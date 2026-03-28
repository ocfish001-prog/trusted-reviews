'use client';

import { useEffect, useState } from 'react';
import InviteGenerator from '@/components/invite/InviteGenerator';
import InviteList from '@/components/invite/InviteList';
import { Skeleton } from '@/components/ui/Skeleton';
import { getInvites } from '@/lib/api';
import type { Invite } from '@/lib/types';

export default function InvitePage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getInvites()
      .then(setInvites)
      .catch(() => setError('Could not load invites.'))
      .finally(() => setLoading(false));
  }, []);

  const handleInviteCreated = (invite: Invite) => {
    setInvites((prev) => [invite, ...prev]);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invite friends</h1>
        <p className="text-sm text-slate-400 mt-1">
          Grow your trusted network — one friend at a time.
        </p>
      </div>

      <InviteGenerator onCreated={handleInviteCreated} />

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : (
        <InviteList invites={invites} />
      )}
    </div>
  );
}
