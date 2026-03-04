import { Vector3, Quaternion } from 'three';

/**
 * Compact memory layout for vehicle state using typed arrays.
 * Provides better cache efficiency and reduces memory allocations.
 */
export class VehicleStateBuffer {
  // Position(3) + Rotation(4) + Velocity(3) + AngularVel(3) = 13 floats
  private readonly buffer: Float32Array;

  constructor() {
    this.buffer = new Float32Array(13);
  }

  // Position methods (indices 0-2)
  setPosition(x: number, y: number, z: number): void {
    this.buffer[0] = x;
    this.buffer[1] = y;
    this.buffer[2] = z;
  }

  getPosition(out: Vector3): void {
    out.set(this.buffer[0], this.buffer[1], this.buffer[2]);
  }

  // Rotation methods (indices 3-6)
  setRotation(x: number, y: number, z: number, w: number): void {
    this.buffer[3] = x;
    this.buffer[4] = y;
    this.buffer[5] = z;
    this.buffer[6] = w;
  }

  getRotation(out: Quaternion): void {
    out.set(this.buffer[3], this.buffer[4], this.buffer[5], this.buffer[6]);
  }

  // Velocity methods (indices 7-9)
  setVelocity(x: number, y: number, z: number): void {
    this.buffer[7] = x;
    this.buffer[8] = y;
    this.buffer[9] = z;
  }

  getVelocity(out: Vector3): void {
    out.set(this.buffer[7], this.buffer[8], this.buffer[9]);
  }

  // Angular velocity methods (indices 10-12)
  setAngularVelocity(x: number, y: number, z: number): void {
    this.buffer[10] = x;
    this.buffer[11] = y;
    this.buffer[12] = z;
  }

  getAngularVelocity(out: Vector3): void {
    out.set(this.buffer[10], this.buffer[11], this.buffer[12]);
  }

  /**
   * Get the raw buffer (for serialization or debugging).
   */
  getRawBuffer(): Float32Array {
    return this.buffer;
  }

  /**
   * Clear all values to zero.
   */
  clear(): void {
    this.buffer.fill(0);
  }
}
