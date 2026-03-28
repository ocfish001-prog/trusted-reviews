'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Star, X, ChevronRight } from 'lucide-react';
import { createReview, searchBusinesses } from '@/lib/api';
import type { Business } from '@/lib/types';
import { cn } from '@/lib/utils';

interface QuickReviewProps {
  onClose: () => void;
}

const CHAR_LIMIT = 280;

export default function QuickReview({ onClose }: QuickReviewProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Slide-in animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = useCallback(() => {
    setMounted(false);
    setTimeout(onClose, 210);
  }, [onClose]);

  // Swipe-down-to-close
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - startYRef.current;
    if (delta > 60) handleClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) { setError('Pick a business first.'); return; }
    if (rating === 0) { setError('Tap a star to rate.'); return; }

    setLoading(true);
    setError('');
    try {
      await createReview({
        business_id: business.id,
        rating,
        body: text.trim() || `${['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing'][rating]} — quick take.`,
        visibility: '2hop',
      });
      setSuccess(true);
      setTimeout(handleClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity duration-200',
          mounted ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleClose}
        aria-hidden
      />

      {/* Bottom sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-white rounded-t-2xl',
          'pb-[env(safe-area-inset-bottom,16px)]',
          'shadow-[0_-8px_40px_rgba(0,0,0,0.12)]',
          'transition-transform duration-200',
          mounted ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-1 pb-4">
          <h2 className="text-base font-bold text-slate-900">Quick review</h2>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 min-w-[44px] min-h-[44px]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="px-5 pb-6 flex flex-col items-center gap-2 py-8">
            <div className="text-3xl">🎉</div>
            <p className="text-sm font-semibold text-slate-900">Review posted!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 space-y-4 pb-6">
            {error && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            {/* Business search */}
            <BusinessSearchInline value={business} onChange={setBusiness} />

            {/* Star rating */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                >
                  <Star
                    className={cn(
                      'w-8 h-8 transition-all',
                      star <= (hoverRating || rating)
                        ? 'fill-amber-400 text-amber-400 scale-110'
                        : 'fill-slate-100 text-slate-200'
                    )}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="text-sm text-slate-400 ml-1">
                  {['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing'][rating]}
                </span>
              )}
            </div>

            {/* Quick take */}
            <div className="relative">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, CHAR_LIMIT))}
                placeholder="Quick take..."
                className="w-full h-12 rounded-xl border border-slate-200 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent pr-14"
              />
              <span
                className={cn(
                  'absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums',
                  text.length > CHAR_LIMIT * 0.9 ? 'text-amber-500' : 'text-slate-300'
                )}
              >
                {CHAR_LIMIT - text.length}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={loading || !business || rating === 0}
                className={cn(
                  'flex-1 h-12 rounded-xl text-sm font-semibold transition-all',
                  'bg-slate-900 text-white',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  'active:scale-[0.98]'
                )}
              >
                {loading ? 'Posting…' : 'Post'}
              </button>

              {business && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    router.push(`/write?business=${business.id}`);
                  }}
                  className="flex items-center gap-1 text-sm text-amber-600 font-medium whitespace-nowrap min-h-[44px] px-2"
                >
                  Add details
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </>
  );
}

// ─── Inline business search (compact) ─────────────────────────────────────────

interface BusinessSearchInlineProps {
  value: Business | null;
  onChange: (b: Business | null) => void;
}

function BusinessSearchInline({ value, onChange }: BusinessSearchInlineProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await searchBusinesses(q);
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 300);
  };

  const select = (b: Business) => {
    onChange(b);
    setQuery(b.name);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={value ? value.name : query}
          onChange={value ? undefined : handleInput}
          readOnly={!!value}
          placeholder="Search for a place..."
          className={cn(
            'w-full h-12 rounded-xl border px-4 text-sm pr-10',
            'text-slate-900 placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent',
            value ? 'border-amber-300 bg-amber-50 font-medium' : 'border-slate-200'
          )}
        />
        {(value || query) && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 min-w-[24px] min-h-[24px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-48 overflow-y-auto">
          {results.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => select(b)}
                className="w-full text-left px-4 py-3 hover:bg-amber-50 text-sm transition-colors min-h-[44px]"
              >
                <p className="font-medium text-slate-900">{b.name}</p>
                {b.address && <p className="text-xs text-slate-400 mt-0.5">{b.address}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 px-4 py-3">
          <p className="text-sm text-slate-400">No places found for &quot;{query}&quot;</p>
        </div>
      )}
    </div>
  );
}
