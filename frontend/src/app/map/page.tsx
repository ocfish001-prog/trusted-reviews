'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { MapPin, List, Navigation, AlertCircle, Loader2 } from 'lucide-react';
import ReviewCard from '@/components/feed/ReviewCard';
import { getMapBusinesses } from '@/lib/api';
import type { MapBusiness } from '@/lib/api';
import { useGeolocation, distanceKm } from '@/hooks/useGeolocation';
import { cn } from '@/lib/utils';

// Dynamically import TrustMap to avoid SSR (Mapbox requires browser APIs)
const TrustMap = dynamic(() => import('@/components/map/TrustMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
    </div>
  ),
});

type ViewMode = 'map' | 'list';

export default function MapPage() {
  const [businesses, setBusinesses] = useState<MapBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [nearMeActive, setNearMeActive] = useState(false);

  const geo = useGeolocation();

  // Load businesses
  useEffect(() => {
    setLoading(true);
    getMapBusinesses()
      .then(setBusinesses)
      .catch((e) => setError(e.message ?? 'Failed to load map data'))
      .finally(() => setLoading(false));
  }, []);

  // Handle Near Me toggle
  const handleNearMe = () => {
    if (!nearMeActive) {
      if (!geo.coords) {
        geo.request(); // Only asks permission here
      }
      setNearMeActive(true);
    } else {
      setNearMeActive(false);
    }
  };

  // Filter to 5km radius when Near Me is active
  const filteredBusinesses = useMemo(() => {
    if (!nearMeActive || !geo.coords) return businesses;
    return businesses.filter((b) => {
      if (b.lat == null || b.lng == null) return false;
      return distanceKm(geo.coords!.lat, geo.coords!.lng, b.lat, b.lng) <= 5;
    });
  }, [businesses, nearMeActive, geo.coords]);

  const hasMapData = filteredBusinesses.some((b) => b.lat != null && b.lng != null);

  return (
    <div className="flex flex-col h-[100dvh] bg-white">
      {/* Top bar */}
      <header className="flex-shrink-0 px-4 pt-safe-top pt-4 pb-3 border-b border-slate-100 bg-white/95 backdrop-blur-sm z-10">
        <div className="flex items-center justify-between gap-3 max-w-screen-lg mx-auto">
          <h1 className="text-lg font-bold text-slate-900">Trusted Map</h1>

          <div className="flex items-center gap-2">
            {/* Near Me toggle */}
            <button
              type="button"
              onClick={handleNearMe}
              disabled={geo.loading}
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-all min-h-[44px]',
                nearMeActive
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {geo.loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className={cn('w-4 h-4', nearMeActive && 'fill-white')} />
              )}
              Near Me
            </button>

            {/* Map / List toggle */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all min-h-[36px]',
                  viewMode === 'map'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <MapPin className="w-4 h-4" />
                Map
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all min-h-[36px]',
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <List className="w-4 h-4" />
                List
              </button>
            </div>
          </div>
        </div>

        {/* Near Me status messages */}
        {nearMeActive && geo.error && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg max-w-screen-lg mx-auto">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {geo.error}
          </div>
        )}
        {nearMeActive && geo.coords && (
          <p className="mt-1.5 text-xs text-slate-500 text-center">
            Showing {filteredBusinesses.length} place{filteredBusinesses.length !== 1 ? 's' : ''} within 5 km
          </p>
        )}
      </header>

      {/* Error state */}
      {error && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3 max-w-xs">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-slate-700 font-medium">Could not load map data</p>
            <p className="text-sm text-slate-500">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm text-amber-600 font-medium hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {!error && (
        <div className="flex-1 min-h-0">
          {/* Map view */}
          {viewMode === 'map' && (
            <div className="w-full h-full relative">
              {hasMapData || loading ? (
                <TrustMap
                  businesses={filteredBusinesses}
                  userLocation={geo.coords}
                  loading={loading}
                />
              ) : (
                <EmptyMapState nearMeActive={nearMeActive} />
              )}
            </div>
          )}

          {/* List view */}
          {viewMode === 'list' && (
            <div className="h-full overflow-y-auto">
              {loading ? (
                <ListSkeleton />
              ) : filteredBusinesses.length === 0 ? (
                <EmptyListState nearMeActive={nearMeActive} />
              ) : (
                <div className="max-w-screen-sm mx-auto px-4 py-4 space-y-3 pb-24">
                  {filteredBusinesses.map((biz) => (
                    <BusinessListItem key={biz.id} business={biz} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trust legend */}
      <div className="flex-shrink-0 px-4 py-2.5 border-t border-slate-100 bg-white">
        <div className="flex items-center justify-center gap-5 max-w-screen-lg mx-auto">
          <LegendItem color="#10b981" label="Friend reviewed" />
          <LegendItem color="#f59e0b" label="Network reviewed" dashed />
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color, opacity: dashed ? 0.7 : 1 }}
      />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function BusinessListItem({ business }: { business: MapBusiness }) {
  const trustColor = business.trust_distance === 1 ? 'bg-emerald-400' : 'bg-amber-400';

  return (
    <Link
      href={`/business/${business.id}`}
      className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors group"
    >
      {/* Trust dot */}
      <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5', trustColor)} />

      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-semibold text-slate-900 group-hover:text-amber-600 transition-colors truncate">
          {business.name}
        </p>
        {business.category && (
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{business.category}</p>
        )}
        {business.address && (
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{business.address}</span>
          </p>
        )}
        {business.top_review_snippet && (
          <p className="text-sm text-slate-500 line-clamp-2 italic mt-1">&ldquo;{business.top_review_snippet}&rdquo;</p>
        )}
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-bold text-slate-900">{business.avg_rating.toFixed(1)}</p>
        <p className="text-xs text-amber-400">★</p>
      </div>
    </Link>
  );
}

function EmptyMapState({ nearMeActive }: { nearMeActive: boolean }) {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center space-y-3 max-w-xs">
        <MapPin className="w-12 h-12 text-slate-200 mx-auto" />
        <p className="font-semibold text-slate-700">No places found</p>
        <p className="text-sm text-slate-400">
          {nearMeActive
            ? 'No trusted reviews near you. Expand your area or browse all.'
            : 'Once people in your network review places, they\'ll show up here.'}
        </p>
        {nearMeActive && (
          <Link href="/feed" className="text-sm text-amber-600 font-medium hover:underline">
            Browse all reviews →
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyListState({ nearMeActive }: { nearMeActive: boolean }) {
  return (
    <div className="flex items-center justify-center h-full p-8 min-h-[300px]">
      <div className="text-center space-y-3 max-w-xs">
        <List className="w-12 h-12 text-slate-200 mx-auto" />
        <p className="font-semibold text-slate-700">No places to show</p>
        <p className="text-sm text-slate-400">
          {nearMeActive ? 'Nothing within 5 km. Try disabling Near Me.' : 'Your network hasn\'t reviewed any places yet.'}
        </p>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="max-w-screen-sm mx-auto px-4 py-4 space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}
