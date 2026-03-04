import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsControllerImpl } from '../../physics/PhysicsController';
import { defaultVehicleConfig } from '../../config/defaultVehicleConfig';
import type { VehicleInput } from '../../types';

/**
 * Performance profiling tests for the physics system
 * 
 * Performance Goals:
 * - Physics update time: <2ms per vehicle
 * - Memory usage: <50MB per vehicle
 * - Frame time: <16ms per vehicle (60 FPS)
 */

describe('Performance Profiling', () => {
  let physicsController: PhysicsControllerImpl;
  let mockRigidBody: any;

  beforeEach(() => {
    physicsController = new PhysicsControllerImpl(defaultVehicleConfig);
    
    // Create mock RigidBody
    mockRigidBody = {
      translation: () => ({ x: 0, y: 1, z: 0 }),
      rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
      linvel: () => ({ x: 0, y: 0, z: -20 }), // 72 km/h
      angvel: () => ({ x: 0, y: 0, z: 0 }),
      applyImpulse: () => {},
      applyTorqueImpulse: () => {},
      setLinvel: () => {},
      setAngvel: () => {}
    };
    
    physicsController.setRigidBody(mockRigidBody);
  });

  describe('Physics Update Performance', () => {
    it('should complete physics update in <2ms per vehicle', () => {
      const input: VehicleInput = {
        throttle: 0.8,
        brake: 0,
        steering: 0.5,
        handbrake: false,
        reset: false
      };

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        physicsController.update(1/60, input);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / iterations;

      console.log(`Average physics update time: ${averageTime.toFixed(3)}ms`);
      console.log(`Total time for ${iterations} iterations: ${totalTime.toFixed(2)}ms`);

      // Target: <2ms per update
      expect(averageTime).toBeLessThan(2);
    });

    it('should handle multiple vehicles efficiently', () => {
      const vehicleCount = 10;
      const controllers: PhysicsControllerImpl[] = [];

      // Create multiple physics controllers
      for (let i = 0; i < vehicleCount; i++) {
        const controller = new PhysicsControllerImpl(defaultVehicleConfig);
        controller.setRigidBody(mockRigidBody);
        controllers.push(controller);
      }

      const input: VehicleInput = {
        throttle: 0.8,
        brake: 0,
        steering: 0.3,
        handbrake: false,
        reset: false
      };

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        controllers.forEach(controller => {
          controller.update(1/60, input);
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTimePerVehicle = totalTime / (iterations * vehicleCount);

      console.log(`Average time per vehicle (${vehicleCount} vehicles): ${averageTimePerVehicle.toFixed(3)}ms`);
      console.log(`Total frame time for ${vehicleCount} vehicles: ${(totalTime / iterations).toFixed(2)}ms`);

      // Target: <2ms per vehicle
      expect(averageTimePerVehicle).toBeLessThan(2);
    });

    it('should maintain consistent performance under load', () => {
      const input: VehicleInput = {
        throttle: 1.0,
        brake: 0,
        steering: 0.8,
        handbrake: true,
        reset: false
      };

      const iterations = 1000;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        physicsController.update(1/60, input);
        const endTime = performance.now();
        timings.push(endTime - startTime);
      }

      const averageTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);
      const variance = timings.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / timings.length;
      const stdDev = Math.sqrt(variance);

      console.log(`Performance statistics over ${iterations} iterations:`);
      console.log(`  Average: ${averageTime.toFixed(3)}ms`);
      console.log(`  Min: ${minTime.toFixed(3)}ms`);
      console.log(`  Max: ${maxTime.toFixed(3)}ms`);
      console.log(`  Std Dev: ${stdDev.toFixed(3)}ms`);

      // Performance should be consistent (low variance)
      expect(averageTime).toBeLessThan(2);
      expect(maxTime).toBeLessThan(5); // No extreme spikes
      expect(stdDev).toBeLessThan(1); // Low variance
    });
  });

  describe('Memory Usage', () => {
    it('should not create excessive allocations during updates', () => {
      const input: VehicleInput = {
        throttle: 0.8,
        brake: 0,
        steering: 0.5,
        handbrake: false,
        reset: false
      };

      // Warm up
      for (let i = 0; i < 100; i++) {
        physicsController.update(1/60, input);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memBefore = process.memoryUsage().heapUsed;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        physicsController.update(1/60, input);
      }

      const memAfter = process.memoryUsage().heapUsed;
      const memDelta = (memAfter - memBefore) / 1024 / 1024; // Convert to MB

      console.log(`Memory delta after ${iterations} updates: ${memDelta.toFixed(2)}MB`);
      console.log(`Memory per update: ${(memDelta / iterations * 1024).toFixed(2)}KB`);

      // Should not allocate significant memory during updates
      // Allow some allocation for internal state, but should be minimal
      expect(memDelta).toBeLessThan(5); // Less than 5MB for 1000 updates
    });

    it('should reuse objects efficiently', () => {
      const input: VehicleInput = {
        throttle: 0.8,
        brake: 0,
        steering: 0.5,
        handbrake: false,
        reset: false
      };

      // Run multiple cycles to check for memory leaks
      const cycles = 5;
      const iterationsPerCycle = 1000;
      const memoryReadings: number[] = [];

      for (let cycle = 0; cycle < cycles; cycle++) {
        if (global.gc) {
          global.gc();
        }

        const memBefore = process.memoryUsage().heapUsed;

        for (let i = 0; i < iterationsPerCycle; i++) {
          physicsController.update(1/60, input);
        }

        const memAfter = process.memoryUsage().heapUsed;
        const memDelta = (memAfter - memBefore) / 1024 / 1024;
        memoryReadings.push(memDelta);
      }

      console.log('Memory delta per cycle:', memoryReadings.map(m => m.toFixed(2) + 'MB').join(', '));

      // Memory usage should not grow significantly across cycles (no leaks)
      const firstCycle = memoryReadings[0];
      const lastCycle = memoryReadings[memoryReadings.length - 1];
      const growth = lastCycle - firstCycle;

      console.log(`Memory growth from first to last cycle: ${growth.toFixed(2)}MB`);

      // Allow some growth, but should be minimal
      expect(Math.abs(growth)).toBeLessThan(2);
    });
  });

  describe('Frame Time Budget', () => {
    it('should stay within 16ms frame budget for single vehicle', () => {
      const input: VehicleInput = {
        throttle: 0.8,
        brake: 0,
        steering: 0.5,
        handbrake: false,
        reset: false
      };

      const iterations = 100;
      const frameTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        // Simulate a full frame update
        physicsController.update(1/60, input);
        
        const endTime = performance.now();
        frameTimes.push(endTime - startTime);
      }

      const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const maxFrameTime = Math.max(...frameTimes);

      console.log(`Average frame time: ${averageFrameTime.toFixed(3)}ms`);
      console.log(`Max frame time: ${maxFrameTime.toFixed(3)}ms`);
      console.log(`Frame budget remaining: ${(16 - averageFrameTime).toFixed(3)}ms`);

      // Should stay well within 16ms budget (60 FPS)
      expect(averageFrameTime).toBeLessThan(16);
      expect(maxFrameTime).toBeLessThan(16);
    });

    it('should maintain 60 FPS with multiple vehicles', () => {
      const vehicleCount = 8; // Typical multiplayer scenario
      const controllers: PhysicsControllerImpl[] = [];

      for (let i = 0; i < vehicleCount; i++) {
        const controller = new PhysicsControllerImpl(defaultVehicleConfig);
        controller.setRigidBody(mockRigidBody);
        controllers.push(controller);
      }

      const input: VehicleInput = {
        throttle: 0.8,
        brake: 0,
        steering: 0.3,
        handbrake: false,
        reset: false
      };

      const iterations = 100;
      const frameTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        controllers.forEach(controller => {
          controller.update(1/60, input);
        });
        
        const endTime = performance.now();
        frameTimes.push(endTime - startTime);
      }

      const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const maxFrameTime = Math.max(...frameTimes);

      console.log(`Average frame time (${vehicleCount} vehicles): ${averageFrameTime.toFixed(3)}ms`);
      console.log(`Max frame time: ${maxFrameTime.toFixed(3)}ms`);
      console.log(`Frame budget remaining: ${(16 - averageFrameTime).toFixed(3)}ms`);

      // Should stay within 16ms budget even with multiple vehicles
      expect(averageFrameTime).toBeLessThan(16);
    });
  });

  describe('Worst Case Scenarios', () => {
    it('should handle high-speed drift scenario efficiently', () => {
      // Simulate high-speed drifting (most computationally intensive)
      mockRigidBody.linvel = () => ({ x: 10, y: 0, z: -40 }); // ~150 km/h with lateral velocity
      mockRigidBody.angvel = () => ({ x: 0, y: 2, z: 0 }); // High angular velocity

      const input: VehicleInput = {
        throttle: 1.0,
        brake: 0,
        steering: 0.9,
        handbrake: true,
        reset: false
      };

      const iterations = 500;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        physicsController.update(1/60, input);
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      console.log(`High-speed drift average time: ${averageTime.toFixed(3)}ms`);

      expect(averageTime).toBeLessThan(2);
    });

    it('should handle rapid input changes efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Rapidly changing inputs
        const input: VehicleInput = {
          throttle: Math.random(),
          brake: Math.random(),
          steering: Math.random() * 2 - 1,
          handbrake: Math.random() > 0.5,
          reset: false
        };

        physicsController.update(1/60, input);
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      console.log(`Rapid input changes average time: ${averageTime.toFixed(3)}ms`);

      expect(averageTime).toBeLessThan(2);
    });
  });
});
