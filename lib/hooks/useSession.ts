'use client';

import { useSessionContext } from '@/components/providers/SessionProvider';

export function useSession() {
  return useSessionContext();
}
