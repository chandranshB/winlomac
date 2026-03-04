import { useProgress } from '@react-three/drei';
import { useStore } from '../store/useStore';
import { useEffect, useState, useRef } from 'react';

export default function LoadingScreen() {
  const { active, progress, total, loaded } = useProgress();
  const { status } = useStore();
  const [shouldRender, setShouldRender] = useState(true);
  const fadeOutRef = useRef(false);

  // Trigger fade out when loading completes
  useEffect(() => {
    if (progress >= 100 && !active && !fadeOutRef.current) {
      fadeOutRef.current = true;
      // Remove from DOM after fade animation completes
      const timer = setTimeout(() => setShouldRender(false), 700);
      return () => clearTimeout(timer);
    }
  }, [progress, active]);

  // Early exit - don't render at all
  if (status !== 'playing' || !shouldRender) return null;

  const isLoaded = progress >= 100 && !active;

  return (
    <>
      {/* Preload hint for browser - helps with resource prioritization */}
      {!isLoaded && (
        <style>{`
          body { 
            cursor: wait; 
            overflow: hidden;
          }
          * {
            pointer-events: none;
          }
        `}</style>
      )}
      
      <div 
        className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 text-white transition-opacity duration-700 ease-out ${
          isLoaded ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ 
          willChange: isLoaded ? 'opacity' : 'auto',
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)' // Force GPU acceleration
        }}
      >
        <h2 className="text-4xl font-black italic tracking-tighter mb-4 text-transparent bg-clip-text bg-linear-to-r from-red-500 to-orange-400 uppercase animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
          Initializing Assets
        </h2>
        <div className="w-1/2 max-w-md h-3 bg-zinc-800 rounded-full overflow-hidden shadow-[0_0_15px_rgba(239,68,68,0.3)]">
          <div 
            className="h-full bg-linear-to-r from-orange-500 to-red-500 transition-all duration-200 ease-out"
            style={{ 
              width: `${progress}%`,
              willChange: progress < 100 ? 'width' : 'auto',
              transform: 'translateZ(0)' // Force GPU layer
            }}
          />
        </div>
        <p className="mt-4 text-sm font-mono text-zinc-400">
          Loading Geometry & Textures: [{loaded} / {total}] | {Math.round(progress)}%
        </p>
      </div>
    </>
  );
}
