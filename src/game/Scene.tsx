import { Canvas } from '@react-three/fiber';
import { Physics, RigidBody } from '@react-three/rapier';
import { Sky } from '@react-three/drei';
import { useStore } from '../store/useStore';
import * as THREE from 'three';
import { Car } from '../vehicle/Car';
import { Track } from './Track';
import { Suspense } from 'react';

export function GameScene() {
  const { players, peerId } = useStore();

  const activePlayers = Object.values(players);

  return (
    <div className="w-full h-screen relative bg-black">
      <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [0, 5, 15], fov: 60 }}>
        <fog attach="fog" args={['#87CEEB', 20, 100]} />
        <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={1.0} />
        <ambientLight intensity={0.5} />
        <directionalLight 
          castShadow 
          position={[50, 50, -20]} 
          intensity={1.5} 
          shadow-mapSize-width={2048} 
          shadow-mapSize-height={2048}
        />

        <Suspense fallback={null}>
          <Physics>
            {/* Ground Physics (Opacity 0 mesh to guarantee the AABB collision block matches the arena) */}
            <RigidBody type="fixed" colliders="cuboid" position={[0, -1, 0]}>
              <mesh>
                <boxGeometry args={[500, 2, 500]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            </RigidBody>

            {/* Ground Visuals (Separated from physics) */}
            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[500, 500]} />
              <meshStandardMaterial color="#0A3311" roughness={0.9} /> {/* Made ground green like grass */}
            </mesh>

            <Track />

            {/* Arena Boundaries (Solid walls around the 500x500 plane) */}
            <RigidBody type="fixed" position={[250, 10, 0]} friction={0} restitution={0.4}>
              <mesh receiveShadow castShadow>
                <boxGeometry args={[4, 20, 500]} />
                <meshStandardMaterial color="#881111" />
              </mesh>
            </RigidBody>
            <RigidBody type="fixed" position={[-250, 10, 0]} friction={0} restitution={0.4}>
              <mesh receiveShadow castShadow>
                <boxGeometry args={[4, 20, 500]} />
                <meshStandardMaterial color="#881111" />
              </mesh>
            </RigidBody>
            <RigidBody type="fixed" position={[0, 10, 250]} friction={0} restitution={0.4}>
              <mesh receiveShadow castShadow>
                <boxGeometry args={[500, 20, 4]} />
                <meshStandardMaterial color="#881111" />
              </mesh>
            </RigidBody>
            <RigidBody type="fixed" position={[0, 10, -250]} friction={0} restitution={0.4}>
              <mesh receiveShadow castShadow>
                <boxGeometry args={[500, 20, 4]} />
                <meshStandardMaterial color="#881111" />
              </mesh>
            </RigidBody>

            {/* Players loop */}
            {activePlayers.map((player) => (
              <Car 
                key={player.id}
                id={player.id}
                isLocal={player.id === peerId}
                initialPosition={player.position}
                color={player.color}
              />
            ))}
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
}
