'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { createInvite } from '@/lib/api';
import { buildInviteUrl, copyToClipboard } from '@/lib/utils';
import type { Invite } from '@/lib/types';
import { Link2, Check } from 'lucide-react';

interface InviteGeneratorProps {
  onCreated: (invite: Invite) => void;
}

export default function InviteGenerator({ onCreated }: InviteGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newInvite, setNewInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const invite = await createInvite();
      setNewInvite(invite);
      onCreated(invite);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate invite. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!newInvite) return;
    await copyToClipboard(buildInviteUrl(newInvite.code));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Invite a friend</h2>
        <p className="text-sm text-slate-400 mt-1">
          Each invite lets one person join your trusted network.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {newInvite ? (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-mono font-bold text-amber-800">{newInvite.code}</p>
              <p className="text-xs text-amber-600 mt-0.5 truncate">{buildInviteUrl(newInvite.code)}</p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium"
            >
              {copied ? (
                <><Check className="w-4 h-4" /> Copied!</>
              ) : (
                <><Link2 className="w-4 h-4" /> Copy</>
              )}
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setNewInvite(null)}>
            Generate another
          </Button>
        </div>
      ) : (
        <Button onClick={handleGenerate} loading={loading} className="w-full">
          Generate invite link
        </Button>
      )}
    </div>
  );
}
