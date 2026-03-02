import { useStore } from '../store/useStore';
import { LogOut, Trophy, Activity, Flag } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function HUD() {
  const { players, status, peerId, setStatus } = useStore();
  
  // Use local state for fast-updating speed to avoid fully re-rendering HUD structure 60fps globally
  const [speed, setSpeed] = useState(0);

  useEffect(() => {
    // Poll the store purely for the local player's speed instead of forcing a full component subscribe array
    const interval = setInterval(() => {
      const state = useStore.getState();
      if (state.peerId && state.players[state.peerId]) {
        setSpeed(Math.round(state.players[state.peerId].speed || 0));
      }
    }, 50); // 20fps UI update for smoother digits without CPU load

    return () => clearInterval(interval);
  }, []);

  if (status !== 'playing') return null;

  const handleLeave = () => {
    setStatus('menu');
  };

  const localPlayer = peerId ? players[peerId] : null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 p-6 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        {/* Connection & Leaderboard */}
        <div className="bg-zinc-900/80 backdrop-blur-md p-4 rounded-xl border border-zinc-700/50 pointer-events-auto shadow-xl w-64">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-700/50">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-sm tracking-wide text-zinc-100 uppercase">Racers Grid</span>
          </div>
          <div className="space-y-2">
            {Object.values(players).map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded shadow-sm" style={{ backgroundColor: p.color }} />
                  <span className="font-medium text-zinc-300 truncate max-w-[100px]">{p.name} {p.id === peerId ? '(You)' : ''}</span>
                </div>
                <span className="text-zinc-500 font-mono text-[10px]">{Math.round(p.speed || 0)} MPH</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Right Controls & Status */}
        <div className="flex gap-2 pointer-events-auto">
          <div className="bg-zinc-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-zinc-700/50 flex items-center gap-2 shadow-xl">
             <Activity className="w-4 h-4 text-emerald-400" />
             <span className="text-xs font-bold text-zinc-300 tracking-wider">LIVE</span>
          </div>
          
          <div className="bg-zinc-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-zinc-700/50 flex items-center gap-2 shadow-xl">
             <Flag className="w-4 h-4 text-white" />
             <span className="text-xs font-bold text-zinc-300 tracking-wider">LAP {localPlayer?.lap || 1}</span>
          </div>

          <button 
            onClick={handleLeave}
            className="bg-red-500/90 hover:bg-red-500 backdrop-blur-md p-2 rounded-xl shadow-xl transition-colors"
          >
            <LogOut className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Speedometer Overlay */}
      <div className="flex justify-end pr-8 pb-8">
         <div className="bg-zinc-950/80 backdrop-blur-xl border-l-[3px] border-l-red-500 border border-zinc-800 p-6 rounded-full w-40 h-40 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <span className="text-5xl font-black italic text-white tracking-tighter" style={{ textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
              {speed}
            </span>
            <span className="text-xs font-bold text-zinc-500 tracking-widest uppercase mt-1">MPH</span>
            
            {/* Simple RPM bar visual */}
            <div className="w-20 h-1.5 bg-zinc-800 rounded-full mt-3 overflow-hidden">
               <div 
                 className="h-full bg-linear-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-75"
                 style={{ width: `${Math.min((speed / 134) * 100, 100)}%` }}
               />
            </div>
         </div>
      </div>
    </div>
  );
}
