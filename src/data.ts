// SPDX-License-Identifier: AGPL-3.0-or-later
// The queries more than one screen uses (spec 13 §4).
import type {
  ContactBookDto,
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

/** A number's name from my books, for calls the PBX only knows by number. */
export function useNames(): (n: string | null | undefined) => string | null {
  const { data } = useContacts();
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const c of data?.items ?? [])
      for (const { number } of c.numbers) map.set(numberKey(number), c.name);
    return (n) => (n ? (map.get(numberKey(n)) ?? null) : null);
  }, [data]);
}

export const useVoicemail = () =>
  useQuery({
    queryKey: ['voicemail'],
    queryFn: () => api<ListResponse<VoicemailDto>>('GET', '/api/me/voicemail'),
    refetchInterval: 60_000,
    enabled: usePaired(),
  });

export const unheard = (v: VoicemailDto) => v.folder !== 'Old';
