'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import FeedFilters from '@/components/feed/FeedFilters';
import ReviewCard from '@/components/feed/ReviewCard';
import SearchBar from '@/components/feed/SearchBar';
import EmptyState from '@/components/ui/EmptyState';
import { ReviewCardSkeleton } from '@/components/ui/Skeleton';
import { getFeed, getMapBusinesses } from '@/lib/api';
import type { Review } from '@/lib/types';
import type { MapBusiness } from '@/lib/api';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import QuickReviewFAB from '@/components/review/QuickReviewFAB';
import { PenLine, List, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useAuth } from '@/hooks/useAuth';

// Lazy-load TrustMap to avoid SSR issues
const TrustMap = dynamic(() => import('@/components/map/TrustMap'), { ssr: false });

const VIEW_PREF_KEY = 'tr-feed-view';

const CATEGORY_TILES = [
  { label: 'Coffee', emoji: '☕', value: 'coffee' },
  { label: 'Food', emoji: '🍕', value: 'food' },
  { label: 'Bars', emoji: '🍺', value: 'bar' },
  { label: 'Services', emoji: '🔧', value: 'services' },
  { label: 'Shopping', emoji: '🛍️', value: 'shopping' },
  { label: 'Other', emoji: '✨', value: 'other' },
];

export default function FeedPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // View toggle: list vs map
  const [viewMode, setViewMode] = useState<'list' | 'map'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(VIEW_PREF_KEY) as 'list' | 'map') || 'list';
    }
    return 'list';
  });
  const [mapBusinesses, setMapBusinesses] = useState<MapBusiness[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const { coords: location } = useGeolocation();

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
    if (!user) {
      setLoading(false);
      return;
    }
    setReviews([]);
    setNextCursor(undefined);
    setHasMore(true);
    fetchFeed(category);
  }, [category, fetchFeed, user]);

  // Load map data when switching to map view (only if authenticated)
  useEffect(() => {
    if (viewMode === 'map' && mapBusinesses.length === 0 && !mapLoading && user) {
      setMapLoading(true);
      getMapBusinesses()
        .then(setMapBusinesses)
        .catch(() => {})
        .finally(() => setMapLoading(false));
    }
  }, [viewMode, mapBusinesses.length, mapLoading, user]);

  // Persist view preference
  const toggleView = (mode: 'list' | 'map') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(VIEW_PREF_KEY, mode);
    }
  };

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || viewMode === 'map') return;
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
  }, [hasMore, loadingMore, loading, nextCursor, category, fetchFeed, viewMode]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {user && <span data-testid="feed-authenticated" style={{ display: 'none' }} />}
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your feed</h1>
        <div className="flex items-center gap-2">
          {/* List / Map toggle */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
            <button
              type="button"
              onClick={() => toggleView('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px]',
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => toggleView('map')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px]',
                viewMode === 'map'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
              aria-label="Map view"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Map</span>
            </button>
          </div>

          <Link href="/write">
            <Button size="sm">
              <PenLine className="w-4 h-4 mr-1.5" />
              Write
            </Button>
          </Link>
        </div>
      </div>

      {/* Search bar */}
      <SearchBar onCategorySelect={(cat) => setCategory(cat)} />

      {/* Category browse tiles */}
      <div className="grid grid-cols-6 gap-2">
        {CATEGORY_TILES.map((tile) => (
          <button
            key={tile.value}
            type="button"
            onClick={() => setCategory(category === tile.value ? '' : tile.value)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-center transition-all min-h-[56px]',
              category === tile.value
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            <span className="text-lg leading-none">{tile.emoji}</span>
            <span className="text-[10px] font-medium leading-none">{tile.label}</span>
          </button>
        ))}
      </div>

      {/* MAP VIEW */}
      {viewMode === 'map' && (
        <div className="rounded-2xl overflow-hidden border border-slate-200 h-[60vh] min-h-[400px]">
          {mapLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-50">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <TrustMap
              businesses={mapBusinesses}
              userLocation={location}
              loading={mapLoading}
            />
          )}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <>
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
        </>
      )}

      {/* Quick Review FAB */}
      <QuickReviewFAB />
    </div>
  );
}
