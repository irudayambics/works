import type { Metadata } from 'next';
import './globals.css';
import { ReactNode } from 'react';

import { SessionProvider } from '@/components/providers/SessionProvider';
import { AppHeader } from '@/components/layout/AppHeader';

export const metadata: Metadata = {
  title: 'Todo App',
  description: 'Feature-rich todo manager for the AI SDLC workshop',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <SessionProvider>
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
            <AppHeader />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-slate-800 pt-4 text-xs text-slate-500">
              Singapore timezone · Better SQLite · WebAuthn ready
            </footer>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
