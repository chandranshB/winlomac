import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls, useGLTF } from '@react-three/drei';
import { RigidBody, RapierRigidBody, CuboidCollider, RoundCuboidCollider, useRapier } from '@react-three/rapier';
import { useStore } from '../store/useStore';
import * as THREE from 'three';
import { getGameConstants } from '../utils/security';

useGLTF.preload('/models/1994 Nissan 180MX.glb');
useGLTF.preload('/models/2022_hyundai_i20_n_line.glb');
useGLTF.preload('/models/Chevrolet Camaro.glb');
useGLTF.preload('/models/Ferrari F40.glb');
useGLTF.preload('/models/MazdaRX-7.glb');
useGLTF.preload('/models/Nissan GTR.glb');
useGLTF.preload('/models/Racing car.glb');
useGLTF.preload('/models/Tractor.glb');
useGLTF.preload('/models/bmw_m3_e46.glb');
useGLTF.preload('/models/lamborghini.glb');
useGLTF.preload('/models/maruti_800_ac.glb');
useGLTF.preload('/models/toyota_fortuner_2021.glb');

// Get protected game constants
const CONSTANTS = getGameConstants();
const MAX_SPEED = CONSTANTS.MAX_SPEED;
const ACCELERATION = CONSTANTS.ACCELERATION;
const BRAKING = CONSTANTS.BRAKING;
const BASE_TURN_SPEED = CONSTANTS.BASE_TURN_SPEED;
const GRIP = CONSTANTS.GRIP;
const GEAR_SPEEDS = CONSTANTS.GEAR_SPEEDS;
const IDLE_RPM = CONSTANTS.IDLE_RPM;
const REDLINE_RPM = CONSTANTS.REDLINE_RPM;

const _quaternion = new THREE.Quaternion();
const _forward = new THREE.Vector3(0, 0, -1);
const _right = new THREE.Vector3(1, 0, 0);
const _up = new THREE.Vector3(0, 1, 0);
const _currentVelVec = new THREE.Vector3();
const _flatForward = new THREE.Vector3();
const _driftDir = new THREE.Vector3();
const _counterForce = new THREE.Vector3();
const _cameraOffset = new THREE.Vector3();
const _cameraTargetPos = new THREE.Vector3();
const _lookAtPos = new THREE.Vector3();
const _currentTarget = new THREE.Vector3();

