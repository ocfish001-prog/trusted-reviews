'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getTrustLabel, getTrustTooltip } from '@/lib/utils';

interface TrustBadgeProps {
  distance?: number;
  reviewerName?: string;
  viaFriend?: string;
  className?: string;
  showTooltip?: boolean;
}

export default function TrustBadge({
  distance,
  reviewerName,
  viaFriend,
  className,
  showTooltip = true,
}: TrustBadgeProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const label = getTrustLabel(distance);
  const tooltip = getTrustTooltip(distance, reviewerName, viaFriend);

  const styles = {
    1: {
      container: 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200/80',
      dot: 'bg-emerald-400',
      glow: 'shadow-[0_0_8px_rgba(52,211,153,0.3)]',
    },
    2: {
      container: 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border border-amber-200/80',
      dot: 'bg-amber-400',
      glow: '',
    },
  } as const;

  const s = distance === 1 ? styles[1] : distance === 2 ? styles[2] : null;

  if (!s) {
    // Extended network — simpler treatment
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
          'bg-slate-50 text-slate-500 border border-slate-200/60',
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
        {label}
      </span>
    );
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all',
          s.container,
          s.glow,
          showTooltip && 'cursor-help',
          className
        )}
        onClick={() => showTooltip && setTooltipVisible((v) => !v)}
        onMouseEnter={() => showTooltip && setTooltipVisible(true)}
        onMouseLeave={() => showTooltip && setTooltipVisible(false)}
        aria-label={`Trust distance: ${label}. ${tooltip}`}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)} />
        {label}
        {showTooltip && (
          <span className="text-[10px] opacity-50 ml-0.5">?</span>
        )}
      </button>

      {/* Tooltip */}
      {tooltipVisible && tooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          role="tooltip"
        >
          <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
            {tooltip}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}
