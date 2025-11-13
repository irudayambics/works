'use client';

import { Suspense, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useRouter, useSearchParams } from 'next/navigation';

type AuthMode = 'login' | 'register';

interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

interface RegistrationOptionsResponse {
  challenge: string;
}

interface AuthenticationOptionsResponse {
  challenge: string;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
          <p>Loading authentication flow…</p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params?.get('next') ?? '/';

  const clearMessage = () => setMessage(null);

  const handleRegister = async () => {
    clearMessage();
    if (!username.trim() || !displayName.trim()) {
      setMessage('Username and display name are required');
      return;
    }

    setIsLoading(true);
    try {
      const registerRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName }),
      });
      const registerOptions = (await registerRes.json()) as ApiResult<RegistrationOptionsResponse>;
      if (!registerRes.ok || !registerOptions.ok) {
        throw new Error(registerOptions.error?.message ?? 'Failed to request registration options');
      }

      const attestation = await startRegistration(registerOptions.data as any);
      const verifyRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          displayName,
          challenge: registerOptions.data!.challenge,
          response: attestation,
        }),
      });
      const verifyJson = (await verifyRes.json()) as ApiResult<{ token: string }>;
      if (!verifyRes.ok || !verifyJson.ok) {
        throw new Error(verifyJson.error?.message ?? 'Registration verification failed');
      }

      router.replace(nextPath);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to register');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    clearMessage();
    if (!username.trim()) {
      setMessage('Username is required');
      return;
    }

    setIsLoading(true);
    try {
      const optionsRes = await fetch('/api/auth/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const optionsJson = (await optionsRes.json()) as ApiResult<AuthenticationOptionsResponse>;
      if (!optionsRes.ok || !optionsJson.ok) {
        throw new Error(optionsJson.error?.message ?? 'Failed to request assertion options');
      }

      const assertion = await startAuthentication(optionsJson.data as any);
      const verifyRes = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          challenge: optionsJson.data!.challenge,
          response: assertion,
        }),
      });
      const verifyJson = (await verifyRes.json()) as ApiResult<{ token: string }>;
      if (!verifyRes.ok || !verifyJson.ok) {
        throw new Error(verifyJson.error?.message ?? 'Authentication failed');
      }

      router.replace(nextPath);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to authenticate');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-100">Access your workspace</h2>
        <p className="text-sm text-slate-400">
          Authenticate with your passkey to manage todos, reminders, templates, and more.
        </p>
      </header>

      <div className="flex items-center gap-2 rounded-full bg-slate-800/60 p-1 text-xs font-semibold uppercase tracking-wide">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex-1 rounded-full px-3 py-2 transition ${mode === 'login' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`flex-1 rounded-full px-3 py-2 transition ${mode === 'register' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Register
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-200" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="your-name"
            disabled={isLoading}
          />
        </div>

        {mode === 'register' && (
          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your Preferred Name"
              disabled={isLoading}
            />
          </div>
        )}

        {message && <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{message}</p>}

        <button
          type="button"
          onClick={mode === 'login' ? handleLogin : handleRegister}
          className="w-full rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
        >
          {isLoading ? 'Processing…' : mode === 'login' ? 'Authenticate' : 'Register passkey'}
        </button>
      </div>
    </div>
  );
}
