import { useProgress } from '@react-three/drei';
import { useStore } from '../store/useStore';
import { useEffect, useState, useRef, useMemo } from 'react';

export default function LoadingScreen() {
  const { active, progress, total, loaded } = useProgress();
  const { status } = useStore();
  const [shouldRender, setShouldRender] = useState(true);
  const fadeOutRef = useRef(false);

  const loadingTips = useMemo(() => [
    'Hold SHIFT for nitro boost!',
    'Press SPACE + Arrow Keys to drift',
    'Press R to reset your car',
    'Master the drift for faster lap times',
    'Nitro recharges when not in use',
    'Use handbrake turns for tight corners',
  ], []);

  // Random loading tip - memoized to avoid re-calculation
  const loadingTip = useMemo(() => 
    loadingTips[Math.floor(Math.random() * loadingTips.length)],
    [loadingTips]
  );

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
        className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white transition-opacity duration-700 ease-out ${
          isLoaded ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ 
          willChange: isLoaded ? 'opacity' : 'auto',
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)' // Force GPU acceleration
        }}
      >
        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
            animation: 'gridScroll 20s linear infinite'
          }} />
        </div>

        <style>{`
          @keyframes gridScroll {
            0% { transform: translate(0, 0); }
            100% { transform: translate(50px, 50px); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div className="relative z-10 flex flex-col items-center max-w-2xl px-8">
          {/* Spinning loader icon */}
          <div className="mb-8 relative">
            <div className="w-20 h-20 border-4 border-zinc-700 border-t-red-500 rounded-full" style={{ animation: 'spin 1s linear infinite' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-3xl">🏎️</div>
            </div>
          </div>

          <h2 className="text-5xl font-black italic tracking-tighter mb-4 text-transparent bg-clip-text bg-linear-to-r from-red-500 via-orange-500 to-red-500 uppercase drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]" style={{ animation: 'pulse 2s ease-in-out infinite' }}>
            Loading Track
          </h2>

          {/* Progress bar */}
          <div className="w-full max-w-md h-4 bg-zinc-800/50 rounded-full overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.3)] backdrop-blur-sm border border-zinc-700/50 mb-6">
            <div 
              className="h-full bg-linear-to-r from-orange-500 via-red-500 to-orange-500 transition-all duration-300 ease-out relative overflow-hidden"
              style={{ 
                width: `${progress}%`,
                willChange: progress < 100 ? 'width' : 'auto',
                transform: 'translateZ(0)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite'
              }}
            >
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent" style={{ animation: 'shimmer 2s linear infinite' }} />
            </div>
          </div>

          <style>{`
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>

          {/* Loading stats */}
          <div className="flex items-center gap-6 mb-8 text-zinc-400 font-mono text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="text-zinc-600">|</div>
            <div>{loaded} / {total} assets</div>
          </div>

          {/* Loading tip */}
          <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-lg px-6 py-4 max-w-md">
            <div className="flex items-start gap-3">
              <div className="text-2xl mt-0.5">💡</div>
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Pro Tip</div>
                <div className="text-sm text-zinc-300">{loadingTip}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
