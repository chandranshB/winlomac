/**
 * RemoteVehiclePhysics
 * 
 * Simplified physics calculations for remote vehicles to reduce computational load.
 * Only performs position/rotation interpolation and approximate body tilt.
 * Skips complex calculations like drift detection, tire model, and RPM simulation.
 * 
 * Requirements: 12.3, 12.4
 */

import type { NetworkVehicleState } from '../types';

export interface RemoteVehicleState {
  position: [number, number, number];
  rotation: [number, number, number, number];
  bodyPitch: number; // degrees
  bodyRoll: number; // degrees
}

export class RemoteVehiclePhysics {
  private currentState: RemoteVehicleState = {
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    bodyPitch: 0,
    bodyRoll: 0,
  };

  private targetState: RemoteVehicleState = {
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    bodyPitch: 0,
    bodyRoll: 0,
  };

  private interpolationProgress = 0;
  private readonly interpolationDuration = 0.05; // 50ms (20 Hz network updates)

  /**
   * Update remote vehicle state with new network data
   * @param networkState - Received network state
   */
  updateFromNetwork(networkState: NetworkVehicleState): void {
    // Set current state as starting point for interpolation
    this.currentState = { ...this.targetState };
    
    // Set new target state
    this.targetState = {
      position: [...networkState.position],
      rotation: [...networkState.rotation],
      bodyPitch: 0,
      bodyRoll: 0,
    };

    // Calculate approximate body tilt from velocity
    this.approximateBodyTilt(networkState.velocity);

    // Reset interpolation progress
    this.interpolationProgress = 0;
  }

  /**
   * Update interpolation (call every frame)
   * @param delta - Time since last frame in seconds
   * @returns Current interpolated state
   */
  update(delta: number): RemoteVehicleState {
    // Advance interpolation
    this.interpolationProgress += delta;
    const t = Math.min(1, this.interpolationProgress / this.interpolationDuration);

    // Interpolate position
    const position: [number, number, number] = [
      this.lerp(this.currentState.position[0], this.targetState.position[0], t),
      this.lerp(this.currentState.position[1], this.targetState.position[1], t),
      this.lerp(this.currentState.position[2], this.targetState.position[2], t),
    ];

    // Interpolate rotation (quaternion slerp approximation using lerp)
    const rotation: [number, number, number, number] = [
      this.lerp(this.currentState.rotation[0], this.targetState.rotation[0], t),
      this.lerp(this.currentState.rotation[1], this.targetState.rotation[1], t),
      this.lerp(this.currentState.rotation[2], this.targetState.rotation[2], t),
      this.lerp(this.currentState.rotation[3], this.targetState.rotation[3], t),
    ];

    // Normalize quaternion
    const qMag = Math.sqrt(
      rotation[0] * rotation[0] +
      rotation[1] * rotation[1] +
      rotation[2] * rotation[2] +
      rotation[3] * rotation[3]
    );
    if (qMag > 0.0001) {
      rotation[0] /= qMag;
      rotation[1] /= qMag;
      rotation[2] /= qMag;
      rotation[3] /= qMag;
    }

    // Interpolate body tilt
    const bodyPitch = this.lerp(this.currentState.bodyPitch, this.targetState.bodyPitch, t);
    const bodyRoll = this.lerp(this.currentState.bodyRoll, this.targetState.bodyRoll, t);

    return {
      position,
      rotation,
      bodyPitch,
      bodyRoll,
    };
  }

  /**
   * Get current state without updating
   */
  getCurrentState(): RemoteVehicleState {
    return { ...this.currentState };
  }

  /**
   * Calculate approximate body tilt from velocity (cheap linear approximation)
   * This skips the full physics calculation and provides a reasonable visual approximation
   * 
   * @param velocity - Vehicle velocity [x, y, z] in m/s
   */
  private approximateBodyTilt(velocity: [number, number, number]): void {
    const [lateralVel] = velocity;

    // Simple linear approximation for body tilt
    // Lateral velocity causes roll (lean into turn)
    // Longitudinal velocity causes pitch (nose up/down)
    
    // Roll: approximate from lateral velocity
    // Positive lateral velocity = moving right = lean right
    // Scale: ~0.1 degrees per m/s lateral velocity, max 8 degrees
    this.targetState.bodyRoll = this.clamp(lateralVel * 0.1, -8, 8);

    // Pitch: approximate from velocity magnitude
    // We approximate acceleration from velocity magnitude
    const speed = Math.sqrt(
      velocity[0] * velocity[0] +
      velocity[1] * velocity[1] +
      velocity[2] * velocity[2]
    );
    
    // Approximate pitch from speed (higher speed = slight nose up from acceleration)
    // Scale: ~0.02 degrees per m/s, max 3 degrees
    this.targetState.bodyPitch = this.clamp(speed * 0.02, -4, 3);
  }

  /**
   * Linear interpolation
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Clamp value between min and max
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.currentState = {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      bodyPitch: 0,
      bodyRoll: 0,
    };
    this.targetState = { ...this.currentState };
    this.interpolationProgress = 0;
  }
}
