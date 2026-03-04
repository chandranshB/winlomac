import type { NetworkVehicleState } from '../types';

/**
 * Serializes vehicle state into a compact binary format for network transmission.
 * Total size: 44 bytes per vehicle per update
 * 
 * Layout:
 * - Position (12 bytes): Float32 x3
 * - Rotation (16 bytes): Float32 x4 (quaternion)
 * - Velocity (12 bytes): Float32 x3
 * - RPM (2 bytes): Uint16
 * - Speed (2 bytes): Uint16
 * - Gear (1 byte): Int8
 * - Flags (1 byte): Uint8
 * 
 * @param state - The vehicle state to serialize
 * @returns ArrayBuffer containing the serialized state (44 bytes)
 */
export function serializeVehicleState(state: NetworkVehicleState): ArrayBuffer {
  const buffer = new ArrayBuffer(46); // 44 bytes + 2 for gear and flags
  const view = new DataView(buffer);
  
  let offset = 0;
  
  // Position (12 bytes)
  view.setFloat32(offset, state.position[0], true); offset += 4;
  view.setFloat32(offset, state.position[1], true); offset += 4;
  view.setFloat32(offset, state.position[2], true); offset += 4;
  
  // Rotation (16 bytes)
  view.setFloat32(offset, state.rotation[0], true); offset += 4;
  view.setFloat32(offset, state.rotation[1], true); offset += 4;
  view.setFloat32(offset, state.rotation[2], true); offset += 4;
  view.setFloat32(offset, state.rotation[3], true); offset += 4;
  
  // Velocity (12 bytes)
  view.setFloat32(offset, state.velocity[0], true); offset += 4;
  view.setFloat32(offset, state.velocity[1], true); offset += 4;
  view.setFloat32(offset, state.velocity[2], true); offset += 4;
  
  // RPM (2 bytes) - Uint16 (0-10000)
  view.setUint16(offset, Math.min(10000, Math.max(0, Math.round(state.rpm))), true); offset += 2;
  
  // Speed (2 bytes) - Uint16 (0-500 km/h)
  view.setUint16(offset, Math.min(500, Math.max(0, Math.round(state.speed))), true); offset += 2;
  
  // Gear (1 byte) - Int8 (-1 to 6)
  view.setInt8(offset, state.gear); offset += 1;
  
  // Flags (1 byte) - Uint8 bitfield
  view.setUint8(offset, state.flags); offset += 1;
  
  return buffer;
}

/**
 * Deserializes vehicle state from a binary buffer.
 * 
 * @param buffer - The ArrayBuffer containing serialized state (must be 46 bytes)
 * @returns The deserialized NetworkVehicleState, or null if validation fails
 */
export function deserializeVehicleState(buffer: ArrayBuffer): NetworkVehicleState | null {
  try {
    // Validate buffer size
    if (buffer.byteLength !== 46) {
      console.error('Invalid state buffer size:', buffer.byteLength, 'expected 46');
      return null;
    }
    
    const view = new DataView(buffer);
    let offset = 0;
    
    // Position (12 bytes)
    const position: [number, number, number] = [
      view.getFloat32(offset, true), // offset 0
      view.getFloat32(offset + 4, true), // offset 4
      view.getFloat32(offset + 8, true)  // offset 8
    ];
    offset += 12;
    
    // Rotation (16 bytes)
    const rotation: [number, number, number, number] = [
      view.getFloat32(offset, true), // offset 12
      view.getFloat32(offset + 4, true), // offset 16
      view.getFloat32(offset + 8, true), // offset 20
      view.getFloat32(offset + 12, true) // offset 24
    ];
    offset += 16;
    
    // Velocity (12 bytes)
    const velocity: [number, number, number] = [
      view.getFloat32(offset, true), // offset 28
      view.getFloat32(offset + 4, true), // offset 32
      view.getFloat32(offset + 8, true)  // offset 36
    ];
    offset += 12;
    
    // RPM (2 bytes)
    const rpm = view.getUint16(offset, true); // offset 40
    offset += 2;
    
    // Speed (2 bytes)
    const speed = view.getUint16(offset, true); // offset 42
    offset += 2;
    
    // Gear (1 byte)
    const gear = view.getInt8(offset); // offset 44
    offset += 1;
    
    // Flags (1 byte)
    const flags = view.getUint8(offset); // offset 45
    
    // Validate deserialized values
    if (!isFinite(position[0]) || !isFinite(position[1]) || !isFinite(position[2])) {
      console.error('Invalid position values in deserialized state');
      return null;
    }
    
    if (!isFinite(rotation[0]) || !isFinite(rotation[1]) || !isFinite(rotation[2]) || !isFinite(rotation[3])) {
      console.error('Invalid rotation values in deserialized state');
      return null;
    }
    
    if (!isFinite(velocity[0]) || !isFinite(velocity[1]) || !isFinite(velocity[2])) {
      console.error('Invalid velocity values in deserialized state');
      return null;
    }
    
    if (rpm > 10000) {
      console.error('Invalid RPM value:', rpm);
      return null;
    }
    
    if (speed > 500) {
      console.error('Invalid speed value:', speed);
      return null;
    }
    
    if (gear < -1 || gear > 6) {
      console.error('Invalid gear value:', gear);
      return null;
    }
    
    return {
      position,
      rotation,
      velocity,
      rpm,
      speed,
      gear,
      flags
    };
  } catch (error) {
    console.error('Deserialization error:', error);
    return null;
  }
}

/**
 * Helper function to extract flag bits from the flags byte
 */
export function extractFlags(flags: number): {
  isDrifting: boolean;
  isGrounded: boolean;
  isRevLimiting: boolean;
  isShifting: boolean;
} {
  return {
    isDrifting: (flags & 0b00000001) !== 0,
    isGrounded: (flags & 0b00000010) !== 0,
    isRevLimiting: (flags & 0b00000100) !== 0,
    isShifting: (flags & 0b00001000) !== 0
  };
}

/**
 * Helper function to pack flags into a single byte
 */
export function packFlags(
  isDrifting: boolean,
  isGrounded: boolean,
  isRevLimiting: boolean,
  isShifting: boolean
): number {
  let flags = 0;
  if (isDrifting) flags |= 0b00000001;
  if (isGrounded) flags |= 0b00000010;
  if (isRevLimiting) flags |= 0b00000100;
  if (isShifting) flags |= 0b00001000;
  return flags;
}
