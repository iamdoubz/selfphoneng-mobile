// SPDX-License-Identifier: AGPL-3.0-or-later
// The queries more than one screen uses (spec 13 §4).
import type {
  AboutDto,
  AuthUser,
  ContactBookDto,
  ContactDto,
  ListResponse,
  MeDto,
  MeUpdate,
  VoicemailDto,
} from '@selfphoneng/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from './api';
import { useSession } from './session';
import { numberKey } from './ui/format';

/** Not before pairing: every call needs the device token. */
const usePaired = () => !!useSession((s) => s.session);

export const useMe = () =>
  useQuery({ queryKey: ['me'], queryFn: () => api<MeDto>('GET', '/api/me'), enabled: usePaired() });

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MeUpdate) => api<MeDto>('PATCH', '/api/me', body),
    onSuccess: (me) => qc.setQueryData(['me'], me),
  });
}

export const useContacts = () =>
  useQuery({
    queryKey: ['contacts'],
    queryFn: () => api<ContactBookDto>('GET', '/api/me/contacts'),
    staleTime: 5 * 60_000,
    enabled: usePaired(),
  });

/** A number's contact from my books (its name and photo), for calls the PBX only knows by number. */
export function useContactOf(): (n: string | null | undefined) => ContactDto | null {
  const { data } = useContacts();
  return useMemo(() => {
    const map = new Map<string, ContactDto>();
    for (const c of data?.items ?? [])
      for (const { number } of c.numbers) map.set(numberKey(number), c);
    return (n) => (n ? (map.get(numberKey(n)) ?? null) : null);
  }, [data]);
}

export function useNames(): (n: string | null | undefined) => string | null {
  const of = useContactOf();
  return (n) => of(n)?.name ?? null;
}

/** Signed-in me as the web sees me: here for my photo, which MeDto doesn't carry. */
export const useAuthMe = () =>
  useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api<{ user: AuthUser }>('GET', '/api/auth/me').then((r) => r.user),
    enabled: usePaired(),
  });

/** The PBX's version (public, 08 §4). */
export const useAbout = () =>
  useQuery({
    queryKey: ['about'],
    queryFn: () => api<AboutDto>('GET', '/api/about'),
    staleTime: Infinity,
    enabled: usePaired(),
  });

export const useVoicemail = () =>
  useQuery({
    queryKey: ['voicemail'],
    queryFn: () => api<ListResponse<VoicemailDto>>('GET', '/api/me/voicemail'),
    refetchInterval: 60_000,
    enabled: usePaired(),
  });

export const unheard = (v: VoicemailDto) => v.folder !== 'Old';
