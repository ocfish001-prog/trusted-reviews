'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { aiAssist } from '@/lib/api';

type AssistAction = 'polish' | 'structure' | 'add_detail';

interface AIAssistPanelProps {
  body: string;
  onApply: (result: string) => void;
}

const ACTIONS: { action: AssistAction; label: string; description: string }[] = [
  { action: 'polish', label: 'Polish', description: 'Fix grammar and flow' },
  { action: 'structure', label: 'Structure', description: 'Add clear paragraphs' },
  { action: 'add_detail', label: 'Add Detail', description: 'Expand with specifics' },
];

export default function AIAssistPanel({ body, onApply }: AIAssistPanelProps) {
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState<AssistAction | null>(null);
  const [error, setError] = useState('');
  const [activeAction, setActiveAction] = useState<AssistAction | null>(null);

  const handleAction = async (action: AssistAction) => {
    if (!body.trim()) {
      setError('Write something first!');
      return;
    }
    setLoading(action);
    setError('');
    setPreview('');
    try {
      const { result } = await aiAssist({ body, action });
      setPreview(result);
      setActiveAction(action);
    } catch {
      setError('AI assist is unavailable right now. Try again later.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-700">AI Assist</span>
        <span className="text-xs text-amber-500 ml-auto">Powered by your words</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {ACTIONS.map(({ action, label, description }) => (
          <button
            key={action}
            onClick={() => handleAction(action)}
            disabled={!!loading}
            className="flex flex-col items-start px-3 py-2 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 transition-colors text-left disabled:opacity-50 min-h-[44px]"
            title={description}
          >
            <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
              {loading === action && (
                <RefreshCw className="w-3 h-3 animate-spin" />
              )}
              {label}
            </span>
            <span className="text-[10px] text-slate-400">{description}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {preview && (
        <div className="space-y-2">
          <div className="bg-white rounded-lg border border-amber-200 p-3 text-sm text-slate-700 leading-relaxed max-h-40 overflow-y-auto">
            {preview}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => { onApply(preview); setPreview(''); setActiveAction(null); }}
              className="text-xs"
            >
              Apply {activeAction && ACTIONS.find(a => a.action === activeAction)?.label}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setPreview(''); setActiveAction(null); }}
              className="text-xs"
            >
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
