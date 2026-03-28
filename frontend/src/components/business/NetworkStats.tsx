import { Users, Network, Star } from 'lucide-react';

interface NetworkStatsProps {
  friendCount: number;
  hop2Count: number;
  avgRating: number;
}

export default function NetworkStats({ friendCount, hop2Count, avgRating }: NetworkStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-amber-50 rounded-xl p-4 text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          <span className="text-2xl font-bold text-slate-900">{avgRating.toFixed(1)}</span>
        </div>
        <p className="text-xs text-slate-500">Network avg</p>
      </div>
      <div className="bg-slate-50 rounded-xl p-4 text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <Users className="w-4 h-4 text-slate-500" />
          <span className="text-2xl font-bold text-slate-900">{friendCount}</span>
        </div>
        <p className="text-xs text-slate-500">Friends reviewed</p>
      </div>
      <div className="bg-slate-50 rounded-xl p-4 text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <Network className="w-4 h-4 text-slate-400" />
          <span className="text-2xl font-bold text-slate-900">{hop2Count}</span>
        </div>
        <p className="text-xs text-slate-500">2nd-hop reviews</p>
      </div>
    </div>
  );
}
