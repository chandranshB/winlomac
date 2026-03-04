import { describe, it, expect, beforeEach } from 'vitest';
import { Vector3 } from 'three';
import { NetworkSyncManager } from '../NetworkSyncManager';
import { serializeVehicleState } from '../NetworkSerializer';
import type { NetworkVehicleState } from '../../types';

describe('NetworkSyncManager', () => {
  let syncManager: NetworkSyncManager;
  
  beforeEach(() => {
    syncManager = new NetworkSyncManager(20); // 20 Hz
  });
  
  describe('update rate management', () => {
    it('should send updates at 20 Hz', () => {
      const updates: number[] = [];
      
      // Simulate 1 second at 60 FPS
      for (let i = 0; i < 60; i++) {
        const time = i * (1000 / 60); // 16.67ms per frame
        if (syncManager.shouldSendUpdate(time)) {
          updates.push(time);
        }
      }
      
      // Should have approximately 20 updates in 1 second
      expect(updates.length).toBeGreaterThanOrEqual(19);
      expect(updates.length).toBeLessThanOrEqual(21);
    });
    
    it('should respect custom update rate', () => {
      const customManager = new NetworkSyncManager(10); // 10 Hz
      const updates: number[] = [];
      
      // Simulate 1 second
      for (let i = 0; i < 60; i++) {
        const time = i * (1000 / 60);
        if (customManager.shouldSendUpdate(time)) {
          updates.push(time);
        }
      }
      
      // Should have approximately 10 updates
      expect(updates.length).toBeGreaterThanOrEqual(9);
      expect(updates.length).toBeLessThanOrEqual(11);
    });
  });
  
  describe('state serialization', () => {
    it('should prepare state update as ArrayBuffer', () => {
      const state: NetworkVehicleState = {
        position: [10, 2, -15],
        rotation: [0, 0, 0, 1],
        velocity: [5, 0, -10],
        rpm: 3500,
        speed: 85,
        gear: 3,
        flags: 0b00000011
      };
      
      const buffer = syncManager.prepareStateUpdate(state);
      
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBe(46);
    });
  });
  
  describe('state reception and interpolation', () => {
    it('should receive and store state updates', () => {
      const state: NetworkVehicleState = {
        position: [10, 2, -15],
        rotation: [0, 0, 0, 1],
        velocity: [5, 0, -10],
        rpm: 3500,
        speed: 85,
        gear: 3,
        flags: 0
      };
      
      const buffer = serializeVehicleState(state);
      const success = syncManager.receiveStateUpdate(buffer);
      
      expect(success).toBe(true);
      expect(syncManager.getCurrentState()).not.toBeNull();
    });
    
    it('should interpolate position between states', () => {
      const state1: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 3000,
        speed: 50,
        gear: 2,
        flags: 0
      };
      
      const state2: NetworkVehicleState = {
        position: [10, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 3000,
        speed: 50,
        gear: 2,
        flags: 0
      };
      
      syncManager.receiveStateUpdate(serializeVehicleState(state1));
      syncManager.receiveStateUpdate(serializeVehicleState(state2));
      
      // Interpolate at 50%
      const interpolated = syncManager.interpolateState(0.025); // Half of 50ms update interval
      
      expect(interpolated).not.toBeNull();
      expect(interpolated!.position.x).toBeCloseTo(5, 1); // Halfway between 0 and 10
    });
    
    it('should interpolate rotation smoothly', () => {
      const state1: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1], // No rotation
        velocity: [0, 0, 0],
        rpm: 3000,
        speed: 50,
        gear: 2,
        flags: 0
      };
      
      const state2: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0.707, 0, 0.707], // 90 degree rotation around Y
        velocity: [0, 0, 0],
        rpm: 3000,
        speed: 50,
        gear: 2,
        flags: 0
      };
      
      syncManager.receiveStateUpdate(serializeVehicleState(state1));
      syncManager.receiveStateUpdate(serializeVehicleState(state2));
      
      const interpolated = syncManager.interpolateState(0.025);
      
      expect(interpolated).not.toBeNull();
      // Rotation should be between the two states
      expect(interpolated!.rotation.y).toBeGreaterThan(0);
      expect(interpolated!.rotation.y).toBeLessThan(0.707);
    });
    
    it('should handle first state update correctly', () => {
      const state: NetworkVehicleState = {
        position: [10, 2, -15],
        rotation: [0, 0, 0, 1],
        velocity: [5, 0, -10],
        rpm: 3500,
        speed: 85,
        gear: 3,
        flags: 0
      };
      
      syncManager.receiveStateUpdate(serializeVehicleState(state));
      
      const interpolated = syncManager.interpolateState(0.016);
      
      expect(interpolated).not.toBeNull();
      // First update should use the same state for both previous and target
      expect(interpolated!.position.x).toBeCloseTo(10, 1);
      expect(interpolated!.position.y).toBeCloseTo(2, 1);
      expect(interpolated!.position.z).toBeCloseTo(-15, 1);
    });
    
    it('should clamp interpolation alpha to 1.0', () => {
      const state1: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 3000,
        speed: 50,
        gear: 2,
        flags: 0
      };
      
      const state2: NetworkVehicleState = {
        position: [10, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 3000,
        speed: 50,
        gear: 2,
        flags: 0
      };
      
      syncManager.receiveStateUpdate(serializeVehicleState(state1));
      syncManager.receiveStateUpdate(serializeVehicleState(state2));
      
      // Interpolate way past the update interval
      const interpolated = syncManager.interpolateState(1.0); // 1 second
      
      expect(interpolated).not.toBeNull();
      // Should be at target position, not beyond it
      expect(interpolated!.position.x).toBeCloseTo(10, 1);
    });
  });
  
  describe('remote body tilt calculation', () => {
    it('should calculate pitch from longitudinal acceleration', () => {
      const velocity = new Vector3(0, 0, -20); // Moving forward
      const previousVelocity = new Vector3(0, 0, -10); // Was slower
      
      const tilt = syncManager.calculateRemoteBodyTilt(velocity, previousVelocity, 60);
      
      // Accelerating forward should create positive pitch (nose up)
      expect(tilt.pitch).toBeGreaterThan(0);
      expect(tilt.pitch).toBeLessThanOrEqual(3); // Max 3 degrees
    });
    
    it('should calculate negative pitch from braking', () => {
      const velocity = new Vector3(0, 0, -10); // Moving forward slowly
      const previousVelocity = new Vector3(0, 0, -20); // Was faster
      
      const tilt = syncManager.calculateRemoteBodyTilt(velocity, previousVelocity, 40);
      
      // Braking should create negative pitch (nose down)
      expect(tilt.pitch).toBeLessThan(0);
      expect(tilt.pitch).toBeGreaterThanOrEqual(-4); // Max 4 degrees down
    });
    
    it('should calculate roll from lateral acceleration', () => {
      const velocity = new Vector3(5, 0, -20); // Moving forward with lateral component
      const previousVelocity = new Vector3(0, 0, -20); // Was going straight
      
      const tilt = syncManager.calculateRemoteBodyTilt(velocity, previousVelocity, 80);
      
      // Lateral acceleration should create roll
      expect(Math.abs(tilt.roll)).toBeGreaterThan(0);
      expect(Math.abs(tilt.roll)).toBeLessThanOrEqual(8); // Max 8 degrees
    });
    
    it('should apply speed scaling to tilt', () => {
      const velocity = new Vector3(0, 0, -20);
      const previousVelocity = new Vector3(0, 0, -10);
      
      // Low speed (< 30 km/h) - 50% scaling
      const lowSpeedTilt = syncManager.calculateRemoteBodyTilt(velocity, previousVelocity, 20);
      
      // High speed (> 80 km/h) - 100% scaling
      const highSpeedTilt = syncManager.calculateRemoteBodyTilt(velocity, previousVelocity, 100);
      
      // High speed tilt should be larger
      expect(Math.abs(highSpeedTilt.pitch)).toBeGreaterThan(Math.abs(lowSpeedTilt.pitch));
    });
    
    it('should handle no previous velocity', () => {
      const velocity = new Vector3(5, 0, -20);
      
      const tilt = syncManager.calculateRemoteBodyTilt(velocity, null, 60);
      
      // Should return zero tilt when no previous velocity
      expect(tilt.pitch).toBe(0);
      expect(tilt.roll).toBe(0);
    });
  });
  
  describe('gauge data synchronization', () => {
    it('should provide gauge data for spectated vehicles', () => {
      const state: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 5500,
        speed: 120,
        gear: 4,
        flags: 0b00000001 // isDrifting
      };
      
      syncManager.receiveStateUpdate(serializeVehicleState(state));
      
      const gaugeData = syncManager.getGaugeData();
      
      expect(gaugeData).not.toBeNull();
      expect(gaugeData!.rpm).toBe(5500);
      expect(gaugeData!.speed).toBe(120);
      expect(gaugeData!.gear).toBe(4);
      expect(gaugeData!.flags).toBe(0b00000001);
    });
    
    it('should return null when no state received', () => {
      const gaugeData = syncManager.getGaugeData();
      
      expect(gaugeData).toBeNull();
    });
  });
  
  describe('reset functionality', () => {
    it('should reset all state', () => {
      const state: NetworkVehicleState = {
        position: [10, 2, -15],
        rotation: [0, 0, 0, 1],
        velocity: [5, 0, -10],
        rpm: 3500,
        speed: 85,
        gear: 3,
        flags: 0
      };
      
      syncManager.receiveStateUpdate(serializeVehicleState(state));
      expect(syncManager.getCurrentState()).not.toBeNull();
      
      syncManager.reset();
      
      expect(syncManager.getCurrentState()).toBeNull();
      expect(syncManager.getGaugeData()).toBeNull();
    });
  });
  
  describe('error handling', () => {
    it('should handle invalid buffer gracefully', () => {
      const invalidBuffer = new ArrayBuffer(10); // Wrong size
      const success = syncManager.receiveStateUpdate(invalidBuffer);
      
      expect(success).toBe(false);
      expect(syncManager.getCurrentState()).toBeNull();
    });
    
    it('should handle corrupted data', () => {
      const buffer = new ArrayBuffer(46);
      const view = new DataView(buffer);
      
      // Fill with invalid data
      view.setFloat32(0, NaN, true);
      
      const success = syncManager.receiveStateUpdate(buffer);
      
      expect(success).toBe(false);
    });
  });
});
