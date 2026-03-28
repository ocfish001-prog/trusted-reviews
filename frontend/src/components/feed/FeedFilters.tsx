'use client';

import { cn } from '@/lib/utils';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'restaurant', label: '🍽️ Restaurants' },
  { value: 'coffee', label: '☕ Coffee' },
  { value: 'bar', label: '🍺 Bars' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'health', label: '💊 Health' },
  { value: 'services', label: '🔧 Services' },
];

interface FeedFiltersProps {
  active: string;
  onChange: (value: string) => void;
}

export default function FeedFilters({ active, onChange }: FeedFiltersProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={cn(
            'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all min-h-[44px]',
            active === f.value
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
