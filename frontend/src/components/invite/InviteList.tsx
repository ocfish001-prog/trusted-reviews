'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import { buildInviteUrl, copyToClipboard } from '@/lib/utils';
import type { Invite } from '@/lib/types';
import EmptyState from '@/components/ui/EmptyState';
import { Link2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InviteListProps {
  invites: Invite[];
}

function InviteRow({ invite }: { invite: Invite }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(buildInviteUrl(invite.code));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusVariant = invite.status === 'used' ? 'green' : invite.status === 'expired' ? 'red' : 'amber';

  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-slate-50 last:border-0">
      <div className="min-w-0">
        <p className="font-mono text-sm text-slate-900 font-medium">{invite.code}</p>
        {invite.used_by && (
          <p className="text-xs text-slate-400 mt-0.5">Used by {invite.used_by}</p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Badge variant={statusVariant} className="capitalize">{invite.status}</Badge>
        {invite.status === 'pending' && (
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1 text-xs font-medium transition-colors min-h-[44px] px-2',
              copied ? 'text-green-600' : 'text-amber-600 hover:text-amber-700'
            )}
          >
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Link2 className="w-3.5 h-3.5" /> Copy</>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function InviteList({ invites }: InviteListProps) {
  if (invites.length === 0) {
    return (
      <EmptyState
        icon={<span>🎫</span>}
        title="No invites yet"
        description="Generate your first invite link and share it with a friend."
      />
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50 px-5">
      <p className="py-4 text-sm font-semibold text-slate-700">Your invites</p>
      {invites.map((invite) => (
        <InviteRow key={invite.id} invite={invite} />
      ))}
    </div>
  );
}
