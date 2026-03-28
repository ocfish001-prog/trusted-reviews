'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PenLine, UserCircle, Ticket, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const NAV_ITEMS = [
  { href: '/feed', label: 'Feed', icon: Home },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/write', label: 'Write', icon: PenLine },
  { href: '/invite', label: 'Invite', icon: Ticket },
  { href: '/profile/me', label: 'Profile', icon: UserCircle },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-slate-100 safe-area-pb">
      <div className="flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href.replace('/me', '') + '/');
          return (
            <Link
              key={href}
              href={href === '/profile/me' && user
                ? `/profile/${user.name.toLowerCase().replace(/\s+/g, '')}`
                : href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-3 gap-0.5 min-h-[56px] transition-colors',
                active ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <Icon className={cn('w-5 h-5', active && 'fill-amber-100')} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
