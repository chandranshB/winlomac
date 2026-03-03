import type { Vector3 } from '@react-three/fiber';
import type { AccelerationSystem, VehicleConfig, VehicleInput, ForceApplication } from '../types';

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
    if (isGrounded && !this._isShifting && input.throttle > 0) {
      // Calculate engine torque
      const engineTorque = this._torqueMultiplier * this.config.acceleration * input.throttle;
      
      // Calculate weight transfer during acceleration
      // Weight transfers to rear wheels during acceleration, increasing rear grip
      const weightTransfer = this.calculateWeightTransfer(engineTorque);
      
      // Calculate available tire grip (base grip + weight transfer bonus)
      // Weight transfer increases rear grip by 15-25% during acceleration
      const weightTransferBonus = weightTransfer.rear / (this.config.mass * 9.81 / 2); // Normalize to percentage
      const gripMultiplier = 1.0 + Math.min(0.25, Math.max(0.15, weightTransferBonus * 0.2)); // 15-25% increase
      
      // Simulate wheel spin on low-grip surfaces when throttle > 70%
      let wheelSpinReduction = 1.0;
      if (input.throttle > 0.7) {
        // On low-grip surfaces, excessive throttle causes wheel spin
        // Reduce effective force when spinning
        const excessThrottle = (input.throttle - 0.7) / 0.3; // 0-1 range above 70%
        wheelSpinReduction = 1.0 - (excessThrottle * 0.4); // Up to 40% reduction from wheel spin
      }
      
      // Apply wheel torque proportional to tire grip and weight transfer
      const effectiveTorque = engineTorque * gripMultiplier * wheelSpinReduction;
      
      // Apply force in forward direction (negative Z in Three.js)
      (force as { x: number; y: number; z: number }).z = -effectiveTorque * this.config.mass * 10; // Scale by mass and constant
      
      // Apply at rear axle for weight transfer simulation
      (point as { x: number; y: number; z: number }).z = -this.config.dimensions.length * 0.3; // 30% back from center
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
    const curve = this.config.engine.torqueCurve;
    const len = curve.length;

    // Early exit for boundary cases
    if (rpm <= curve[0].rpm) return curve[0].torqueMultiplier;
    if (rpm >= curve[len - 1].rpm) return curve[len - 1].torqueMultiplier;

    // Find surrounding points in curve
    let lowerPoint = curve[0];
    let upperPoint = curve[len - 1];

    for (let i = 0; i < len - 1; i++) {
      if (rpm >= curve[i].rpm && rpm <= curve[i + 1].rpm) {
        lowerPoint = curve[i];
        upperPoint = curve[i + 1];
        break;
      }
    }

    // Linear interpolation
    const t = (rpm - lowerPoint.rpm) / (upperPoint.rpm - lowerPoint.rpm);
    return lowerPoint.torqueMultiplier + t * (upperPoint.torqueMultiplier - lowerPoint.torqueMultiplier);
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

    return null;
  }
}
