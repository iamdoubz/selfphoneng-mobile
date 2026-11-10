// SPDX-License-Identifier: AGPL-3.0-or-later
// The phone's softphone (spec 13 §1, MB4): SIP.js over WebSocket to Asterisk with
// react-native-webrtc, on the extension's -web endpoint. Ported from the web's SoftphoneEngine:
// one call at a time here (the native call screen handles one), no transfers, and no audio
// elements (the phone plays the far side by itself). No React in here; native.ts connects it to
// the system call screen, Phone.tsx reads it through subscribe()/state.
import { registerGlobals } from 'react-native-webrtc';
import {
  Invitation,
  Inviter,
  Registerer,
  RegistererState,
  SessionState,
  UserAgent,
  Web,
  type Session,
} from 'sip.js';
import type { WebRtcCreds } from '@selfphoneng/shared';

// SIP.js's WebRTC code looks for RTCPeerConnection, MediaStream and navigator.mediaDevices.
registerGlobals();

export type RegState = 'off' | 'connecting' | 'registered' | 'error';

export type CallInfo = {
  id: string;
  direction: 'in' | 'out';
  /** The other side's number (SIP user part). */
  remote: string;
  remoteName: string | null;
  /** incoming: ringing here; calling: ringing there; active: talking. */
  state: 'incoming' | 'calling' | 'active';
  answeredAt: number | null;
  muted: boolean;
  held: boolean;
};

export type EngineState = { reg: RegState; error: string | null; call: CallInfo | null };

/** What native.ts hears about, to keep the system call screen in step. */
export type EngineEvents = {
  incoming(call: CallInfo): void;
  /** The call is up: both sides can talk. */
  established(id: string): void;
  /** Over, for any reason. `wasActive`: it had been answered. */
  ended(id: string, wasActive: boolean): void;
};

const BACKOFF_S = [2, 4, 8, 16, 30];

export class PhoneEngine {
  /** The calls' RTCPeerConnection settings; `iceServers` is swapped in place (setIceServers). */
  private readonly pc: { iceServers: WebRtcCreds['iceServers'] } = { iceServers: [] };
  state: EngineState = { reg: 'off', error: null, call: null };
  events: Partial<EngineEvents> = {};
  private listeners = new Set<() => void>();
  private ua: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private host = '';
  private session: Session | null = null;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private attempt = 0;
  private stopped = true;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  private set(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  private patchCall(patch: Partial<CallInfo>) {
    if (this.state.call) this.set({ call: { ...this.state.call, ...patch } });
  }

  /** New ICE servers (a timed TURN credential renewed, 04 §12) for the calls that follow. */
  setIceServers(iceServers: WebRtcCreds['iceServers']) {
    this.pc.iceServers = iceServers;
  }

  async start(creds: WebRtcCreds): Promise<void> {
    await this.stop();
    this.setIceServers(creds.iceServers);
    this.stopped = false;
    // "sip:101-web@pbx.example.com" → the host (React Native's URL can't be trusted with sip:).
    this.host = /@([^;>:]+)/.exec(creds.sipUri)?.[1] ?? '';
    this.set({ reg: 'connecting', error: null });
    const ua = new UserAgent({
      uri: UserAgent.makeURI(creds.sipUri),
      transportOptions: { server: creds.wsUrl },
      authorizationUsername: creds.authUser,
      authorizationPassword: creds.password,
      displayName: creds.displayName,
      contactParams: { transport: creds.wsUrl.startsWith('wss:') ? 'wss' : 'ws' },
      // This object is read again for every call, so setIceServers reaches the next one.
      sessionDescriptionHandlerFactoryOptions: { peerConnectionConfiguration: this.pc },
      logLevel: 'warn',
      delegate: {
        onInvite: (inv) => this.incoming(inv),
        onDisconnect: (err) => {
          if (err && !this.stopped) this.reconnect();
        },
      },
    });
    this.ua = ua;
    const registerer = new Registerer(ua, { expires: 300 });
    this.registerer = registerer;
    registerer.stateChange.addListener((s) => {
      if (this.stopped) return;
      if (s === RegistererState.Registered) {
        this.attempt = 0;
        this.set({ reg: 'registered', error: null });
      } else if (this.state.reg === 'registered') this.set({ reg: 'connecting' });
    });
    try {
      await ua.start();
      await this.register();
    } catch (e) {
      this.set({ reg: 'error', error: (e as Error).message });
      this.reconnect();
    }
  }

  private register() {
    return this.registerer!.register({
      requestDelegate: {
        onReject: (res) =>
          this.set({
            reg: 'error',
            error: `Registration refused (${res.message.statusCode} ${res.message.reasonPhrase})`,
          }),
      },
    });
  }

  /** Transport lost: reconnect with backoff 2 → 30 s, then register again. */
  private reconnect() {
    clearTimeout(this.retry);
    if (this.stopped || !this.ua) return;
    if (this.state.reg !== 'error') this.set({ reg: 'connecting' });
    const s = BACKOFF_S[Math.min(this.attempt++, BACKOFF_S.length - 1)]!;
    this.retry = setTimeout(() => {
      if (this.stopped || !this.ua) return;
      this.ua
        .reconnect()
        .then(() => this.register())
        .catch(() => this.reconnect());
    }, s * 1000);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.retry);
    if (this.state.call) await this.hangup(this.state.call.id).catch(() => undefined);
    await this.registerer?.unregister().catch(() => undefined);
    await this.ua?.stop().catch(() => undefined);
    this.ua = null;
    this.registerer = null;
    this.set({ reg: 'off', error: null, call: null });
  }

