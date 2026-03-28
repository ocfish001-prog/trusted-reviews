'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Avatar from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <nav className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href={user ? '/feed' : '/'}
          className="text-slate-900 font-bold text-lg tracking-tight hover:text-amber-600 transition-colors"
        >
          Trusted
          <span className="text-amber-500">Reviews</span>
        </Link>

        {/* Desktop Nav */}
        {user && (
          <div className="hidden sm:flex items-center gap-1">
            {[
              { href: '/feed', label: 'Feed' },
              { href: '/map', label: 'Map' },
              { href: '/write', label: 'Write' },
              { href: '/invite', label: 'Invite' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  isActive(href)
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        )}

        {/* User / Auth */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <Link href={`/profile/${user.name.toLowerCase().replace(/\s+/g, '')}`}>
                <Avatar name={user.name} src={user.avatar_url} size="sm" />
              </Link>
              <button
                onClick={logout}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-sm text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="text-sm bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
