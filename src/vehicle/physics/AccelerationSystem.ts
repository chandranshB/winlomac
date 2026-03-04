import type { AccelerationSystem, VehicleConfig, VehicleInput, ForceApplication, Vector3 } from '../types';
import { fastTorqueLookup } from './OptimizedCurveLookup';

export class AccelerationSystemImpl implements AccelerationSystem {
  private _currentGear: number = 1;
  private _isShifting: boolean = false;
  private _torqueMultiplier: number = 0;
  private shiftTimer: number = 0;
  private config: VehicleConfig;
  private wheelbase: number;

  constructor(config: VehicleConfig) {
    this.config = config;
    // Calculate wheelbase from vehicle dimensions
    this.wheelbase = config.dimensions.length * 0.6; // Approximate wheelbase as 60% of length
  }

  get currentGear(): number {
    return this._currentGear;
  }

  get isShifting(): boolean {
    return this._isShifting;
  }

  get torqueMultiplier(): number {
    return this._torqueMultiplier;
  }

  update(
    delta: number,
    input: VehicleInput,
    rpm: number,
    speed: number,
    isGrounded: boolean
  ): ForceApplication {
    // Validate inputs
    if (!isFinite(delta) || delta <= 0 || delta > 1) {
      console.warn('AccelerationSystem: Invalid delta, using fallback');
      delta = 1/60; // Fallback to 60 FPS
    }
    
    if (!isFinite(rpm) || rpm < 0) {
      rpm = this.config.engine.idleRPM;
    }
    
    if (!isFinite(speed)) {
      speed = 0;
    }
    
    // Clamp input values to valid ranges
    const throttle = Math.max(0, Math.min(1, input.throttle || 0));
    const brake = Math.max(0, Math.min(1, input.brake || 0));

    // Update shift timer
    if (this._isShifting) {
      this.shiftTimer += delta;
      if (this.shiftTimer >= this.config.transmission.shiftTime) {
        this._isShifting = false;
        this.shiftTimer = 0;
      }
    }

    // Check for automatic gear shifting
    if (!this._isShifting && !input.handbrake) {
      const newGear = this.shouldShift(speed, rpm);
      if (newGear !== null && newGear !== this._currentGear) {
        this._currentGear = newGear;
        this._isShifting = true;
        this.shiftTimer = 0;
      }
    }

    // Calculate torque multiplier from RPM
    this._torqueMultiplier = this.calculateTorque(rpm);

    // Calculate force application
    const force = { x: 0, y: 0, z: 0 } as Vector3;
    const point = { x: 0, y: 0, z: 0 } as Vector3;

    // Only apply force if grounded and not shifting
    if (isGrounded && !this._isShifting) {
      // Handle throttle (forward) input
      if (throttle > 0) {
        // Calculate engine torque
        const engineTorque = this._torqueMultiplier * this.config.acceleration * throttle;
        
        // Calculate weight transfer during acceleration
        // Weight transfers to rear wheels during acceleration, increasing rear grip
        const weightTransfer = this.calculateWeightTransfer(engineTorque);
        
        // Calculate available tire grip (base grip + weight transfer bonus)
        // Weight transfer increases rear grip by 15-25% during acceleration
        const weightTransferBonus = weightTransfer.rear / (this.config.mass * 9.81 / 2); // Normalize to percentage
        const gripMultiplier = 1.0 + Math.min(0.25, Math.max(0.15, weightTransferBonus * 0.2)); // 15-25% increase
        
        // Progressive throttle response curve for better control
        // Gentle at low throttle, aggressive at high throttle
        const throttleCurve = Math.pow(throttle, 0.9); // Slightly progressive
        
        // Simulate wheel spin on low-grip surfaces when throttle > 70%
        let wheelSpinReduction = 1.0;
        if (throttle > 0.7) {
          // On low-grip surfaces, excessive throttle causes wheel spin
          // Reduce effective force when spinning
          const excessThrottle = (throttle - 0.7) / 0.3; // 0-1 range above 70%
          wheelSpinReduction = 1.0 - (excessThrottle * 0.35); // Up to 35% reduction from wheel spin (reduced from 40%)
        }
        
        // Speed-dependent power scaling for realistic acceleration curve
        // Cars accelerate faster at low speeds, slower at high speeds
        let speedPowerFactor = 1.0;
        
        // Hard limit check to definitively prevent exceeding maxSpeed
        if (speed >= this.config.maxSpeed) {
           speedPowerFactor = 0.0; // Complete power cut when max speed is reached
        } else if (speed > this.config.maxSpeed * 0.4) {
          // Above 40% of max speed, gradually reduce acceleration
          const excessSpeedRatio = (speed - (this.config.maxSpeed * 0.4)) / (this.config.maxSpeed * 0.6);
          // Scale down to 0% power gracefully as it hits maxSpeed
          speedPowerFactor = 1.0 - Math.min(excessSpeedRatio, 1.0); 
        }
        
        // Apply wheel torque proportional to tire grip and weight transfer
        const effectiveTorque = engineTorque * gripMultiplier * wheelSpinReduction * throttleCurve * speedPowerFactor;
        
        // Apply force in forward direction (negative Z in Three.js)
        // Increased multiplier from 100 to 110 for better acceleration
        (force as { x: number; y: number; z: number }).z = -effectiveTorque * this.config.mass * 110;
        
        // Apply at rear axle for weight transfer simulation
        (point as { x: number; y: number; z: number }).z = -this.config.dimensions.length * 0.3; // 30% back from center
      }
      // Handle brake (reverse) input with realistic behavior
      else if (brake > 0) {
        // Determine if we're moving forward or backward
        const isMovingForward = speed > 0.5;
        const isMovingBackward = speed < -0.5;
        const isNearlyStationary = Math.abs(speed) <= 0.5;
        
        if (isMovingForward) {
          // Apply progressive braking force when moving forward
          // Braking is more effective at higher speeds (like real brakes)
          const speedFactor = Math.min(speed / 50, 1.0); // Normalize to 0-1
          
          // Progressive brake input curve for better control
          const brakeCurve = Math.pow(brake, 0.85); // Slightly progressive
          
          const baseBrakingForce = brakeCurve * this.config.braking * this.config.mass * 900; // Increased from 800
          const progressiveBraking = baseBrakingForce * (0.6 + speedFactor * 0.4); // 60-100% based on speed (improved from 50-100%)
          
          // Apply force opposite to movement direction (positive Z to slow down)
          const clampedBrakingForce = Math.min(progressiveBraking, this.config.mass * 6000); // Increased from 5000
          (force as { x: number; y: number; z: number }).z = clampedBrakingForce;
        }
        else if (isNearlyStationary || isMovingBackward) {
          // Reverse gear engaged - realistic reverse behavior
          // Real cars have lower reverse gear ratio and limited power
          // Reverse is typically 20-35% of first gear power
          const reversePowerRatio = 0.25;
          
          // Calculate reverse torque with realistic gear ratio
          const reverseTorque = this._torqueMultiplier * this.config.acceleration * brake * reversePowerRatio;
          
          // Apply speed limiter for reverse (typically 25-40 km/h max)
          const maxReverseSpeed = 35; // km/h
          let speedLimiter = 1.0;
          if (Math.abs(speed) > maxReverseSpeed * 0.8) {
            // Gradually reduce power as approaching max reverse speed
            speedLimiter = Math.max(0, 1.0 - (Math.abs(speed) - maxReverseSpeed * 0.8) / (maxReverseSpeed * 0.2));
          }
          
          // Apply force in reverse direction (positive Z in Three.js)
          const reverseForce = reverseTorque * this.config.mass * 25 * speedLimiter;
          
          // Clamp reverse force for stability
          const clampedReverseForce = Math.min(reverseForce, this.config.mass * 2500);
          (force as { x: number; y: number; z: number }).z = clampedReverseForce;
          
          // Apply at rear axle for realistic weight distribution
          (point as { x: number; y: number; z: number }).z = -this.config.dimensions.length * 0.3;
        }
      }
    }

    return {
      force,
      point,
      isImpulse: false
    };
  }

