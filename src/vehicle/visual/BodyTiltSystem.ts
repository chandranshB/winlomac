import type { BodyTiltSystem, VehicleConfig, BodyTilt, Vector3 } from '../types';

export class BodyTiltSystemImpl implements BodyTiltSystem {
  private _currentPitch: number = 0;
  private _currentRoll: number = 0;
  private readonly config: VehicleConfig;
  private readonly neutralReturnTime: number = 0.2; // seconds (Requirement 6.5)
  private oscillationTime: number = 0; // Track time for oscillation

  constructor(config: VehicleConfig) {
    this.config = config;
  }

  get currentPitch(): number {
    return this._currentPitch;
  }

  get currentRoll(): number {
    return this._currentRoll;
  }

  update(
    delta: number,
    acceleration: Vector3,
    lateralAcceleration: number,
    speed: number
  ): BodyTilt {
    // Update oscillation time
    this.oscillationTime += delta;

    // Extract longitudinal acceleration (z-axis is forward/backward)
    // Handle both object {x, y, z} and tuple [x, y, z] formats
    const longitudinalAccel = Array.isArray(acceleration) ? acceleration[2] : acceleration.z;

    // Calculate target pitch and roll
    const targetPitch = this.calculatePitch(longitudinalAccel, speed);
    const targetRoll = this.calculateRoll(lateralAcceleration, speed);

    // Determine transition speeds based on whether we're applying tilt or returning to neutral
    // Requirement 6.4: Apply tilt over 0.15s
    // Requirement 6.5: Return to neutral over 0.2s
    const pitchTransitionTime = Math.abs(targetPitch) < Math.abs(this._currentPitch)
      ? this.neutralReturnTime
      : this.config.bodyTilt.pitchTransitionTime;

    // Requirement 7.6: Left-right transitions over 0.25s
    // Requirement 6.5: Return to neutral over 0.2s
    const rollTransitionTime = Math.abs(targetRoll) < 0.01 && Math.abs(this._currentRoll) > 0.01
      ? this.neutralReturnTime
      : this.config.bodyTilt.rollTransitionTime;

    const pitchTransitionSpeed = 1 / pitchTransitionTime;
    const rollTransitionSpeed = 1 / rollTransitionTime;

    this._currentPitch = this.lerp(
      this._currentPitch,
      targetPitch,
      delta * pitchTransitionSpeed
    );

    this._currentRoll = this.lerp(
      this._currentRoll,
      targetRoll,
      delta * rollTransitionSpeed
    );

    // Apply high-speed suspension oscillation (Requirement 8.4)
    const oscillation = this.calculateHighSpeedOscillation(speed);

    // Combine pitch and roll additively with oscillation (Requirement 8.5)
    return {
      pitch: this._currentPitch + oscillation,
      roll: this._currentRoll + oscillation
    };
  }

  calculatePitch(longitudinalAccel: number, speed: number): number {
    let pitch = 0;

    if (longitudinalAccel > 0) {
      // Accelerating - nose up (rear down)
      // Normalize by typical max acceleration (~20 m/s²)
      pitch = (longitudinalAccel / 20) * this.config.bodyTilt.maxPitchAccel;
    } else if (longitudinalAccel < 0) {
      // Braking - nose down (front down)
      // Normalize by typical max braking (~20 m/s²)
      pitch = (longitudinalAccel / 20) * this.config.bodyTilt.maxPitchBrake;
    }

    // Apply speed scaling
    return this.applySpeedScaling(pitch, speed);
  }

  calculateRoll(lateralAccel: number, speed: number): number {
    // Roll from lateral acceleration (centrifugal force)
    // Normalize by typical max lateral acceleration (~12 m/s²)
    let roll = (lateralAccel / 12) * this.config.bodyTilt.maxRoll;

    // High-speed roll increase: 0.01° per km/h above 100 km/h (reduced from 0.02° for less bending)
    if (speed > 100) {
      const speedBonus = (speed - 100) * 0.01; // Reduced from 0.02
      // Apply bonus in the same direction as the roll
      roll = roll >= 0 ? roll + speedBonus : roll - speedBonus;
    }

    // Clamp roll angle to maximum (now 4° instead of 8°)
    roll = Math.max(-this.config.bodyTilt.maxRoll, Math.min(this.config.bodyTilt.maxRoll, roll));

    // Apply speed scaling
    return this.applySpeedScaling(roll, speed);
  }

  applySpeedScaling(tilt: number, speed: number): number {
    const { minSpeed, maxSpeed, minScale, maxScale } = this.config.bodyTilt.speedScaling;

    let scale: number;

    if (speed < minSpeed) {
      scale = minScale;
    } else if (speed > maxSpeed) {
      scale = maxScale;
    } else {
      // Linear interpolation between minSpeed and maxSpeed
      const t = (speed - minSpeed) / (maxSpeed - minSpeed);
      scale = minScale + t * (maxScale - minScale);
    }

    return tilt * scale;
  }

  /**
   * Calculate high-speed suspension oscillation (Requirement 8.4)
   * Above 120 km/h: ±0.15 degrees at 2 Hz frequency (reduced for less bending)
   */
  private calculateHighSpeedOscillation(speed: number): number {
    if (speed <= 120) {
      return 0;
    }

    // 2 Hz oscillation = 2 cycles per second
    const frequency = 2; // Hz
    const amplitude = 0.15; // degrees (reduced from 0.3 for less bending)

    // Calculate sine wave: amplitude * sin(2π * frequency * time)
    const oscillation = amplitude * Math.sin(2 * Math.PI * frequency * this.oscillationTime);

    return oscillation;
  }

  private lerp(current: number, target: number, alpha: number): number {
    // Clamp alpha to [0, 1] to prevent overshooting
    const clampedAlpha = Math.min(1, Math.max(0, alpha));
    return current + (target - current) * clampedAlpha;
  }
}

