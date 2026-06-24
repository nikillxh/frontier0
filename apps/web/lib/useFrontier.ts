'use client';

import { useQuery } from '@tanstack/react-query';
import type { StateResponse } from '@/lib/types';

async function fetchState(): Promise<StateResponse> {
  const res = await fetch('/api/state', { cache: 'no-store' });
  if (!res.ok) throw new Error(`state ${res.status}`);
  return res.json();
}

export function useFrontier() {
  return useQuery({
    queryKey: ['frontier-state'],
    queryFn: fetchState,
    refetchInterval: 5000,
  });
}
