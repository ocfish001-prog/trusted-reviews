'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import BusinessHeader from '@/components/business/BusinessHeader';
import NetworkStats from '@/components/business/NetworkStats';
import ReviewCard from '@/components/feed/ReviewCard';
import TrustBadge from '@/components/ui/TrustBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton, ReviewCardSkeleton } from '@/components/ui/Skeleton';
import { getBusiness, getBusinessReviews } from '@/lib/api';
import type { Business, Review } from '@/lib/types';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

function avg(reviews: Review[]): number {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

export default function BusinessPage() {
  const { id } = useParams<{ id: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [networkStats, setNetworkStats] = useState({ friend_count: 0, hop2_count: 0, avg_rating: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([getBusiness(id), getBusinessReviews(id)])
      .then(([biz, data]) => {
        setBusiness(biz);
        setReviews(data.reviews);
        setNetworkStats(data.network_stats);
      })
      .catch(() => setError('Could not load this business.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-2xl mb-2">😶</p>
        <p className="text-slate-500 text-sm">{error}</p>
      </div>
    );
  }

  // Compute friend vs network averages from reviews
  const friendReviews = reviews.filter((r) => r.trust_distance === 1);
  const networkReviews = reviews.filter((r) => (r.trust_distance ?? 99) > 1);
  const friendAvg = avg(friendReviews);
  const networkAvg = avg(networkReviews);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {loading ? (
        <>
          <div className="flex items-start gap-4">
            <Skeleton className="w-14 h-14 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        </>
      ) : business ? (
        <>
          <BusinessHeader business={business} />
          <NetworkStats
            friendCount={networkStats.friend_count}
            hop2Count={networkStats.hop2_count}
            avgRating={networkStats.avg_rating}
          />

          {/* Trust breakdown — friends vs network */}
          {(friendReviews.length > 0 || networkReviews.length > 0) && (
            <div className="flex gap-3">
              {friendReviews.length > 0 && (
                <div className="flex-1 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200/60 rounded-xl px-3 py-2.5">
                  <TrustBadge distance={1} showTooltip={false} />
                  <div>
                    <p className="text-[10px] text-emerald-600 font-medium">Friends say</p>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-bold text-slate-900">{friendAvg.toFixed(1)}</span>
                      <span className="text-[10px] text-slate-400">({friendReviews.length})</span>
                    </div>
                  </div>
                </div>
              )}
              {networkReviews.length > 0 && (
                <div className="flex-1 flex items-center gap-2.5 bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-2.5">
                  <TrustBadge distance={2} showTooltip={false} />
                  <div>
                    <p className="text-[10px] text-amber-600 font-medium">Network says</p>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-bold text-slate-900">{networkAvg.toFixed(1)}</span>
                      <span className="text-[10px] text-slate-400">({networkReviews.length})</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}

      {/* Reviews */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Network reviews</h2>

        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => <ReviewCardSkeleton key={i} />)}
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={<span>💬</span>}
            title="No network reviews yet"
            description="Be the first in your network to review this place."
            action={
              business ? (
                <Link href={`/write?business=${id}`}>
                  <Button>Write a review</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
