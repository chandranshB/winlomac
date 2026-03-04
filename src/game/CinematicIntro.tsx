import { useRef, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import * as THREE from 'three';

interface CinematicIntroProps {
  onComplete?: () => void;
}

// Optimized easing function (ease-out-cubic for snappier feel)
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const { camera, gl } = useThree();
  const { progress } = useProgress();
  
  const state = useRef({
    started: false,
    time: 0,
    complete: false,
    warmupFrames: 0
  });

  // Memoize vectors to avoid recreation every frame
  const vectors = useMemo(() => ({
    startPos: new THREE.Vector3(15, 18, 35),
    startLook: new THREE.Vector3(0, 2, -5),
    endPos: new THREE.Vector3(0, 5, 15),
    endLook: new THREE.Vector3(0, 0, 0),
    tempLook: new THREE.Vector3()
  }), []);

  const DURATION = 2.2;
  const DELAY = 0.15;
  const WARMUP_FRAMES = 3; // Let GPU warm up before animation

  useFrame((_, delta) => {
    const s = state.current;
    
    // Early exit if complete
    if (s.complete) return;

    // Wait for full load
    if (progress < 100) {
      // Set initial position while loading
      if (!s.started) {
        camera.position.copy(vectors.startPos);
        camera.lookAt(vectors.startLook);
        // Force a render to compile shaders
        gl.compile(camera as any, camera as any);
      }
      return;
    }

    // GPU warmup period - render a few frames before animating
    if (s.warmupFrames < WARMUP_FRAMES) {
      s.warmupFrames++;
      camera.position.copy(vectors.startPos);
      camera.lookAt(vectors.startLook);
      return;
    }

    // Initialize animation
    if (!s.started) {
      s.started = true;
      s.time = -DELAY;
      return;
    }

    s.time += delta;

    // Delay period
    if (s.time < 0) return;

    // Calculate progress with clamping
    const t = Math.min(s.time / DURATION, 1);
    const eased = easeOutCubic(t);

    // Direct vector operations (more efficient than lerpVectors)
    camera.position.x = vectors.startPos.x + (vectors.endPos.x - vectors.startPos.x) * eased;
    camera.position.y = vectors.startPos.y + (vectors.endPos.y - vectors.startPos.y) * eased;
    camera.position.z = vectors.startPos.z + (vectors.endPos.z - vectors.startPos.z) * eased;
    
    // Interpolate look-at target (reuse temp vector)
    vectors.tempLook.x = vectors.startLook.x + (vectors.endLook.x - vectors.startLook.x) * eased;
    vectors.tempLook.y = vectors.startLook.y + (vectors.endLook.y - vectors.startLook.y) * eased;
    vectors.tempLook.z = vectors.startLook.z + (vectors.endLook.z - vectors.startLook.z) * eased;
    camera.lookAt(vectors.tempLook);

    // Complete
    if (t >= 1) {
      s.complete = true;
      camera.position.copy(vectors.endPos);
      camera.lookAt(vectors.endLook);
      onComplete?.();
    }
  });

  return null;
}
