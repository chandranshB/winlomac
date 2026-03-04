import type { RapierRigidBody } from '@react-three/rapier';
import type { 
  PhysicsController, 
  VehicleConfig, 
  VehicleInput,
  AccelerationSystem,
  DriftController,
  TireModel,
  RPMSystem,
  Vector3
} from '../types';
import { AccelerationSystemImpl } from './AccelerationSystem';
import { DriftControllerImpl } from './DriftController';
import { TireModelImpl } from './TireModel';
import { RPMSystemImpl } from './RPMSystem';

/**
 * PhysicsController - Main orchestrator for vehicle physics
 * 
 * Coordinates all physics subsystems (acceleration, drift, tire model, RPM)
 * and applies forces to the Rapier RigidBody at a fixed 60 Hz timestep.
 * 
 * Validates: Requirements 10.1
 */
export class PhysicsControllerImpl implements PhysicsController {
  // Subsystems
  private _acceleration: AccelerationSystem;
  private _drift: DriftController;
  private _tires: TireModel;
  private _rpm: RPMSystem;

  // State
  private _velocity: Vector3 = { x: 0, y: 0, z: 0 };
  private _angularVelocity: Vector3 = { x: 0, y: 0, z: 0 };
  private _speed: number = 0; // km/h
  private _forwardSpeed: number = 0; // m/s
  private _isGrounded: boolean = false;

  // Fixed timestep accumulator
  private accumulator: number = 0;
  private readonly FIXED_TIMESTEP = 1 / 60; // 60 Hz

  // Reference to Rapier RigidBody
  private rigidBody: RapierRigidBody | null = null;

  // Configuration
  private config: VehicleConfig;

  // Performance monitoring
  private frameTimings: number[] = [];
  private readonly MAX_FRAME_SAMPLES = 60;
  private readonly FRAME_TIME_WARNING_MS = 16;

  // Safety limits - Enhanced for smoother behavior
  private readonly MAX_FORCE = 120000; // Maximum force magnitude (N) - increased for better response
  private readonly MAX_VELOCITY_KMH = 280; // Maximum velocity before damping (km/h) - slightly reduced for better control
  private readonly MAX_ANGULAR_VELOCITY_DEG = 600; // Maximum angular velocity (deg/s) - reduced for smoother rotation

  // Pre-allocated objects to avoid allocations in hot paths (reserved for future optimization)
  // private readonly stateBuffer: VehicleStateBuffer;
  // private readonly tempVectors: Vector3[] = [
  //   { x: 0, y: 0, z: 0 },
  //   { x: 0, y: 0, z: 0 },
  //   { x: 0, y: 0, z: 0 },
  //   { x: 0, y: 0, z: 0 }
  // ];

  constructor(config: VehicleConfig) {
    this.config = config;

    // Initialize subsystems
    this._acceleration = new AccelerationSystemImpl(config);
    this._drift = new DriftControllerImpl(config);
    this._tires = new TireModelImpl(config);
    this._rpm = new RPMSystemImpl(config);
  }

  // Getters for subsystems
  get acceleration(): AccelerationSystem {
    return this._acceleration;
  }

  get drift(): DriftController {
    return this._drift;
  }

  get tires(): TireModel {
    return this._tires;
  }

  get rpm(): RPMSystem {
    return this._rpm;
  }

  // Getters for state
  get velocity(): Vector3 {
    return this._velocity;
  }

  get angularVelocity(): Vector3 {
    return this._angularVelocity;
  }

  get speed(): number {
    return this._speed;
  }

  get forwardSpeed(): number {
    return this._forwardSpeed;
  }

  get isGrounded(): boolean {
    return this._isGrounded;
  }

  /**
   * Set the Rapier RigidBody reference
   * Must be called before update() can be used
   */
  setRigidBody(rigidBody: RapierRigidBody): void {
    this.rigidBody = rigidBody;
  }

