'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import { searchBusinesses, upsertOsmBusiness } from '@/lib/api';
import type { Business } from '@/lib/types';
import { cn } from '@/lib/utils';
import { highlightMatch } from '@/lib/googlePlaces';

interface BusinessSearchProps {
  value: Business | null;
  onChange: (business: Business | null) => void;
}

interface OsmResult {
  place_id: number;
  osm_id: string;
  osm_type: string;
  display_name: string;
  name: string;
  lat: string;
  lon: string;
  type: string;
  category: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

interface UnifiedResult {
  source: 'db' | 'osm';
  business?: Business;
  osm?: OsmResult;
  label: string;
  sublabel?: string;
}

const searchOSM = async (query: string): Promise<OsmResult[]> => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=8&countrycodes=us`,
    { headers: { 'User-Agent': 'TrustedReviews/1.0 (contact@trusted-reviews.app)' } }
  );
  return res.json();
};

const enrichWithGoogle = async (name: string, address: string): Promise<{ place_id: string } | null> => {
  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(name + ' ' + address)}&inputtype=textquery&fields=place_id,geometry&key=${key}`
    );
    const data = await res.json();
    return data.candidates?.[0] || null;
  } catch {
    return null;
  }
};

function osmDisplayAddress(osm: OsmResult): string {
  if (osm.address) {
    const parts: string[] = [];
    if (osm.address.house_number && osm.address.road) {
      parts.push(`${osm.address.house_number} ${osm.address.road}`);
    } else if (osm.address.road) {
      parts.push(osm.address.road);
    }
    if (osm.address.city) parts.push(osm.address.city);
    if (osm.address.state) parts.push(osm.address.state);
    if (parts.length > 0) return parts.join(', ');
  }
  // Fallback: strip name from display_name
  const dn = osm.display_name;
  const namePrefix = osm.name ? dn.replace(new RegExp('^' + osm.name + ',\\s*'), '') : dn;
  return namePrefix.split(',').slice(0, 3).join(',').trim();
}

function osmName(osm: OsmResult): string {
  if (osm.name) return osm.name;
  // fallback: first part of display_name
  return osm.display_name.split(',')[0].trim();
}

export default function BusinessSearch({ value, onChange }: BusinessSearchProps) {
  const [query, setQuery] = useState('');
  const [dbResults, setDbResults] = useState<Business[]>([]);
  const [osmResults, setOsmResults] = useState<OsmResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectingOsm, setSelectingOsm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setDbResults([]);
      setOsmResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [db, osm] = await Promise.allSettled([
        searchBusinesses(q),
        searchOSM(q),
      ]);

      setDbResults(db.status === 'fulfilled' ? db.value : []);
      // Filter OSM results to only show named places (not roads/addresses without names)
      const osmData = osm.status === 'fulfilled' ? osm.value : [];
      setOsmResults(osmData.filter(r => osmName(r).length > 1));
    } catch {
      setError('Search unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleSelectDb = useCallback((business: Business) => {
    onChange(business);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const handleSelectOsm = useCallback(async (osm: OsmResult) => {
    setSelectingOsm(true);
    setError(null);
    try {
      const name = osmName(osm);
      const address = osmDisplayAddress(osm);
      const osmIdStr = `${osm.osm_type}/${osm.osm_id ?? osm.place_id}`;

      // Enrich with Google (silent fail)
      const googleResult = await enrichWithGoogle(name, address);

      const business = await upsertOsmBusiness({
        name,
        address,
        lat: parseFloat(osm.lat),
        lng: parseFloat(osm.lon),
        category: osm.type || osm.category || 'business',
        osm_id: osmIdStr,
        google_place_id: googleResult?.place_id,
      });

      onChange(business);
      setOpen(false);
      setQuery('');
    } catch {
      setError('Could not add this business. Please try again.');
    } finally {
      setSelectingOsm(false);
    }
  }, [onChange]);

  if (value) {
    return (
      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 min-h-[44px]">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
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

  const hasDbResults = dbResults.length > 0;
  const hasOsmResults = osmResults.length > 0;
  const hasAnyResults = hasDbResults || hasOsmResults;

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
          {/* Loading / selecting state */}
          {(loading || selectingOsm) && (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">
              {selectingOsm ? 'Adding business…' : 'Searching…'}
            </div>
          )}

          {/* Error */}
          {!loading && !selectingOsm && error && (
            <div className="px-4 py-3 text-sm text-red-500 text-center">{error}</div>
          )}

          {/* Empty state */}
          {!loading && !selectingOsm && !error && !hasAnyResults && (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">
              No businesses found. Try a different name.
            </div>
          )}

          {/* DB results section — "In Trusted Reviews" */}
          {!loading && !selectingOsm && hasDbResults && (
            <>
              <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-100">
                In Trusted Reviews
              </div>
              <ul>
                {dbResults.map((biz) => {
                  const segments = highlightMatch(biz.name, query);
                  return (
                    <li key={biz.id} role="option">
                      <button
                        className={cn(
                          'w-full px-4 py-3 text-left hover:bg-amber-50 active:bg-amber-100 transition-colors',
                          'border-b border-slate-50 last:border-0',
                          'min-h-[44px] flex flex-col justify-center'
                        )}
                        onClick={() => handleSelectDb(biz)}
                      >
                        <p className="font-medium text-slate-900 text-sm leading-snug">
                          {segments.map((seg, i) =>
                            seg.bold ? (
                              <strong key={i} className="font-semibold">{seg.text}</strong>
                            ) : (
                              <span key={i}>{seg.text}</span>
                            )
                          )}
                        </p>
                        {biz.category && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{biz.category}</p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* OSM results section — "Add from map" */}
          {!loading && !selectingOsm && hasOsmResults && (
            <>
              <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-100 border-t border-t-slate-100">
                Add from map
              </div>
              <ul>
                {osmResults.map((osm) => {
                  const name = osmName(osm);
                  const addr = osmDisplayAddress(osm);
                  const segments = highlightMatch(name, query);
                  const key = `osm-${osm.place_id}`;
                  return (
                    <li key={key} role="option">
                      <button
                        className={cn(
                          'w-full px-4 py-3 text-left hover:bg-amber-50 active:bg-amber-100 transition-colors',
                          'border-b border-slate-50 last:border-0',
                          'min-h-[44px] flex flex-col justify-center'
                        )}
                        onClick={() => handleSelectOsm(osm)}
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 text-sm leading-snug">
                              {segments.map((seg, i) =>
                                seg.bold ? (
                                  <strong key={i} className="font-semibold">{seg.text}</strong>
                                ) : (
                                  <span key={i}>{seg.text}</span>
                                )
                              )}
                            </p>
                            {addr && (
                              <p className="text-xs text-slate-400 mt-0.5 truncate">{addr}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* OSM attribution */}
          {!loading && hasOsmResults && (
            <div className="px-4 py-1.5 border-t border-slate-100 text-[10px] text-slate-300 text-right">
              Map data © OpenStreetMap contributors
            </div>
          )}
        </div>
      )}
    </div>
  );
}
