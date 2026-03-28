'use client';

import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { MapPin, Calendar } from 'lucide-react';
import type { User, Review } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';

interface ProfileHeaderProps {
  user: User;
  reviews: Review[];
  isOwnProfile: boolean;
}

export default function ProfileHeader({ user, reviews, isOwnProfile }: ProfileHeaderProps) {
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="space-y-5">
      {/* Top */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} src={user.avatar_url} size="xl" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
            {user.location && (
              <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {user.location}
              </p>
            )}
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
              <Calendar className="w-3.5 h-3.5" />
              Joined {formatRelativeTime(user.created_at)}
            </p>
          </div>
        </div>
        {isOwnProfile && (
          <Link href="/profile/edit">
            <Button variant="secondary" size="sm">Edit profile</Button>
          </Link>
        )}
      </div>

      {/* Bio */}
      {user.bio && (
        <p className="text-sm text-slate-600 leading-relaxed">{user.bio}</p>
      )}

      {/* Stats */}
      <div className="flex gap-6 py-3 border-t border-b border-slate-100">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">{reviews.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Reviews</p>
        </div>
        {avgRating && (
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900">⭐ {avgRating}</p>
            <p className="text-xs text-slate-400 mt-0.5">Avg rating</p>
          </div>
        )}
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">
            {reviews.filter(r => r.ai_polished).length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">AI polished</p>
        </div>
      </div>
    </div>
  );
}
