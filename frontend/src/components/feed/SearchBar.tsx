'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Clock } from 'lucide-react';
import Link from 'next/link';
import { combinedSearch } from '@/lib/api';
import type { CombinedSearchResponse } from '@/lib/types';
import { cn } from '@/lib/utils';

const RECENT_SEARCHES_KEY = 'tr-recent-searches';
const MAX_RECENT = 5;
const DEBOUNCE_MS = 300;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentSearch(query: string): void {
  if (typeof window === 'undefined' || !query.trim()) return;
  try {
    const prev = getRecentSearches().filter((s) => s !== query);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify([query, ...prev].slice(0, MAX_RECENT))
    );
  } catch {
    // ignore
  }
}

/** Bold-highlight the first matching substring */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <strong className="font-semibold text-slate-900">{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </span>
  );
}

interface SearchBarProps {
  onCategorySelect?: (category: string) => void;
}

export default function SearchBar({ onCategorySelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<CombinedSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showDropdown = focused && (query.trim() ? results !== null || loading : recentSearches.length > 0);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await combinedSearch(q);
      setResults(data);
    } catch {
      setResults({ businesses: [], reviews: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => doSearch(query), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  useEffect(() => {
    if (focused) {
      setRecentSearches(getRecentSearches());
    }
  }, [focused]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (searchQuery: string) => {
    addRecentSearch(searchQuery);
    setQuery(searchQuery);
    setFocused(false);
    doSearch(searchQuery);
  };

  const clearSearch = () => {
    setQuery('');
    setResults(null);
    setFocused(false);
    inputRef.current?.focus();
  };

  const hasResults = results && (results.businesses.length > 0 || results.reviews.length > 0);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search input */}
      <div
        className={cn(
          'flex items-center gap-2.5 h-12 px-4 rounded-2xl border transition-all bg-white',
          focused
            ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-sm'
            : 'border-slate-200 hover:border-slate-300'
        )}
      >
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search businesses, reviews..."
          className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
          aria-label="Search"
          autoComplete="off"
        />
        {loading && (
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
        {query && !loading && (
          <button
            type="button"
            onClick={clearSearch}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-[420px] overflow-y-auto">

          {/* Recent searches (when empty query) */}
          {!query.trim() && recentSearches.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Recent</p>
              {recentSearches.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 text-sm text-slate-700 transition-colors text-left min-h-[44px]"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search results */}
          {query.trim() && (
            <>
              {loading && !results && (
                <div className="px-4 py-6 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!loading && !hasResults && results && (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-slate-400">No results for &ldquo;{query}&rdquo;</p>
                </div>
              )}

              {/* Businesses section */}
              {results && results.businesses.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Businesses</p>
                  {results.businesses.slice(0, 4).map((biz) => (
                    <Link
                      key={biz.id}
                      href={`/business/${biz.id}`}
                      onClick={() => {
                        addRecentSearch(query);
                        setFocused(false);
                      }}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-amber-50 transition-colors min-h-[52px]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs">🏪</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          <HighlightMatch text={biz.name} query={query} />
                        </p>
                        {biz.category && (
                          <p className="text-xs text-slate-400 mt-0.5">{biz.category}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Reviews section */}
              {results && results.reviews.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Reviews</p>
                  {results.reviews.slice(0, 4).map((rev) => (
                    <Link
                      key={rev.id}
                      href={`/business/${rev.business.id}`}
                      onClick={() => {
                        addRecentSearch(query);
                        setFocused(false);
                      }}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-amber-50 transition-colors min-h-[52px]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 mb-0.5">
                          <span className="font-medium text-slate-700">{rev.business.name}</span>
                          {rev.reviewer_name && (
                            <span className="text-slate-400"> · by {rev.reviewer_name}</span>
                          )}
                        </p>
                        {rev.body && (
                          <p className="text-sm text-slate-600 line-clamp-2">
                            <HighlightMatch text={rev.body.slice(0, 120)} query={query} />
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          {[1,2,3,4,5].map((s) => (
                            <span key={s} className={cn('text-[10px]', s <= rev.rating ? 'text-amber-400' : 'text-slate-200')}>★</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