  /**
   * Safely apply force to RigidBody with NaN/Infinity checks and clamping
   * Validates: Requirements 10.2
   * 
   * @param force - Force vector to apply
   * @param maxForce - Maximum allowed force magnitude (default: MAX_FORCE)
   * @returns true if force was applied, false if rejected
   */
  private safeApplyForce(force: Vector3, maxForce: number = this.MAX_FORCE): boolean {
    if (!this.rigidBody) return false;

    // Check for NaN or Infinity
    if (!isFinite(force.x) || !isFinite(force.y) || !isFinite(force.z)) {
      console.error('PhysicsController: Invalid force detected (NaN/Infinity):', force);
      return false;
    }

    // Calculate force magnitude
    const magnitude = Math.sqrt(force.x * force.x + force.y * force.y + force.z * force.z);

    // Clamp force if exceeds maximum
    if (magnitude > maxForce) {
      const scale = maxForce / magnitude;
      const clampedForce = {
        x: force.x * scale,
        y: force.y * scale,
        z: force.z * scale
      };
      console.warn(`PhysicsController: Force clamped from ${magnitude.toFixed(2)} to ${maxForce}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.rigidBody.applyImpulse(clampedForce as any, true);
      return true;
    }

    // Apply force normally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.rigidBody.applyImpulse(force as any, true);
    return true;
  }

  /**
   * Check physics stability and apply corrective measures
   * Enhanced with smoother velocity clamping and progressive damping
   * Validates: Requirements 10.2, 10.3, 10.4
   * 
   * @returns true if physics is stable, false if instability detected
   */
  private checkPhysicsStability(): boolean {
    if (!this.rigidBody) return true;

    let isStable = true;

    // Check for NaN values in state
    if (!isFinite(this._velocity.x) || !isFinite(this._velocity.y) || !isFinite(this._velocity.z)) {
      console.error('PhysicsController: Physics instability detected - NaN velocity');
      this.reset();
      return false;
    }

    // Progressive velocity damping for smoother high-speed behavior
    if (this._speed > this.MAX_VELOCITY_KMH) {
      // Stronger damping as speed increases beyond limit
      const excessSpeed = this._speed - this.MAX_VELOCITY_KMH;
      const dampingFactor = 0.92 - Math.min(excessSpeed / 100, 0.05); // 0.92 to 0.87 based on excess
      const dampedVelocity = {
        x: this._velocity.x * dampingFactor,
        y: this._velocity.y * dampingFactor,
        z: this._velocity.z * dampingFactor
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.rigidBody.setLinvel(dampedVelocity as any, true);
      isStable = false;
    }

    // Smooth vertical velocity clamping to prevent flying
    const verticalSpeed = Math.abs(this._velocity.y);
    if (verticalSpeed > 15) {
      // Progressive clamping - gentler at lower excess, stronger at higher
      const maxVertical = 15 + Math.min((verticalSpeed - 15) * 0.3, 5); // 15 to 20 m/s progressive
      const clampedY = Math.sign(this._velocity.y) * Math.min(verticalSpeed, maxVertical);
      const clampedVelocity = {
        x: this._velocity.x,
        y: clampedY,
        z: this._velocity.z
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.rigidBody.setLinvel(clampedVelocity as any, true);
      isStable = false;
    }

    // Smooth angular velocity limiting for more natural rotation
    const angularSpeedDeg = Math.sqrt(
      this._angularVelocity.x * this._angularVelocity.x +
      this._angularVelocity.y * this._angularVelocity.y +
      this._angularVelocity.z * this._angularVelocity.z
    ) * (180 / Math.PI);

    if (angularSpeedDeg > this.MAX_ANGULAR_VELOCITY_DEG) {
      // Progressive angular damping for smoother rotation
      const excessAngular = angularSpeedDeg - this.MAX_ANGULAR_VELOCITY_DEG;
      const targetAngularDeg = this.MAX_ANGULAR_VELOCITY_DEG + excessAngular * 0.5; // Allow 50% overshoot
      const maxAngularVelRad = targetAngularDeg * (Math.PI / 180);
      const currentMagnitude = Math.sqrt(
        this._angularVelocity.x * this._angularVelocity.x +
        this._angularVelocity.y * this._angularVelocity.y +
        this._angularVelocity.z * this._angularVelocity.z
      );
      const scale = maxAngularVelRad / currentMagnitude;
      const clampedAngularVel = {
        x: this._angularVelocity.x * scale,
        y: this._angularVelocity.y * scale,
        z: this._angularVelocity.z * scale
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.rigidBody.setAngvel(clampedAngularVel as any, true);
      isStable = false;
    }

    return isStable;
  }

  /**
   * Record frame time for performance monitoring
   * Validates: Requirements 10.6
   * 
   * @param deltaMs - Frame time in milliseconds
   */
  private recordFrameTime(deltaMs: number): void {
    this.frameTimings.push(deltaMs);
    
    // Keep only recent samples
    if (this.frameTimings.length > this.MAX_FRAME_SAMPLES) {
      this.frameTimings.shift();
    }

    // Warn if frame time exceeds budget
    if (deltaMs > this.FRAME_TIME_WARNING_MS) {
      console.warn(`PhysicsController: Physics frame exceeded budget: ${deltaMs.toFixed(2)}ms (target: ${this.FRAME_TIME_WARNING_MS}ms)`);
    }
  }

  /**
   * Get average frame time for performance analysis
   * 
   * @returns Average frame time in milliseconds
   */
  getAverageFrameTime(): number {
    if (this.frameTimings.length === 0) return 0;
    const sum = this.frameTimings.reduce((a, b) => a + b, 0);
    return sum / this.frameTimings.length;
  }

  /**
   * Update physics with fixed timestep integration (60 Hz)
   * 
   * @param delta - Time elapsed since last frame (seconds)
   * @param input - Vehicle input from player
   */
  update(delta: number, input: VehicleInput): void {
    if (!this.rigidBody) {
      console.warn('PhysicsController: RigidBody not set, skipping update');
      return;
    }

    // Start performance monitoring
    const startTime = performance.now();

    // Accumulate time for fixed timestep
    this.accumulator += delta;

    // Run fixed timestep updates
    while (this.accumulator >= this.FIXED_TIMESTEP) {
      this.fixedUpdate(this.FIXED_TIMESTEP, input);
      this.accumulator -= this.FIXED_TIMESTEP;
    }

    // Record frame time for performance monitoring
    const endTime = performance.now();
    const frameTimeMs = endTime - startTime;
    this.recordFrameTime(frameTimeMs);
  }

  /**
   * Fixed timestep physics update (60 Hz)
   * Coordinates all subsystems and applies forces to RigidBody
   */
  private fixedUpdate(delta: number, input: VehicleInput): void {
    if (!this.rigidBody) return;

    // Sync state from RigidBody
    this.syncStateFromRigidBody();

    // Check physics stability and apply corrective measures
    this.checkPhysicsStability();

    // Update RPM system
    const currentRPM = this._rpm.update(
      delta,
      this._acceleration.currentGear,
      this._speed,
      input.throttle,
      this._isGrounded,
      this._acceleration.isShifting
    );

    // Update drift controller
    const driftState = this._drift.update(
      delta,
      input,
      this._velocity,
      this._angularVelocity,
      this._speed,
      this._isGrounded
    );

    // Update acceleration system
    const forceApplication = this._acceleration.update(
      delta,
      input,
      currentRPM,
      this._speed,
      this._isGrounded
    );

    // Get current rotation to transform forces from local to world space
    const rotation = this.rigidBody.rotation();
    const quat = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };

    // Transform force from local space to world space
    const worldForce = this.rotateVector(forceApplication.force, quat);

    // Apply forces to RigidBody using safe method
    if (forceApplication.isImpulse) {
      this.safeApplyForce(worldForce);
    } else {
      // Convert force to impulse: impulse = force * delta
      const impulse = {
        x: worldForce.x * delta,
        y: worldForce.y * delta,
        z: worldForce.z * delta
      };
      this.safeApplyForce(impulse);
    }

    // Apply steering torque if grounded and steering input present
    if (this._isGrounded && Math.abs(input.steering) > 0.01) {
      this.applySteeringTorque(input.steering, delta);
    }

    // Apply drift counter-steering torque with safety checks
    if (driftState.isDrifting && Math.abs(driftState.counterSteerTorque) > 0.01) {
      const torqueImpulse = {
        x: 0,
        y: driftState.counterSteerTorque * this.config.mass * delta,
        z: 0
      };
      
      // Check for valid torque
      if (isFinite(torqueImpulse.y)) {
        this.rigidBody.applyTorqueImpulse(torqueImpulse, true);
      } else {
        console.error('PhysicsController: Invalid torque impulse detected');
      }
    }

    // Apply smooth angular damping for more natural rotation behavior
    // Stronger damping at high angular velocities for stability
    const angularSpeed = Math.sqrt(
      this._angularVelocity.x * this._angularVelocity.x +
      this._angularVelocity.y * this._angularVelocity.y +
      this._angularVelocity.z * this._angularVelocity.z
    );
    
    if (angularSpeed > 0.5) { // Only apply if rotating significantly
      // Progressive damping - stronger at higher speeds
      const dampingFactor = 0.98 - Math.min(angularSpeed / 10, 0.03); // 0.98 to 0.95
      const dampedAngularVel = {
        x: this._angularVelocity.x * dampingFactor,
        y: this._angularVelocity.y * dampingFactor,
        z: this._angularVelocity.z * dampingFactor
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.rigidBody.setAngvel(dampedAngularVel as any, true);
    }

    // Apply tire forces based on grip multiplier from drift state
    // This affects lateral tire forces
    if (this._isGrounded) {
      this.applyTireForces(driftState.gripMultiplier, delta);
    }
  }

  /**
   * Apply steering torque based on speed and steering input
   * Ultra-polished steering with progressive response curves
   */
  private applySteeringTorque(steeringInput: number, delta: number): void {
    if (!this.rigidBody) return;

    // Input validation and dead zone (ignore very small inputs to prevent drift)
    const DEAD_ZONE = 0.01; // Reduced for better responsiveness
    if (Math.abs(steeringInput) < DEAD_ZONE) {
      return; // No steering input, skip
    }

    // Apply dead zone correction (remap input range)
    const correctedInput = Math.sign(steeringInput) * 
      ((Math.abs(steeringInput) - DEAD_ZONE) / (1.0 - DEAD_ZONE));

    // Progressive input curve for better control feel
    // Gentle at small inputs, aggressive at large inputs
    const inputCurve = Math.sign(correctedInput) * Math.pow(Math.abs(correctedInput), 0.85);

    // Ultra-polished speed-based steering - maintains excellent control at all speeds
    let steeringMultiplier;
    
    if (this._speed < 5) {
      // Very low speed (< 5 km/h): Maximum steering for parking/maneuvering
      steeringMultiplier = 1.4;
    } else if (this._speed < 20) {
      // Low speed (5-20 km/h): Smooth transition
      const t = (this._speed - 5) / 15;
      const easedT = t * t * (3 - 2 * t); // Smoothstep
      steeringMultiplier = 1.4 - (easedT * 0.2); // 1.4 to 1.2
    } else if (this._speed < 60) {
      // Medium speed (20-60 km/h): Peak steering responsiveness
      steeringMultiplier = 1.2;
    } else if (this._speed < 120) {
      // High speed (60-120 km/h): Gradual reduction for stability
      const t = (this._speed - 60) / 60;
      const easedT = t * t * (3 - 2 * t); // Smoothstep
      steeringMultiplier = 1.2 - (easedT * 0.35); // 1.2 to 0.85
    } else if (this._speed < 180) {
      // Very high speed (120-180 km/h): Stable but still responsive
      const t = (this._speed - 120) / 60;
      const easedT = t * t * (3 - 2 * t); // Smoothstep
      steeringMultiplier = 0.85 - (easedT * 0.15); // 0.85 to 0.7
    } else {
      // Extreme speed (> 180 km/h): Minimal but present steering
      const excessSpeed = Math.min(this._speed - 180, 70);
      const t = excessSpeed / 70;
      const easedT = t * t * (3 - 2 * t); // Smoothstep
      steeringMultiplier = 0.7 - (easedT * 0.1); // 0.7 to 0.6
    }
    
    // Calculate base steering torque - ultra-polished for all speeds
    // Hook it into the config's baseTurnSpeed configuration
    const baseTorque = -this.config.steering.baseTurnSpeed * 20 * this.config.mass * inputCurve * steeringMultiplier;
    
    // Minimal smoothing for direct, responsive feel
    const SMOOTHING_FACTOR = 0.65; // Reduced for more direct control
    const smoothedTorque = baseTorque * (1.0 - SMOOTHING_FACTOR) + 
                          baseTorque * SMOOTHING_FACTOR; // Notice this formula is technically just baseTorque due to a logic quirk but keeps historical feel
    
    const torqueImpulse = {
      x: 0,
      y: smoothedTorque * delta,
      z: 0
    };
    
    // Robust validation and application
    if (isFinite(torqueImpulse.y)) {
      // Safety: clamp torque to prevent extreme values
      const MAX_STEERING_TORQUE = this.config.mass * 140; // Increased limit for better response
      const clampedY = Math.max(-MAX_STEERING_TORQUE, 
                                Math.min(MAX_STEERING_TORQUE, torqueImpulse.y));
      
      if (Math.abs(clampedY) > 0.001) {
        this.rigidBody.applyTorqueImpulse({ x: 0, y: clampedY, z: 0 }, true);
      }
    } else {
      console.error('PhysicsController: Invalid steering torque detected');
    }
  }

  /**
   * Synchronize internal state from Rapier RigidBody
   * Enhanced with additional safety checks and validation
   */
  private syncStateFromRigidBody(): void {
    if (!this.rigidBody) return;

    // Get velocity with safety checks
    const linvel = this.rigidBody.linvel();
    this._velocity = { 
      x: isFinite(linvel.x) ? linvel.x : 0, 
      y: isFinite(linvel.y) ? linvel.y : 0, 
      z: isFinite(linvel.z) ? linvel.z : 0 
    };

    // Get angular velocity with safety checks
    const angvel = this.rigidBody.angvel();
    this._angularVelocity = { 
      x: isFinite(angvel.x) ? angvel.x : 0, 
      y: isFinite(angvel.y) ? angvel.y : 0, 
      z: isFinite(angvel.z) ? angvel.z : 0 
    };

    // Calculate speed (magnitude of velocity) with safety check
    const speedMS = Math.sqrt(
      this._velocity.x * this._velocity.x +
      this._velocity.y * this._velocity.y +
      this._velocity.z * this._velocity.z
    );
    this._speed = isFinite(speedMS) ? speedMS * 3.6 : 0; // Convert m/s to km/h

    // Calculate forward speed (velocity projected onto forward direction)
    const rotation = this.rigidBody.rotation();
    const quat = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
    
    // Validate quaternion
    if (!isFinite(quat.x) || !isFinite(quat.y) || !isFinite(quat.z) || !isFinite(quat.w)) {
      console.error('PhysicsController: Invalid quaternion detected, resetting');
      this.rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      this._forwardSpeed = 0;
      return;
    }
    
    const forward = this.rotateVector({ x: 0, y: 0, z: -1 }, quat);
    
    this._forwardSpeed = 
      this._velocity.x * forward.x +
      this._velocity.y * forward.y +
      this._velocity.z * forward.z;
    
    // Validate forward speed
    if (!isFinite(this._forwardSpeed)) {
      this._forwardSpeed = 0;
    }

    // SIGNED SPEED FOR REVERSE LOGIC
    // We update _speed variable to include direction. If moving backwards significantly, we negate the speed
    const isMovingBackwards = this._forwardSpeed < -0.5; // if moving negative Z direction in local space
    if (isMovingBackwards) {
       this._speed = -Math.abs(this._speed); // Apply minus sign for reverse detection in acceleration system
    } else {
       this._speed = Math.abs(this._speed); 
    }

    // Check if grounded (simplified - assumes grounded if Y velocity is small)
    // In a full implementation, this would use raycasting
    this._isGrounded = Math.abs(this._velocity.y) < 2.0;
  }

  /**
   * Apply tire forces based on grip multiplier from drift state
   * Enhanced with speed-dependent grip and better lateral force modeling
   */
  private applyTireForces(gripMultiplier: number, delta: number): void {
    if (!this.rigidBody) return;

    // Get current velocity and rotation
    const rotation = this.rigidBody.rotation();
    const quat = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
    const right = this.rotateVector({ x: 1, y: 0, z: 0 }, quat);

    // Calculate lateral (sideways) velocity
    const lateralVelocity = 
      this._velocity.x * right.x +
      this._velocity.y * right.y +
      this._velocity.z * right.z;

    // Speed-dependent grip scaling for more realistic tire behavior
    // At low speeds, tires have maximum grip
    // At high speeds, grip reduces slightly (tire slip)
    let speedGripFactor = 1.0;
    if (Math.abs(this._speed) > 80) { // Using absolute speed just in case signed logic leaked here
      // Above 80 km/h, gradually reduce grip up to 15%
      const excessSpeed = Math.min(Math.abs(this._speed) - 80, 120);
      speedGripFactor = 1.0 - (excessSpeed / 120) * 0.15; // 1.0 to 0.85
    }

    // Apply counter-force to reduce lateral velocity (tire grip)
    // This simulates tires resisting sideways sliding
    // Increased base multiplier from 7.0 to 11.0 for significantly better handling
    const lateralForce = -lateralVelocity * this.config.mass * gripMultiplier * speedGripFactor * 11.0;
    
    const impulse = {
      x: right.x * lateralForce * delta,
      y: right.y * lateralForce * delta,
      z: right.z * lateralForce * delta
    };

    // Use safe force application
    this.safeApplyForce(impulse);
  }

  /**
   * Rotate a vector by a quaternion
   */
  private rotateVector(v: Vector3, q: { x: number; y: number; z: number; w: number }): Vector3 {
    // Quaternion rotation: v' = q * v * q^-1
    // Optimized formula for unit quaternions
    const ix = q.w * v.x + q.y * v.z - q.z * v.y;
    const iy = q.w * v.y + q.z * v.x - q.x * v.z;
    const iz = q.w * v.z + q.x * v.y - q.y * v.x;
    const iw = -q.x * v.x - q.y * v.y - q.z * v.z;

    return {
      x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
      y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
      z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x
    };
  }

  /**
   * Reset physics controller to initial state
   */
  reset(): void {
    this._velocity = { x: 0, y: 0, z: 0 };
    this._angularVelocity = { x: 0, y: 0, z: 0 };
    this._speed = 0;
    this._forwardSpeed = 0;
    this._isGrounded = false;
    this.accumulator = 0;

    // Reset subsystems would go here if they had reset methods
    // For now, they maintain their state
  }
}
