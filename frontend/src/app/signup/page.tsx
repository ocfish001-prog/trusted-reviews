import { Suspense } from 'react';
import SignupForm from '@/components/auth/SignupForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create account — Trusted Reviews',
};

export default function SignupPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-slate-900">Join the network</h1>
          <p className="text-sm text-slate-400 mt-2">You&apos;ll need an invite from someone already inside.</p>
        </div>

        <Suspense fallback={<div className="h-64 flex items-center justify-center text-slate-400 text-sm">Loading…</div>}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