  /**
   * Calculate weight transfer during acceleration
   * Weight transfers to rear wheels during acceleration, increasing rear grip
   * 
   * @param longitudinalForce - Forward acceleration force
   * @returns Weight distribution on front and rear axles
   */
  private calculateWeightTransfer(longitudinalForce: number): { front: number; rear: number } {
    // Calculate longitudinal acceleration from force
    const longitudinalAccel = longitudinalForce / this.config.mass;
    
    // Weight transfer = (mass × acceleration × center of mass height) / wheelbase
    const weightTransfer = (this.config.mass * longitudinalAccel * this.config.centerOfMassHeight) / this.wheelbase;
    
    // Base weight distribution (50/50)
    const baseWeight = (this.config.mass * 9.81) / 2;
    
    return {
      front: baseWeight - weightTransfer,
      rear: baseWeight + weightTransfer
    };
  }

  calculateTorque(rpm: number): number {
    // Use optimized binary search lookup instead of linear search
    return fastTorqueLookup(rpm, this.config.engine.torqueCurve);
  }

  shouldShift(speed: number, rpm: number): number | null {
    const absSpeed = Math.abs(speed);

    // Reverse gear logic
    if (speed < -1) {
      return -1;
    }

    // Neutral/First gear at low speeds
    if (absSpeed < 1) {
      return 1;
    }

    // Forward gear shifting
    if (this._currentGear > 0) {
      const gearRatios = this.config.transmission.gearRatios;

      // Upshift if approaching redline
      if (rpm > this.config.engine.redlineRPM * 0.9 && this._currentGear < gearRatios.length) {
        return this._currentGear + 1;
      }

      // Downshift if RPM too low (with hysteresis)
      if (this._currentGear > 1) {
        const minRPM = this.config.engine.idleRPM + 1000;
        if (rpm < minRPM) {
          return this._currentGear - 1;
        }
      }
    }

    // Force neutral when completely stopped and not applying throttle/brake
    if (absSpeed < 0.5) return 1;

    return null;
  }
}
