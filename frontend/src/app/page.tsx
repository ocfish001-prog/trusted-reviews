import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-full px-4 py-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">Invite only</span>
          </div>

          {/* Headline — oversized serif */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.05] tracking-tight">
            Reviews from people you{' '}
            <em className="text-amber-500 not-italic">actually know.</em>
          </h1>

          {/* Subline */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-lg mx-auto leading-relaxed">
            No paid placements. No fake five-stars. Just honest takes from your friends — and friends of friends.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-colors shadow-sm"
            >
              Join with an invite →
            </Link>
            <Link
              href="/login"
              className="text-slate-500 hover:text-slate-700 text-sm font-medium"
            >
              Already a member? Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features — minimal 3-up */}
      <section className="border-t border-slate-100 bg-white py-16 px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10">
          {[
            {
              emoji: '🤝',
              title: '2-hop trust',
              body: 'See reviews from friends, and friends of friends. No strangers.',
            },
            {
              emoji: '✨',
              title: 'AI-polished',
              body: 'Optional AI assist helps you write clearer, more helpful reviews.',
            },
            {
              emoji: '🔒',
              title: 'Invite only',
              body: 'Everyone here was vouched for by someone you trust.',
            },
          ].map(({ emoji, title, body }) => (
            <div key={title} className="text-center space-y-3">
              <span className="text-4xl">{emoji}</span>
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-6 px-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            © 2026 Trusted Reviews. All rights reserved.
          </p>
          <p className="text-xs text-slate-300">Built on trust.</p>
        </div>
      </footer>
    </div>
  );
}
