import type { Vector3 } from '@react-three/fiber';
import type { DriftController, VehicleConfig, VehicleInput, DriftState } from '../types';

/**
 * Drift scoring event data
 */
export interface DriftScoringEvent {
  duration: number; // seconds
  slipAngle: number; // degrees
  score: number;
}

export class DriftControllerImpl implements DriftController {
  private _isDrifting: boolean = false;
  private _slipAngle: number = 0;
  private _driftDuration: number = 0;
  private _driftScore: number = 0;
  private _exitTransitionProgress: number = 0; // 0 to 1, for smooth exit transition
  private _surfaceTransitionProgress: number = 0; // 0 to 1, for surface transition interpolation
  private _driftScoringEmitted: boolean = false; // Track if scoring event was emitted for current drift
  private _wasAirborne: boolean = false; // Track airborne state for drift deferral
  private readonly config: VehicleConfig;
  private readonly driftScoringCallbacks: Array<(score: DriftScoringEvent) => void> = [];

  constructor(config: VehicleConfig) {
    this.config = config;
  }

  get isDrifting(): boolean {
    return this._isDrifting;
  }

  get slipAngle(): number {
    return this._slipAngle;
  }

  get driftDuration(): number {
    return this._driftDuration;
  }

  get driftScore(): number {
    return this._driftScore;
  }

  /**
   * Register a callback to be invoked when drift scoring events are emitted
   */
  onDriftScoring(callback: (event: DriftScoringEvent) => void): void {
    this.driftScoringCallbacks.push(callback);
  }

  /**
   * Exit drift immediately (e.g., due to collision) - Requirement 2.2
   */
  exitDriftImmediately(): void {
    if (this._isDrifting) {
      this._isDrifting = false;
      this._exitTransitionProgress = 0;
      this._driftScoringEmitted = false;
    }
  }

