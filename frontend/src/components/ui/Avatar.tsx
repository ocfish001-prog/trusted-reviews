import { cn, getInitials, getTrustRingStyle } from '@/lib/utils';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  trustDistance?: number;
}

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

export default function Avatar({ name, src, size = 'md', className, trustDistance }: AvatarProps) {
  const hasRing = trustDistance != null && trustDistance >= 1;
  const ring = hasRing ? getTrustRingStyle(trustDistance) : null;

  // For dashed/dotted rings, we use a wrapper with SVG border trick via CSS
  // For solid green (friend), use Tailwind ring + glow
  const wrapperStyle: React.CSSProperties = {};
  if (ring && ring.borderStyle !== 'solid') {
    // We'll use an outline with border-style via inline styles on the element
    wrapperStyle.outline = `2px ${ring.borderStyle} ${ring.color}`;
    wrapperStyle.outlineOffset = '2px';
  }

  const imgClasses = cn(
    'rounded-full object-cover bg-slate-100 flex-shrink-0',
    sizes[size],
    ring?.borderStyle === 'solid' && ring.ringClass,
    ring?.borderStyle === 'solid' && ring.glowClass,
    className
  );

  const divClasses = cn(
    'rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center justify-center flex-shrink-0',
    sizes[size],
    ring?.borderStyle === 'solid' && ring.ringClass,
    ring?.borderStyle === 'solid' && ring.glowClass,
    className
  );

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={imgClasses}
        style={ring?.borderStyle !== 'solid' ? wrapperStyle : undefined}
      />
    );
  }

  return (
    <div
      className={divClasses}
      style={ring?.borderStyle !== 'solid' ? wrapperStyle : undefined}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  );
}
