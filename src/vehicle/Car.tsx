import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls, useGLTF } from '@react-three/drei';
import { RigidBody, RapierRigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
import { useStore } from '../store/useStore';
import * as THREE from 'three';
import { PhysicsControllerImpl } from './physics/PhysicsController';
import { BodyTiltSystemImpl } from './visual/BodyTiltSystem';
import { defaultVehicleConfig } from './config/defaultVehicleConfig';
import type { VehicleInput } from './types';

useGLTF.preload('/models/lamborghini.glb');
useGLTF.preload('/models/MazdaRX-7.glb');
useGLTF.preload('/models/bmw_m3_e46.glb');

export function Car({ isLocal, id, initialPosition, color }: { isLocal: boolean; id: string; initialPosition: [number, number, number]; color: string }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [, getKeys] = useKeyboardControls();
  const { rapier, world } = useRapier(); // Required for robust physics raycasting
  
  // Smoothing vars for remote players
  const targetPos = useRef(new THREE.Vector3(...initialPosition));
  const targetRot = useRef(new THREE.Quaternion(0, 0, 0, 1));
  
  // Real-time custom player car model property
  const carModel = useStore((state) => state.players[id]?.carModel || 'default');

  // Initialize physics controller and body tilt system (only once)
  const physicsController = useMemo(() => new PhysicsControllerImpl(defaultVehicleConfig), []);
  const bodyTiltSystem = useMemo(() => new BodyTiltSystemImpl(defaultVehicleConfig), []);
  
  // Flip timer for stuck detection
  const flipTimerRef = useRef<number>(0);
  
  // Previous velocity for acceleration calculation
  const prevVelocityRef = useRef({ x: 0, y: 0, z: 0 }); 

  useFrame((state, delta) => {
    if (!bodyRef.current || !meshRef.current) return;
    
    if (isLocal) {
      // Set rigid body reference in physics controller (first frame)
      const currentVelocity = physicsController.velocity;
      if (typeof currentVelocity === 'object' && 'x' in currentVelocity && !currentVelocity.x && !currentVelocity.y && !currentVelocity.z) {
        physicsController.setRigidBody(bodyRef.current);
      }

      const keys = getKeys();
      const currentRot = bodyRef.current.rotation();
      const quaternion = new THREE.Quaternion(currentRot.x, currentRot.y, currentRot.z, currentRot.w);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
      
      const pos = bodyRef.current.translation();

      // Robust Ground Raycast Check
      const rayorigin = { x: pos.x, y: pos.y, z: pos.z };
      const raydir = { x: 0, y: -1, z: 0 };
      const ray = new rapier.Ray(rayorigin, raydir);
      const hit = world.castRay(ray, 1.5, true); 
      const isGrounded = up.y > 0.1 && hit !== null; 

      // Arcade Gravity (Fixes floaty spaceship feeling)
      if (!isGrounded) {
         bodyRef.current.applyImpulse({ x: 0, y: -150 * defaultVehicleConfig.mass * delta, z: 0 }, true);
      }

      // Prepare vehicle input for physics controller
      const input: VehicleInput = {
        throttle: keys.forward ? 1 : 0,
        brake: keys.backward ? 1 : 0,
        steering: keys.left ? -1 : (keys.right ? 1 : 0),
        handbrake: keys.brake || false,
        reset: keys.reset || false
      };

      // Update physics controller (handles acceleration, drift, RPM, etc.)
      physicsController.update(delta, input);

      // Get current state from physics controller
      const speed = physicsController.speed;
      const forwardSpeed = physicsController.forwardSpeed;
      const rpm = physicsController.rpm.currentRPM;
      const gear = physicsController.acceleration.currentGear;
      const isDrifting = physicsController.drift.isDrifting;

      // Flip tracker (Upside down or heavily tilted and stuck)
      if (!isGrounded && speed < 2) {
         flipTimerRef.current += delta;
      } else {
         flipTimerRef.current = 0;
      }
      const isStuck = flipTimerRef.current > 1.5;

      // Manual Reset (R key)
      if (keys.reset) {
         // Determine if we are out of the arena bounds or fallen into the void
         const outOfBounds = pos.y < -5 || pos.x > 245 || pos.x < -245 || pos.z > 245 || pos.z < -245;
         
         const safeX = outOfBounds ? initialPosition[0] : pos.x;
         const safeY = outOfBounds ? initialPosition[1] : pos.y + 3;
         const safeZ = outOfBounds ? initialPosition[2] : pos.z;

         // Respawn slightly higher and upright instantly in place
         bodyRef.current.setTranslation({ x: safeX, y: safeY, z: safeZ }, true);
         bodyRef.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
         bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
         bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
         flipTimerRef.current = 0;
         physicsController.reset();

         useStore.getState().updatePlayer(id, { 
            speed: 0, gear: 1, rpm: defaultVehicleConfig.engine.idleRPM, isStuck: false 
         });
         return;
      }

      // Calculate acceleration for body tilt
      const velocity = physicsController.velocity;
      // Type guard to ensure velocity is an object with x, y, z properties
      if (typeof velocity === 'object' && 'x' in velocity) {
        const acceleration = {
          x: (velocity.x - prevVelocityRef.current.x) / delta,
          y: (velocity.y - prevVelocityRef.current.y) / delta,
          z: (velocity.z - prevVelocityRef.current.z) / delta
        };
        prevVelocityRef.current = { x: velocity.x, y: velocity.y, z: velocity.z };

        // Calculate lateral acceleration for body tilt
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
        const lateralAcceleration = acceleration.x * right.x + acceleration.y * right.y + acceleration.z * right.z;

        // Update body tilt system
        const bodyTilt = bodyTiltSystem.update(
          delta,
          { x: acceleration.x, y: acceleration.y, z: acceleration.z },
          lateralAcceleration,
          speed
        );

        // Apply body tilt to mesh (visual only, not physics)
        meshRef.current.rotation.x = bodyTilt.pitch * (Math.PI / 180); // Convert degrees to radians
        meshRef.current.rotation.z = bodyTilt.roll * (Math.PI / 180);

        // Apply steering visual tilt (drift effect)
        const driftTilt = (keys.brake && speed > 15) ? 0.12 : 0.05;
        const turningMultiplier = Math.min(speed / 10, 1.0);
        const steeringTilt = (keys.left ? driftTilt : (keys.right ? -driftTilt : 0)) * turningMultiplier;
        meshRef.current.rotation.z += steeringTilt;
      }

      // Send telemetry and state to HUD and multiplayer
      const gearDisplay: number | 'N' | 'R' = gear === -1 ? 'R' : gear;
      useStore.getState().updatePlayer(id, { 
         position: [pos.x, pos.y, pos.z],
         rotation: [currentRot.x, currentRot.y, currentRot.z, currentRot.w],
         speed: Math.abs(forwardSpeed) * 2.23694, // Convert m/s to mph for display
         gear: gearDisplay,
         rpm: rpm,
         isStuck: isStuck,
         isDrifting: isDrifting
      });

      // Void Fall recovery mechanism
      if (pos.y < -15) {
        bodyRef.current.setTranslation({ x: initialPosition[0], y: initialPosition[1], z: initialPosition[2] }, true);
        bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        bodyRef.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        physicsController.reset();
        return;
      }
      
      // --- Dynamic Smooth Camera ---
      const speedFactor = Math.min(speed / defaultVehicleConfig.maxSpeed, 1);
      const cameraDist = 8 + (speedFactor * 4);
      const cameraHeight = 3.0 + (speedFactor * 1.5);
      
      const cameraOffset = new THREE.Vector3(0, cameraHeight, cameraDist).applyQuaternion(quaternion);
      const cameraTargetPos = new THREE.Vector3(pos.x, pos.y, pos.z).add(cameraOffset);
      
      // Frame-rate independent lerping for ultra smooth camera chase
      const lerpFactor = 1.0 - Math.exp(-5 * delta);
      state.camera.position.lerp(cameraTargetPos, lerpFactor);
      
      // Add slight look-ahead based on velocity
      const lookAtPos = new THREE.Vector3(pos.x, pos.y, pos.z).add(forward.clone().multiplyScalar(speedFactor * 8));
      
      // Slerping camera look rotation for smoothness
      const currentTarget = new THREE.Vector3();
      state.camera.getWorldDirection(currentTarget);
      currentTarget.add(state.camera.position);
      currentTarget.lerp(lookAtPos, lerpFactor);
      state.camera.lookAt(currentTarget);

      // FOV speed effect
      const cam = state.camera as THREE.PerspectiveCamera;
      const targetFov = 60 + (speedFactor * 20);
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 0.15);
      cam.updateProjectionMatrix();

    } else {
      // Remote player interpolation
      const remotePlayer = useStore.getState().players[id];
      if (remotePlayer) {
        targetPos.current.set(...remotePlayer.position);
        targetRot.current.set(...remotePlayer.rotation);
        
        meshRef.current.position.lerp(targetPos.current, 0.3);
        meshRef.current.quaternion.slerp(targetRot.current, 0.3);
      }
    }
  });

  if (isLocal) {
    // Prepare telemetry for gauge display (now handled in Scene.tsx)
    return (
      <>
        <RigidBody ref={bodyRef} position={initialPosition} colliders={false} ccd={true} linearDamping={0.4} angularDamping={2.5} friction={0.1} restitution={0.4}>
          {/* Explicit Physics Box (Half-extents of the main car hull) added friction and anti-bouncing properties explicitly */}
          <CuboidCollider args={[0.9, 0.4, 2.1]} position={[0, 0.5, 0]} mass={1200} friction={0.1} restitution={0.4} />
          <CuboidCollider args={[0.8, 0.3, 1.0]} position={[0, 1.1, -0.5]} mass={100} friction={0.1} restitution={0.4} />
          
          <group ref={meshRef}>
             <CarMesh color={color} model={carModel} />
          </group>
        </RigidBody>
        {/* Optimized Particle system mapped globally, unaffected by car rotation */}
        <TireSmoke isDrifting={useStore.getState().players[id]?.isDrifting || false} carBodyRef={bodyRef} />
      </>
    );
  }

  // Remote player return block
  return (
    <group ref={meshRef} position={initialPosition}>
       <CarMesh color={color} model={carModel} />
    </group>
  );
}

