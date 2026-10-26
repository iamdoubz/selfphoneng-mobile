// SPDX-License-Identifier: AGPL-3.0-or-later
// The PBX's REST API (spec 04 §7, 13 §4) with this phone's device token.
import type {
  ListResponse,
  MobileDeviceDto,
  MobilePair,
  MobilePairResult,
} from '@selfphoneng/shared';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { useSession } from './session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  server: string,
  method: string,
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<T> {
  const r = await fetch(server + path, {
    method,
    headers: body === undefined ? headers : { ...headers, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok)
    throw new ApiError(
      r.status,
      data?.error?.code ?? 'error',
      data?.error?.message ?? `The server answered ${r.status}`,
    );
  return data as T;
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { session, set } = useSession.getState();
  if (!session) throw new ApiError(401, 'unauthorized', 'Not paired');
  try {
    return await request<T>(session.server, method, path, body, {
      authorization: `Bearer ${session.token}`,
    });
  } catch (e) {
    // Removed on the web, a password change, or the user disabled: back to pairing.
    if (e instanceof ApiError && e.status === 401) await set(null);
    throw e;
  }
}

/** "pbx.example.com" or "https://pbx.example.com/" → "https://pbx.example.com". */
export function serverUrl(input: string): string {
  const s = input.trim().replace(/\/+$/, '');
  if (/^http:\/\//i.test(s)) throw new Error('The server must use https://');
  return /^https:\/\//i.test(s) ? s : `https://${s}`;
}

export async function pair(server: string, code: string): Promise<void> {
  const url = serverUrl(server);
  const body: MobilePair = {
    code,
    name: Device.modelName ?? (Platform.OS === 'ios' ? 'iPhone' : 'Android phone'),
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  };
  // No token yet: the CSRF header instead, like the web (spec 04 §2.2).
  const r = await request<MobilePairResult>(url, 'POST', '/api/mobile/pair', body, {
    'x-requested-with': 'selfphoneng',
  });
  await useSession.getState().set({ server: url, token: r.token, ...r.user });
}

/** Removes this phone on the server too, so it leaves the list on the web. */
export async function signOut(): Promise<void> {
  try {
    const { items } = await api<ListResponse<MobileDeviceDto>>('GET', '/api/me/mobile-devices');
    const me = items.find((d) => d.current);
    if (me) await api('DELETE', `/api/me/mobile-devices/${me.id}`);
  } finally {
    await useSession.getState().set(null);
  }
}
