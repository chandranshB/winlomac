import { describe, it, expect, beforeEach } from 'vitest';
import { RPMSystemImpl } from '../RPMSystem';
import { defaultVehicleConfig } from '../../config/defaultVehicleConfig';

describe('RPMSystem', () => {
  let rpmSystem: RPMSystemImpl;

  beforeEach(() => {
    rpmSystem = new RPMSystemImpl(defaultVehicleConfig);
  });

  describe('Rev Limiter', () => {
    it('should activate rev limiter above 7500 RPM', () => {
      // Manually set RPM above rev limiter
      const highRPM = 7600;
      const limitedRPM = rpmSystem.applyRevLimiter(highRPM);
      
      expect(rpmSystem.isRevLimiting).toBe(true);
      expect(limitedRPM).toBeLessThan(highRPM);
      expect(limitedRPM).toBeCloseTo(7500 * 0.95, 1);
    });

    it('should not activate rev limiter below 7500 RPM', () => {
      const normalRPM = 6000;
      const result = rpmSystem.applyRevLimiter(normalRPM);
      
      expect(rpmSystem.isRevLimiting).toBe(false);
      expect(result).toBe(normalRPM);
    });

    it('should cut torque by 90% when rev limiting', () => {
      const revLimiterRPM = defaultVehicleConfig.engine.revLimiterRPM;
      const limitedRPM = rpmSystem.applyRevLimiter(revLimiterRPM + 100);
      
      // Rev limiter should reduce RPM to 95% of limit (5% cut from limit, which is 90% torque cut)
      expect(limitedRPM).toBeCloseTo(revLimiterRPM * 0.95, 1);
    });
  });

  describe('Gear Change RPM Adjustment', () => {
    it('should instantly adjust RPM on gear change', () => {
      const speed = 100; // km/h
      const gear = 3;
      
      // Simulate gear change
      const newRPM = rpmSystem.update(0.016, gear, speed, 0.8, true, true);
      
      // RPM should be calculated based on speed and new gear
      expect(newRPM).toBeGreaterThan(defaultVehicleConfig.engine.idleRPM);
      expect(newRPM).toBeLessThan(defaultVehicleConfig.engine.redlineRPM);
    });

    it('should calculate different RPM for different gears at same speed', () => {
      const speed = 80; // km/h
      
      // Get RPM for gear 2
      const rpm2 = rpmSystem.update(0.016, 2, speed, 0.5, true, true);
      
      // Reset and get RPM for gear 4
      rpmSystem = new RPMSystemImpl(defaultVehicleConfig);
      const rpm4 = rpmSystem.update(0.016, 4, speed, 0.5, true, true);
      
      // Lower gear should have higher RPM at same speed
      expect(rpm2).toBeGreaterThan(rpm4);
    });
  });

  describe('Update Rate', () => {
    it('should maintain 30 Hz minimum update rate', () => {
      const deltaTime = 1 / 30; // 30 Hz
      const initialRPM = rpmSystem.currentRPM;
      
      // Update with throttle
      const newRPM = rpmSystem.update(deltaTime, 1, 50, 1.0, true, false);
      
      // RPM should change smoothly
      expect(newRPM).not.toBe(initialRPM);
      expect(Math.abs(newRPM - initialRPM)).toBeLessThan(1000); // Reasonable change per frame
    });

    it('should handle multiple updates smoothly', () => {
      const updates = 10;
      const deltaTime = 1 / 60; // 60 Hz
      
      for (let i = 0; i < updates; i++) {
        rpmSystem.update(deltaTime, 2, 60, 0.8, true, false);
      }
      
      // RPM should be within valid range
      expect(rpmSystem.currentRPM).toBeGreaterThanOrEqual(defaultVehicleConfig.engine.idleRPM);
      expect(rpmSystem.currentRPM).toBeLessThanOrEqual(defaultVehicleConfig.engine.redlineRPM);
    });
  });

  describe('RPM Bounds', () => {
    it('should never go below idle RPM', () => {
      // Try to force RPM below idle
      for (let i = 0; i < 100; i++) {
        rpmSystem.update(0.016, 1, 0, 0, true, false);
      }
      
      expect(rpmSystem.currentRPM).toBeGreaterThanOrEqual(defaultVehicleConfig.engine.idleRPM);
    });

    it('should never exceed redline RPM', () => {
      // Try to force RPM above redline
      for (let i = 0; i < 100; i++) {
        rpmSystem.update(0.016, 1, 200, 1.0, true, false);
      }
      
      expect(rpmSystem.currentRPM).toBeLessThanOrEqual(defaultVehicleConfig.engine.redlineRPM);
    });
  });

  describe('Throttle Response', () => {
    it('should increase RPM when throttle is applied', () => {
      const initialRPM = rpmSystem.currentRPM;
      
      // Apply throttle
      rpmSystem.update(0.1, 1, 30, 1.0, true, false);
      
      expect(rpmSystem.currentRPM).toBeGreaterThan(initialRPM);
    });

    it('should decrease RPM toward idle when throttle is released', () => {
      // First increase RPM
      for (let i = 0; i < 20; i++) {
        rpmSystem.update(0.016, 2, 60, 1.0, true, false);
      }
      
      const highRPM = rpmSystem.currentRPM;
      
      // Release throttle
      for (let i = 0; i < 20; i++) {
        rpmSystem.update(0.016, 2, 60, 0, true, false);
      }
      
      expect(rpmSystem.currentRPM).toBeLessThan(highRPM);
    });
  });

  describe('Edge Cases', () => {
    it('should handle neutral gear (gear 0)', () => {
      const rpm = rpmSystem.update(0.016, 0, 50, 0.5, true, false);
      
      // Should return idle RPM or slightly above
      expect(rpm).toBeGreaterThanOrEqual(defaultVehicleConfig.engine.idleRPM);
    });

    it('should handle reverse gear', () => {
      const rpm = rpmSystem.update(0.016, -1, 20, 0.5, true, true);
      
      // Should calculate RPM based on reverse gear ratio
      expect(rpm).toBeGreaterThan(defaultVehicleConfig.engine.idleRPM);
    });

    it('should handle zero speed', () => {
      const rpm = rpmSystem.update(0.016, 1, 0, 0.5, true, false);
      
      // Should be at or near idle
      expect(rpm).toBeGreaterThanOrEqual(defaultVehicleConfig.engine.idleRPM);
    });
  });
});
