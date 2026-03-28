import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import TrustBadge from '@/components/ui/TrustBadge';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { formatRelativeTime } from '@/lib/utils';
import type { Review } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MapPin, Star } from 'lucide-react';

interface ReviewCardProps {
  review: Review;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'w-4 h-4',
            star <= rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'
          )}
        />
      ))}
    </div>
  );
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const { user, business, trust_distance, via_friend, created_at, rating, body, ai_polished } = review;

  return (
    <Card className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {user && (
            <Link href={`/profile/${user.name.toLowerCase().replace(/\s+/g, '')}`} className="flex-shrink-0">
              <Avatar
                name={user.name}
                src={user.avatar_url}
                size="md"
                trustDistance={trust_distance}
              />
            </Link>
          )}
          <div className="min-w-0">
            {user && (
              <p className="font-semibold text-slate-900 text-sm truncate">
                {user.name}
              </p>
            )}
            {/* Trust connection context */}
            {trust_distance === 2 && via_friend && (
              <p className="text-xs text-slate-400 truncate mt-0.5">
                via{' '}
                <span className="text-amber-600 font-medium">
                  {typeof via_friend === 'string' ? via_friend : via_friend.name}
                </span>
              </p>
            )}
            {trust_distance === 1 && (
              <p className="text-xs text-emerald-600 font-medium mt-0.5">Your friend</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <TrustBadge
            distance={trust_distance}
            reviewerName={user?.name}
            viaFriend={typeof via_friend === 'string' ? via_friend : via_friend?.name}
          />
          {ai_polished && (
            <Badge variant="amber">✨ AI</Badge>
          )}
        </div>
      </div>

      {/* Business */}
      {business && (
        <Link
          href={`/business/${review.business_id}`}
          className="flex items-start gap-2 group"
        >
          <div>
            <p className="font-semibold text-slate-800 group-hover:text-amber-600 transition-colors">
              {business.name}
            </p>
            {business.address && (
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {business.address}
              </p>
            )}
          </div>
        </Link>
      )}

      {/* Rating */}
      <StarRating rating={rating} />

      {/* Body */}
      <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">{body}</p>

      {/* Footer */}
      <p className="text-xs text-slate-400">{formatRelativeTime(created_at)}</p>
    </Card>
  );
}
