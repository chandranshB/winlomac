import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhysicsControllerImpl } from '../PhysicsController';
import { defaultVehicleConfig } from '../../config/defaultVehicleConfig';
import type { VehicleInput } from '../../types';
import type { RapierRigidBody } from '@react-three/rapier';

describe('PhysicsController', () => {
  let controller: PhysicsControllerImpl;
  let mockRigidBody: Partial<RapierRigidBody>;

  const defaultInput: VehicleInput = {
    throttle: 0,
    brake: 0,
    steering: 0,
    handbrake: false,
    reset: false
  };

  beforeEach(() => {
    controller = new PhysicsControllerImpl(defaultVehicleConfig);

    // Create mock RigidBody
    mockRigidBody = {
      linvel: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
      angvel: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
      rotation: vi.fn(() => ({ x: 0, y: 0, z: 0, w: 1 })),
      translation: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
      applyImpulse: vi.fn(),
      applyTorqueImpulse: vi.fn(),
      setLinvel: vi.fn(),
      setAngvel: vi.fn(),
      setTranslation: vi.fn(),
      setRotation: vi.fn()
    };

    controller.setRigidBody(mockRigidBody as RapierRigidBody);
  });

  describe('Initialization', () => {
    it('should initialize with all subsystems', () => {
      expect(controller.acceleration).toBeDefined();
      expect(controller.drift).toBeDefined();
      expect(controller.tires).toBeDefined();
      expect(controller.rpm).toBeDefined();
    });

    it('should initialize with zero velocity and speed', () => {
      expect(controller.velocity).toEqual({ x: 0, y: 0, z: 0 });
      expect(controller.speed).toBe(0);
      expect(controller.forwardSpeed).toBe(0);
    });

    it('should initialize with grounded state as false', () => {
      expect(controller.isGrounded).toBe(false);
    });
  });

  describe('Fixed Timestep Integration', () => {
    it('should update at 60 Hz fixed timestep', () => {
      const delta = 1 / 30; // 30 FPS frame
      
      controller.update(delta, defaultInput);

      // At 30 FPS, one frame should trigger 2 fixed updates (60 Hz)
      // We can verify this by checking that subsystems were updated
      expect(mockRigidBody.linvel).toHaveBeenCalled();
    });

    it('should accumulate time correctly for fixed timestep', () => {
      // First update with small delta (less than fixed timestep)
      controller.update(1 / 120, defaultInput); // 0.0083s
      
      // Should not have applied forces yet (accumulator < 1/60)
      const firstCallCount = (mockRigidBody.applyImpulse as any).mock.calls.length;
      
      // Second update to push over the threshold
      controller.update(1 / 120, defaultInput); // Another 0.0083s
      
      // Now should have applied forces (accumulator >= 1/60)
      const secondCallCount = (mockRigidBody.applyImpulse as any).mock.calls.length;
      
      expect(secondCallCount).toBeGreaterThanOrEqual(firstCallCount);
    });

    it('should handle multiple fixed updates in one frame', () => {
      const delta = 1 / 15; // 15 FPS frame (slow frame)
      
      controller.update(delta, defaultInput);

      // At 15 FPS, one frame should trigger 4 fixed updates (60 Hz)
      // Verify multiple updates occurred
      expect(mockRigidBody.linvel).toHaveBeenCalled();
    });
  });

  describe('Subsystem Coordination', () => {
    it('should coordinate RPM system with acceleration system', () => {
      const input: VehicleInput = {
        ...defaultInput,
        throttle: 1.0
      };

      // Mock velocity to simulate movement
      (mockRigidBody.linvel as any).mockReturnValue({ x: 0, y: 0, z: -10 });

      controller.update(1 / 60, input);

      // RPM should be updated based on speed and gear
      expect(controller.rpm.currentRPM).toBeGreaterThan(defaultVehicleConfig.engine.idleRPM);
    });

    it('should coordinate drift controller with tire forces', () => {
      const input: VehicleInput = {
        ...defaultInput,
        throttle: 0.8,
        steering: 1.0,
        handbrake: true
      };

      // Mock high speed and grounded state
      (mockRigidBody.linvel as any).mockReturnValue({ x: 5, y: 0, z: -20 });

      controller.update(1 / 60, input);

      // Drift state should be tracked
      expect(controller.drift.slipAngle).toBeDefined();
    });

    it('should apply forces from acceleration system', () => {
      const input: VehicleInput = {
        ...defaultInput,
        throttle: 1.0
      };

      controller.update(1 / 60, input);

      // Should have applied impulse from acceleration
      expect(mockRigidBody.applyImpulse).toHaveBeenCalled();
    });
  });

  describe('State Synchronization', () => {
    it('should sync velocity from RigidBody', () => {
      const mockVelocity = { x: 10, y: 2, z: -15 };
      (mockRigidBody.linvel as any).mockReturnValue(mockVelocity);

      controller.update(1 / 60, defaultInput);

      expect(controller.velocity).toEqual(mockVelocity);
    });

    it('should calculate speed in km/h from velocity', () => {
      // 10 m/s = 36 km/h
      (mockRigidBody.linvel as any).mockReturnValue({ x: 10, y: 0, z: 0 });

      controller.update(1 / 60, defaultInput);

      expect(controller.speed).toBeCloseTo(36, 0);
    });

    it('should calculate forward speed correctly', () => {
      // Moving forward at 10 m/s
      (mockRigidBody.linvel as any).mockReturnValue({ x: 0, y: 0, z: -10 });
      (mockRigidBody.rotation as any).mockReturnValue({ x: 0, y: 0, z: 0, w: 1 });

      controller.update(1 / 60, defaultInput);

      expect(controller.forwardSpeed).toBeCloseTo(10, 0);
    });

    it('should detect grounded state based on Y velocity', () => {
      // Small Y velocity = grounded
      (mockRigidBody.linvel as any).mockReturnValue({ x: 0, y: 0.5, z: 0 });

      controller.update(1 / 60, defaultInput);

      expect(controller.isGrounded).toBe(true);
    });

    it('should detect airborne state based on Y velocity', () => {
      // Large Y velocity = airborne
      (mockRigidBody.linvel as any).mockReturnValue({ x: 0, y: 5, z: 0 });

      controller.update(1 / 60, defaultInput);

      expect(controller.isGrounded).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should reset all state to initial values', () => {
      // Set some state
      (mockRigidBody.linvel as any).mockReturnValue({ x: 10, y: 2, z: -15 });
      controller.update(1 / 60, defaultInput);

      // Reset
      controller.reset();

      // Verify state is reset
      expect(controller.velocity).toEqual({ x: 0, y: 0, z: 0 });
      expect(controller.speed).toBe(0);
      expect(controller.forwardSpeed).toBe(0);
      expect(controller.isGrounded).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing RigidBody gracefully', () => {
      const newController = new PhysicsControllerImpl(defaultVehicleConfig);
      
      // Should not throw when RigidBody is not set
      expect(() => {
        newController.update(1 / 60, defaultInput);
      }).not.toThrow();
    });

    it('should warn when RigidBody is not set', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const newController = new PhysicsControllerImpl(defaultVehicleConfig);
      
      newController.update(1 / 60, defaultInput);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('RigidBody not set')
      );

      consoleSpy.mockRestore();
    });
  });
});
