import { useStore } from '../store/useStore';
import { Play } from 'lucide-react';

export default function Lobby() {
  const { status, playerName, playerColor, setStatus } = useStore();

  const handlePlaySolo = () => {
    // Generate a unique ID for single player
    const singlePlayerId = 'local-player';
    
    useStore.getState().setConnectionInfo(singlePlayerId, true, 'solo-lobby');
    
    useStore.getState().addPlayer({
      id: singlePlayerId,
      name: playerName,
      color: playerColor,
      position: [0, 5, 0],
      rotation: [0, 0, 0, 1],
      ready: true,
      speed: 0,
      lap: 0,
      checkpoints: 0
    });

    setStatus('playing');
  };

  if (status === 'playing') return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm text-white">
      <div className="bg-zinc-900 border border-zinc-700/50 p-8 rounded-2xl shadow-2xl max-w-md w-full">
        <h1 className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-linear-to-r from-red-500 to-orange-400 mb-8 text-center uppercase">
          Apex Solo Racing
        </h1>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Racer Name</label>
            <input 
              type="text" 
              value={playerName}
              onChange={e => useStore.getState().setPlayerName(e.target.value)}
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Car Paint</label>
            <input 
              type="color" 
              value={playerColor}
              onChange={e => useStore.getState().setPlayerColor(e.target.value)}
              className="w-full h-12 bg-zinc-950/50 border border-zinc-800 rounded-lg p-1 cursor-pointer"
            />
          </div>

          <div className="pt-4 space-y-4">
            <button 
              onClick={handlePlaySolo}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 relative overflow-hidden group"
            >
              <Play className="w-5 h-5 fill-current"/>
              Start Engine
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
