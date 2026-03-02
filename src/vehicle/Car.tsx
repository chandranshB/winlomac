import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls, useGLTF } from '@react-three/drei';
import { RigidBody, RapierRigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
import { useStore } from '../store/useStore';
import * as THREE from 'three';

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

  // Engine & Transmission State
  const gearRef = useRef<number>(1);
  const rpmRef = useRef<number>(1000);
  const shiftDelayRef = useRef<number>(0); // Transmission delay for realistic feeling
  const flipTimerRef = useRef<number>(0); 
  
  // Game mechanic constants
  const MAX_SPEED = 120; // Massive top speed
  const ACCELERATION = 60; // Slower, more realistic acceleration speed
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
      const rayorigin = { x: pos.x, y: pos.y, z: pos.z }; // start slightly under the car
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
        } else if (gear > 0 && !keys.brake) { // HOLD GEAR WHEN DRIFTING!
          // Upshift logic (Engine reaching redline powerband limit)
          if (absForwardSpeed >= GEAR_SPEEDS[gear - 1] * 0.9 && gear < 6) {
              gear++;
              shiftDelayRef.current = 0.4; // 400ms simulated shift time
          }
          // Downshift logic with Hysteresis (Prevents rapid back-and-forth shifting)
          else if (gear > 1 && absForwardSpeed < (gear === 2 ? 10 : GEAR_SPEEDS[gear - 2] * 0.75)) {
              gear--;
              shiftDelayRef.current = 0.3; // 300ms reliable downshift
          }
        }
      }
      gearRef.current = gear;

      // --- RPM Calculation ---
      let targetRpm = IDLE_RPM;
      
      if (!isGrounded && keys.forward) {
         // Free-spin the engine quickly to redline when tires lose contact
         targetRpm = REDLINE_RPM;
      } else if (gear === -1) { // Reverse RPM
         targetRpm = IDLE_RPM + (absForwardSpeed / 15) * (REDLINE_RPM - IDLE_RPM);
         if (keys.backward) targetRpm += 500; // Engine load
      } else { // Forward Gears RPM
         const maxSpeedInGear = GEAR_SPEEDS[gear - 1]; 
         
         // In real life, RPM doesn't start at IDLE when you shift up. 
         // RPM = (Speed / MaxSpeedForGear) * REDLINE_RPM
         // We clamp the minimum RPM to IDLE_RPM to keep the engine running
         const gearRatio = REDLINE_RPM / maxSpeedInGear;
         targetRpm = Math.max(IDLE_RPM, absForwardSpeed * gearRatio);
         
         // Simulated engine load (revs jump a little higher when foot is on the gas)
         if (keys.forward && targetRpm < REDLINE_RPM) {
             targetRpm += 500; // Applying torque to drivetrain load
         }
      }

      // Smooth RPM visually
      if (isShifting) {
          // RPM drops sharply simulating a clutch-in transmission shift!
          rpmRef.current = THREE.MathUtils.lerp(rpmRef.current, IDLE_RPM + 1200, 16 * delta); 
      } else if (keys.forward || keys.backward) {
          // Rapid climb when accelerating (throttle open)
          rpmRef.current = THREE.MathUtils.lerp(rpmRef.current, Math.min(targetRpm, REDLINE_RPM), 15 * delta); 
      } else { 
          // Idle drop (throttle closed)
          rpmRef.current = THREE.MathUtils.lerp(rpmRef.current, IDLE_RPM, 6 * delta); 
      }
      const rpm = rpmRef.current;

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
         const safeY = outOfBounds ? initialPosition[1] : pos.y + 3; // Pop up slightly
         const safeZ = outOfBounds ? initialPosition[2] : pos.z;

         // Respawn slightly higher and upright instantly in place
         bodyRef.current.setTranslation({ x: safeX, y: safeY, z: safeZ }, true);
         bodyRef.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
         bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
         bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
         flipTimerRef.current = 0;
         gearRef.current = 1;

         useStore.getState().updatePlayer(id, { 
            speed: 0, gear: 1, rpm: IDLE_RPM, isStuck: false 
         });
         return;
      }

      // Send telemetry to HUD
      useStore.getState().updatePlayer(id, { 
         speed: absForwardSpeed * 2.23694, 
         gear: gear === -1 ? 'R' : gear,
         rpm: rpm,
         isStuck: isStuck
      });

      // --- Acceleration & Braking with Torque Curve ---
      // (Mass extracted to higher scope)
      
      // Calculate realistic acceleration torque curve multiplier
      let torqueMultiplier = 1.0;
      if (rpm < 4000) torqueMultiplier = 0.5 + (rpm / 4000) * 0.5; // Build up power
      else if (rpm < 7000) torqueMultiplier = 1.0; // Peak powerband
      else torqueMultiplier = Math.max(0.6, 1.0 - ((rpm - 7000) / 1000) * 0.4); // Power drop off, but high enough to beat aerodynamic drag

      // Reduced power during shifting (simulate smooth automatic clutch)
      if (isShifting) {
          torqueMultiplier = 0.1; // Minimal acceleration while shifting
      } 
      // Gentle re-engage
      else if (shiftDelayRef.current <= 0 && shiftDelayRef.current > -0.1) {
          if (keys.forward) torqueMultiplier *= 1.1; // Very gentle bump, no harsh snap
          shiftDelayRef.current -= delta; // Push timer below -0.1 to end the jolt
      }

      if (isGrounded && keys.forward && forwardSpeed < MAX_SPEED && torqueMultiplier > 0) {
         bodyRef.current.applyImpulse(forward.clone().multiplyScalar(ACCELERATION * mass * torqueMultiplier * delta), true);
      }
      
      // Brakes and Reverse logic
      if (isGrounded && keys.backward) {
         if (forwardSpeed > 1) { // Forward momentum -> Hard Braking
            bodyRef.current.applyImpulse(forward.clone().multiplyScalar(-BRAKING * mass * delta), true);
         } else if (forwardSpeed > -20) { // Reverse gear (Capped at 20 m/s ~ 45mph)
            // Reduced acceleration for reverse gear
            bodyRef.current.applyImpulse(forward.clone().multiplyScalar(-ACCELERATION * mass * 0.3 * delta), true);
         }
      }

      // Cancel out sideways velocity to simulate tire grip
      const sidewaysVelocity = new THREE.Vector3(currentVel.x, 0, currentVel.z).dot(right);
      
      let currentGrip = GRIP;
      if (keys.brake && speed > 10) {
         currentGrip = 0.05; // Extremely slippery sideways (drift)
         // Apply a braking friction to drift so it feels like tires scrubbing the pavement 
         bodyRef.current.applyImpulse(new THREE.Vector3(currentVel.x, 0, currentVel.z).normalize().multiplyScalar(-30 * mass * delta), true);
      } else if (Math.abs(sidewaysVelocity) > 5) {
         currentGrip = 0.4; // Sliding naturally recovering
      }
      
      // Apply counter impulse to sideways momentum relative to mass
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
        // Drifting adds a higher turn sensitivity
        const turnStrength = BASE_TURN_SPEED * turningMultiplier * mass * (keys.brake ? 14 : 7) * delta;
        
        if (keys.left) bodyRef.current.applyTorqueImpulse({ x: 0, y: turnStrength, z: 0 }, true);
        if (keys.right) bodyRef.current.applyTorqueImpulse({ x: 0, y: -turnStrength, z: 0 }, true);

        // Auto counter-steering (stabilize the car from spinning out natively)
        const angVel = bodyRef.current.angvel();
        if (!keys.left && !keys.right) {
            // Snap straight aggressively if letting go of steering
            bodyRef.current.applyTorqueImpulse({ x: 0, y: -angVel.y * mass * 0.5 * delta, z: 0 }, true); 
        } else if (keys.brake) {
            // Apply slight counter-resistance while drifting so you don't overspin into a full 360 easily
            bodyRef.current.applyTorqueImpulse({ x: 0, y: -angVel.y * mass * 0.3 * delta, z: 0 }, true); 
        }
      }
      
      // Fake visual tilt for drifting
      const driftTilt = (keys.brake && speed > 15) ? 0.12 : 0.05;
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, (keys.left ? driftTilt : (keys.right ? -driftTilt : 0)) * turningMultiplier, 0.1);

      // --- Particles ---
      const isBurnout = isGrounded && speed < 5 && (
         (keys.forward && keys.brake) || 
         (keys.forward && keys.backward)
      );

      const isDrifting = isGrounded && (
         (keys.brake && speed > 15) || 
         isBurnout ||
         (keys.forward && keys.brake && (keys.left || keys.right))
      );
      useStore.getState().updatePlayer(id, { isDrifting });

      // --- Dynamic Smooth Camera ---
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

      // FOV speed effect and Shifting Camera Jolt
      const cam = state.camera as THREE.PerspectiveCamera;
      let targetFov = 60 + (speedFactor * 20);
      
      // Simulating realistic gear-shift forward momentum lunging
      if (isShifting) {
          targetFov -= 6; // Camera compresses slightly forward as acceleration drops
      } else if (shiftDelayRef.current <= 0 && shiftDelayRef.current > -0.2 && keys.forward) {
          targetFov += 10; // Snap back aggressively when gear catches!
      }

      // Snappier FOV tracking allows for visceral momentum jolts
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, isShifting ? 0.08 : 0.15);
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
      <>
        <RigidBody ref={bodyRef} position={initialPosition} colliders={false} ccd={true} linearDamping={0.4} angularDamping={5.0} friction={0.1} restitution={0.4}>
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
