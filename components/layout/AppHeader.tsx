'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSession } from '@/lib/hooks/useSession';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/calendar', label: 'Calendar' },
];

export function AppHeader() {
  const { user, loading, refresh } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      await refresh();
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="flex flex-col gap-4 border-b border-slate-800 pb-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">AI SDLC Todo App</h1>
          <p className="text-sm text-slate-400">Singapore-time aware planning with passkey security.</p>
        </div>
        <nav className="ml-auto flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/60 p-1 text-sm">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 transition ${
                  isActive
                    ? 'bg-sky-500 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
        {loading ? (
          <span>Checking session…</span>
        ) : user ? (
          <>
            <span className="truncate">Signed in as <strong className="font-semibold text-slate-100">{user.username}</strong></span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-md border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? 'Signing out…' : 'Logout'}
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
