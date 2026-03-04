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
      // Handle gear changes with smooth rev matching
      if (isShifting) {
        // Calculate RPM for new gear based on current speed with smooth transition
        const targetRPM = this.calculateRPMFromSpeed(speed, gear);
        // Blend current and target RPM for smoother gear changes
        this._currentRPM = this._currentRPM * 0.3 + targetRPM * 0.7;
        return this._currentRPM;
      }

      // Calculate target RPM based on speed and gear
      const targetRPM = this.calculateTargetRPM(gear, speed, throttle);

      // Adaptive RPM change rate for smoother response
      // Faster response on throttle, slower on deceleration
      const baseRate = throttle > 0.1 ? 3500 : 2000; // RPM per second (increased from 3000/1500)
      // Add speed-dependent scaling for more realistic behavior
      const speedFactor = 1.0 + Math.min(speed / 100, 0.5); // Up to 50% faster at high speeds
      const rpmChangeRate = baseRate * speedFactor;
      const maxChange = rpmChangeRate * delta;

      // Smooth interpolation with easing
      const rpmDiff = targetRPM - this._currentRPM;
      if (Math.abs(rpmDiff) < maxChange) {
        this._currentRPM = targetRPM;
      } else {
        // Apply easing for smoother transitions
        const easingFactor = Math.min(Math.abs(rpmDiff) / 1000, 1.0); // Ease based on RPM difference
        const actualChange = maxChange * (0.5 + easingFactor * 0.5); // 50-100% of max change
        this._currentRPM += Math.sign(rpmDiff) * actualChange;
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
