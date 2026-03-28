'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6">
      <div className="text-center space-y-4">
        <p className="text-6xl">⚡</p>
        <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">
          {error.message || 'An unexpected error occurred. Sorry about that.'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl text-sm transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
