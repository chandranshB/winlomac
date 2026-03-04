import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Physics, RigidBody } from '@react-three/rapier';
import { Sky } from '@react-three/drei';
import { useStore } from '../store/useStore';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Car } from '../vehicle/Car';
import { Track } from './Track';
import { NitroBlur } from './NitroBlur';
import { CinematicIntro } from './CinematicIntro';

// Smooth blur controller component
function BlurController({ effectRef }: { effectRef: React.RefObject<any> }) {
  const { players, peerId } = useStore();
  const currentStrength = useRef(0);

  useFrame((_, delta) => {
    if (!effectRef.current) return;
    
    // Check if local player is using nitro
    const isNitroActive = peerId ? (players[peerId]?.isNitro || false) : false;
    const targetStrength = isNitroActive ? 1.0 : 0.0;
    
    // Smooth lerp for professional fade in/out
    currentStrength.current = THREE.MathUtils.lerp(
      currentStrength.current,
      targetStrength,
      delta * 8 // Fast response but smooth
    );
    
    // Update the effect's strength uniform
    const strengthUniform = effectRef.current.uniforms.get('strength');
    if (strengthUniform) {
      strengthUniform.value = currentStrength.current;
    }
  });

  return null;
}

// Progressive scene loader - loads heavy elements after initial render
function ProgressiveScene({ 
  introComplete, 
  activePlayers, 
  peerId, 
  blurEffectRef 
}: { 
  introComplete: boolean;
  activePlayers: any[];
  peerId: string | null;
  blurEffectRef: React.RefObject<any>;
}) {
  const [loadPhase, setLoadPhase] = useState(1); // Start at phase 1 to load track immediately

  useEffect(() => {
    // Phase 1: Track loads immediately (no delay)
    // Phase 2: Add effects after intro completes
    
    if (loadPhase === 1 && introComplete) {
      const timer = setTimeout(() => setLoadPhase(2), 50);
      return () => clearTimeout(timer);
    }
  }, [loadPhase, introComplete]);

  return (
    <Physics gravity={[0, -30, 0]} paused={!introComplete}>
      {/* Ground Physics (Opacity 0 mesh to guarantee the AABB collision block matches the arena) */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -30, 0]}>
        <mesh>
          <boxGeometry args={[500, 2, 500]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>

      {/* Ground Visuals (Separated from physics) */}
      <mesh receiveShadow position={[0, -29, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#0A3311" roughness={0.9} />
      </mesh>

      {/* Load track immediately - no delay */}
      <Track />

      {/* Players loop */}
      {activePlayers.map((player) => (
        <Car 
          key={player.id}
          id={player.id}
          isLocal={player.id === peerId}
          initialPosition={player.position}
          initialRotation={player.rotation}
          color={player.color}
        />
      ))}
      
      {/* Load blur controller after intro */}
      {loadPhase >= 2 && <BlurController effectRef={blurEffectRef} />}
    </Physics>
  );
}

export function GameScene() {
  const { players, peerId } = useStore();
  const blurEffectRef = useRef<any>(null);
  const [introComplete, setIntroComplete] = useState(false);
  const [effectsReady, setEffectsReady] = useState(false);

  // Memoize callback to prevent recreation
  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true);
    // Enable effects after intro
    setTimeout(() => setEffectsReady(true), 100);
  }, []);

  // Memoize active players array to prevent unnecessary re-renders
  const activePlayers = useMemo(() => Object.values(players), [players]);

  return (
    <div className="w-full h-screen relative bg-black">
      <Canvas 
         shadows={{ type: THREE.BasicShadowMap }} 
         camera={{ position: [0, 5, 15], fov: 60 }}
         dpr={[1, 1.5]}
         gl={{ 
           antialias: false, 
           powerPreference: "high-performance",
           stencil: false,
           depth: true,
           alpha: false // Disable alpha for better performance
         }}
         frameloop="always"
         performance={{ min: 0.5 }} // Allow frame rate to drop if needed
      >
        <color attach="background" args={['#87CEEB']} />
        <fog attach="fog" args={['#87CEEB', 20, 100]} />
        
        {/* Simplified lighting during load */}
        <ambientLight intensity={0.5} />
        <directionalLight 
          castShadow 
          position={[50, 50, -20]} 
          intensity={1.5} 
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
          shadow-camera-far={200}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
          shadow-bias={-0.001}
        />

        <Suspense fallback={null}>
          {/* Cinematic camera intro animation */}
          <CinematicIntro onComplete={handleIntroComplete} />
          
          <ProgressiveScene 
            introComplete={introComplete}
            activePlayers={activePlayers}
            peerId={peerId}
            blurEffectRef={blurEffectRef}
          />
          
          {/* Load Sky after intro starts */}
          {introComplete && <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={1.0} />}
        </Suspense>

        {/* AAA Visual Effects: Load after intro completes */}
        {effectsReady && (
          <EffectComposer multisampling={0}>
            <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.9} intensity={0.6} mipmapBlur />
            <NitroBlur ref={blurEffectRef} strength={0} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
