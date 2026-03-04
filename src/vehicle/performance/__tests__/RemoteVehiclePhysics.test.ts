import { describe, it, expect, beforeEach } from 'vitest';
import { RemoteVehiclePhysics } from '../RemoteVehiclePhysics';
import type { NetworkVehicleState } from '../../types';

describe('RemoteVehiclePhysics', () => {
  let physics: RemoteVehiclePhysics;

  beforeEach(() => {
    physics = new RemoteVehiclePhysics();
  });

  describe('initialization', () => {
    it('should start at origin with identity rotation', () => {
      const state = physics.getCurrentState();
      expect(state.position).toEqual([0, 0, 0]);
      expect(state.rotation).toEqual([0, 0, 0, 1]);
      expect(state.bodyPitch).toBe(0);
      expect(state.bodyRoll).toBe(0);
    });
  });

  describe('network state updates', () => {
    it('should update target state from network data', () => {
      const networkState: NetworkVehicleState = {
        position: [10, 2, 5],
        rotation: [0, 0.707, 0, 0.707],
        velocity: [5, 0, -10],
        rpm: 3000,
        speed: 50,
        gear: 3,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);
      
      // Should start interpolating towards new position
      const state = physics.update(0.016);
      expect(state.position[0]).toBeGreaterThan(0);
      expect(state.position[0]).toBeLessThan(10);
    });

    it('should reset interpolation progress on new network data', () => {
      const networkState1: NetworkVehicleState = {
        position: [10, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 1000,
        speed: 0,
        gear: 1,
        flags: 0,
      };

      physics.updateFromNetwork(networkState1);
      physics.update(0.025); // Half interpolation

      const networkState2: NetworkVehicleState = {
        position: [20, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 1000,
        speed: 0,
        gear: 1,
        flags: 0,
      };

      physics.updateFromNetwork(networkState2);
      
      // Should restart interpolation from current position
      const state = physics.update(0.016);
      expect(state.position[0]).toBeGreaterThan(0);
      expect(state.position[0]).toBeLessThan(20);
    });
  });

  describe('position interpolation', () => {
    it('should interpolate position smoothly', () => {
      const networkState: NetworkVehicleState = {
        position: [10, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 1000,
        speed: 0,
        gear: 1,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);

      // At 0% progress
      let state = physics.update(0);
      expect(state.position[0]).toBeCloseTo(0, 1);

      // At ~50% progress (0.025s / 0.05s)
      state = physics.update(0.025);
      expect(state.position[0]).toBeCloseTo(5, 1);

      // At 100% progress
      state = physics.update(0.025);
      expect(state.position[0]).toBeCloseTo(10, 1);
    });

    it('should clamp interpolation at 100%', () => {
      const networkState: NetworkVehicleState = {
        position: [10, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 1000,
        speed: 0,
        gear: 1,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);

      // Exceed interpolation duration
      const state = physics.update(0.1);
      expect(state.position[0]).toBeCloseTo(10, 1);
    });
  });

  describe('rotation interpolation', () => {
    it('should interpolate rotation quaternion', () => {
      const networkState: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 1, 0, 0], // 180 degree rotation
        velocity: [0, 0, 0],
        rpm: 1000,
        speed: 0,
        gear: 1,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);

      const state = physics.update(0.025); // 50% progress
      
      // Rotation should be interpolated
      expect(state.rotation[1]).toBeGreaterThan(0);
      expect(state.rotation[1]).toBeLessThan(1);
    });

    it('should normalize quaternion after interpolation', () => {
      const networkState: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0.707, 0, 0.707],
        velocity: [0, 0, 0],
        rpm: 1000,
        speed: 0,
        gear: 1,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);
      const state = physics.update(0.025);

      // Quaternion should be normalized (magnitude = 1)
      const magnitude = Math.sqrt(
        state.rotation[0] ** 2 +
        state.rotation[1] ** 2 +
        state.rotation[2] ** 2 +
        state.rotation[3] ** 2
      );
      expect(magnitude).toBeCloseTo(1, 5);
    });
  });

  describe('approximate body tilt', () => {
    it('should calculate roll from lateral velocity', () => {
      const networkState: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [10, 0, 0], // Moving right
        rpm: 3000,
        speed: 50,
        gear: 3,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);
      const state = physics.update(0.05);

      // Positive lateral velocity should cause positive roll
      expect(state.bodyRoll).toBeGreaterThan(0);
      expect(state.bodyRoll).toBeLessThanOrEqual(8); // Max 8 degrees
    });

    it('should calculate pitch from speed', () => {
      const networkState: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, -30], // Moving forward fast
        rpm: 5000,
        speed: 100,
        gear: 4,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);
      const state = physics.update(0.05);

      // High speed should cause positive pitch (nose up)
      expect(state.bodyPitch).toBeGreaterThan(0);
      expect(state.bodyPitch).toBeLessThanOrEqual(3); // Max 3 degrees
    });

    it('should clamp roll to ±8 degrees', () => {
      const networkState: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [100, 0, 0], // Extreme lateral velocity
        rpm: 3000,
        speed: 50,
        gear: 3,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);
      const state = physics.update(0.05);

      expect(state.bodyRoll).toBeLessThanOrEqual(8);
      expect(state.bodyRoll).toBeGreaterThanOrEqual(-8);
    });

    it('should clamp pitch to -4 to 3 degrees', () => {
      const networkState: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, -200], // Extreme forward velocity
        rpm: 7000,
        speed: 200,
        gear: 6,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);
      const state = physics.update(0.05);

      expect(state.bodyPitch).toBeLessThanOrEqual(3);
      expect(state.bodyPitch).toBeGreaterThanOrEqual(-4);
    });

    it('should handle zero velocity', () => {
      const networkState: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 800,
        speed: 0,
        gear: 1,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);
      const state = physics.update(0.05);

      expect(state.bodyRoll).toBe(0);
      expect(state.bodyPitch).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const networkState: NetworkVehicleState = {
        position: [10, 5, 20],
        rotation: [0, 0.707, 0, 0.707],
        velocity: [5, 0, -10],
        rpm: 5000,
        speed: 100,
        gear: 5,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);
      physics.update(0.025);

      physics.reset();

      const state = physics.getCurrentState();
      expect(state.position).toEqual([0, 0, 0]);
      expect(state.rotation).toEqual([0, 0, 0, 1]);
      expect(state.bodyPitch).toBe(0);
      expect(state.bodyRoll).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple rapid updates', () => {
      for (let i = 0; i < 10; i++) {
        const networkState: NetworkVehicleState = {
          position: [i * 10, 0, 0],
          rotation: [0, 0, 0, 1],
          velocity: [10, 0, 0],
          rpm: 3000,
          speed: 50,
          gear: 3,
          flags: 0,
        };
        physics.updateFromNetwork(networkState);
        physics.update(0.016);
      }

      // Should handle without errors
      const state = physics.getCurrentState();
      expect(state.position[0]).toBeGreaterThan(0);
    });

    it('should handle very small delta times', () => {
      const networkState: NetworkVehicleState = {
        position: [10, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        rpm: 1000,
        speed: 0,
        gear: 1,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);
      const state = physics.update(0.001);

      // Should interpolate slightly
      expect(state.position[0]).toBeGreaterThan(0);
      expect(state.position[0]).toBeLessThan(1);
    });

    it('should handle negative velocities', () => {
      const networkState: NetworkVehicleState = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        velocity: [-10, 0, 10], // Moving left and backward
        rpm: 2000,
        speed: 30,
        gear: -1,
        flags: 0,
      };

      physics.updateFromNetwork(networkState);
      const state = physics.update(0.05);

      // Should handle negative velocities
      expect(state.bodyRoll).toBeLessThan(0); // Negative roll
      expect(Math.abs(state.bodyRoll)).toBeLessThanOrEqual(8);
    });
  });
});
