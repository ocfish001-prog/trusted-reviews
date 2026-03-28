'use client';

import { getTrustPinColor } from '@/lib/utils';

interface BusinessPinProps {
  trustDistance?: number;
  selected?: boolean;
  onClick?: () => void;
}

/**
 * SVG-based custom map pin rendered into a Mapbox marker container.
 * Used as a React component for the visual; the actual DOM element
 * is passed to mapboxgl.Marker via a ref in TrustMap.
 */
export default function BusinessPin({ trustDistance, selected = false, onClick }: BusinessPinProps) {
  const color = getTrustPinColor(trustDistance);
  const scale = selected ? 1.2 : 1;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ transform: `scale(${scale})`, transition: 'transform 150ms ease', transformOrigin: 'bottom center' }}
      className="cursor-pointer border-0 bg-transparent p-0 focus:outline-none"
      aria-label="Business location"
    >
      <svg
        width="28"
        height="36"
        viewBox="0 0 28 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: selected ? `drop-shadow(0 4px 12px ${color}80)` : `drop-shadow(0 2px 4px rgba(0,0,0,0.25))` }}
      >
        {/* Pin body */}
        <path
          d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
          fill={color}
        />
        {/* Inner white circle */}
        <circle cx="14" cy="14" r="6" fill="white" opacity="0.9" />
        {/* Center dot */}
        <circle cx="14" cy="14" r="2.5" fill={color} />
        {/* Subtle shine */}
        <ellipse cx="11" cy="10" rx="2.5" ry="1.5" fill="white" opacity="0.3" />
      </svg>
    </button>
  );
}

/** Returns the pin color for use in Mapbox marker creation */
export { getTrustPinColor };
