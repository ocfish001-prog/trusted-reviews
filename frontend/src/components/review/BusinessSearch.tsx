'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import { searchBusinesses, upsertGoogleBusiness } from '@/lib/api';
import type { Business } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BusinessSearchProps {
  value: Business | null;
  onChange: (business: Business | null) => void;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text?: string;
  };
}

interface UnifiedResult {
  source: 'db' | 'google';
  business?: Business;
  prediction?: PlacePrediction;
  label: string;
  sublabel?: string;
}

const searchGooglePlaces = async (query: string): Promise<PlacePrediction[]> => {
  try {
    const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.predictions || [];
  } catch {
    return [];
  }
};

const getPlaceDetails = async (placeId: string) => {
  try {
    const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(placeId)}`);
    const data = await res.json();
    return data.result || null;
  } catch {
    return null;
  }
};

function highlightMatch(text: string, query: string): Array<{ text: string; bold: boolean }> {
  if (!query) return [{ text, bold: false }];
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return [{ text, bold: false }];
  return [
    { text: text.slice(0, idx), bold: false },
    { text: text.slice(idx, idx + query.length), bold: true },
    { text: text.slice(idx + query.length), bold: false },
  ].filter(s => s.text.length > 0);
}

export default function BusinessSearch({ value, onChange }: BusinessSearchProps) {
  const [query, setQuery] = useState('');
  const [dbResults, setDbResults] = useState<Business[]>([]);
  const [googleResults, setGoogleResults] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 1) {
      setDbResults([]);
      setGoogleResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const [db, google] = await Promise.allSettled([
      searchBusinesses(q).catch(() => [] as Business[]),
      searchGooglePlaces(q),
    ]);

    setDbResults(db.status === 'fulfilled' ? db.value : []);
    setGoogleResults(google.status === 'fulfilled' ? google.value : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectDb = useCallback((business: Business) => {
    onChange(business);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const handleSelectGoogle = useCallback(async (prediction: PlacePrediction) => {
    setSelecting(true);
    setError(null);
    try {
      const details = await getPlaceDetails(prediction.place_id);

      const name = details?.name || prediction.structured_formatting.main_text;
      const address = details?.formatted_address || prediction.structured_formatting.secondary_text || '';
      const lat = details?.geometry?.location?.lat || 0;
      const lng = details?.geometry?.location?.lng || 0;
      const category = details?.types?.[0]?.replace(/_/g, ' ') || 'business';

      const business = await upsertGoogleBusiness({
        google_place_id: prediction.place_id,
        name,
        address,
        lat,
        lng,
        category,
      });

      onChange(business);
      setOpen(false);
      setQuery('');
    } catch {
      setError('Could not add this business. Please try again.');
    } finally {
      setSelecting(false);
    }
  }, [onChange]);

  if (value) {
    return (
      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 min-h-[44px]">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-slate-900 text-sm">{value.name}</p>
            {value.category && <p className="text-xs text-slate-500">{value.category}</p>}
            {value.address && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[240px]">{value.address}</p>}
          </div>
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-slate-400 hover:text-slate-600 p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Clear business"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const hasDbResults = dbResults.length > 0;
  const hasGoogleResults = googleResults.length > 0;
  const hasAnyResults = hasDbResults || hasGoogleResults;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search for a business…"
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          aria-label="Search for a business"
          autoComplete="off"
        />
      </div>

      {open && query.length >= 1 && (
        <div className="absolute z-10 top-full mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
          {(loading || selecting) && (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">
              {selecting ? 'Adding business…' : 'Searching…'}
            </div>
          )}

          {!loading && !selecting && error && (
            <div className="px-4 py-3 text-sm text-red-500 text-center">{error}</div>
          )}

          {!loading && !selecting && !error && !hasAnyResults && (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">
              No businesses found. Try a different name.
            </div>
          )}

          {/* DB results — "In Trusted Reviews" */}
          {!loading && !selecting && hasDbResults && (
            <>
              <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-100">
                In Trusted Reviews
              </div>
              <ul>
                {dbResults.map((biz) => {
                  const segs = highlightMatch(biz.name, query);
                  return (
                    <li key={biz.id}>
                      <button
                        className={cn(
                          'w-full px-4 py-3 text-left hover:bg-amber-50 active:bg-amber-100 transition-colors',
                          'border-b border-slate-50 last:border-0 min-h-[44px] flex flex-col justify-center'
                        )}
                        onClick={() => handleSelectDb(biz)}
                      >
                        <p className="font-medium text-slate-900 text-sm leading-snug">
                          {segs.map((s, i) => s.bold
                            ? <strong key={i} className="font-semibold">{s.text}</strong>
                            : <span key={i}>{s.text}</span>
                          )}
                        </p>
                        {biz.category && <p className="text-xs text-slate-400 mt-0.5">{biz.category}</p>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Google Places results — "Nearby" */}
          {!loading && !selecting && hasGoogleResults && (
            <>
              <div className={cn(
                'px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-100',
                hasDbResults && 'border-t border-t-slate-100'
              )}>
                Nearby
              </div>
              <ul>
                {googleResults.slice(0, 6).map((pred) => {
                  const name = pred.structured_formatting.main_text;
                  const sub = pred.structured_formatting.secondary_text;
                  const segs = highlightMatch(name, query);
                  return (
                    <li key={pred.place_id}>
                      <button
                        className={cn(
                          'w-full px-4 py-3 text-left hover:bg-amber-50 active:bg-amber-100 transition-colors',
                          'border-b border-slate-50 last:border-0 min-h-[44px] flex flex-col justify-center'
                        )}
                        onClick={() => handleSelectGoogle(pred)}
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 text-sm leading-snug">
                              {segs.map((s, i) => s.bold
                                ? <strong key={i} className="font-semibold">{s.text}</strong>
                                : <span key={i}>{s.text}</span>
                              )}
                            </p>
                            {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="px-4 py-1.5 border-t border-slate-100 text-[10px] text-slate-300 text-right">
                Powered by Google
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
