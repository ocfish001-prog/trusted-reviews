'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { signup } from '@/lib/api';
import { setToken, setStoredUser } from '@/lib/auth';

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteFromUrl = searchParams.get('invite') || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(inviteFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (inviteFromUrl) setInviteCode(inviteFromUrl);
  }, [inviteFromUrl]);

  const hasInvite = inviteCode.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasInvite) {
      setError('An invite code is required to join.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await signup({ name, email, password, invite_code: inviteCode });
      setStoredUser(result.user);
      // Use token from signup response directly — no need for separate login
      setToken(result.token);
      router.push('/feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account. Check your invite code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!hasInvite && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-sm text-amber-800 font-medium">🔒 Invite required</p>
          <p className="text-xs text-amber-600 mt-1">
            Trusted Reviews is invite-only. Ask a friend for their code, or enter it below.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full name"
          type="text"
          placeholder="Jane Smith"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          placeholder="Min 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Input
          label="Invite code"
          type="text"
          placeholder="XXXX-XXXX"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          hint="Get this from a friend who's already on Trusted Reviews"
          required
        />

        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>

      <p className="text-sm text-center text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="text-amber-600 hover:text-amber-700 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
