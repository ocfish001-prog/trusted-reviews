import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getTrustLabel(distance?: number): string {
  if (distance === 0) return 'You';
  if (distance === 1) return 'Your friend';
  if (distance === 2) return 'Friend of friend';
  return 'Network';
}

export function getTrustColor(distance?: number): string {
  if (distance === 1) return 'bg-amber-100 text-amber-700';
  if (distance === 2) return 'bg-slate-100 text-slate-600';
  return 'bg-slate-50 text-slate-400';
}

/** Returns ring/glow CSS classes for trust distance avatar rings */
export function getTrustRingStyle(distance?: number): {
  ringClass: string;
  glowClass: string;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none';
  color: string;
} {
  if (distance === 1) {
    return {
      ringClass: 'ring-2 ring-offset-2 ring-emerald-400',
      glowClass: 'shadow-[0_0_0_3px_rgba(52,211,153,0.25)]',
      borderStyle: 'solid',
      color: '#34d399',
    };
  }
  if (distance === 2) {
    return {
      ringClass: 'ring-2 ring-offset-2 ring-amber-400',
      glowClass: '',
      borderStyle: 'dashed',
      color: '#fbbf24',
    };
  }
  return {
    ringClass: 'ring-1 ring-offset-1 ring-slate-300',
    glowClass: '',
    borderStyle: 'dotted',
    color: '#94a3b8',
  };
}

/** Returns pin color hex for map markers */
export function getTrustPinColor(distance?: number): string {
  if (distance === 1) return '#10b981'; // emerald-500
  if (distance === 2) return '#f59e0b'; // amber-500
  return '#94a3b8'; // slate-400
}

/** Returns a short tooltip explaining why a review is visible */
export function getTrustTooltip(distance?: number, reviewerName?: string, viaFriend?: string): string {
  if (distance === 1 && reviewerName) return `${reviewerName} is your friend`;
  if (distance === 2 && reviewerName && viaFriend) return `${reviewerName} knows your friend ${viaFriend}`;
  if (distance === 2 && reviewerName) return `${reviewerName} is in your network`;
  return 'In your trust network';
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function buildInviteUrl(code: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/signup?invite=${code}`;
}
