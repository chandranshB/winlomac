import { Vector3, Quaternion } from 'three';
import type { NetworkVehicleState, BodyTilt } from '../types';
import { serializeVehicleState, deserializeVehicleState } from './NetworkSerializer';

/**
 * Manages network synchronization for vehicle state.
 * Handles 20 Hz state updates, interpolation, and remote vehicle state management.
 */
export class NetworkSyncManager {
  private readonly updateRate: number; // Hz
  private readonly updateInterval: number; // ms
  private lastUpdateTime = 0;
  
  // Interpolation state
  private previousState: NetworkVehicleState | null = null;
  private targetState: NetworkVehicleState | null = null;
  private interpolationAlpha = 0;
  
  // Temporary objects for calculations (avoid allocations)
  private readonly tempPosition = new Vector3();
  private readonly tempRotation = new Quaternion();
  private readonly tempPrevRotation = new Quaternion();
  private readonly tempTargetRotation = new Quaternion();
  
  constructor(updateRate: number = 20) {
    this.updateRate = updateRate;
    this.updateInterval = 1000 / updateRate;
  }
  
  /**
   * Checks if it's time to send a state update (20 Hz)
   */
  shouldSendUpdate(currentTime: number): boolean {
    if (currentTime - this.lastUpdateTime >= this.updateInterval) {
      this.lastUpdateTime = currentTime;
      return true;
    }
    return false;
  }
  
  /**
   * Serializes and prepares vehicle state for transmission
   */
  prepareStateUpdate(state: NetworkVehicleState): ArrayBuffer {
    return serializeVehicleState(state);
  }
  
  /**
   * Receives and processes a remote vehicle state update
   */
  receiveStateUpdate(buffer: ArrayBuffer): boolean {
    const newState = deserializeVehicleState(buffer);
    
    if (!newState) {
      console.error('Failed to deserialize vehicle state');
      return false;
    }
    
    // Shift current target to previous
    if (this.targetState) {
      this.previousState = this.targetState;
    } else {
      // First update - initialize both to same state
      this.previousState = newState;
    }
    
    this.targetState = newState;
    this.interpolationAlpha = 0;
    
    return true;
  }
  
  /**
   * Interpolates position and rotation for smooth remote vehicle movement
   * 
   * @param delta - Time since last frame in seconds
   * @returns Interpolated position and rotation
   */
  interpolateState(delta: number): {
    position: Vector3;
    rotation: Quaternion;
    velocity: Vector3;
    rpm: number;
    speed: number;
    gear: number;
    flags: number;
  } | null {
    if (!this.previousState || !this.targetState) {
      return null;
    }
    
    // Update interpolation alpha
    this.interpolationAlpha += (delta * 1000) / this.updateInterval;
    this.interpolationAlpha = Math.min(1, this.interpolationAlpha);
    
    const t = this.interpolationAlpha;
    
    // Interpolate position
    this.tempPosition.set(
      this.previousState.position[0] + (this.targetState.position[0] - this.previousState.position[0]) * t,
      this.previousState.position[1] + (this.targetState.position[1] - this.previousState.position[1]) * t,
      this.previousState.position[2] + (this.targetState.position[2] - this.previousState.position[2]) * t
    );
    
    // Interpolate rotation (quaternion slerp)
    this.tempPrevRotation.set(
      this.previousState.rotation[0],
      this.previousState.rotation[1],
      this.previousState.rotation[2],
      this.previousState.rotation[3]
    );
    
    this.tempTargetRotation.set(
      this.targetState.rotation[0],
      this.targetState.rotation[1],
      this.targetState.rotation[2],
      this.targetState.rotation[3]
    );
    
    this.tempRotation.copy(this.tempPrevRotation).slerp(this.tempTargetRotation, t);
    
    // Interpolate velocity
    const velocity = new Vector3(
      this.previousState.velocity[0] + (this.targetState.velocity[0] - this.previousState.velocity[0]) * t,
      this.previousState.velocity[1] + (this.targetState.velocity[1] - this.previousState.velocity[1]) * t,
      this.previousState.velocity[2] + (this.targetState.velocity[2] - this.previousState.velocity[2]) * t
    );
    
    // For discrete values, use target state when interpolation is > 0.5
    const useTarget = t > 0.5;
    const rpm = useTarget ? this.targetState.rpm : this.previousState.rpm;
    const speed = useTarget ? this.targetState.speed : this.previousState.speed;
    const gear = useTarget ? this.targetState.gear : this.previousState.gear;
    const flags = useTarget ? this.targetState.flags : this.previousState.flags;
    
    return {
      position: this.tempPosition.clone(),
      rotation: this.tempRotation.clone(),
      velocity,
      rpm,
      speed,
      gear,
      flags
    };
  }
  
  /**
   * Calculates body tilt for remote vehicles from velocity data
   * Uses simplified calculation based on velocity changes
   * 
   * @param velocity - Current velocity vector
   * @param previousVelocity - Previous velocity vector (optional)
   * @param speed - Current speed in km/h
   * @returns Body tilt (pitch and roll)
   */
  calculateRemoteBodyTilt(
    velocity: Vector3,
    previousVelocity: Vector3 | null,
    speed: number
  ): BodyTilt {
    // Calculate acceleration from velocity change (if we have previous velocity)
    let longitudinalAccel = 0;
    let lateralAccel = 0;
    
    if (previousVelocity) {
      const deltaTime = this.updateInterval / 1000; // Convert to seconds
      
      // Longitudinal acceleration (forward/backward)
      // Note: In the game, negative Z is forward, so we invert the calculation
      longitudinalAccel = (previousVelocity.z - velocity.z) / deltaTime;
      
      // Lateral acceleration (left/right)
      lateralAccel = (velocity.x - previousVelocity.x) / deltaTime;
    }
    
    // Calculate pitch from longitudinal acceleration
    // Max 3 degrees for acceleration, 4 degrees for braking
    let pitch = 0;
    if (longitudinalAccel > 0) {
      // Accelerating (nose up)
      pitch = Math.min(3, (longitudinalAccel / 20) * 3);
    } else if (longitudinalAccel < 0) {
      // Braking (nose down)
      pitch = Math.max(-4, (longitudinalAccel / 20) * 4);
    }
    
    // Calculate roll from lateral acceleration
    // Max 8 degrees
    const roll = Math.max(-8, Math.min(8, (lateralAccel / 12) * 8));
    
    // Apply speed scaling
    let speedScale = 1.0;
    if (speed < 30) {
      speedScale = 0.5;
    } else if (speed < 80) {
      speedScale = 0.5 + ((speed - 30) / 50) * 0.5;
    }
    
    return {
      pitch: pitch * speedScale,
      roll: roll * speedScale
    };
  }
  
  /**
   * Gets synchronized gauge data for spectated remote vehicles
   */
  getGaugeData(): {
    rpm: number;
    speed: number;
    gear: number;
    flags: number;
  } | null {
    if (!this.targetState) {
      return null;
    }
    
    return {
      rpm: this.targetState.rpm,
      speed: this.targetState.speed,
      gear: this.targetState.gear,
      flags: this.targetState.flags
    };
  }
  
  /**
   * Resets the sync manager state
   */
  reset(): void {
    this.previousState = null;
    this.targetState = null;
    this.interpolationAlpha = 0;
    this.lastUpdateTime = 0;
  }
  
  /**
   * Gets the current target state (most recent received state)
   */
  getCurrentState(): NetworkVehicleState | null {
    return this.targetState;
  }
}
