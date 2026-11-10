// SPDX-License-Identifier: AGPL-3.0-or-later
// Between the SIP engine and the phone's own call screen (spec 13 §1, MB4): CallKit on iPhone,
// Core-Telecom on Android, through expo-callkit-telecom. The system owns the call's buttons and
// the audio session; the engine owns the SIP call. Every user action goes to the system first
// (answerCall, endCall, setMuted …) and comes back as an event, which is where the engine is
// told: that way the lock screen, a headset button and our own buttons all take the same road.
import type { WebRtcCreds } from '@selfphoneng/shared';
import * as Calls from 'expo-callkit-telecom';
import { AppState } from 'react-native';
import { api } from '../api';
import { phone, type CallInfo } from './engine';

const OPTIONS = { hasVideo: false, supportsHolding: true, supportsDTMF: true };

/** SIP call id ↔ the system's call id. One call at a time, but ended calls overlap briefly. */
const nativeOf = new Map<string, string>();
const sipOf = new Map<string, string>();
/** Outgoing: the number the system was asked to call, until it says go. */
let dialing: string | null = null;
/** Incoming, answered on the system screen: what to confirm once the audio is up. */
const answering = new Map<string, string>();
/** Ended from this phone: the engine's "ended" needs no report back to the system. */
const endedHere = new Set<string>();
/** Incoming calls that ended before the system had given them an id. */
const goneEarly = new Set<string>();

function link(sipId: string, nativeId: string) {
  nativeOf.set(sipId, nativeId);
  sipOf.set(nativeId, sipId);
}
function unlink(sipId: string) {
  const n = nativeOf.get(sipId);
  nativeOf.delete(sipId);
  if (n) sipOf.delete(n);
  answering.delete(sipId);
}

/** Good enough for an event id: nothing secret rides on it. */
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });

const quiet = (p: Promise<unknown>) => void p.catch(() => undefined);

let wired = false;
/** Once: the engine's events to the system, and the system's to the engine. */
function wire() {
  if (wired) return;
  wired = true;
  // iPhone: WebRTC's audio starts and stops with the system's audio session, not by itself.
  Calls.setRTCAudioSessionConfiguration(false);

  phone.events = {
    incoming: (c: CallInfo) =>
      void Calls.reportIncomingCall({
        eventId: uuid(),
        serverCallId: c.id,
        caller: { id: c.remote, displayName: c.remoteName ?? c.remote, phoneNumber: c.remote },
        startedAt: new Date().toISOString(),
        ...OPTIONS,
      }).catch(() => phone.hangup(c.id)), // the system refused it (Do Not Disturb, say)
    established: (id) => {
      const n = nativeOf.get(id);
      const requestId = answering.get(id);
      answering.delete(id);
      if (requestId) quiet(Calls.fulfillIncomingCallConnected(requestId));
      else if (n) quiet(Calls.reportOutgoingCallConnected(n));
    },
    ended: (id, wasActive) => {
      const n = nativeOf.get(id);
      unlink(id);
      if (endedHere.delete(id)) return;
      if (n) quiet(Calls.reportCallEnded(n, wasActive ? 'remoteEnded' : 'unanswered'));
      else goneEarly.add(id);
    },
  };

  Calls.addCallSessionAddedListener(({ session }) => {
    const sipId = session.incomingCallEvent?.serverCallId;
    if (!sipId) return;
    if (goneEarly.delete(sipId)) quiet(Calls.reportCallEnded(session.id, 'unanswered'));
    else link(sipId, session.id);
  });

  Calls.addOutgoingCallStartedListener(({ id }) => {
    const number = dialing;
    dialing = null;
    if (!number) return quiet(Calls.reportCallEnded(id, 'failed'));
    phone.call(number).then(
      (sipId) => link(sipId, id),
      () => quiet(Calls.reportCallEnded(id, 'failed')),
    );
  });

  Calls.addCallAnsweredListener(({ id, requestId }) => {
    const sipId = sipOf.get(id);
    if (!sipId) return quiet(Calls.failIncomingCallConnected(id, requestId));
    answering.set(sipId, requestId);
    phone.answer(sipId).catch(() => {
      answering.delete(sipId);
      quiet(Calls.failIncomingCallConnected(id, requestId));
    });
  });

  // Ended or declined here: on the system screen, the lock screen, or our own button.
  Calls.addCallEndedListener(({ id }) => {
    const sipId = sipOf.get(id);
    if (!sipId) return;
    endedHere.add(sipId);
    quiet(phone.hangup(sipId));
  });

  Calls.addSetMutedActionListener(({ id, isMuted }) => {
    const sipId = sipOf.get(id);
    if (sipId) phone.mute(sipId, isMuted);
  });
  Calls.addSetHeldActionListener(({ id, isOnHold }) => {
    const sipId = sipOf.get(id);
    if (sipId) quiet(phone.hold(sipId, isOnHold));
  });
  Calls.addDTMFListener(({ id, digits }) => {
    const sipId = sipOf.get(id);
    if (sipId) for (const d of digits) phone.dtmf(sipId, d);
  });

  // Back in the app after a while: the connection was dropped while it slept.
  AppState.addEventListener('change', (s) => {
    if (s === 'active' && wanted && phone.state.reg !== 'registered' && !phone.state.call)
      void startPhone();
  });
}

let wanted = false;
let iceTimer: ReturnType<typeof setInterval> | undefined;

/** Registers with the PBX (while the app is open: no push yet, spec 13 §1). */
export async function startPhone(): Promise<void> {
  wire();
  wanted = true;
  const creds = await api<WebRtcCreds>('GET', '/api/me/webrtc');
  await phone.start(creds);
  // A timed TURN credential (04 §12) runs out: fetch a new one in time, for the next calls.
  clearInterval(iceTimer);
  if (creds.iceRefreshSeconds)
    iceTimer = setInterval(
      () =>
        void api<WebRtcCreds>('GET', '/api/me/webrtc')
          .then((c) => phone.setIceServers(c.iceServers))
          .catch(() => undefined), // offline for a moment: the next round tries again
      creds.iceRefreshSeconds * 1000,
    );
}

export async function stopPhone(): Promise<void> {
  wanted = false;
  clearInterval(iceTimer);
  await phone.stop();
}

/** The buttons. Each asks the system; the listeners above then tell the engine. */
export const callActions = {
  async dial(number: string): Promise<void> {
    if (phone.state.call) throw new Error('You’re on a call already');
    dialing = number;
    await Calls.startOutgoingCall(
      { id: number, displayName: number, phoneNumber: number },
      OPTIONS,
    );
  },
  answer: (sipId: string) => {
    const n = nativeOf.get(sipId);
    return n ? Calls.answerCall(n) : phone.answer(sipId);
  },
  hangup: (sipId: string) => {
    const n = nativeOf.get(sipId);
    return n ? Calls.endCall(n) : phone.hangup(sipId);
  },
  mute: (sipId: string, on: boolean) => {
    const n = nativeOf.get(sipId);
    return n ? Calls.setMuted(n, on) : Promise.resolve(phone.mute(sipId, on));
  },
  hold: (sipId: string, on: boolean) => {
    const n = nativeOf.get(sipId);
    return n ? Calls.setHeld(n, on) : phone.hold(sipId, on);
  },
  dtmf: (sipId: string, digit: string) => {
    const n = nativeOf.get(sipId);
    return n ? Calls.playDTMF(n, digit) : Promise.resolve(phone.dtmf(sipId, digit));
  },
  /** The loudspeaker, or back to the earpiece (or the headset in use). */
  speaker: (on: boolean) => Calls.setAudioSessionPortOverride(on),
};
