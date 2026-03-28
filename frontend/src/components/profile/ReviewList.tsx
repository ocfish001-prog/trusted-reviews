import ReviewCard from '@/components/feed/ReviewCard';
import EmptyState from '@/components/ui/EmptyState';
import type { Review } from '@/lib/types';
import Link from 'next/link';
import Button from '@/components/ui/Button';

interface ReviewListProps {
  reviews: Review[];
  isOwnProfile?: boolean;
}

export default function ReviewList({ reviews, isOwnProfile }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={<span>📝</span>}
        title="No reviews yet"
        description={isOwnProfile ? "Share your first honest review with your network." : "This person hasn't reviewed anything yet."}
        action={isOwnProfile ? (
          <Link href="/write">
            <Button>Write a review</Button>
          </Link>
        ) : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
}