const DUMMY = new THREE.Object3D();
const MAX_PARTICLES = 150;

function TireSmoke({ isDrifting, carBodyRef }: { isDrifting: boolean, carBodyRef: React.RefObject<RapierRigidBody | null> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const emitIndex = useRef(0);
  
  const particles = useRef(Array.from({ length: MAX_PARTICLES }, () => ({
    pos: new THREE.Vector3(0, -999, 0),
    vel: new THREE.Vector3(),
    life: 0,
  })));

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    
    // Spawn particles out of rear tires when drifting
    if (isDrifting && carBodyRef.current) {
      const pos = carBodyRef.current.translation();
      const rot = carBodyRef.current.rotation();
      const quat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
      
      // Left and Right Rear tires emit
      for (let i = -1; i <= 1; i += 2) {
         const p = particles.current[emitIndex.current];
         // Placed behind (-forward) and to the sides (right)
         p.pos.set(
            pos.x + right.x * i * 0.8 - forward.x * 1.5, 
            pos.y - 0.3, 
            pos.z + right.z * i * 0.8 - forward.z * 1.5
         );
         // Smoke bursts slightly upward
         p.vel.set((Math.random() - 0.5) * 2, Math.random() * 2 + 1, (Math.random() - 0.5) * 2);
         p.life = 1.0;
         
         emitIndex.current = (emitIndex.current + 1) % MAX_PARTICLES;
      }
    }

    // Process physics and rendering for all fast-particles
    particles.current.forEach((p, i) => {
       if (p.life > 0) {
          p.life -= delta * 1.2; // Fade out rapidly
          p.pos.addScaledVector(p.vel, delta);
          p.pos.y = Math.max(p.pos.y, 0.1); // Prevent sinking into road
          
          DUMMY.position.copy(p.pos);
          const scale = 1 + (1 - p.life) * 3; // Smoke blooms and expands
          DUMMY.scale.set(scale, scale, scale);
          DUMMY.updateMatrix();
          
          meshRef.current!.setMatrixAt(i, DUMMY.matrix);
          meshRef.current!.setColorAt(i, new THREE.Color().setHSL(0, 0, 0.5 + p.life * 0.5)); // White fading to grey
       } else {
          DUMMY.position.set(0, -999, 0); // Hide dead particles perfectly
          DUMMY.scale.set(0,0,0);
          DUMMY.updateMatrix();
          meshRef.current!.setMatrixAt(i, DUMMY.matrix);
       }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.2} depthWrite={false} />
    </instancedMesh>
  );
}

// Separate component for hook-compliant GLTF dynamic loading
function LoadedCarModel({ model, color }: { model: string; color: string }) {
  const { scene } = useGLTF(model);
  
  // Create a deep clone so multiple remote players can have the exact same car model simultaneously without stealing visual nodes
  const clonedScene = scene.clone(true);
  
  // Enable shadows down the entire node tree and find the main car body paint
  clonedScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          
          let modified = false;
          const newMaterials = materials.map(m => {
              if (!m.name) return m;
              const name = m.name.toLowerCase();
              // Common keywords used by 3D artists to label the car's paint job
              if (name.includes('paint') || name.includes('body') || name.includes('exterior') || name.includes('color') || name.includes('shell') || name.includes('car') || name.includes('metal')) {
                  const newMat = (m as THREE.MeshStandardMaterial).clone();
                  newMat.color.set(color);
                  modified = true;
                  return newMat;
              }
              return m;
          });
          
          if (modified) {
              mesh.material = Array.isArray(mesh.material) ? newMaterials : newMaterials[0];
          }
      }
    }
  });

  let position: [number, number, number] = [0, -0.4, 0];
  // Universally fix the 180-degree flipped car issue for all imported models!
  const rotation: [number, number, number] = [0, Math.PI, 0]; 
  let scale: [number, number, number] = [1, 1, 1];

  // Specific 3D Model Height/Size Corrections (No more rotation overrides needed)
  if (model.includes('Mazda')) {
     position = [0, 0.4, 0]; // Raised out of the ground
  } else if (model.includes('lamborghini')) {
     position = [0, 0.2, 0]; 
     scale = [0.01, 0.01, 0.01]; // Scale down the ridiculously massive lamborghini
  } else if (model.includes('bmw_m3_e46')) {
     position = [0, 0.4, 0]; // Raised out of the ground
  }

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  );
}

