'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Plus, X, Globe, Users, Lock } from 'lucide-react';
import Button from '@/components/ui/Button';
import BusinessSearch from './BusinessSearch';
import AIAssistPanel from './AIAssistPanel';
import { createReview } from '@/lib/api';
import type { Business, Review } from '@/lib/types';
import { cn } from '@/lib/utils';

type Visibility = 'friends' | '2hop' | 'private';

const VISIBILITY_OPTIONS: { value: Visibility; label: string; icon: typeof Globe; desc: string }[] = [
  { value: '2hop', label: 'Network', icon: Globe, desc: 'Friends & friends of friends' },
  { value: 'friends', label: 'Friends', icon: Users, desc: 'Only your direct friends' },
  { value: 'private', label: 'Private', icon: Lock, desc: 'Only you' },
];

export default function ReviewForm() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [body, setBody] = useState('');
  const [pros, setPros] = useState<string[]>(['']);
  const [cons, setCons] = useState<string[]>(['']);
  const [visibility, setVisibility] = useState<Visibility>('2hop');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addPro = () => setPros([...pros, '']);
  const updatePro = (i: number, v: string) => setPros(pros.map((p, idx) => idx === i ? v : p));
  const removePro = (i: number) => setPros(pros.filter((_, idx) => idx !== i));

  const addCon = () => setCons([...cons, '']);
  const updateCon = (i: number, v: string) => setCons(cons.map((c, idx) => idx === i ? v : c));
  const removeCon = (i: number) => setCons(cons.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) { setError('Please select a business.'); return; }
    if (rating === 0) { setError('Please pick a star rating.'); return; }
    if (!body.trim()) { setError('Please write a review.'); return; }

    setLoading(true);
    setError('');
    try {
      const review: Review = await createReview({
        business_id: business.id,
        rating,
        body,
        pros: pros.filter(Boolean),
        cons: cons.filter(Boolean),
        visibility,
      });
      router.push(`/business/${review.business_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post review. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {/* Business */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Business</label>
        <BusinessSearch value={business} onChange={setBusiness} />
      </div>

      {/* Rating */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Rating</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            >
              <Star
                className={cn(
                  'w-8 h-8 transition-all',
                  star <= (hoverRating || rating)
                    ? 'fill-amber-400 text-amber-400 scale-110'
                    : 'fill-slate-100 text-slate-200'
                )}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="text-sm text-slate-400 self-center ml-1">
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing'][rating]}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Review</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Share your honest experience..."
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
          required
        />
        <p className="text-xs text-slate-400">{body.length} characters</p>
      </div>

      {/* AI Assist */}
      <AIAssistPanel body={body} onApply={setBody} />

      {/* Pros */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Pros <span className="text-slate-400 font-normal">(optional)</span></label>
        {pros.map((pro, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={pro}
              onChange={(e) => updatePro(i, e.target.value)}
              placeholder="Something great..."
              className="flex-1 h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
            {pros.length > 1 && (
              <button type="button" onClick={() => removePro(i)} className="text-slate-400 hover:text-red-400 p-2">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addPro} className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add pro
        </button>
      </div>

      {/* Cons */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Cons <span className="text-slate-400 font-normal">(optional)</span></label>
        {cons.map((con, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={con}
              onChange={(e) => updateCon(i, e.target.value)}
              placeholder="Something not great..."
              className="flex-1 h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
            {cons.length > 1 && (
              <button type="button" onClick={() => removeCon(i)} className="text-slate-400 hover:text-red-400 p-2">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addCon} className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add con
        </button>
      </div>

      {/* Visibility */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Who can see this?</label>
        <div className="grid grid-cols-3 gap-2">
          {VISIBILITY_OPTIONS.map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setVisibility(value)}
              className={cn(
                'flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all min-h-[44px]',
                visibility === value
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
              <span className="text-[10px] text-slate-400 leading-tight">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Post review
      </Button>
    </form>
  );
}
