'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { login, requestMagicLink } from '@/lib/api';
import { setToken, setStoredUser } from '@/lib/auth';

type Mode = 'password' | 'magic';

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicSent, setMagicSent] = useState(false);

  const handlePasswordLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      const tokens = await login({ email, password });
      setToken(tokens.access_token);
      // Store the user object returned by the login endpoint so useAuth
      // can hydrate from localStorage without a /users/me call.
      if (tokens.user) {
        setStoredUser(tokens.user);
      }
      router.push('/feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      await requestMagicLink(email);
      setMagicSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send magic link. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (mode === 'password') handlePasswordLogin();
    else handleMagicLink();
  };

  if (magicSent) {
    return (
      <div className="text-center space-y-3 py-6">
        <div className="text-4xl">✉️</div>
        <h2 className="text-xl font-semibold text-slate-900">Check your inbox</h2>
        <p className="text-sm text-slate-500">
          We sent a magic link to <strong>{email}</strong>.<br />
          Click it to sign in — no password needed.
        </p>
        <button
          onClick={() => { setMagicSent(false); setMode('password'); }}
          className="text-sm text-amber-600 hover:text-amber-700 font-medium"
        >
          Use password instead
        </button>
      </div>
    );
  }

  return (
    <div data-testid="login-form" className="space-y-6">
      {/* Mode toggle */}
      <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
        {(['password', 'magic'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === m
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {m === 'password' ? 'Password' : '✨ Magic link'}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <Input
          data-testid="email-input"
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />

        {mode === 'password' && (
          <Input
            data-testid="password-input"
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        )}

        <Button data-testid="login-submit" type="button" onClick={handleSubmit} className="w-full" loading={loading}>
          {mode === 'password' ? 'Sign in' : 'Send magic link'}
        </Button>
        <span data-testid="react-hydrated" style={{ display: 'none' }} />
      </div>

      <p className="text-sm text-center text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-amber-600 hover:text-amber-700 font-medium">
          Sign up with invite
        </Link>
      </p>
    </div>
  );
}
