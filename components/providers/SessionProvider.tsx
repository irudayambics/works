'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface SessionValue {
  user: { userId: string; username: string } | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

async function fetchSession() {
  const response = await fetch('/api/auth/me', { cache: 'no-store' });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Unable to load session');
  }
  const json = await response.json();
  if (!json.ok) {
    return null;
  }
  return json.data as { userId: string; username: string };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ userId: string; username: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const session = await fetchSession();
      setUser(session);
      if (!session && pathname !== '/login') {
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
        router.replace(`/login${next}`);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, loading, refresh }),
    [user, loading, refresh]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSessionContext must be used within SessionProvider');
  }
  return value;
}