  update(
    delta: number,
    input: VehicleInput,
    velocity: Vector3,
    angularVelocity: Vector3,
    speed: number,
    isGrounded: boolean
  ): DriftState {
    // Mark angularVelocity as intentionally unused (will be used in task 6.3)
    void angularVelocity;

    // Calculate current slip angle from velocity and heading
    // For heading, we'll derive it from the velocity direction when moving
    // In a real implementation, this would come from the vehicle's forward vector
    const heading = this.deriveHeadingFromVelocity(velocity);
    this._slipAngle = this.calculateSlipAngle(velocity, heading);

    // Airborne drift deferral (Requirement 2.4)
    if (!isGrounded) {
      this._wasAirborne = true;
      // Don't enter drift while airborne, but maintain current drift state
      // Drift will be deferred until wheels contact ground
    }

    // State transition logic
    if (!this._isDrifting) {
      // Check if we should enter drift state
      // Defer drift entry if we were just airborne (Requirement 2.4)
      if (isGrounded && !this._wasAirborne && this.shouldEnterDrift(input, speed, this._slipAngle)) {
        this._isDrifting = true;
        this._exitTransitionProgress = 0;
        this._driftScoringEmitted = false;
        this._surfaceTransitionProgress = 0;
      }
      
      // Reset airborne flag once grounded
      if (isGrounded) {
        this._wasAirborne = false;
      }
    } else {
      // Check if we should exit drift state
      if (this.shouldExitDrift(input, speed, this._slipAngle)) {
        this._isDrifting = false;
        this._exitTransitionProgress = 0;
        this._driftScoringEmitted = false;
        this._surfaceTransitionProgress = 1.0; // Start surface transition
      }
    }

    // Update drift duration counter and emit scoring events
    if (this._isDrifting) {
      this._driftDuration += delta;
      this._exitTransitionProgress = 0; // Reset transition when actively drifting
      
      // Emit drift scoring event after 0.5 seconds (Requirement 1.7)
      if (this._driftDuration >= 0.5 && !this._driftScoringEmitted) {
        this._driftScore = this.calculateDriftScore(this._driftDuration, this._slipAngle);
        this.emitDriftScoringEvent({
          duration: this._driftDuration,
          slipAngle: this._slipAngle,
          score: this._driftScore
        });
        this._driftScoringEmitted = true;
      }
      
      // Continue updating score while drifting
      if (this._driftDuration >= 0.5) {
        this._driftScore = this.calculateDriftScore(this._driftDuration, this._slipAngle);
      }
    } else {
      // Handle smooth exit transition
      if (this._driftDuration > 0) {
        this._exitTransitionProgress += delta / this.config.drift.exitTransitionTime;
        if (this._exitTransitionProgress >= 1.0) {
          this._driftDuration = 0;
          this._driftScore = 0;
          this._exitTransitionProgress = 0;
        }
      }
    }

    // Surface transition interpolation (Requirement 2.3)
    if (this._surfaceTransitionProgress > 0 && this._surfaceTransitionProgress < 1.0) {
      this._surfaceTransitionProgress += delta / 0.2; // 0.2 seconds transition time
      if (this._surfaceTransitionProgress >= 1.0) {
        this._surfaceTransitionProgress = 0;
      }
    }

    // Calculate grip multiplier with smooth transition
    let gripMultiplier = 1.0;
    if (this._isDrifting) {
      gripMultiplier = 1.0 - this.config.drift.gripReduction;
    } else if (this._exitTransitionProgress > 0 && this._exitTransitionProgress < 1.0) {
      // Interpolate from drift grip to full grip during exit transition
      const driftGrip = 1.0 - this.config.drift.gripReduction;
      gripMultiplier = driftGrip + (1.0 - driftGrip) * this._exitTransitionProgress;
    } else if (this._surfaceTransitionProgress > 0 && this._surfaceTransitionProgress < 1.0) {
      // Surface transition interpolation (Requirement 2.3)
      const driftGrip = 1.0 - this.config.drift.gripReduction;
      gripMultiplier = driftGrip + (1.0 - driftGrip) * this._surfaceTransitionProgress;
    }

    // Calculate counter-steering torque
    let counterSteerTorque = 0;
    if (this._isDrifting) {
      counterSteerTorque = this.calculateCounterSteer(this._slipAngle);
    }

    // Enforce slip angle bounds and apply corrective forces
    const absSlipAngle = Math.abs(this._slipAngle);
    if (this._isDrifting) {
      // If slip angle exceeds spinout threshold (50°), apply strong corrective forces
      if (absSlipAngle > this.config.drift.spinoutThreshold) {
        // Apply additional corrective torque to prevent full spin-out
        const excessAngle = absSlipAngle - this.config.drift.spinoutThreshold;
        const correctiveTorque = -Math.sign(this._slipAngle) * excessAngle * 2.0;
        counterSteerTorque += correctiveTorque;
      }
      
      // Clamp slip angle to max bounds (45°) by increasing grip when approaching limit
      if (absSlipAngle > this.config.drift.maxSlipAngle) {
        // Gradually restore grip to bring slip angle back within bounds
        const excessAngle = absSlipAngle - this.config.drift.maxSlipAngle;
        const gripRestoration = Math.min(excessAngle / 10, 0.3); // Up to 30% grip restoration
        gripMultiplier = Math.min(1.0, gripMultiplier + gripRestoration);
      }
    }

    return {
      isDrifting: this._isDrifting,
      gripMultiplier,
      counterSteerTorque,
      slipAngle: this._slipAngle
    };
  }

