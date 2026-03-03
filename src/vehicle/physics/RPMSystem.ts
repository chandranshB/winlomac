import type { RPMSystem, VehicleConfig } from '../types';

export class RPMSystemImpl implements RPMSystem {
  private _currentRPM: number = 800;
  private _isRevLimiting: boolean = false;
  private config: VehicleConfig;

  constructor(config: VehicleConfig) {
    this.config = config;
    this._currentRPM = config.engine.idleRPM;
  }

  get currentRPM(): number {
    return this._currentRPM;
  }

  get isRevLimiting(): boolean {
    return this._isRevLimiting;
  }

  update(
      delta: number,
      gear: number,
      speed: number,
      throttle: number,
      _isGrounded: boolean,
      isShifting: boolean
    ): number {
      // Handle gear changes - instant RPM adjustment
      if (isShifting) {
        // Calculate RPM for new gear based on current speed
        this._currentRPM = this.calculateRPMFromSpeed(speed, gear);
        return this._currentRPM;
      }

      // Calculate target RPM based on speed and gear
      const targetRPM = this.calculateTargetRPM(gear, speed, throttle);

      // Smoothly interpolate towards target RPM
      const rpmChangeRate = throttle > 0.1 ? 3000 : 1500; // RPM per second
      const maxChange = rpmChangeRate * delta;

      if (Math.abs(targetRPM - this._currentRPM) < maxChange) {
        this._currentRPM = targetRPM;
      } else if (targetRPM > this._currentRPM) {
        this._currentRPM += maxChange;
      } else {
        this._currentRPM -= maxChange;
      }

      // Apply rev limiter
      this._currentRPM = this.applyRevLimiter(this._currentRPM);

      // Ensure RPM stays within bounds
      this._currentRPM = Math.max(
        this.config.engine.idleRPM,
        Math.min(this.config.engine.redlineRPM, this._currentRPM)
      );

      return this._currentRPM;
    }


  calculateTargetRPM(gear: number, speed: number, throttle: number): number {
      // If no throttle, return idle RPM
      if (throttle < 0.1) {
        return this.config.engine.idleRPM;
      }

      // Calculate RPM from speed and gear
      const baseRPM = this.calculateRPMFromSpeed(speed, gear);

      // Add throttle influence (allows revving beyond speed-based RPM)
      const throttleRPM = this.config.engine.idleRPM + 
        (this.config.engine.redlineRPM - this.config.engine.idleRPM) * throttle * 0.3;

      // Target is the higher of speed-based or throttle-based RPM
      return Math.max(baseRPM, throttleRPM);
    }


  applyRevLimiter(rpm: number): number {
      // Check if RPM exceeds rev limiter threshold
      if (rpm > this.config.engine.revLimiterRPM) {
        this._isRevLimiting = true;
        // Cut RPM to 90% of rev limiter (10% reduction from current)
        return this.config.engine.revLimiterRPM * 0.95;
      }

      this._isRevLimiting = false;
      return rpm;
    }

  private calculateRPMFromSpeed(speed: number, gear: number): number {
    // Neutral or invalid gear
    if (gear === 0) {
      return this.config.engine.idleRPM;
    }

    // Get gear ratio
    const gearRatio = gear === -1 
      ? this.config.transmission.reverseRatio 
      : this.config.transmission.gearRatios[gear - 1];

    const finalDrive = this.config.transmission.finalDrive;
    const wheelCircumference = 2 * Math.PI * 0.35; // 0.35m radius

    // Convert speed from km/h to m/s
    const speedMS = Math.abs(speed) / 3.6;

    // Wheel RPM from speed
    const wheelRPM = (speedMS * 60) / wheelCircumference;

    // Engine RPM from wheel RPM
    const engineRPM = wheelRPM * gearRatio * finalDrive;

    // Ensure minimum idle RPM
    return Math.max(this.config.engine.idleRPM, engineRPM);
  }
}
