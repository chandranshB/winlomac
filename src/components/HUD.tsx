import { useStore } from '../store/useStore';
import { LogOut, Trophy, Activity, Flag } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function HUD() {
  const { players, status, peerId, setStatus } = useStore();
  
  // Use local state for fast-updating speed to avoid fully re-rendering HUD structure 60fps globally
  const [speed, setSpeed] = useState(0);
  const [gear, setGear] = useState<number | string>('N');
  const [rpm, setRpm] = useState(1000);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    // Poll the store purely for the local player's details instead of forcing a full component subscribe array
    const interval = setInterval(() => {
      const state = useStore.getState();
      if (state.peerId && state.players[state.peerId]) {
        setSpeed(Math.round(state.players[state.peerId].speed || 0));
        setGear(state.players[state.peerId].gear || 'N');
        setRpm(state.players[state.peerId].rpm || 1000);
        setIsStuck(state.players[state.peerId].isStuck || false);
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

      {/* Stuck Respawn Prompt */}
      {isStuck && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
           <div className="bg-red-500/20 backdrop-blur-md px-8 py-4 rounded-xl border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-pulse">
              <span className="text-2xl font-black italic text-white tracking-widest uppercase shadow-black drop-shadow-md">Press 'R' to Respawn</span>
           </div>
        </div>
      )}

      {/* NFS-Style Speedometer Overlay */}
      <div className="flex justify-end pr-8 pb-8">
         <div className="relative bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 p-8 rounded-full w-48 h-48 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.6)]">
            
            {/* RPM Circular Gauge (CSS Trick) */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none" 
              viewBox="0 0 100 100"
              style={{ transform: 'rotate(135deg)' }}
            >
               {/* Gauge Track */}
               <circle 
                 cx="50" cy="50" r="46" 
                 fill="none" 
                 stroke="rgba(255,255,255,0.05)" 
                 strokeWidth="6" 
                 strokeDasharray="216.77 289.03"
                 strokeLinecap="round"
               />
               {/* Active RPM Gauge Fill */}
               <circle 
                 cx="50" cy="50" r="46" 
                 fill="none" 
                 stroke={rpm > 7000 ? "#ef4444" : "#10b981"} 
                 strokeWidth="6" 
                 strokeLinecap="round"
                 strokeDasharray="216.77 289.03" // 270 degree sweep
                 strokeDashoffset={216.77 - (Math.min(rpm / 8000, 1) * 216.77)} 
                 className="transition-all duration-75 ease-out"
               />
            </svg>

            {/* Speed Value */}
            <div className="flex flex-col items-center justify-center z-10 w-full mb-1">
              <span className="text-6xl font-black italic text-white tracking-tighter tabular-nums leading-none" style={{ textShadow: '0 0 15px rgba(255,255,255,0.4)' }}>
                {speed}
              </span>
              <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase mt-1">MPH</span>
            </div>
            
            {/* Gear Indicator */}
            <div className="absolute bottom-6 right-6 bg-zinc-900 border border-zinc-700 w-10 h-10 rounded-full flex items-center justify-center shadow-lg pointer-events-none z-20">
              <span className={`text-xl font-bold ${gear === 'R' ? 'text-red-500' : gear === 'N' ? 'text-zinc-400' : 'text-emerald-400'}`}>
                {gear}
              </span>
            </div>
            
            {/* Direct RPM text readout inside */}
            <div className="absolute top-6 flex flex-col items-center pointer-events-none z-10">
              <span className={`text-xs font-mono font-bold ${rpm > 7500 ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`}>
                {Math.round(rpm)}
              </span>
              <span className="text-[8px] font-bold text-zinc-600 tracking-widest uppercase">RPM</span>
            </div>
         </div>
      </div>
    </div>
  );
}
