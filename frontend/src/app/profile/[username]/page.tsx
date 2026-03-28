'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ReviewList from '@/components/profile/ReviewList';
import { ProfileSkeleton, ReviewCardSkeleton } from '@/components/ui/Skeleton';
import { getUserProfile, getUserReviews } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { User, Review } from '@/lib/types';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!username) return;
    setLoadingProfile(true);
    getUserProfile(username)
      .then((user) => {
        setProfileUser(user);
        return getUserReviews(user.id);
      })
      .then((r) => setReviews(r))
      .catch(() => setError('Could not load this profile.'))
      .finally(() => {
        setLoadingProfile(false);
        setLoadingReviews(false);
      });
  }, [username]);

  const isOwnProfile =
    currentUser != null &&
    profileUser != null &&
    currentUser.id === profileUser.id;

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-2xl mb-2">😶</p>
        <p className="text-slate-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      {loadingProfile ? (
        <ProfileSkeleton />
      ) : profileUser ? (
        <ProfileHeader
          user={profileUser}
          reviews={reviews}
          isOwnProfile={isOwnProfile}
        />
      ) : null}

      {loadingReviews ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <ReviewCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <ReviewList reviews={reviews} isOwnProfile={isOwnProfile} />
      )}
    </div>
  );
}
