import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6">
      <div className="text-center space-y-4">
        <p className="text-6xl">🌵</p>
        <h1 className="text-2xl font-bold text-slate-900">Nothing here</h1>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">
          This page doesn&apos;t exist, or was moved somewhere else.
        </p>
        <Link
          href="/feed"
          className="inline-flex items-center px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl text-sm transition-colors"
        >
          Back to feed
        </Link>
      </div>
    </div>
  );
}
