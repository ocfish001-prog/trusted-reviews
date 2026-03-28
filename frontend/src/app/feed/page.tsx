'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import FeedFilters from '@/components/feed/FeedFilters';
import ReviewCard from '@/components/feed/ReviewCard';
import EmptyState from '@/components/ui/EmptyState';
import { ReviewCardSkeleton } from '@/components/ui/Skeleton';
import { getFeed } from '@/lib/api';
import type { Review } from '@/lib/types';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { PenLine } from 'lucide-react';

export default function FeedPage() {
  const [category, setCategory] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async (cat: string, cursor?: string) => {
    if (!cursor) setLoading(true);
    else setLoadingMore(true);
    setError('');
    try {
      const data = await getFeed({ category: cat || undefined, cursor });
      if (cursor) {
        setReviews((prev) => [...prev, ...data.reviews]);
      } else {
        setReviews(data.reviews);
      }
      setNextCursor(data.next_cursor);
      setHasMore(!!data.next_cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your feed. Check your connection.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setReviews([]);
    setNextCursor(undefined);
    setHasMore(true);
    fetchFeed(category);
  }, [category, fetchFeed]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchFeed(category, nextCursor);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, nextCursor, category, fetchFeed]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your feed</h1>
        <Link href="/write">
          <Button size="sm">
            <PenLine className="w-4 h-4 mr-1.5" />
            Write
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <FeedFilters active={category} onChange={setCategory} />

      {/* Content */}
      {error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => fetchFeed(category)}
            className="text-sm text-red-500 hover:text-red-700 font-medium mt-2"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <ReviewCardSkeleton key={i} />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<span>🌱</span>}
          title="Your feed is empty"
          description="Follow more friends or write your first review to start seeing what your network thinks."
          action={
            <Link href="/write">
              <Button>Write a review</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={loadMoreRef} className="h-4" />

      {loadingMore && (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <ReviewCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!hasMore && reviews.length > 0 && (
        <p className="text-center text-sm text-slate-300 py-4">You&apos;ve seen everything 🎉</p>
      )}
    </div>
  );
}
