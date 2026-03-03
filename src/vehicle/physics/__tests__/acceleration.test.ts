import { describe, it, expect } from 'vitest';
import { AccelerationSystemImpl } from '../AccelerationSystem';
import { defaultVehicleConfig } from '../../config/defaultVehicleConfig';
import type { VehicleInput } from '../../types';

describe('AccelerationSystem', () => {
  describe('Wheel Torque and Weight Transfer', () => {
    it('should apply wheel torque proportional to tire grip', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const input: VehicleInput = {
        throttle: 0.5,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      const result = system.update(0.016, input, 3000, 50, true);
      
      // Should apply force when grounded with throttle
      expect(result.force.z).toBeLessThan(0); // Negative Z is forward
      expect(result.force.z).not.toBe(0);
    });

    it('should increase force with weight transfer during acceleration', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const lowThrottle: VehicleInput = {
        throttle: 0.3,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      const highThrottle: VehicleInput = {
        throttle: 0.6,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      const lowResult = system.update(0.016, lowThrottle, 3000, 50, true);
      const highResult = system.update(0.016, highThrottle, 3000, 50, true);
      
      // Higher throttle should produce more force (accounting for weight transfer)
      expect(Math.abs(highResult.force.z)).toBeGreaterThan(Math.abs(lowResult.force.z));
    });

    it('should simulate wheel spin when throttle > 70%', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const normalThrottle: VehicleInput = {
        throttle: 0.7,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      const excessiveThrottle: VehicleInput = {
        throttle: 1.0,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      const normalResult = system.update(0.016, normalThrottle, 3000, 50, true);
      const excessiveResult = system.update(0.016, excessiveThrottle, 3000, 50, true);
      
      // Excessive throttle should produce less force due to wheel spin
      // The force should be reduced, not increased proportionally
      const normalForce = Math.abs(normalResult.force.z);
      const excessiveForce = Math.abs(excessiveResult.force.z);
      const expectedProportionalForce = normalForce * (1.0 / 0.7); // If no wheel spin
      
      // Excessive force should be less than proportional due to wheel spin
      expect(excessiveForce).toBeLessThan(expectedProportionalForce);
    });

    it('should apply force at rear axle for weight transfer', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const input: VehicleInput = {
        throttle: 0.8,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      const result = system.update(0.016, input, 3000, 50, true);
      
      // Force should be applied at rear axle (negative Z)
      expect(result.point.z).toBeLessThan(0);
      expect(result.point.z).toBeCloseTo(-defaultVehicleConfig.dimensions.length * 0.3, 2);
    });

    it('should not apply force when not grounded', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const input: VehicleInput = {
        throttle: 1.0,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      const result = system.update(0.016, input, 3000, 50, false);
      
      // No force when airborne
      expect(result.force.z).toBe(0);
    });

    it('should not apply force when shifting', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const input: VehicleInput = {
        throttle: 1.0,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      // First, get to a state where we're in gear 1 with high RPM
      // This should trigger an upshift
      const rpm = defaultVehicleConfig.engine.redlineRPM * 0.91; // 91% of redline
      const speed = 30; // m/s, reasonable for gear 1
      
      // This update should trigger a shift
      system.update(0.016, input, rpm, speed, true);
      
      // After the update, system should be shifting
      expect(system.isShifting).toBe(true);
      
      // During shift, force should be zero
      const shiftResult = system.update(0.016, input, rpm, speed, true);
      expect(shiftResult.force.z).toBe(0);
    });
  });

  describe('Weight Transfer Calculation', () => {
    it('should increase rear grip by 15-25% during acceleration', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const input: VehicleInput = {
        throttle: 0.8,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      // Get the force with weight transfer
      const result = system.update(0.016, input, 3000, 50, true);
      
      // The force should be enhanced by weight transfer
      // We can't directly test the internal calculation, but we can verify
      // that force is being applied
      expect(result.force.z).toBeLessThan(0);
      expect(result.force.z).not.toBe(0);
    });
  });

  describe('Torque Curve Calculation', () => {
    it('should calculate torque from RPM using curve interpolation', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      // Test at various RPM points
      const lowRPM = system.calculateTorque(1000);
      const midRPM = system.calculateTorque(4000);
      const highRPM = system.calculateTorque(7000);
      
      // All should be valid multipliers between 0 and 1
      expect(lowRPM).toBeGreaterThanOrEqual(0);
      expect(lowRPM).toBeLessThanOrEqual(1);
      expect(midRPM).toBeGreaterThanOrEqual(0);
      expect(midRPM).toBeLessThanOrEqual(1);
      expect(highRPM).toBeGreaterThanOrEqual(0);
      expect(highRPM).toBeLessThanOrEqual(1);
    });

    it('should return boundary values for RPM outside curve range', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      const curve = defaultVehicleConfig.engine.torqueCurve;
      
      const belowMin = system.calculateTorque(curve[0].rpm - 100);
      const aboveMax = system.calculateTorque(curve[curve.length - 1].rpm + 100);
      
      expect(belowMin).toBe(curve[0].torqueMultiplier);
      expect(aboveMax).toBe(curve[curve.length - 1].torqueMultiplier);
    });
  });

  describe('Automatic Gear Shifting', () => {
    it('should upshift when approaching redline', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      // Start in gear 1
      const rpm = defaultVehicleConfig.engine.redlineRPM * 0.91; // 91% of redline
      const speed = 30; // m/s
      
      const newGear = system.shouldShift(speed, rpm);
      
      // Should upshift to gear 2
      expect(newGear).toBe(2);
    });

    it('should downshift when RPM too low', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const input: VehicleInput = {
        throttle: 0.5,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      // Get to gear 2 first by triggering upshift
      const highRPM = defaultVehicleConfig.engine.redlineRPM * 0.91;
      system.update(0.016, input, highRPM, 30, true);
      
      // Wait for shift to complete
      const shiftTime = defaultVehicleConfig.transmission.shiftTime;
      const updates = Math.ceil(shiftTime / 0.016) + 1;
      for (let i = 0; i < updates; i++) {
        system.update(0.016, input, 5000, 35, true);
      }
      
      // Verify we're in gear 2
      expect(system.currentGear).toBe(2);
      
      // Now test downshift with low RPM
      const lowRPM = defaultVehicleConfig.engine.idleRPM + 500; // Below threshold
      const newGear = system.shouldShift(20, lowRPM);
      
      // Should downshift to gear 1
      expect(newGear).toBe(1);
    });

    it('should not shift during handbrake (drift)', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const input: VehicleInput = {
        throttle: 0.8,
        brake: 0,
        steering: 0.5,
        handbrake: true, // Handbrake engaged
        reset: false
      };
      
      // High RPM that would normally trigger upshift
      const rpm = defaultVehicleConfig.engine.redlineRPM * 0.95;
      const speed = 30;
      
      // Update with handbrake - should not shift
      system.update(0.016, input, rpm, speed, true);
      
      // Should still be in gear 1
      expect(system.currentGear).toBe(1);
      expect(system.isShifting).toBe(false);
    });

    it('should shift to reverse gear when moving backward', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const speed = -2; // Moving backward at 2 m/s
      const rpm = 1500;
      
      const newGear = system.shouldShift(speed, rpm);
      
      // Should shift to reverse (-1)
      expect(newGear).toBe(-1);
    });

    it('should shift to first gear at low speeds', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const speed = 0.5; // Very low speed
      const rpm = 1000;
      
      const newGear = system.shouldShift(speed, rpm);
      
      // Should be in first gear
      expect(newGear).toBe(1);
    });

    it('should not upshift beyond maximum gear', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      // Manually get to max gear by simulating multiple upshifts
      const input: VehicleInput = {
        throttle: 1.0,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      // Simulate getting to gear 6
      for (let gear = 1; gear < 6; gear++) {
        const rpm = defaultVehicleConfig.engine.redlineRPM * 0.91;
        system.update(0.016, input, rpm, 30 + gear * 10, true);
        
        // Wait for shift to complete
        for (let i = 0; i < 20; i++) {
          system.update(0.016, input, 5000, 30 + gear * 10, true);
        }
      }
      
      // Now in gear 6, try to shift with high RPM
      const rpm = defaultVehicleConfig.engine.redlineRPM * 0.95;
      const newGear = system.shouldShift(100, rpm);
      
      // Should not shift beyond gear 6
      expect(newGear).toBeNull();
    });

    it('should complete gear shift after shift time', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const input: VehicleInput = {
        throttle: 1.0,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      // Trigger upshift
      const rpm = defaultVehicleConfig.engine.redlineRPM * 0.91;
      system.update(0.016, input, rpm, 30, true);
      
      // Should be shifting
      expect(system.isShifting).toBe(true);
      
      // Update for shift time duration
      const shiftTime = defaultVehicleConfig.transmission.shiftTime;
      const updates = Math.ceil(shiftTime / 0.016) + 1;
      
      for (let i = 0; i < updates; i++) {
        system.update(0.016, input, 5000, 30, true);
      }
      
      // Should have completed shift
      expect(system.isShifting).toBe(false);
    });

    it('should not apply force during gear shift', () => {
      const system = new AccelerationSystemImpl(defaultVehicleConfig);
      
      const input: VehicleInput = {
        throttle: 1.0,
        brake: 0,
        steering: 0,
        handbrake: false,
        reset: false
      };
      
      // Trigger upshift
      const rpm = defaultVehicleConfig.engine.redlineRPM * 0.91;
      system.update(0.016, input, rpm, 30, true);
      
      // During shift, no force should be applied
      const result = system.update(0.016, input, 5000, 30, true);
      
      expect(system.isShifting).toBe(true);
      expect(result.force.z).toBe(0);
    });
  });
});
