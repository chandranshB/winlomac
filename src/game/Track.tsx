import React from 'react';
import { RigidBody } from '@react-three/rapier';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { loadAssetWithFallback, ASSETS } from '../utils/assetLoader';

export function Track() {
  const [trackUrl, setTrackUrl] = React.useState<string | null>(null);

  // Load track URL with fallback strategy
  React.useEffect(() => {
    loadAssetWithFallback(ASSETS.TRACK_OVAL).then(setTrackUrl);
  }, []);

  const { scene } = useGLTF(trackUrl || ASSETS.TRACK_OVAL.localPath);

  // Strip the invisible walls and complex heavy visual meshes from the physics array!
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone(true);
    const badNodes: THREE.Object3D[] = [];
    
    // Traverse the map to ensure physics and shadows are robust
    clone.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        const meshName = mesh.name.toLowerCase();
        
        // Massive optimization: Do not run Rapier raycasts or shadow math on the high poly crowds, bleachers, or skybox!
        if (
          meshName.includes('bound') || 
          meshName.includes('wall_invisible') || 
          meshName.includes('collision') ||
          meshName.includes('trigger') ||
          meshName.includes('sky') ||
          meshName.includes('tree') ||
          meshName.includes('spectator') ||
          meshName.includes('bleacher') ||
          meshName.includes('stand') ||
          (meshName.includes('plane') && meshName.includes('invisible'))
        ) {
          badNodes.push(mesh);
          return; 
        }

        // Only explicitly drawn roads/terrain receive costly shadows
        // Disabling castShadow completely for the track terrain frees up HUGE amounts of GPU texture memory!!
        mesh.receiveShadow = true;
        mesh.castShadow = false; 
        
        // Double side the materials ONLY where necessary (saves drawing 50,000 backfaces per frame)
        if (meshName.includes('track') || meshName.includes('road')) {
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                 mesh.material.forEach(m => m.side = THREE.DoubleSide);
              } else {
                 mesh.material.side = THREE.DoubleSide;
              }
            }
        }
      }
    });
    
    badNodes.forEach(node => node.removeFromParent());
    return clone;
  }, [scene]);

  return (
    <group>
      {/* Invisible Safety Catch Floor: Prevents cars from falling through the world endlessly if they glitch through a wall */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -2, 0]} friction={0.8}>
        <mesh visible={false}>
          <boxGeometry args={[2000, 2, 2000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>

      {/* Render the heavily optimized map natively */}
      <RigidBody type="fixed" colliders="trimesh" friction={0.6} restitution={0.1}>
        <primitive object={clonedScene} />
      </RigidBody>
    </group>
  );
}

// Preload track with fallback
loadAssetWithFallback(ASSETS.TRACK_OVAL).then(url => {
  useGLTF.preload(url);
});