  calculateSlipAngle(velocity: Vector3, heading: Vector3): number {
    // Handle both array and Vector3 object types
    const vx = typeof velocity === 'object' && 'x' in velocity ? velocity.x : (velocity as unknown as number[])[0];
    const vz = typeof velocity === 'object' && 'z' in velocity ? velocity.z : (velocity as unknown as number[])[2];
    const hx = typeof heading === 'object' && 'x' in heading ? heading.x : (heading as unknown as number[])[0];
    const hz = typeof heading === 'object' && 'z' in heading ? heading.z : (heading as unknown as number[])[2];

    // Project velocity onto ground plane (ignore Y component)
    const velocityMagnitude = Math.sqrt(vx * vx + vz * vz);

    // If velocity is too small, slip angle is zero
    if (velocityMagnitude < 0.1) {
      return 0;
    }

    // Normalize velocity direction
    const velocityDirX = vx / velocityMagnitude;
    const velocityDirZ = vz / velocityMagnitude;

    // Normalize heading direction (ground plane)
    const headingMagnitude = Math.sqrt(hx * hx + hz * hz);

    if (headingMagnitude < 0.01) {
      return 0;
    }

    const headingDirX = hx / headingMagnitude;
    const headingDirZ = hz / headingMagnitude;

    // Calculate angle between velocity and heading using dot product
    const dot = velocityDirX * headingDirX + velocityDirZ * headingDirZ;
    const clampedDot = Math.max(-1, Math.min(1, dot));
    
    // Calculate cross product to determine sign (left vs right slip)
    const cross = velocityDirX * headingDirZ - velocityDirZ * headingDirX;
    
    // Angle in degrees
    const angle = Math.acos(clampedDot) * (180 / Math.PI);
    
    // Return signed angle based on cross product
    return cross >= 0 ? angle : -angle;
  }

  private deriveHeadingFromVelocity(velocity: Vector3): Vector3 {
    // Handle both array and Vector3 object types
    const vx = typeof velocity === 'object' && 'x' in velocity ? velocity.x : (velocity as unknown as number[])[0];
    const vz = typeof velocity === 'object' && 'z' in velocity ? velocity.z : (velocity as unknown as number[])[2];

    // For now, use velocity direction as heading
    // In a full implementation, this would come from the vehicle's transform
    const magnitude = Math.sqrt(vx * vx + vz * vz);
    if (magnitude < 0.1) {
      return [0, 0, -1] as unknown as Vector3; // Default forward direction
    }
    return [vx / magnitude, 0, vz / magnitude] as unknown as Vector3;
  }

  shouldEnterDrift(input: VehicleInput, speed: number, slipAngle: number): boolean {
    // Check minimum speed threshold
    if (speed < this.config.drift.entrySpeedThreshold) {
      return false;
    }
    
    // Check steering angle threshold
    const steeringAngle = Math.abs(input.steering) * 45; // Max 45 degrees
    if (steeringAngle < this.config.drift.entrySteeringThreshold) {
      return false;
    }
    
    // Check throttle application (must be accelerating)
    if (input.throttle < 0.3 && !input.handbrake) {
      return false;
    }
    
    // Check if slip angle is developing
    if (Math.abs(slipAngle) < this.config.drift.minSlipAngle) {
      return false;
    }
    
    return true;
  }

  shouldExitDrift(input: VehicleInput, speed: number, slipAngle: number): boolean {
    // Mark slipAngle as intentionally unused (not needed for exit logic)
    void slipAngle;
    
    // Exit if speed drops too low (Requirement 2.1)
    if (speed < 20) { // km/h
      return true;
    }
    
    // Exit if steering straightens
    const steeringAngle = Math.abs(input.steering) * 45;
    if (steeringAngle < this.config.drift.entrySteeringThreshold * 0.5) {
      return true;
    }
    
    // Exit if throttle released (unless handbrake held)
    if (input.throttle < 0.1 && !input.handbrake) {
      return true;
    }
    
    return false;
  }

  calculateCounterSteer(slipAngle: number): number {
      // Counter-steering assistance proportional to slip angle
      // Positive slip angle means car is sliding right, need to steer left (negative torque)
      // Negative slip angle means car is sliding left, need to steer right (positive torque)
      const counterSteerTorque = -slipAngle * this.config.drift.counterSteerAssist;

      return counterSteerTorque;
    }

  /**
   * Calculate drift score based on duration and slip angle
   */
  private calculateDriftScore(duration: number, slipAngle: number): number {
    // Simple scoring: duration * slip angle magnitude
    // More complex scoring could consider speed, angle consistency, etc.
    return duration * Math.abs(slipAngle);
  }

  /**
   * Emit drift scoring event to registered callbacks
   */
  private emitDriftScoringEvent(event: DriftScoringEvent): void {
    this.driftScoringCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in drift scoring callback:', error);
      }
    });
  }
}
