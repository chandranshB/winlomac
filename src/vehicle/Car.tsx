import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { RigidBody, RapierRigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
import { useStore } from '../store/useStore';
import * as THREE from 'three';

export function Car({ isLocal, id, initialPosition, color }: { isLocal: boolean; id: string; initialPosition: [number, number, number]; color: string }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [, getKeys] = useKeyboardControls();
  const { rapier, world } = useRapier(); // Required for robust physics raycasting
  
  // Smoothing vars for remote players
  const targetPos = useRef(new THREE.Vector3(...initialPosition));
  const targetRot = useRef(new THREE.Quaternion(0, 0, 0, 1));

  // Engine & Transmission State
  const gearRef = useRef<number>(1);
  const rpmRef = useRef<number>(1000);
  const shiftDelayRef = useRef<number>(0); // Transmission delay for realistic feeling
  const flipTimerRef = useRef<number>(0); 
  
  // Game mechanic constants
  const MAX_SPEED = 120; // Massive top speed
  const ACCELERATION = 250;
  const BRAKING = 200;
  const BASE_TURN_SPEED = 3.0;
  const GRIP = 0.95; // Higher = tighter turns, less drifting
  
  // Transmission Tuning (m/s)
  const GEAR_SPEEDS = [20, 40, 60, 80, 100, 120]; // 6 Gears properly spaced
  const IDLE_RPM = 1000;
  const REDLINE_RPM = 8000;

  useFrame((state, delta) => {
    if (!bodyRef.current || !meshRef.current) return;
    
    if (isLocal) {
      const keys = getKeys();
      const currentVel = bodyRef.current.linvel();
      const currentRot = bodyRef.current.rotation();
      const quaternion = new THREE.Quaternion(currentRot.x, currentRot.y, currentRot.z, currentRot.w);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
      
      const pos = bodyRef.current.translation();
      const mass = 1200;

      // Robust Ground Raycast Check
      const rayorigin = { x: pos.x, y: pos.y - 0.2, z: pos.z }; // start slightly under the car
      const raydir = { x: 0, y: -1, z: 0 };
      const ray = new rapier.Ray(rayorigin, raydir);
      const hit = world.castRay(ray, 1.5, true); 
      const isGrounded = up.y > 0.1 && hit !== null; 

      // Arcade Gravity (Fixes floaty spaceship feeling)
      if (!isGrounded) {
         // Pull the heavy massive frame powerfully down to the road while jumping!
         bodyRef.current.applyImpulse({ x: 0, y: -150 * mass * delta, z: 0 }, true);
      }

      const speed = new THREE.Vector3(currentVel.x, currentVel.y, currentVel.z).length();
      const forwardSpeed = new THREE.Vector3(currentVel.x, currentVel.y, currentVel.z).dot(forward);
      const absForwardSpeed = Math.abs(forwardSpeed);

      // --- Transmission Logic (Auto Shifting) ---
      let gear = gearRef.current;
      let isShifting = false;

      // Check if we are mid-shift
      if (shiftDelayRef.current > 0) {
          shiftDelayRef.current -= delta;
          isShifting = true;
      }
      
      if (!isShifting) {
        if (forwardSpeed < -1 && !keys.forward) {
          if (gear !== -1) { gear = -1; shiftDelayRef.current = 0.3; }
        } else if (gear === -1 && (keys.forward || forwardSpeed >= -1)) {
          gear = 1; shiftDelayRef.current = 0.2;
        } else if (absForwardSpeed < 1 && !keys.forward && !keys.backward) {
          if (gear !== 1) { gear = 1; shiftDelayRef.current = 0.1; }
        } else if (gear > 0) {
          // Upshift logic (Redline reached)
          if (absForwardSpeed >= GEAR_SPEEDS[gear - 1] && gear < 6) {
              gear++;
              shiftDelayRef.current = 0.2; // 200ms smooth upshift
          }
          // Downshift logic with Hysteresis (Prevents rapid back-and-forth shifting)
          else if (gear > 1 && absForwardSpeed < (gear === 2 ? 10 : GEAR_SPEEDS[gear - 2] * 0.8)) {
              gear--;
              shiftDelayRef.current = 0.15; // 150ms reliable downshift
          }
        }
      }
      gearRef.current = gear;

      // --- RPM Calculation ---
      let targetRpm = IDLE_RPM;
      if (gear === -1) { // Reverse RPM
         targetRpm = IDLE_RPM + (absForwardSpeed / 15) * (REDLINE_RPM - IDLE_RPM);
      } else { // Forward Gears RPM
         const prevGearSpeed = gear === 1 ? 0 : GEAR_SPEEDS[gear - 2];
         const gearRange = GEAR_SPEEDS[gear - 1] - prevGearSpeed;
         const speedInGear = Math.max(0, absForwardSpeed - prevGearSpeed);
         const rpmRatio = Math.min(speedInGear / gearRange, 1.1); // Can slightly over-rev before shift
         targetRpm = IDLE_RPM + rpmRatio * (REDLINE_RPM - IDLE_RPM);
      }

      // Smooth RPM visually
      if (isShifting) {
          // RPM drops immediately as clutch is held in during shift
          rpmRef.current = THREE.MathUtils.lerp(rpmRef.current, IDLE_RPM + 1500, 10 * delta); 
      } else if (keys.forward) {
          rpmRef.current = THREE.MathUtils.lerp(rpmRef.current, Math.min(targetRpm, REDLINE_RPM), 15 * delta); 
      } else if (keys.backward) {
          rpmRef.current = THREE.MathUtils.lerp(rpmRef.current, Math.min(targetRpm, REDLINE_RPM), 15 * delta); 
      } else { // Idle drop
          rpmRef.current = THREE.MathUtils.lerp(rpmRef.current, IDLE_RPM, 5 * delta); 
      }
      const rpm = rpmRef.current;

      // Send telemetry to HUD
      useStore.getState().updatePlayer(id, { 
         speed: absForwardSpeed * 2.23694, 
         gear: gear === -1 ? 'R' : gear,
         rpm: rpm
      });

      // --- Acceleration & Braking with Torque Curve ---
      // (Mass extracted to higher scope)
      
      // Calculate realistic acceleration torque curve multiplier
      let torqueMultiplier = 1.0;
      if (rpm < 4000) torqueMultiplier = 0.5 + (rpm / 4000) * 0.5; // Build up power
      else if (rpm < 7000) torqueMultiplier = 1.0; // Peak powerband
      else torqueMultiplier = Math.max(0.2, 1.0 - ((rpm - 7000) / 1000) * 0.8); // Power drop off near redline

      // Disconnect engine (clutch in) while shifting
      if (isShifting) {
          torqueMultiplier = 0; 
          // Very slight deceleration drag
          bodyRef.current.applyImpulse(forward.clone().multiplyScalar(-BRAKING * mass * 0.01 * delta), true);
      } 
      // Clutch pops: major torque kick when gear re-engages!
      else if (shiftDelayRef.current <= 0 && shiftDelayRef.current > -0.1) {
          if (keys.forward) torqueMultiplier *= 1.3; // Much softer, realistic snap 
          shiftDelayRef.current -= delta; // Push timer below -0.1 to end the jolt
      }

      if (isGrounded && keys.forward && forwardSpeed < MAX_SPEED && torqueMultiplier > 0) {
         bodyRef.current.applyImpulse(forward.clone().multiplyScalar(ACCELERATION * mass * torqueMultiplier * delta), true);
      }
      // Brakes work independently of transmission clutch logic
      if (isGrounded && keys.backward) {
         if (forwardSpeed > 1) { // Braking
            bodyRef.current.applyImpulse(forward.clone().multiplyScalar(-BRAKING * mass * delta), true);
         } else if (forwardSpeed > -MAX_SPEED / 2) { // Reverse
            bodyRef.current.applyImpulse(forward.clone().multiplyScalar(-ACCELERATION * mass * 0.5 * delta), true);
         }
      }

      // Cancel out sideways velocity to simulate tire grip
      const sidewaysVelocity = new THREE.Vector3(currentVel.x, 0, currentVel.z).dot(right);
      
      const currentGrip = (keys.brake) ? 0.1 : GRIP; // Press space to drift (heavy loss of grip)
      
      // Apply counter impulse to sideways momentum relative to mass (1200)
      if (isGrounded) {
         const counterForce = right.clone().multiplyScalar(-sidewaysVelocity * mass * currentGrip * 5 * delta); 
         bodyRef.current.applyImpulse(counterForce, true);
      }

      // --- Steering ---
      // Steering should be affected by how fast we are going (can't turn much if still)
      let turningMultiplier = Math.min(speed / 10, 1.0); 
      // Reverse turning direction if going backwards
      if (forwardSpeed < -0.1) turningMultiplier *= -1;

      if (isGrounded && speed > 1) {
        // Use proper physical torque for rotation to prevent collision jitter from forced setRotation
        const turnStrength = BASE_TURN_SPEED * turningMultiplier * mass * 8 * delta;
        if (keys.left) bodyRef.current.applyTorqueImpulse({ x: 0, y: turnStrength, z: 0 }, true);
        if (keys.right) bodyRef.current.applyTorqueImpulse({ x: 0, y: -turnStrength, z: 0 }, true);
      }
      
      // Fake visual tilt for drifting
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, (keys.left ? 0.05 : (keys.right ? -0.05 : 0)) * turningMultiplier, 0.1);

      // --- Dynamic Smooth Camera & Respawns ---
      // (pos already requested at top of useFrame scope)
      
      // Void Fall recovery mechanism
      if (pos.y < -15) {
        bodyRef.current.setTranslation({ x: initialPosition[0], y: initialPosition[1], z: initialPosition[2] }, true);
        bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        bodyRef.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        gearRef.current = 1;
        return;
      }

      // Flip recovery (Upside down or heavily tilted and stuck)
      if (!isGrounded && speed < 2) {
         flipTimerRef.current += delta;
         if (flipTimerRef.current > 2.0) { // Stuck upside down for 2 seconds
            // Respawn slightly higher and upright instantly in place
            bodyRef.current.setTranslation({ x: pos.x, y: pos.y + 3, z: pos.z }, true);
            bodyRef.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
            bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
            bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
            flipTimerRef.current = 0;
            gearRef.current = 1;
            return;
         }
      } else {
         flipTimerRef.current = 0;
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
      <RigidBody ref={bodyRef} position={initialPosition} colliders={false} ccd={true} linearDamping={0.4} angularDamping={5.0} friction={0.1} restitution={0.4}>
        {/* Explicit Physics Box (Half-extents of the main car hull) added friction and anti-bouncing properties explicitly */}
        <CuboidCollider args={[0.9, 0.4, 2.1]} position={[0, 0.5, 0]} mass={1200} friction={0.1} restitution={0.4} />
        <CuboidCollider args={[0.8, 0.3, 1.0]} position={[0, 1.1, -0.5]} mass={100} friction={0.1} restitution={0.4} />
        
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
