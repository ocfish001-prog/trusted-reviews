'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import { searchBusinesses, upsertGoogleBusiness } from '@/lib/api';
import type { Business } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  getPlacePredictions,
  getPlaceDetails,
  highlightMatch,
  type PlacePrediction,
} from '@/lib/googlePlaces';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

interface BusinessSearchProps {
  value: Business | null;
  onChange: (business: Business | null) => void;
}

type ResultSource = 'google' | 'db';

interface UnifiedResult {
  source: ResultSource;
  business?: Business;          // DB result
  prediction?: PlacePrediction; // Google result
  /** Displayed label */
  label: string;
  sublabel?: string;
}

export default function BusinessSearch({ value, onChange }: BusinessSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnifiedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectingGoogle, setSelectingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const usingGoogle = GOOGLE_API_KEY.length > 0;

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (usingGoogle) {
          // Primary: Google Places Autocomplete
          const predictions = await getPlacePredictions(q, GOOGLE_API_KEY);
          const googleResults: UnifiedResult[] = predictions.map((p) => ({
            source: 'google' as ResultSource,
            prediction: p,
            label: p.main_text,
            sublabel: p.secondary_text,
          }));
          setResults(googleResults);
        } else {
          // Fallback: DB search
          const businesses = await searchBusinesses(q);
          const dbResults: UnifiedResult[] = businesses.map((biz) => ({
            source: 'db' as ResultSource,
            business: biz,
            label: biz.name,
            sublabel: biz.category,
          }));
          setResults(dbResults);
        }
      } catch {
        setError('Search unavailable. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [usingGoogle]
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = useCallback(
    async (result: UnifiedResult) => {
      if (result.source === 'db' && result.business) {
        onChange(result.business);
        setOpen(false);
        setQuery('');
        return;
      }

      if (result.source === 'google' && result.prediction) {
        setSelectingGoogle(true);
        setError(null);
        try {
          const details = await getPlaceDetails(result.prediction.place_id, GOOGLE_API_KEY);
          if (!details) throw new Error('Could not load place details');

          // Upsert into backend
          const business = await upsertGoogleBusiness({
            name: details.name,
            address: details.formatted_address,
            category: details.category,
            lat: details.lat,
            lng: details.lng,
            google_place_id: details.place_id,
          });

          onChange(business);
          setOpen(false);
          setQuery('');
        } catch {
          setError('Could not load business details. Please try again.');
        } finally {
          setSelectingGoogle(false);
        }
      }
    },
    [onChange]
  );

  if (value) {
    return (
      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 min-h-[44px]">
        <div className="flex items-start gap-2">
          {value.google_place_id && (
            <MapPin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          )}
          <div>
            <p className="font-medium text-slate-900 text-sm">{value.name}</p>
            {value.category && (
              <p className="text-xs text-slate-500">{value.category}</p>
            )}
            {value.address && (
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[240px]">{value.address}</p>
            )}
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

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search for a business…"
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          aria-label="Search for a business"
          aria-autocomplete="list"
          aria-expanded={open && query.length >= 2}
        />
      </div>

      {open && query.length >= 2 && (
        <div
          className="absolute z-10 top-full mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden"
          role="listbox"
          aria-label="Business suggestions"
        >
          {/* Loading state */}
          {(loading || selectingGoogle) && (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">
              {selectingGoogle ? 'Loading business details…' : 'Searching…'}
            </div>
          )}

          {/* Error state */}
          {!loading && !selectingGoogle && error && (
            <div className="px-4 py-3 text-sm text-red-500 text-center">{error}</div>
          )}

          {/* Empty state */}
          {!loading && !selectingGoogle && !error && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">
              No businesses found. Try a different name.
            </div>
          )}

          {/* Results */}
          {!loading && !selectingGoogle && results.length > 0 && (
            <ul>
              {results.map((result) => {
                const key =
                  result.source === 'google'
                    ? result.prediction!.place_id
                    : result.business!.id;

                // Highlight matching characters in label
                const segments = highlightMatch(result.label, query);

                return (
                  <li key={key} role="option">
                    <button
                      className={cn(
                        'w-full px-4 py-3 text-left hover:bg-amber-50 active:bg-amber-100 transition-colors',
                        'border-b border-slate-50 last:border-0',
                        'min-h-[44px] flex flex-col justify-center'
                      )}
                      onClick={() => handleSelect(result)}
                    >
                      <p className="font-medium text-slate-900 text-sm leading-snug">
                        {segments.map((seg, i) =>
                          seg.bold ? (
                            <strong key={i} className="font-semibold">
                              {seg.text}
                            </strong>
                          ) : (
                            <span key={i}>{seg.text}</span>
                          )
                        )}
                      </p>
                      {result.sublabel && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {result.sublabel}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Google attribution — required by ToS when showing Google results */}
          {!loading && usingGoogle && results.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-end gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
                alt="Powered by Google"
                className="h-4 opacity-60"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
