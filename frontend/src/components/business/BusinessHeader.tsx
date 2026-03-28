import { MapPin, Tag } from 'lucide-react';
import type { Business } from '@/lib/types';
import Link from 'next/link';
import Button from '@/components/ui/Button';

interface BusinessHeaderProps {
  business: Business;
}

export default function BusinessHeader({ business }: BusinessHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        {/* Icon placeholder */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🏢</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{business.name}</h1>
            {business.category && (
              <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                <Tag className="w-3.5 h-3.5" />
                {business.category}
              </p>
            )}
            {business.address && (
              <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {business.address}
              </p>
            )}
          </div>
        </div>
        <Link href={`/write?business=${business.id}`}>
          <Button size="sm">Write review</Button>
        </Link>
      </div>
    </div>
  );
}
