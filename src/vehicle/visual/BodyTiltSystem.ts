import type { Vector3 } from '@react-three/fiber';
import type { BodyTiltSystem, VehicleConfig, BodyTilt } from '../types';

export class BodyTiltSystemImpl implements BodyTiltSystem {
  private _currentPitch: number = 0;
  private _currentRoll: number = 0;
  private readonly config: VehicleConfig;

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
    // Extract longitudinal acceleration (z-axis is forward/backward)
    const longitudinalAccel = (acceleration as [number, number, number])[2];
    
    // Calculate target pitch and roll
    const targetPitch = this.calculatePitch(longitudinalAccel, speed);
    const targetRoll = this.calculateRoll(lateralAcceleration, speed);
    
    // Smooth transition to target values
    const pitchTransitionSpeed = 1 / this.config.bodyTilt.pitchTransitionTime;
    const rollTransitionSpeed = 1 / this.config.bodyTilt.rollTransitionTime;
    
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
    
    return {
      pitch: this._currentPitch,
      roll: this._currentRoll
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
    const roll = (lateralAccel / 12) * this.config.bodyTilt.maxRoll;
    
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

  private lerp(current: number, target: number, alpha: number): number {
    // Clamp alpha to [0, 1] to prevent overshooting
    const clampedAlpha = Math.min(1, Math.max(0, alpha));
    return current + (target - current) * clampedAlpha;
  }
}
