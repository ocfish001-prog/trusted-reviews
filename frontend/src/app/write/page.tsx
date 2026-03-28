import ReviewForm from '@/components/review/ReviewForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Write a review — Trusted Reviews',
};

export default function WritePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Write a review</h1>
        <p className="text-sm text-slate-400 mt-1">
          Your honest take. Your friends will thank you.
        </p>
      </div>
      <ReviewForm />
    </div>
  );
}
