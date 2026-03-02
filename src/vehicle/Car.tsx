import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { RigidBody, RapierRigidBody, CuboidCollider } from '@react-three/rapier';
import { useStore } from '../store/useStore';
import * as THREE from 'three';

export function Car({ isLocal, id, initialPosition, color }: { isLocal: boolean; id: string; initialPosition: [number, number, number]; color: string }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [, getKeys] = useKeyboardControls();
  
  // Smoothing vars for remote players
  const targetPos = useRef(new THREE.Vector3(...initialPosition));
  const targetRot = useRef(new THREE.Quaternion(0, 0, 0, 1));
  
  // Game mechanic constants
  const MAX_SPEED = 60;
  const ACCELERATION = 120;
  const BRAKING = 150;
  const BASE_TURN_SPEED = 3.0;
  const GRIP = 0.95; // Higher = tighter turns, less drifting

  useFrame((state, delta) => {
    if (!bodyRef.current || !meshRef.current) return;
    
    if (isLocal) {
      const keys = getKeys();
      const currentVel = bodyRef.current.linvel();
      const currentRot = bodyRef.current.rotation();
      const quaternion = new THREE.Quaternion(currentRot.x, currentRot.y, currentRot.z, currentRot.w);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
      
      const speed = new THREE.Vector3(currentVel.x, currentVel.y, currentVel.z).length();
      const forwardSpeed = new THREE.Vector3(currentVel.x, currentVel.y, currentVel.z).dot(forward);
      
      // Send speed to HUD
      useStore.getState().updatePlayer(id, { speed: Math.abs(forwardSpeed) * 2.23694 }); // m/s to mph

      // --- Acceleration & Braking ---
      if (keys.forward && forwardSpeed < MAX_SPEED) {
         bodyRef.current.applyImpulse(forward.clone().multiplyScalar(ACCELERATION * delta), true);
      }
      if (keys.backward) {
         if (forwardSpeed > 1) { // Braking
            bodyRef.current.applyImpulse(forward.clone().multiplyScalar(-BRAKING * delta), true);
         } else if (forwardSpeed > -MAX_SPEED / 2) { // Reverse
            bodyRef.current.applyImpulse(forward.clone().multiplyScalar(-ACCELERATION * 0.5 * delta), true);
         }
      }

      // Cancel out sideways velocity to simulate tire grip
      const sidewaysVelocity = new THREE.Vector3(currentVel.x, 0, currentVel.z).dot(right);
      
      const currentGrip = (keys.brake) ? 0.1 : GRIP; // Press space to drift (heavy loss of grip)
      
      // Apply counter impulse to sideways momentum relative to mass (1200)
      const mass = 1200;
      const counterForce = right.clone().multiplyScalar(-sidewaysVelocity * mass * currentGrip * 5 * delta); 
      bodyRef.current.applyImpulse(counterForce, true);

      // --- Steering ---
      // Steering should be affected by how fast we are going (can't turn much if still)
      let turningMultiplier = Math.min(speed / 10, 1.0); 
      // Reverse turning direction if going backwards
      if (forwardSpeed < -0.1) turningMultiplier *= -1;

      if (speed > 1) {
        // Use proper physical torque for rotation to prevent collision jitter from forced setRotation
        const turnStrength = BASE_TURN_SPEED * turningMultiplier * mass * 8 * delta;
        if (keys.left) bodyRef.current.applyTorqueImpulse({ x: 0, y: turnStrength, z: 0 }, true);
        if (keys.right) bodyRef.current.applyTorqueImpulse({ x: 0, y: -turnStrength, z: 0 }, true);
      }
      
      // Fake visual tilt for drifting
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, (keys.left ? 0.05 : (keys.right ? -0.05 : 0)) * turningMultiplier, 0.1);

      // --- Dynamic Smooth Camera ---
      const pos = bodyRef.current.translation();
      
      // Fall recovery mechanism
      if (pos.y < -10) {
        bodyRef.current.setTranslation({ x: initialPosition[0], y: initialPosition[1], z: initialPosition[2] }, true);
        bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        bodyRef.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        return;
      }
      
      // Camera pulls back on higher speeds
      const speedFactor = Math.min(speed / MAX_SPEED, 1);
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
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 0.1);
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
    return (
      <RigidBody ref={bodyRef} position={initialPosition} colliders={false} ccd={true} linearDamping={1.5} angularDamping={5.0} friction={0}>
        {/* Explicit Physics Box (Half-extents of the main car hull) */}
        <CuboidCollider args={[0.9, 0.4, 2.1]} position={[0, 0.5, 0]} mass={1200} />
        <CuboidCollider args={[0.8, 0.3, 1.0]} position={[0, 1.1, -0.5]} mass={100} />
        
        <group ref={meshRef}>
          {/* Main Car Body */}
          <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
            <boxGeometry args={[1.8, 0.8, 4.2]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} />
          </mesh>
          {/* Car Cabin */}
          <mesh castShadow receiveShadow position={[0, 1.1, -0.5]}>
            <boxGeometry args={[1.6, 0.6, 2.0]} />
            <meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} />
          </mesh>

          {/* Headlights */}
          <pointLight position={[0.7, 0.5, -2.2]} color="#ffffff" intensity={2} distance={20} castShadow/>
          <pointLight position={[-0.7, 0.5, -2.2]} color="#ffffff" intensity={2} distance={20} castShadow/>
          
          <mesh position={[0.7, 0.5, -2.11]}>
            <planeGeometry args={[0.4, 0.2]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.7, 0.5, -2.11]}>
            <planeGeometry args={[0.4, 0.2]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          
          {/* Taillights */}
          <mesh position={[0.7, 0.6, 2.11]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.5, 0.2]} />
            <meshBasicMaterial color="#ff0000" />
          </mesh>
          <mesh position={[-0.7, 0.6, 2.11]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.5, 0.2]} />
            <meshBasicMaterial color="#ff0000" />
          </mesh>

          {/* Wheels (Static visuals for now) */}
          <mesh position={[1, 0.3, 1.4]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.4, 0.4, 0.3, 16]}/><meshStandardMaterial color="#222"/></mesh>
          <mesh position={[-1, 0.3, 1.4]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.4, 0.4, 0.3, 16]}/><meshStandardMaterial color="#222"/></mesh>
          <mesh position={[1, 0.3, -1.4]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.4, 0.4, 0.3, 16]}/><meshStandardMaterial color="#222"/></mesh>
          <mesh position={[-1, 0.3, -1.4]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.4, 0.4, 0.3, 16]}/><meshStandardMaterial color="#222"/></mesh>
        </group>
      </RigidBody>
    );
  }

  return (
    <group ref={meshRef} position={initialPosition}>
      <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1.8, 0.8, 4.2]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.1, -0.5]}>
        <boxGeometry args={[1.6, 0.6, 2.0]} />
        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} />
      </mesh>
    </group>
  );
}