  private static readonly AUDIO = { constraints: { audio: true, video: false } };

  /** Returns the new call's id. */
  async call(number: string): Promise<string> {
    if (!this.ua) throw new Error('The phone isn’t connected');
    if (this.session) throw new Error('You’re on a call already');
    const uri = UserAgent.makeURI(`sip:${encodeURIComponent(number)}@${this.host}`);
    if (!uri) throw new Error(`Can’t call ${number}`);
    const inviter = new Inviter(this.ua, uri, {
      sessionDescriptionHandlerOptions: PhoneEngine.AUDIO,
    });
    this.track(inviter, 'out', number, null);
    await inviter.invite();
    return inviter.id;
  }

  private incoming(inv: Invitation) {
    if (this.session) {
      void inv.reject({ statusCode: 486 }); // busy: one call at a time
      return;
    }
    this.track(
      inv,
      'in',
      inv.remoteIdentity.uri.user ?? '',
      inv.remoteIdentity.displayName || null,
    );
    this.events.incoming?.(this.state.call!);
  }

  private mine(id: string): Session | null {
    return this.session?.id === id ? this.session : null;
  }

  async answer(id: string): Promise<void> {
    const s = this.mine(id);
    if (s instanceof Invitation)
      await s.accept({ sessionDescriptionHandlerOptions: PhoneEngine.AUDIO });
  }

  /** bye() once talking; before that, cancel (outgoing) or reject (incoming). */
  async hangup(id: string): Promise<void> {
    const s = this.mine(id);
    if (!s) return;
    if (s.state === SessionState.Established) await s.bye();
    else if (s instanceof Inviter) await s.cancel();
    else if (s instanceof Invitation) await s.reject({ statusCode: 486 });
  }

  private sdh(id: string) {
    const sdh = this.mine(id)?.sessionDescriptionHandler;
    return sdh instanceof Web.SessionDescriptionHandler ? sdh : null;
  }

  /** re-INVITE with a=sendonly (hold) or a=sendrecv (resume). */
  async hold(id: string, on: boolean): Promise<void> {
    const s = this.mine(id);
    const info = this.state.call;
    if (!s || !info || s.state !== SessionState.Established || info.held === on) return;
    s.sessionDescriptionHandlerOptionsReInvite = {
      ...s.sessionDescriptionHandlerOptionsReInvite,
      hold: on,
    } as Web.SessionDescriptionHandlerOptions;
    await s.invite();
    this.sdh(id)?.enableReceiverTracks(!on);
    this.sdh(id)?.enableSenderTracks(!on && !info.muted);
    this.patchCall({ held: on });
  }

  mute(id: string, on: boolean): void {
    const info = this.state.call;
    if (!this.mine(id) || !info) return;
    this.sdh(id)?.enableSenderTracks(!on && !info.held);
    this.patchCall({ muted: on });
  }

  /** RFC 4733 through the RTCDTMFSender; SIP INFO when there is none. */
  dtmf(id: string, digit: string): void {
    if (this.sdh(id)?.sendDtmf(digit)) return;
    void this.mine(id)
      ?.info({
        requestOptions: {
          body: {
            contentDisposition: 'render',
            contentType: 'application/dtmf-relay',
            content: `Signal=${digit}\r\nDuration=160`,
          },
        },
      })
      .catch(() => undefined);
  }

  private track(session: Session, direction: 'in' | 'out', remote: string, name: string | null) {
    const id = session.id;
    this.session = session;
    this.set({
      call: {
        id,
        direction,
        remote,
        remoteName: name,
        state: direction === 'in' ? 'incoming' : 'calling',
        answeredAt: null,
        muted: false,
        held: false,
      },
    });
    session.stateChange.addListener((s) => {
      if (this.session !== session) return;
      if (s === SessionState.Established && this.state.call?.state !== 'active') {
        this.patchCall({ state: 'active', answeredAt: Date.now() });
        this.events.established?.(id);
      }
      if (s === SessionState.Terminated) {
        const wasActive = this.state.call?.state === 'active';
        this.session = null;
        this.set({ call: null });
        this.events.ended?.(id, wasActive);
      }
    });
  }
}

/** One engine for the app. */
export const phone = new PhoneEngine();
