import type { Metadata } from 'next';
import './globals.css';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Todo App',
  description: 'Feature-rich todo manager for the AI SDLC workshop',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">AI SDLC Todo App</h1>
            <p className="text-sm text-slate-400">
              Manage tasks with Singapore-time aware reminders, priorities, and more.
            </p>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-800 pt-4 text-xs text-slate-500">
            Singapore timezone · Better SQLite · WebAuthn ready
          </footer>
        </div>
      </body>
    </html>
  );
}
