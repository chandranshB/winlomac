import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import { Physics, RigidBody } from '@react-three/rapier';
import { Sky } from '@react-three/drei';
import { useStore } from '../store/useStore';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Car } from '../vehicle/Car';
import { Track } from './Track';
import { NitroBlur } from './NitroBlur';

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

export function GameScene() {
  const { players, peerId } = useStore();
  const blurEffectRef = useRef<any>(null);

  const activePlayers = Object.values(players);

  return (
    <div className="w-full h-screen relative bg-black">
      <Canvas 
         shadows={{ type: THREE.BasicShadowMap }} 
         camera={{ position: [0, 5, 15], fov: 60 }}
         dpr={[1, 1.5]} // Prevent ultra-high-definition pixel-density renders that kill GPUs (capped at 1.5)
         gl={{ antialias: false, powerPreference: "high-performance" }} // Hardware antialiasing off saves ~30% GPU overhead
      >
        <fog attach="fog" args={['#87CEEB', 20, 100]} />
        <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={1.0} />
        <ambientLight intensity={0.5} />
        <directionalLight 
          castShadow 
          position={[50, 50, -20]} 
          intensity={1.5} 
          shadow-mapSize-width={512}  // Reduced shadow resolution significantly for low end integrated graphics
          shadow-mapSize-height={512}
          shadow-camera-far={200}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
          shadow-bias={-0.001}
        />

        <Suspense fallback={null}>
          <Physics gravity={[0, -30, 0]}>
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
              <meshStandardMaterial color="#0A3311" roughness={0.9} /> {/* Made ground green like grass */}
            </mesh>

            <Track />

            {/* Removed artificial red boundaries! Players can now fall off freely */}

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
          </Physics>
          
          {/* Smooth blur strength controller */}
          <BlurController effectRef={blurEffectRef} />
        </Suspense>

        {/* AAA Visual Effects: High Performance micro-bloom for Car Paint Highlights and Nitro. 
            multisampling={0} prevents Context Loss on low end GPU devices! */}
        <EffectComposer multisampling={0}>
           <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.9} intensity={0.6} mipmapBlur />
           <NitroBlur ref={blurEffectRef} strength={0} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
