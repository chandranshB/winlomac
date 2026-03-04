import { describe, it, expect } from 'vitest';
import {
  serializeVehicleState,
  deserializeVehicleState,
  extractFlags,
  packFlags
} from '../NetworkSerializer';
import type { NetworkVehicleState } from '../../types';

describe('NetworkSerializer', () => {
  describe('serializeVehicleState', () => {
    it('should serialize vehicle state to 46 bytes', () => {
      const state: NetworkVehicleState = {
        position: [10.5, 2.0, -15.3],
        rotation: [0, 0.707, 0, 0.707], // 90 degree rotation around Y
        velocity: [5.0, 0, -10.0],
        rpm: 3500,
        speed: 85,
        gear: 3,
        flags: 0b00000011 // isDrifting and isGrounded
      };
      
      const buffer = serializeVehicleState(state);
      
      expect(buffer.byteLength).toBe(46);
    });
    
    it('should clamp RPM to valid range (0-10000)', () => {
      const state: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 15000, // Over limit
        speed: 100,
        gear: 4,
        flags: 0
      };
      
      const buffer = serializeVehicleState(state);
      const deserialized = deserializeVehicleState(buffer);
      
      expect(deserialized).not.toBeNull();
      expect(deserialized!.rpm).toBe(10000);
    });
    
    it('should clamp speed to valid range (0-500)', () => {
      const state: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 5000,
        speed: 600, // Over limit
        gear: 6,
        flags: 0
      };
      
      const buffer = serializeVehicleState(state);
      const deserialized = deserializeVehicleState(buffer);
      
      expect(deserialized).not.toBeNull();
      expect(deserialized!.speed).toBe(500);
    });
  });
  
  describe('deserializeVehicleState', () => {
    it('should deserialize valid state correctly', () => {
      const originalState: NetworkVehicleState = {
        position: [10.5, 2.0, -15.3],
        rotation: [0, 0.707, 0, 0.707],
        velocity: [5.0, 0, -10.0],
        rpm: 3500,
        speed: 85,
        gear: 3,
        flags: 0b00000011
      };
      
      const buffer = serializeVehicleState(originalState);
      const deserialized = deserializeVehicleState(buffer);
      
      expect(deserialized).not.toBeNull();
      expect(deserialized!.position[0]).toBeCloseTo(10.5, 2);
      expect(deserialized!.position[1]).toBeCloseTo(2.0, 2);
      expect(deserialized!.position[2]).toBeCloseTo(-15.3, 2);
      expect(deserialized!.rotation[0]).toBeCloseTo(0, 2);
      expect(deserialized!.rotation[1]).toBeCloseTo(0.707, 2);
      expect(deserialized!.velocity[0]).toBeCloseTo(5.0, 2);
      expect(deserialized!.velocity[2]).toBeCloseTo(-10.0, 2);
      expect(deserialized!.rpm).toBe(3500);
      expect(deserialized!.speed).toBe(85);
      expect(deserialized!.gear).toBe(3);
      expect(deserialized!.flags).toBe(0b00000011);
    });
    
    it('should return null for invalid buffer size', () => {
      const invalidBuffer = new ArrayBuffer(20); // Wrong size
      const result = deserializeVehicleState(invalidBuffer);
      
      expect(result).toBeNull();
    });
    
    it('should validate position values', () => {
      const buffer = new ArrayBuffer(46);
      const view = new DataView(buffer);
      
      // Set invalid position (NaN)
      view.setFloat32(0, NaN, true);
      view.setFloat32(4, 0, true);
      view.setFloat32(8, 0, true);
      
      const result = deserializeVehicleState(buffer);
      expect(result).toBeNull();
    });
    
    it('should validate RPM range', () => {
      const state: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 5000,
        speed: 100,
        gear: 3,
        flags: 0
      };
      
      const buffer = serializeVehicleState(state);
      const view = new DataView(buffer);
      
      // Manually set invalid RPM
      view.setUint16(40, 15000, true);
      
      const result = deserializeVehicleState(buffer);
      expect(result).toBeNull();
    });
    
    it('should validate gear range', () => {
      const state: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 5000,
        speed: 100,
        gear: 3,
        flags: 0
      };
      
      const buffer = serializeVehicleState(state);
      const view = new DataView(buffer);
      
      // Manually set invalid gear
      view.setInt8(44, 10); // Invalid gear
      
      const result = deserializeVehicleState(buffer);
      expect(result).toBeNull();
    });
  });
  
  describe('round-trip serialization', () => {
    it('should preserve state through serialize-deserialize cycle', () => {
      const originalState: NetworkVehicleState = {
        position: [123.456, 78.9, -234.567],
        rotation: [0.1, 0.2, 0.3, 0.9],
        velocity: [15.5, -2.3, -25.8],
        rpm: 6543,
        speed: 187,
        gear: 5,
        flags: 0b00001111
      };
      
      const buffer = serializeVehicleState(originalState);
      const deserialized = deserializeVehicleState(buffer);
      
      expect(deserialized).not.toBeNull();
      
      // Check position (Float32 precision)
      expect(deserialized!.position[0]).toBeCloseTo(originalState.position[0], 2);
      expect(deserialized!.position[1]).toBeCloseTo(originalState.position[1], 2);
      expect(deserialized!.position[2]).toBeCloseTo(originalState.position[2], 2);
      
      // Check rotation
      expect(deserialized!.rotation[0]).toBeCloseTo(originalState.rotation[0], 2);
      expect(deserialized!.rotation[1]).toBeCloseTo(originalState.rotation[1], 2);
      expect(deserialized!.rotation[2]).toBeCloseTo(originalState.rotation[2], 2);
      expect(deserialized!.rotation[3]).toBeCloseTo(originalState.rotation[3], 2);
      
      // Check velocity
      expect(deserialized!.velocity[0]).toBeCloseTo(originalState.velocity[0], 2);
      expect(deserialized!.velocity[1]).toBeCloseTo(originalState.velocity[1], 2);
      expect(deserialized!.velocity[2]).toBeCloseTo(originalState.velocity[2], 2);
      
      // Check discrete values (exact match)
      expect(deserialized!.rpm).toBe(originalState.rpm);
      expect(deserialized!.speed).toBe(originalState.speed);
      expect(deserialized!.gear).toBe(originalState.gear);
      expect(deserialized!.flags).toBe(originalState.flags);
    });
    
    it('should handle negative gear (reverse)', () => {
      const state: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 5], // Moving backward
        rpm: 2000,
        speed: 15,
        gear: -1, // Reverse
        flags: 0
      };
      
      const buffer = serializeVehicleState(state);
      const deserialized = deserializeVehicleState(buffer);
      
      expect(deserialized).not.toBeNull();
      expect(deserialized!.gear).toBe(-1);
    });
    
    it('should handle all gears (reverse through 6th)', () => {
      for (let gear = -1; gear <= 6; gear++) {
        const state: NetworkVehicleState = {
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          velocity: [0, 0, 0],
          rpm: 3000,
          speed: 50,
          gear,
          flags: 0
        };
        
        const buffer = serializeVehicleState(state);
        const deserialized = deserializeVehicleState(buffer);
        
        expect(deserialized).not.toBeNull();
        expect(deserialized!.gear).toBe(gear);
      }
    });
  });
  
  describe('flag packing and extraction', () => {
    it('should pack flags correctly', () => {
      const flags = packFlags(true, true, false, true);
      
      expect(flags).toBe(0b00001011); // isDrifting, isGrounded, isShifting
    });
    
    it('should extract flags correctly', () => {
      const flags = 0b00001111;
      const extracted = extractFlags(flags);
      
      expect(extracted.isDrifting).toBe(true);
      expect(extracted.isGrounded).toBe(true);
      expect(extracted.isRevLimiting).toBe(true);
      expect(extracted.isShifting).toBe(true);
    });
    
    it('should handle all flag combinations', () => {
      const testCases = [
        { isDrifting: true, isGrounded: false, isRevLimiting: false, isShifting: false },
        { isDrifting: false, isGrounded: true, isRevLimiting: false, isShifting: false },
        { isDrifting: false, isGrounded: false, isRevLimiting: true, isShifting: false },
        { isDrifting: false, isGrounded: false, isRevLimiting: false, isShifting: true },
        { isDrifting: true, isGrounded: true, isRevLimiting: true, isShifting: true }
      ];
      
      testCases.forEach(testCase => {
        const packed = packFlags(
          testCase.isDrifting,
          testCase.isGrounded,
          testCase.isRevLimiting,
          testCase.isShifting
        );
        const extracted = extractFlags(packed);
        
        expect(extracted.isDrifting).toBe(testCase.isDrifting);
        expect(extracted.isGrounded).toBe(testCase.isGrounded);
        expect(extracted.isRevLimiting).toBe(testCase.isRevLimiting);
        expect(extracted.isShifting).toBe(testCase.isShifting);
      });
    });
  });
  
  describe('edge cases', () => {
    it('should handle zero values', () => {
      const state: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 0,
        speed: 0,
        gear: 1,
        flags: 0
      };
      
      const buffer = serializeVehicleState(state);
      const deserialized = deserializeVehicleState(buffer);
      
      expect(deserialized).not.toBeNull();
      expect(deserialized!.rpm).toBe(0);
      expect(deserialized!.speed).toBe(0);
    });
    
    it('should handle maximum values', () => {
      const state: NetworkVehicleState = {
        position: [1000, 100, 1000],
        rotation: [1, 0, 0, 0],
        velocity: [100, 50, 100],
        rpm: 10000,
        speed: 500,
        gear: 6,
        flags: 0b11111111
      };
      
      const buffer = serializeVehicleState(state);
      const deserialized = deserializeVehicleState(buffer);
      
      expect(deserialized).not.toBeNull();
      expect(deserialized!.rpm).toBe(10000);
      expect(deserialized!.speed).toBe(500);
      expect(deserialized!.gear).toBe(6);
    });
    
    it('should handle negative position values', () => {
      const state: NetworkVehicleState = {
        position: [-500.5, -10.2, -300.8],
        rotation: [0, 0, 0, 1],
        velocity: [-20, -5, -30],
        rpm: 4000,
        speed: 120,
        gear: 4,
        flags: 0
      };
      
      const buffer = serializeVehicleState(state);
      const deserialized = deserializeVehicleState(buffer);
      
      expect(deserialized).not.toBeNull();
      expect(deserialized!.position[0]).toBeCloseTo(-500.5, 1);
      expect(deserialized!.position[1]).toBeCloseTo(-10.2, 1);
      expect(deserialized!.position[2]).toBeCloseTo(-300.8, 1);
    });
  });
});