export function Car({ isLocal, id, initialPosition, initialRotation, color }: { isLocal: boolean; id: string; initialPosition: [number, number, number]; initialRotation: [number, number, number, number]; color: string }) {
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
  const nitroLevelRef = useRef<number>(100);
  const nitroCooldownRef = useRef<boolean>(false);
  const rpmRef = useRef<number>(1000);
  const shiftDelayRef = useRef<number>(0); // Transmission delay for realistic feeling
  const flipTimerRef = useRef<number>(0);
  const spawnInitializedRef = useRef<boolean>(false); // Track if spawn initialization is complete
  const resetCooldownRef = useRef<number>(0); // Cooldown timer for reset button

  useFrame((state, delta) => {
    if (!bodyRef.current || !meshRef.current) return;
    
    if (isLocal) {
      // Robust spawn initialization - ensure physics body is awake and properly positioned
      if (!spawnInitializedRef.current) {
        // Wake up the physics body
        bodyRef.current.wakeUp();
        
        // Ensure proper spawn position (slightly elevated to prevent ground clipping)
        bodyRef.current.setTranslation({ 
          x: initialPosition[0], 
          y: initialPosition[1] + 0.5, // Add small buffer above spawn point
          z: initialPosition[2] 
        }, true);
        
        // Set rotation
        bodyRef.current.setRotation({ 
          x: initialRotation[0], 
          y: initialRotation[1], 
          z: initialRotation[2], 
          w: initialRotation[3] 
        }, true);
        
        // Clear any residual velocities
        bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        
        // Apply small downward impulse to settle on ground
        bodyRef.current.applyImpulse({ x: 0, y: -100, z: 0 }, true);
        
        spawnInitializedRef.current = true;
      }
      
      const keys = getKeys();
      const currentVel = bodyRef.current.linvel();
      const currentRot = bodyRef.current.rotation();
      _quaternion.set(currentRot.x, currentRot.y, currentRot.z, currentRot.w);

      _forward.set(0, 0, -1).applyQuaternion(_quaternion);
      _right.set(1, 0, 0).applyQuaternion(_quaternion);
      _up.set(0, 1, 0).applyQuaternion(_quaternion);
      
      const pos = bodyRef.current.translation();
      const mass = 1200;

      // Model-specific ground detection - i20 needs longer raycast due to elevation
      const isI20Model = carModel.includes('hyundai') || carModel.includes('i20');
      const rayStartHeight = isI20Model ? 1.5 : 0.5;
      const rayDistance = isI20Model ? 3.0 : 1.5;
      
      // Robust Ground Raycast Check
      const rayorigin = { x: pos.x, y: pos.y + rayStartHeight, z: pos.z }; 
      const raydir = { x: 0, y: -1, z: 0 };
      const ray = new rapier.Ray(rayorigin, raydir);
      const hit = world.castRay(ray, rayDistance, true); 
      const isGrounded = _up.y > 0.1 && hit !== null; 

      _currentVelVec.set(currentVel.x, currentVel.y, currentVel.z);
      const speed = _currentVelVec.length();
      const forwardSpeed = _currentVelVec.dot(_forward);
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
              shiftDelayRef.current = 0.15; // 150ms lightning fast shift time
          }
          // Downshift logic with Hysteresis (Prevents rapid back-and-forth shifting)
          else if (gear > 1 && absForwardSpeed < (gear === 2 ? 10 : GEAR_SPEEDS[gear - 2] * 0.65)) {
              gear--;
              shiftDelayRef.current = 0.15; // 150ms reliable downshift
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

      // Decrease reset cooldown
      if (resetCooldownRef.current > 0) {
        resetCooldownRef.current -= delta;
      }

      // Manual Reset (R key) with cooldown to prevent spam
      if (keys.reset && resetCooldownRef.current <= 0) {
         // Determine if we are out of the arena bounds or fallen into the void
         const outOfBounds = pos.y < -5 || Math.abs(pos.x) > 1000 || Math.abs(pos.z) > 1000;
         
         let safeX, safeY, safeZ;
         
         if (outOfBounds) {
            // Respawn at initial position if out of bounds
            safeX = initialPosition[0];
            safeY = initialPosition[1];
            safeZ = initialPosition[2];
         } else {
            // Find ground height using raycast - create new Ray to avoid aliasing
            const resetRayOrigin = { x: pos.x, y: pos.y + 10, z: pos.z };
            const resetRayDir = { x: 0, y: -1, z: 0 };
            const resetRay = new rapier.Ray(resetRayOrigin, resetRayDir);
            const groundHit = world.castRay(resetRay, 50, true);
            
            safeX = pos.x;
            safeZ = pos.z;
            
            if (groundHit) {
               // Lift car 2 units above detected ground
               const groundY = (pos.y + 10) - groundHit.timeOfImpact;
               safeY = groundY + 2.0;
            } else {
               // Fallback if no ground detected
               safeY = pos.y + 2.0;
            }
         }

         // Respawn at calculated height and upright
         bodyRef.current.setTranslation({ x: safeX, y: safeY, z: safeZ }, true);
         bodyRef.current.setRotation({ x: initialRotation[0], y: initialRotation[1], z: initialRotation[2], w: initialRotation[3] }, true);
         bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
         bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
         flipTimerRef.current = 0;
         gearRef.current = 1;

         // Set cooldown to 2 seconds to prevent spam
         resetCooldownRef.current = 2.0;

         useStore.getState().updatePlayer(id, { 
            speed: 0, gear: 1, rpm: IDLE_RPM, isStuck: false 
         });
         return;
      }

      // --- Nitro Injection Logic & Limits ---
      let requestedNitro = Boolean(keys.nitro && isGrounded && keys.forward);

      // If user completely lets go of shift, clear the cooldown and allow recharge!
      if (!keys.nitro) {
          nitroCooldownRef.current = false;
      }
      
      if (requestedNitro && !nitroCooldownRef.current && nitroLevelRef.current > 0) {
          nitroLevelRef.current = Math.max(0, nitroLevelRef.current - (CONSTANTS.NITRO_DRAIN_RATE * delta));
          if (nitroLevelRef.current === 0) {
              nitroCooldownRef.current = true; // Exhausted! Must release shift to reset.
              requestedNitro = false;
          }
      } else {
          requestedNitro = false; // Kill boost if we ran out or are in cooldown!
          // Only recharge if we aren't holding the button at all (forcing release to recharge)
          if (!keys.nitro) {
              nitroLevelRef.current = Math.min(100, nitroLevelRef.current + (CONSTANTS.NITRO_RECHARGE_RATE * delta));
          }
      }
      const isNitro = requestedNitro;

      // High-performance telemetry mutation (mutating directly bypasses 60FPS React re-renders)
      const pState = useStore.getState().players[id];
      if (pState) {
         pState.speed = absForwardSpeed * 3.6; // m/s to KM/H
         pState.gear = gear === -1 ? 'R' : gear;
         pState.rpm = rpm;
         pState.isStuck = isStuck;
         
         // Evaluate Nitro state globally
         pState.isNitro = isNitro;
         pState.nitroLevel = nitroLevelRef.current;
         
         // Mutate position into the store for HUD Coordinate debugging
         pState.mapX = pos.x;
         pState.mapY = pos.y;
         pState.mapZ = pos.z;
      }

      // --- Acceleration & Braking ---
      // Nitro gives a very subtle boost - not a big advantage
      const currentMaxSpeed = isNitro ? MAX_SPEED + CONSTANTS.NITRO_SPEED_BONUS : MAX_SPEED; 
      
      // i20 needs extra power to compensate for higher damping and elevation
      const i20PowerBoost = isI20Model ? 1.3 : 1.0;
      const torqueMultiplier = 1.0 * i20PowerBoost;
      // Nitro boosts acceleration by 15% - subtle tactical advantage
      let currentAccel = (isNitro ? ACCELERATION * CONSTANTS.NITRO_BOOST : ACCELERATION) * torqueMultiplier;
      
      // Use actual forward direction for inclines, but flatten for top speed calculation
      _flatForward.copy(_forward);
      _flatForward.y = 0;
      if (_flatForward.lengthSq() > 0.001) _flatForward.normalize();
      
      // Calculate flat speed for speed limiting (ignores vertical component)
      const flatVelocity = new THREE.Vector3(currentVel.x, 0, currentVel.z);
      const flatSpeed = flatVelocity.length();
      
      // More lenient speed limiter - only kicks in very close to max speed
      if (flatSpeed > currentMaxSpeed * 0.98) {
          const overSpeed = flatSpeed - (currentMaxSpeed * 0.98);
          const fade = Math.max(0, 1.0 - (overSpeed / (currentMaxSpeed * 0.02)));
          currentAccel *= fade;
      }

      if (isGrounded && keys.forward && currentAccel > 0) {
         // Aggressive incline compensation for climbing steep roads
         const inclineAngle = Math.asin(Math.max(-1, Math.min(1, -_forward.y)));
         
         // Much more aggressive slope boost
         // Flat: 1.0x, 30°: 3.5x, 45°: 6.0x, 60°: 10.0x
         const baseInclineBoost = 1.0 + Math.max(0, Math.pow(Math.abs(inclineAngle) * 4.5, 1.5));
         const inclineBoost = isI20Model ? baseInclineBoost * 1.2 : baseInclineBoost;
         
         // Massive anti-gravity force on slopes
         const gravityCompensation = Math.max(0, inclineAngle) * mass * (isI20Model ? 60 : 50) * delta;
         
         _counterForce.copy(_forward).multiplyScalar(currentAccel * mass * inclineBoost * delta);
         _counterForce.y += gravityCompensation; // Direct upward push on inclines
         
         bodyRef.current.applyImpulse(_counterForce, true);
      }
      
      // Brakes and Reverse logic
      if (isGrounded && keys.backward) {
         if (forwardSpeed > 1) { // Forward momentum -> Hard Braking
            _counterForce.copy(_flatForward).multiplyScalar(-BRAKING * mass * delta);
            bodyRef.current.applyImpulse(_counterForce, true);
         } else { 
            // Reverse gear (Capped smoothly at ~20 m/s, roughly 72 km/h)
            let reverseAccel = ACCELERATION * 0.8;
            
            // Fade the reverse accelerator smoothly as we approach -20 m/s to prevent hitting a hard "wall" and jittering
            if (forwardSpeed < -15) {
                const overSpeed = Math.abs(forwardSpeed) - 15;
                const fade = Math.max(0, 1.0 - (overSpeed / 5)); // Fades from 1.0 to 0.0 between 15 and 20 m/s
                reverseAccel *= fade;
            }

            _counterForce.copy(_flatForward).multiplyScalar(-reverseAccel * mass * delta);
            bodyRef.current.applyImpulse(_counterForce, true);
            
            // Hard clamp purely on the reverse vector if gravity pushes us faster than 20m/s backward!
            if (forwardSpeed < -20) {
                const ratio = Math.abs(forwardSpeed) / 20.0;
                bodyRef.current.setLinvel({
                    x: currentVel.x / ratio,
                    y: currentVel.y,
                    z: currentVel.z / ratio
                }, true);
            }
         }
      }

      // i20 Vertical Velocity Damping - Aggressively kill vertical bouncing from bumps
      if (isI20Model && isGrounded) {
        const verticalVel = currentVel.y;
        // If car is bouncing up or down while grounded, heavily damp it
        if (Math.abs(verticalVel) > 0.05) {
          bodyRef.current.setLinvel({
            x: currentVel.x,
            y: verticalVel * 0.2, // Kill 80% of vertical velocity each frame
            z: currentVel.z
          }, true);
        }
      }

      // --- Need for Speed Style Drift System ---
      // Robust, stable, and fun drift mechanics
      const sidewaysVelocity = _currentVelVec.dot(_right);
      const absSidewaysVel = Math.abs(sidewaysVelocity);
      
      // Enhanced drift input detection with stability
      const isDriftInput = keys.brake && (keys.left || keys.right);
      const minDriftSpeed = 5; // Very accessible threshold
      const canDrift = speed > minDriftSpeed;
      
      // Pre-calculate speed ratio once for efficiency
      const speedRatio = Math.min(speed / MAX_SPEED, 1.0);
      
      let currentGrip = GRIP;
      let driftIntensity = 0;
      let driftAngle = 0;
      let driftRadiusFactor = 1.0;
      let isInDrift = false; // Track drift state for stability
      
      if (isDriftInput && canDrift && isGrounded) {
         isInDrift = true;
         
         // Calculate drift momentum and angle (optimized)
         _driftDir.set(currentVel.x, 0, currentVel.z);
         const driftSpeed = _driftDir.length();
         
         if (driftSpeed > 0.1) {
            _driftDir.multiplyScalar(1.0 / driftSpeed); // Optimized normalize
            driftAngle = Math.abs(_flatForward.angleTo(_driftDir));
         }
         
         // NFS-style drift intensity: smooth and predictable
         const angleRatio = Math.min(driftAngle * 0.6366, 1.0); // 0.6366 = 2/PI
         
         // Balanced intensity calculation for stable drifts
         driftIntensity = 0.5 + (speedRatio * 0.25) + (angleRatio * 0.25); // Range: 0.5 to 1.0
         
         // Speed-Adaptive Drift Radius (NFS-style wide arcs at high speed)
         driftRadiusFactor = 0.7 + (speedRatio * 0.6); // Range: 0.7 to 1.3
         
         // Much more slippery grip model for natural handbrake feel
         const baseGrip = 0.03 + (1.0 - driftIntensity) * 0.04; // Range: 0.03 to 0.07 (reduced from 0.06-0.12)
         currentGrip = baseGrip / driftRadiusFactor;
         
         // Progressive speed loss during drift for more natural feel
         if (driftSpeed > 0.1) {
            // Progressive braking based on drift angle - more angle = more scrub
            const baseBrake = 0.3 + (1.0 - speedRatio) * 0.6; // Range: 0.3 to 0.9 (reduced)
            const angleFactor = angleRatio * 1.2; // More angle penalty for realism
            const driftBrake = baseBrake * (1.0 + angleFactor);
            
            // Apply drift resistance
            bodyRef.current.applyImpulse(_driftDir.multiplyScalar(-driftBrake * mass * delta), true);
         }
      } else if (absSidewaysVel > 4) {
         // Natural slide with smooth recovery
         const slideRatio = Math.min(absSidewaysVel * 0.05, 1.0);
         currentGrip = 0.4 + (slideRatio * 0.3); // Range: 0.4 to 0.7
         
         // Calculate slide angle for intensity
         _driftDir.set(currentVel.x, 0, currentVel.z);
         const dirLength = _driftDir.length();
         if (dirLength > 0.1) {
            _driftDir.multiplyScalar(1.0 / dirLength);
            driftAngle = Math.abs(_flatForward.angleTo(_driftDir));
            driftIntensity = Math.min(slideRatio * (driftAngle * 0.6366), 0.7);
         }
      }
      
      // Apply counter impulse to sideways momentum
      if (isGrounded) {
         // More slippery grip during handbrake
         const gripMultiplier = isInDrift ? 2.0 : 5.5; // Reduced from 3.0 to 2.0 for more slip
         _counterForce.copy(_right).multiplyScalar(-sidewaysVelocity * mass * currentGrip * gripMultiplier * delta);
         
         // Advanced Drift Rotation with Natural Counter-Steering
         if (isInDrift) {
            const steerDirection = keys.left ? 1 : (keys.right ? -1 : 0);
            const angVel = bodyRef.current.angvel();
            const currentRotation = angVel.y;
            const rotationSpeed = Math.abs(currentRotation);
            
            // Calculate optimal counter-steering based on drift state
            // Positive rotation = turning left, negative = turning right
            const driftDirection = Math.sign(currentRotation);
            const isCounterSteering = steerDirection !== 0 && Math.sign(steerDirection) !== driftDirection;
            
            // Natural counter-steering assistance
            let counterSteerBonus = 0;
            if (isCounterSteering) {
               // Boost counter-steering power based on rotation speed
               // More rotation = more counter-steer needed
               counterSteerBonus = Math.min(rotationSpeed * 2.5, 8); // Range: 0 to 8
            }
            
            // Stable rotation power with speed adaptation
            const baseRotation = 10 + (driftIntensity * 8); // Range: 10 to 18
            const speedAdjustment = 1.0 - (speedRatio * 0.3); // Range: 1.0 to 0.7
            const driftRotationPower = (baseRotation * speedAdjustment) + counterSteerBonus;
            
            bodyRef.current.applyTorqueImpulse({ 
               x: 0, 
               y: steerDirection * mass * driftRotationPower * delta, 
               z: 0 
            }, true);
            
            // Intelligent drift stabilization system
            const excessiveRotation = rotationSpeed > 3.5; // Detect spin-outs
            const needsStabilization = rotationSpeed > 2.0; // Needs gentle help
            
            if (excessiveRotation) {
               // Strong anti-spin protection
               const antiSpinForce = -currentRotation * mass * 0.6 * delta;
               bodyRef.current.applyTorqueImpulse({ x: 0, y: antiSpinForce, z: 0 }, true);
            } else if (needsStabilization && !isCounterSteering) {
               // Gentle automatic stabilization when not counter-steering
               // Helps maintain drift without spinning out
               const autoStabilize = -currentRotation * mass * 0.25 * delta;
               bodyRef.current.applyTorqueImpulse({ x: 0, y: autoStabilize, z: 0 }, true);
            }
            
            // Natural drift angle correction
            // Automatically adjusts car angle to match velocity direction
            if (driftAngle > 0.1) {
               const angleError = driftAngle - 0.785; // Target ~45° drift angle (0.785 rad)
               
               if (Math.abs(angleError) > 0.2) {
                  // Gentle correction towards optimal drift angle
                  const correctionForce = -Math.sign(angleError) * driftDirection * mass * 2.0 * delta;
                  bodyRef.current.applyTorqueImpulse({ x: 0, y: correctionForce, z: 0 }, true);
               }
            }
         }

         // Enhanced Suspension System: Immune to tiny bumps from low-poly geometry
         // Aggressive downforce keeps car glued to track, smoothing over micro-bumps
         const baseDownforce = mass * 25 * (speed / MAX_SPEED) * delta;
         
         // Extra downforce when on relatively flat surfaces to crush bumps
         const flatnessBonus = _up.y > 0.85 ? 1.5 : 1.0;
         const aerodynamicDownforce = baseDownforce * flatnessBonus;
         _counterForce.y -= aerodynamicDownforce;

         // Ultra-stiff suspension: Aggressively dampens vertical velocity
         // This makes the car "hover" over tiny polygon bumps
         if (_up.y > 0.7) { // On mostly flat or slightly inclined surfaces
             // Dampen any upward velocity immediately
             if (currentVel.y > 0.05) {
                 const verticalDampening = currentVel.y * mass * -25 * delta; // Increased from -15 to -25
                 _counterForce.y += verticalDampening;
             }
             
             // Also dampen downward velocity to prevent "bouncing" into bumps
             if (currentVel.y < -0.5) {
                 const downwardDampening = currentVel.y * mass * -8 * delta;
                 _counterForce.y += downwardDampening;
             }
         }

         bodyRef.current.applyImpulse(_counterForce, true);
      }

      // --- NFS-Style Steering with Natural Counter-Steer Support ---
      // Speed-adaptive steering for precise control
      let turningMultiplier = Math.min(speed * 0.1, 1.0);
      if (forwardSpeed < -0.1) turningMultiplier *= -1;

      if (isGrounded && speed > 1) {
        // Stable steering with drift mode
        const isDriftMode = isInDrift;
        const angVel = bodyRef.current.angvel();
        const angularSpeed = Math.abs(angVel.y);
        
        // Detect counter-steering for enhanced response
        const currentRotation = angVel.y;
        const steerInput = keys.left ? 1 : (keys.right ? -1 : 0);
        const isCounterSteeringNow = steerInput !== 0 && Math.sign(steerInput) !== Math.sign(currentRotation);
        
        // Enhanced turn multipliers with counter-steer bonus
        let turnMultiplier = isDriftMode ? 
           (12 + speedRatio * 5 + driftIntensity * 3) : // Drift: 12 to 20
           (8 + speedRatio * 2); // Normal: 8 to 10
        
        // Boost steering power during counter-steer for better control
        if (isDriftMode && isCounterSteeringNow) {
           turnMultiplier *= 1.3; // 30% boost for counter-steering
        }
        
        const turnStrength = BASE_TURN_SPEED * turningMultiplier * mass * turnMultiplier * delta;
        
        if (keys.left) bodyRef.current.applyTorqueImpulse({ x: 0, y: turnStrength, z: 0 }, true);
        if (keys.right) bodyRef.current.applyTorqueImpulse({ x: 0, y: -turnStrength, z: 0 }, true);

        // Intelligent stabilization system
        if (!keys.left && !keys.right) {
            // Strong stabilization when no steering input (NFS-style snap back)
            const stabilizationForce = 0.9 + (speedRatio * 0.3); // Range: 0.9 to 1.2
            bodyRef.current.applyTorqueImpulse({ 
               x: 0, 
               y: -angVel.y * mass * stabilizationForce * delta, 
               z: 0 
            }, true); 
        } else if (isDriftMode && !isCounterSteeringNow) {
            // Gentle stabilization during drift (not counter-steering)
            // Helps maintain controlled drift
            const driftStabilization = 0.30 + (angularSpeed * 0.06);
            const clampedStabilization = driftStabilization < 0.50 ? driftStabilization : 0.50;
            bodyRef.current.applyTorqueImpulse({ 
               x: 0, 
               y: -angVel.y * mass * clampedStabilization * delta, 
               z: 0 
            }, true); 
        }
        // Note: No stabilization during counter-steering - let player have full control
      }
      
      // Enhanced visual tilt system (NFS-style dramatic feedback)
      const baseTilt = 0.05;
      const driftTiltBonus = isInDrift ? 
         (0.12 + driftIntensity * 0.10) : // Range: 0.12 to 0.22 radians during drift
         0;
      
      const targetTilt = baseTilt + driftTiltBonus;
      const tiltDirection = keys.left ? targetTilt : (keys.right ? -targetTilt : 0);
      
      // Smooth, responsive tilt
      const tiltSpeed = isInDrift ? 0.18 : 0.12;
      meshRef.current.rotation.z = THREE.MathUtils.lerp(
         meshRef.current.rotation.z, 
         tiltDirection * turningMultiplier, 
         tiltSpeed
      );

      // --- Particle Effects ---
      const isBurnout = isGrounded && speed < 5 && (
         (keys.forward && keys.brake) || 
         (keys.forward && keys.backward)
      );

      // Enhanced drift detection with robust state tracking
      const isDrifting = isGrounded && (
         isInDrift || // Active drift input
         isBurnout ||
         (absSidewaysVel > 6 && speed > 10) // Natural slide at speed
      );
      if (pState) pState.isDrifting = isDrifting; // Performant mutation

      // --- Modern Racing Camera with Rotation Lag ---
      // (pos already requested at top of useFrame scope)
      
      // Void Fall & Out-Of-Bounds recovery mechanism
      // Instantly respawn if falling off the map, or driving excessively far into emptiness!
      if (pos.y < -15 || Math.abs(pos.x) > 1500 || Math.abs(pos.z) > 1500) {
        bodyRef.current.setTranslation({ x: initialPosition[0], y: initialPosition[1], z: initialPosition[2] }, true);
        bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        bodyRef.current.setRotation({ x: initialRotation[0], y: initialRotation[1], z: initialRotation[2], w: initialRotation[3] }, true);
        gearRef.current = 1;
        return;
      }
      
      // Modern camera system with rotation lag
      const speedFactor = Math.min(speed / MAX_SPEED, 1);
      
      // Camera distance and height scale with speed
      const cameraDist = 10 + (speedFactor * 4);
      const cameraHeight = 4.0 + (speedFactor * 1.5);
      
      // Calculate target camera position (directly behind car)
      _cameraOffset.set(0, cameraHeight, cameraDist).applyQuaternion(_quaternion);
      _cameraTargetPos.set(pos.x, pos.y, pos.z).add(_cameraOffset);
      
      // Smooth camera position tracking
      const positionLerp = 10 * delta;
      const verticalLerp = 6 * delta;
      
      state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, _cameraTargetPos.x, positionLerp);
      state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, _cameraTargetPos.z, positionLerp);
      state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, _cameraTargetPos.y, verticalLerp);
      
      // Modern rotation lag system - camera rotation lags behind car rotation
      // This reveals the side of the car during turns
      const angVel = bodyRef.current.angvel();
      const turnRate = Math.abs(angVel.y);
      
      // Adaptive rotation lag based on turn intensity
      // Slower rotation = more lag = more side view
      const baseLag = 0.15; // Base lag for smooth following
      const turnLag = Math.min(turnRate * 0.8, 0.4); // Extra lag during sharp turns
      const rotationLerp = Math.max(baseLag, turnLag);
      
      // Look-at target with smooth lag
      const lookAheadDist = 3 + (speedFactor * 5);
      _lookAtPos.set(pos.x, pos.y + 0.5, pos.z).add(_forward.clone().multiplyScalar(lookAheadDist));
      
      // Smooth camera rotation with lag effect
      state.camera.getWorldDirection(_currentTarget);
      _currentTarget.add(state.camera.position);
      
      _currentTarget.x = THREE.MathUtils.lerp(_currentTarget.x, _lookAtPos.x, rotationLerp);
      _currentTarget.z = THREE.MathUtils.lerp(_currentTarget.z, _lookAtPos.z, rotationLerp);
      _currentTarget.y = THREE.MathUtils.lerp(_currentTarget.y, _lookAtPos.y, rotationLerp * 0.8);
      
      state.camera.lookAt(_currentTarget);

      const cam = state.camera as THREE.PerspectiveCamera;
      
      // Dynamic FOV for speed sensation
      const isNitroActive = useStore.getState().players[id]?.isNitro || false;
      const targetFov = 65 + (speedFactor * 15) + (isNitroActive ? 25 : 0);
      
      // Smooth FOV transitions
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, (isNitroActive ? 4 : 2) * delta);
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

  const spawnRotEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...initialRotation));

  // Model-specific physics adjustments for elevated cars
  const isI20 = carModel.includes('hyundai') || carModel.includes('i20');
  const undercarriageHeight = isI20 ? 1.3 : 0.4; // Raise i20 undercarriage much higher
  const mainHullHeight = isI20 ? 1.7 : 0.9; // Raise main hull to match
  const linearDamping = isI20 ? 0.6 : 0.5; // Moderate damping - not too high to kill acceleration
  const angularDamping = isI20 ? 10.0 : 6.0; // Maximum angular damping for stability

  if (isLocal) {
    return (
      <>
        {/* CCD (Continuous Collision Detection) is extremely expensive on Trimesh maps at high speeds! Completely disable it! */}
        <RigidBody ref={bodyRef} position={initialPosition} rotation={[spawnRotEuler.x, spawnRotEuler.y, spawnRotEuler.z]} colliders={false} linearDamping={linearDamping} angularDamping={angularDamping} friction={0.05} restitution={0.1}>
          {/* Raised Main Hull so flat collision edges NEVER randomly snag on jagged trimesh map triangles */}
          <CuboidCollider args={[0.9, 0.4, 2.0]} position={[0, mainHullHeight, 0]} mass={1200} friction={0.05} restitution={0.1} />
          {/* Upper roof physics box */}
          <CuboidCollider args={[0.8, 0.3, 1.0]} position={[0, 1.5, -0.5]} mass={100} friction={0.05} restitution={0.1} />
          
          {/* 
            Frictionless Soap Bar Undercarriage: Replace 4 sphere wheels with a sleek continuous slider!
            Spheres can geometrically drop into the tiny microscopic cracks between 3D Map Triangles at high speeds. 
            A RoundCuboid glides flawlessly over them without snagging!
          */}
          <RoundCuboidCollider args={[0.7, 0.15, 1.4, 0.3]} position={[0, undercarriageHeight, 0]} friction={0} restitution={0.0} />

          <group ref={meshRef}>
             <CarMesh color={color} model={carModel} />
             <NitroFlames peerId={id} />
          </group>
        </RigidBody>
        {/* Optimized Particle system mapped globally, unaffected by car rotation */}
        <TireSmoke isDrifting={useStore.getState().players[id]?.isDrifting || false} carBodyRef={bodyRef} />
      </>
    );
  }

  // Remote player return block
  return (
    <group ref={meshRef} position={initialPosition} quaternion={initialRotation}>
       <CarMesh color={color} model={carModel} />
       <NitroFlames peerId={id} />
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
  const [resolvedUrl, setResolvedUrl] = React.useState<string>(model);

  // Resolve the model URL through asset loader
  React.useEffect(() => {
    // Check if this is a local path that needs R2 fallback
    if (model.startsWith('/models/')) {
      import('../utils/assetLoader').then(({ loadAssetWithFallback }) => {
        loadAssetWithFallback({
          localPath: model,
          r2Path: model // Same path for R2
        }).then(setResolvedUrl).catch(err => {
          console.error('[Car] Failed to load model:', err);
          setResolvedUrl(model); // Fallback to original
        });
      });
    } else {
      setResolvedUrl(model);
    }
  }, [model]);

  const { scene } = useGLTF(resolvedUrl);
  
  // Massive optimization: Only execute the deep clone and material mapping ONCE when the component loads or the color changes!
  // Doing scene.clone(true) every frame/render on a 1MB+ high poly model ruins FPS completely!
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        // Optimization: High-poly cars casting complex shadows is fine, but RECEIVING shadows on millions of faces destroys FPS.
        mesh.castShadow = true;
        mesh.receiveShadow = false; 
        
        if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            
            let modified = false;
            const newMaterials = materials.map(m => {
                // Handle materials without names - apply color to all unnamed materials
                const name = m.name ? m.name.toLowerCase() : '';
                
                // Common keywords used by 3D artists to label the car's paint job
                // Extended list to catch more material naming conventions
                const paintKeywords = [
                  'paint', 'body', 'exterior', 'color', 'shell', 'car', 
                  'metal', 'chassis', 'surface', 'finish', 'coat', 'panel',
                  'hood', 'door', 'roof', 'fender', 'bumper', 'lambo',
                  'material', 'base', 'main', 'primary', 'yellow', 'white'
                ];
                
                // Exclude non-paintable parts
                const excludeKeywords = [
                  'glass', 'window', 'tire', 'wheel', 'rim', 'brake',
                  'light', 'lamp', 'chrome', 'mirror', 'interior', 'seat',
                  'dashboard', 'steering', 'exhaust', 'grill', 'grille',
                  'logo', 'badge', 'emblem', 'decal', 'sticker', 'carbon'
                ];
                
                const shouldPaint = (name === '' || paintKeywords.some(keyword => name.includes(keyword))) &&
                                   !excludeKeywords.some(keyword => name.includes(keyword));
                
                if (shouldPaint) {
                    const newMat = (m as THREE.MeshStandardMaterial).clone();
                    
                    // Completely override the base color - don't mix with existing
                    newMat.color.set(color);
                    
                    // Remove emissive to prevent color mixing with base yellow
                    newMat.emissive.set(0x000000);
                    newMat.emissiveIntensity = 0;
                    
                    // Ensure proper metalness and roughness for car paint
                    newMat.metalness = 0.6;
                    newMat.roughness = 0.3;
                    
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
    return clone;
  }, [scene, color]);

  // By default, raise the cars up so their wheels sit neatly on the ground instead of clipping through.
  let position: [number, number, number] = [0, 0, 0];
  // Universally fix the 180-degree flipped car issue for all imported models!
  let rotation: [number, number, number] = [0, Math.PI, 0]; 
  let scale: [number, number, number] = [1, 1, 1];

  // Specific 3D Model Height/Size Corrections (No more rotation overrides needed)
  if (model.includes('Mazda')) {
     position = [0, 0.4, 0]; // Raised out of the ground
  } else if (model.includes('lamborghini')) {
     position = [0, 0.4, 0]; 
     scale = [0.01, 0.01, 0.01]; // Scale down the ridiculously massive lamborghini
  } else if (model.includes('bmw_m3_e46')) {
     position = [0, 0.4, 0]; // Raised out of the ground
  } else if (model.includes('maruti_800_ac')) {
     rotation = [0, 0, 0]; // Correct the backwards rotation
     position = [0, 0.4, 0];
  } else if (model.includes('Tractor')) {
     scale = [0.4, 0.4, 0.4]; // Downscale the massive tractor so physics don't glitch
     position = [0, 0, 0];
  } else if (model.includes('180MX') || model.includes('Camaro') || model.includes('F40') || model.includes('GTR')) {
     position = [0, 0.3, 0]; // Raise most standard cars
  } else if (model.includes('Racing')) {
     position = [0, 0.3, 0]; 
     rotation = [0, Math.PI + Math.PI / 2, 0]; // Rotate anti-clockwise 90 degrees
  } else if (model.includes('toyota')) {
     position = [0, 0.6, 0]; // Raise the tall SUV
  } else if (model.includes('hyundai') || model.includes('i20')) {
     position = [0, 1.5, 0]; // Raise the Hyundai i20 significantly higher
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
        <meshStandardMaterial 
          color={color} 
          roughness={0.3} 
          metalness={0.7}
          emissive={color}
          emissiveIntensity={0.15}
        />
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

// -------------------------------------------------------------
// NITRO FLAMES (Visual effects removed - nitro functionality preserved)
// -------------------------------------------------------------
function NitroFlames(props: { peerId: string }) {
  // Component kept for compatibility but renders nothing
  // Nitro boost mechanics remain fully functional in the physics system
  void props; // Explicitly mark as intentionally unused
  return null;
}
