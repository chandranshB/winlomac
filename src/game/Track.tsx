import React, { useMemo, useState } from 'react';
import { RigidBody } from '@react-three/rapier';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { loadAssetWithFallback, ASSETS } from '../utils/assetLoader';

export function Track() {
  const [trackUrl, setTrackUrl] = useState<string>(ASSETS.TRACK_OVAL.localPath);
  const [isReady, setIsReady] = useState(false);

  // Load track URL with fallback strategy
  React.useEffect(() => {
    loadAssetWithFallback(ASSETS.TRACK_OVAL)
      .then(url => {
        setTrackUrl(url);
        // Small delay to ensure model is loaded
        setTimeout(() => setIsReady(true), 100);
      })
      .catch(err => {
        console.error('[Track] Failed to load track:', err);
        // Still mark as ready to show something
        setTimeout(() => setIsReady(true), 100);
      });
  }, []);

  const { scene } = useGLTF(trackUrl);

  // Strip the invisible walls and complex heavy visual meshes from the physics array!
  const clonedScene = useMemo(() => {
    if (!scene) return null;
    
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
        mesh.receiveShadow = true;
        mesh.castShadow = false; 
        mesh.frustumCulled = true;
        
        // Double side the materials ONLY where necessary
        if (meshName.includes('track') || meshName.includes('road')) {
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                 mesh.material.forEach(m => {
                   m.side = THREE.DoubleSide;
                   if (m instanceof THREE.MeshStandardMaterial) {
                     m.needsUpdate = false;
                   }
                 });
              } else {
                 mesh.material.side = THREE.DoubleSide;
                 if (mesh.material instanceof THREE.MeshStandardMaterial) {
                   mesh.material.needsUpdate = false;
                 }
              }
            }
        }
      }
    });
    
    badNodes.forEach(node => node.removeFromParent());
    return clone;
  }, [scene]);

  // Don't render if scene isn't ready
  if (!clonedScene || !isReady) return null;

  return (
    <group>
      {/* Invisible Safety Catch Floor */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -2, 0]} friction={0.8}>
        <mesh visible={false}>
          <boxGeometry args={[2000, 2, 2000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>

      {/* Render the map with trimesh collider (more compatible than hull) */}
      <RigidBody 
        type="fixed" 
        colliders="trimesh" 
        friction={0.6} 
        restitution={0.1}
      >
        <primitive object={clonedScene} />
      </RigidBody>
    </group>
  );
}

// Preload track
loadAssetWithFallback(ASSETS.TRACK_OVAL).then(url => {
  useGLTF.preload(url);
}).catch(err => {
  console.error('[Track] Failed to preload:', err);
});
