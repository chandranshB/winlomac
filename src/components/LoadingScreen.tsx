import { useProgress } from '@react-three/drei';
import { useStore } from '../store/useStore';

export default function LoadingScreen() {
  const { active, progress, total, loaded } = useProgress();
  const { status } = useStore();

  // If we're not supposed to be playing/loading a map yet, don't show the game map loading screen
  if (status !== 'playing' || !active) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 text-white transition-opacity duration-500">
      <h2 className="text-4xl font-black italic tracking-tighter mb-4 text-transparent bg-clip-text bg-linear-to-r from-red-500 to-orange-400 uppercase animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
        Initializing Assets
      </h2>
      <div className="w-1/2 max-w-md h-3 bg-zinc-800 rounded-full overflow-hidden shadow-[0_0_15px_rgba(239,68,68,0.3)]">
        <div 
          className="h-full bg-linear-to-r from-orange-500 to-red-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-4 text-sm font-mono text-zinc-400">
        Loading Geometry & Textures: [{loaded} / {total}] | {Math.round(progress)}%
      </p>
    </div>
  );
}
