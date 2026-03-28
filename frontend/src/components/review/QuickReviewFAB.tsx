'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import QuickReview from './QuickReview';

export default function QuickReviewFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB — sits above 56px mobile nav */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick review"
        className="
          fixed bottom-[72px] right-4 z-40
          flex items-center gap-2
          h-12 pl-3 pr-4
          rounded-full
          bg-slate-900 text-white
          shadow-[0_4px_24px_rgba(0,0,0,0.22)]
          active:scale-95
          transition-transform duration-150
          min-w-[44px] min-h-[44px]
        "
      >
        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-400 flex-shrink-0">
          <Zap className="w-3.5 h-3.5 text-slate-900 fill-slate-900" />
        </span>
        <span className="text-sm font-semibold tracking-tight whitespace-nowrap">
          Quick review
        </span>
      </button>

      {open && <QuickReview onClose={() => setOpen(false)} />}
    </>
  );
}
