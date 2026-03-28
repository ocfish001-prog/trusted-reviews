'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { searchBusinesses } from '@/lib/api';
import type { Business } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BusinessSearchProps {
  value: Business | null;
  onChange: (business: Business | null) => void;
}

export default function BusinessSearch({ value, onChange }: BusinessSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchBusinesses(q);
      setResults(data);
    } catch {
      setResults([]);
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

  if (value) {
    return (
      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <div>
          <p className="font-medium text-slate-900 text-sm">{value.name}</p>
          {value.category && (
            <p className="text-xs text-slate-500">{value.category}</p>
          )}
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-slate-400 hover:text-slate-600 p-1"
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
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search for a business..."
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
      </div>

      {open && (query.length >= 2) && (
        <div className="absolute z-10 top-full mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
          {loading ? (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">
              No businesses found. Try a different name.
            </div>
          ) : (
            <ul>
              {results.map((biz) => (
                <li key={biz.id}>
                  <button
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-amber-50 transition-colors',
                      'border-b border-slate-50 last:border-0'
                    )}
                    onClick={() => {
                      onChange(biz);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <p className="font-medium text-slate-900 text-sm">{biz.name}</p>
                    {biz.category && (
                      <p className="text-xs text-slate-400">{biz.category}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