// Mesh Router Component
function CarMesh({ color, model }: { color: string, model: string }) {
  if (model !== 'default') {
    return <LoadedCarModel model={model} color={color} />;
  }

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1.8, 0.8, 4.2]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.1, -0.5]}>
        <boxGeometry args={[1.6, 0.6, 2.0]} />
        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} />
      </mesh>

      <pointLight position={[0.7, 0.5, -2.2]} color="#ffffff" intensity={2} distance={20} castShadow/>
      <pointLight position={[-0.7, 0.5, -2.2]} color="#ffffff" intensity={2} distance={20} castShadow/>
      
      <mesh position={[0.7, 0.5, -2.11]}><planeGeometry args={[0.4, 0.2]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <mesh position={[-0.7, 0.5, -2.11]}><planeGeometry args={[0.4, 0.2]} /><meshBasicMaterial color="#ffffff" /></mesh>
      
      <mesh position={[0.7, 0.6, 2.11]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.5, 0.2]} /><meshBasicMaterial color="#ff0000" /></mesh>
      <mesh position={[-0.7, 0.6, 2.11]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.5, 0.2]} /><meshBasicMaterial color="#ff0000" /></mesh>

      <mesh position={[1, 0.3, 1.4]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.4, 0.4, 0.3, 16]}/><meshStandardMaterial color="#222"/></mesh>
      <mesh position={[-1, 0.3, 1.4]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.4, 0.4, 0.3, 16]}/><meshStandardMaterial color="#222"/></mesh>
      <mesh position={[1, 0.3, -1.4]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.4, 0.4, 0.3, 16]}/><meshStandardMaterial color="#222"/></mesh>
      <mesh position={[-1, 0.3, -1.4]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.4, 0.4, 0.3, 16]}/><meshStandardMaterial color="#222"/></mesh>
    </group>
  );
}
