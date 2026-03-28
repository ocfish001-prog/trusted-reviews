'use client';

import Link from 'next/link';
import { X, Star, MapPin, ChevronRight } from 'lucide-react';
import TrustBadge from '@/components/ui/TrustBadge';
import type { MapBusiness } from '@/lib/api';
import { cn } from '@/lib/utils';

interface BusinessCardProps {
  business: MapBusiness | null;
  onClose: () => void;
}

function MiniStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'w-3.5 h-3.5',
            s <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'
          )}
        />
      ))}
      <span className="text-xs text-slate-500 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function BusinessCard({ business, onClose }: BusinessCardProps) {
  const isVisible = business !== null;

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        className={cn(
          'fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 md:hidden',
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-up card */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 md:absolute md:bottom-auto md:top-4 md:left-4 md:right-auto md:max-w-sm',
          'bg-white rounded-t-2xl md:rounded-2xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          isVisible ? 'translate-y-0' : 'translate-y-full md:translate-y-0 md:opacity-0 md:pointer-events-none',
          !isVisible && 'md:opacity-0 md:pointer-events-none'
        )}
        role="dialog"
        aria-modal="true"
        aria-label={business?.name ?? 'Business details'}
      >
        {business && (
          <div className="p-5 space-y-4">
            {/* Drag handle (mobile) */}
            <div className="flex justify-center md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900 text-lg leading-tight truncate">
                  {business.name}
                </h3>
                {business.category && (
                  <p className="text-xs text-slate-500 mt-0.5 font-medium uppercase tracking-wide">
                    {business.category}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Address */}
            {business.address && (
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <span className="truncate">{business.address}</span>
              </p>
            )}

            {/* Rating row */}
            <div className="flex items-center justify-between">
              <MiniStars rating={business.avg_rating} />
              <TrustBadge
                distance={business.trust_distance}
                viaFriend={business.via_friend}
                showTooltip={false}
              />
            </div>

            {/* Review snippet */}
            {business.top_review_snippet && (
              <div className="bg-slate-50 rounded-xl p-3.5">
                <p className="text-sm text-slate-600 leading-relaxed italic line-clamp-3">
                  &ldquo;{business.top_review_snippet}&rdquo;
                </p>
              </div>
            )}

            {/* CTA */}
            <Link
              href={`/business/${business.id}`}
              className="flex items-center justify-between w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-4 py-3 rounded-xl transition-colors min-h-[44px]"
            >
              <span>View all reviews</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
