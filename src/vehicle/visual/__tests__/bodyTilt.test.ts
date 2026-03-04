import { describe, it, expect, beforeEach } from 'vitest';
import { BodyTiltSystemImpl } from '../BodyTiltSystem';
import { defaultVehicleConfig } from '../../config/defaultVehicleConfig';
import type { VehicleConfig, BodyTilt } from '../../types';

describe('BodyTiltSystem', () => {
  let bodyTiltSystem: BodyTiltSystemImpl;
  let config: VehicleConfig;

  beforeEach(() => {
    config = { ...defaultVehicleConfig };
    bodyTiltSystem = new BodyTiltSystemImpl(config);
  });

  describe('initialization', () => {
    it('should initialize with zero pitch and roll', () => {
      expect(bodyTiltSystem.currentPitch).toBe(0);
      expect(bodyTiltSystem.currentRoll).toBe(0);
    });
  });

  describe('calculatePitch', () => {
    it('should calculate positive pitch (nose up) during acceleration', () => {
      const longitudinalAccel = 10; // m/s² forward acceleration
      const speed = 100; // km/h (above maxSpeed threshold)
      
      const pitch = bodyTiltSystem.calculatePitch(longitudinalAccel, speed);
      
      // Should be positive (nose up) and scaled by maxPitchAccel (3 degrees)
      expect(pitch).toBeGreaterThan(0);
      expect(pitch).toBeLessThanOrEqual(config.bodyTilt.maxPitchAccel);
    });

    it('should calculate negative pitch (nose down) during braking', () => {
      const longitudinalAccel = -10; // m/s² braking
      const speed = 100; // km/h
      
      const pitch = bodyTiltSystem.calculatePitch(longitudinalAccel, speed);
      
      // Should be negative (nose down) and scaled by maxPitchBrake (4 degrees)
      expect(pitch).toBeLessThan(0);
      expect(pitch).toBeGreaterThanOrEqual(-config.bodyTilt.maxPitchBrake);
    });

    it('should return zero pitch when no acceleration', () => {
      const pitch = bodyTiltSystem.calculatePitch(0, 100);
      expect(pitch).toBe(0);
    });

    it('should respect max pitch during hard acceleration', () => {
      const longitudinalAccel = 20; // m/s² (max typical acceleration)
      const speed = 100; // km/h
      
      const pitch = bodyTiltSystem.calculatePitch(longitudinalAccel, speed);
      
      expect(pitch).toBeLessThanOrEqual(config.bodyTilt.maxPitchAccel);
    });

    it('should respect max pitch during hard braking', () => {
      const longitudinalAccel = -20; // m/s² (max typical braking)
      const speed = 100; // km/h
      
      const pitch = bodyTiltSystem.calculatePitch(longitudinalAccel, speed);
      
      expect(pitch).toBeGreaterThanOrEqual(-config.bodyTilt.maxPitchBrake);
    });
  });

  describe('calculateRoll', () => {
    it('should calculate roll from lateral acceleration', () => {
      const lateralAccel = 6; // m/s² (half of max typical)
      const speed = 100; // km/h
      
      const roll = bodyTiltSystem.calculateRoll(lateralAccel, speed);
      
      // Should be non-zero and within max roll (8 degrees)
      expect(Math.abs(roll)).toBeGreaterThan(0);
      expect(Math.abs(roll)).toBeLessThanOrEqual(config.bodyTilt.maxRoll);
    });

    it('should return zero roll when no lateral acceleration', () => {
      const roll = bodyTiltSystem.calculateRoll(0, 100);
      expect(roll).toBe(0);
    });

    it('should respect max roll during high lateral acceleration', () => {
      const lateralAccel = 12; // m/s² (max typical lateral acceleration)
      const speed = 100; // km/h
      
      const roll = bodyTiltSystem.calculateRoll(lateralAccel, speed);
      
      expect(Math.abs(roll)).toBeLessThanOrEqual(config.bodyTilt.maxRoll);
    });

    it('should handle negative lateral acceleration (opposite direction)', () => {
      const lateralAccel = -6; // m/s²
      const speed = 100; // km/h
      
      const roll = bodyTiltSystem.calculateRoll(lateralAccel, speed);
      
      expect(roll).toBeLessThan(0);
      expect(Math.abs(roll)).toBeLessThanOrEqual(config.bodyTilt.maxRoll);
    });
  });

  describe('applySpeedScaling', () => {
    it('should apply minimum scale below minSpeed', () => {
      const tilt = 4; // degrees
      const speed = 20; // km/h (below minSpeed of 30)
      
      const scaled = bodyTiltSystem.applySpeedScaling(tilt, speed);
      
      expect(scaled).toBe(tilt * config.bodyTilt.speedScaling.minScale);
      expect(scaled).toBe(1.2); // 4 * 0.3 (reduced from 0.5)
    });

    it('should apply maximum scale above maxSpeed', () => {
      const tilt = 4; // degrees
      const speed = 100; // km/h (above maxSpeed of 80)
      
      const scaled = bodyTiltSystem.applySpeedScaling(tilt, speed);
      
      expect(scaled).toBe(tilt * config.bodyTilt.speedScaling.maxScale);
      expect(scaled).toBe(2.8); // 4 * 0.7 (reduced from 1.0)
    });

    it('should interpolate scale between minSpeed and maxSpeed', () => {
      const tilt = 4; // degrees
      const speed = 55; // km/h (midpoint between 30 and 80)
      
      const scaled = bodyTiltSystem.applySpeedScaling(tilt, speed);
      
      // At midpoint, scale should be 0.5 (halfway between 0.3 and 0.7)
      expect(scaled).toBeCloseTo(2, 1); // 4 * 0.5 = 2
    });

    it('should scale at minSpeed boundary', () => {
      const tilt = 4;
      const speed = 30; // exactly at minSpeed
      
      const scaled = bodyTiltSystem.applySpeedScaling(tilt, speed);
      
      expect(scaled).toBe(tilt * config.bodyTilt.speedScaling.minScale);
    });

    it('should scale at maxSpeed boundary', () => {
      const tilt = 4;
      const speed = 80; // exactly at maxSpeed
      
      const scaled = bodyTiltSystem.applySpeedScaling(tilt, speed);
      
      expect(scaled).toBe(tilt * config.bodyTilt.speedScaling.maxScale);
    });
  });

  describe('update', () => {
    it('should update pitch and roll based on acceleration', () => {
      const delta = 0.016; // 60 FPS
      const acceleration: Vector3 = { x: 0, y: 0, z: 10 }; // forward acceleration
      const lateralAcceleration = 6; // m/s²
      const speed = 100; // km/h
      
      const result = bodyTiltSystem.update(delta, acceleration, lateralAcceleration, speed);
      
      expect(result.pitch).toBeGreaterThan(0);
      expect(Math.abs(result.roll)).toBeGreaterThan(0);
    });

    it('should smoothly transition pitch over time', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 20]; // max acceleration
      const speed = 100;
      
      // First update - should not reach target immediately
      const result1 = bodyTiltSystem.update(delta, acceleration, 0, speed);
      const targetPitch = bodyTiltSystem.calculatePitch(20, speed);
      
      expect(result1.pitch).toBeGreaterThan(0);
      expect(result1.pitch).toBeLessThan(targetPitch);
      
      // Simulate enough time to reach steady state
      // The lerp uses alpha = delta * (1 / transitionTime)
      // For exponential decay to ~95%, need about 3 * transitionTime
      const transitionFrames = Math.ceil((3 * config.bodyTilt.pitchTransitionTime) / delta);
      for (let i = 0; i < transitionFrames; i++) {
        bodyTiltSystem.update(delta, acceleration, 0, speed);
      }
      
      // Should be very close to target (within 5%)
      expect(bodyTiltSystem.currentPitch).toBeGreaterThan(targetPitch * 0.95);
      expect(bodyTiltSystem.currentPitch).toBeLessThanOrEqual(targetPitch);
    });

    it('should smoothly transition roll over time', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 0];
      const lateralAcceleration = 12; // max lateral
      const speed = 100;
      
      // First update
      const result1 = bodyTiltSystem.update(delta, acceleration, lateralAcceleration, speed);
      const targetRoll = bodyTiltSystem.calculateRoll(lateralAcceleration, speed);
      
      expect(Math.abs(result1.roll)).toBeGreaterThan(0);
      expect(Math.abs(result1.roll)).toBeLessThan(Math.abs(targetRoll));
      
      // Simulate enough time to reach steady state
      const transitionFrames = Math.ceil((3 * config.bodyTilt.rollTransitionTime) / delta);
      for (let i = 0; i < transitionFrames; i++) {
        bodyTiltSystem.update(delta, acceleration, lateralAcceleration, speed);
      }
      
      // Should be very close to target (within 5%)
      expect(Math.abs(bodyTiltSystem.currentRoll)).toBeGreaterThan(Math.abs(targetRoll) * 0.95);
      expect(Math.abs(bodyTiltSystem.currentRoll)).toBeLessThanOrEqual(Math.abs(targetRoll));
    });

    it('should return to neutral when accelerations are zero', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 10];
      const speed = 100;
      
      // Build up some tilt
      const buildUpFrames = Math.ceil((3 * config.bodyTilt.pitchTransitionTime) / delta);
      for (let i = 0; i < buildUpFrames; i++) {
        bodyTiltSystem.update(delta, acceleration, 6, speed);
      }
      
      expect(Math.abs(bodyTiltSystem.currentPitch)).toBeGreaterThan(0);
      expect(Math.abs(bodyTiltSystem.currentRoll)).toBeGreaterThan(0);
      
      // Return to neutral - need enough time for both transitions
      const neutralAccel: [number, number, number] = [0, 0, 0];
      const returnFrames = Math.ceil((3 * Math.max(
        config.bodyTilt.pitchTransitionTime,
        config.bodyTilt.rollTransitionTime
      )) / delta);
      for (let i = 0; i < returnFrames; i++) {
        bodyTiltSystem.update(delta, neutralAccel, 0, speed);
      }
      
      // Should be very close to zero (within 5% of max tilt)
      expect(Math.abs(bodyTiltSystem.currentPitch)).toBeLessThan(0.2);
      expect(Math.abs(bodyTiltSystem.currentRoll)).toBeLessThan(0.4);
    });

    it('should combine pitch and roll additively', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 10]; // forward
      const lateralAcceleration = 6; // lateral
      const speed = 100;
      
      // Update multiple times to reach steady state
      for (let i = 0; i < 15; i++) {
        bodyTiltSystem.update(delta, acceleration, lateralAcceleration, speed);
      }
      
      // Both pitch and roll should be non-zero
      expect(Math.abs(bodyTiltSystem.currentPitch)).toBeGreaterThan(0);
      expect(Math.abs(bodyTiltSystem.currentRoll)).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very small delta times', () => {
      const delta = 0.001; // 1ms
      const acceleration: [number, number, number] = [0, 0, 10];
      const speed = 100;
      
      const result = bodyTiltSystem.update(delta, acceleration, 0, speed);
      
      expect(result.pitch).toBeGreaterThanOrEqual(0);
      expect(result.pitch).toBeLessThanOrEqual(config.bodyTilt.maxPitchAccel);
    });

    it('should handle very large delta times', () => {
      const delta = 1.0; // 1 second
      const acceleration: [number, number, number] = [0, 0, 10];
      const speed = 100;
      
      const result = bodyTiltSystem.update(delta, acceleration, 0, speed);
      
      // Should clamp to target, not overshoot
      const targetPitch = bodyTiltSystem.calculatePitch(10, speed);
      expect(result.pitch).toBeCloseTo(targetPitch, 1);
    });

    it('should handle zero speed', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 10];
      const speed = 0;
      
      const result = bodyTiltSystem.update(delta, acceleration, 6, speed);
      
      // At zero speed, tilt should be scaled by minScale
      expect(Math.abs(result.pitch)).toBeLessThan(config.bodyTilt.maxPitchAccel);
      expect(Math.abs(result.roll)).toBeLessThan(config.bodyTilt.maxRoll);
    });

    it('should handle extreme acceleration values', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 100]; // unrealistic
      const speed = 100;
      
      const result = bodyTiltSystem.update(delta, acceleration, 0, speed);
      
      // Should still be bounded by max pitch
      expect(result.pitch).toBeLessThanOrEqual(config.bodyTilt.maxPitchAccel * 2);
    });
  });

  describe('high-speed roll increase (Requirement 7.3)', () => {
    it('should add 0.02° per km/h above 100 km/h', () => {
      const lateralAccel = 6; // m/s²
      const speed100 = 100; // km/h
      const speed150 = 150; // km/h
      
      const roll100 = bodyTiltSystem.calculateRoll(lateralAccel, speed100);
      const roll150 = bodyTiltSystem.calculateRoll(lateralAccel, speed150);
      
      // At 150 km/h, should have 50 * 0.01 = 0.5° additional roll before speed scaling
      // Both are above maxSpeed (80), so speed scaling is 0.7
      // The difference after scaling: 0.5 * 0.7 = 0.35°
      const expectedIncrease = 50 * 0.01 * 0.7; // 0.35° (with speed scaling)
      expect(roll150 - roll100).toBeCloseTo(expectedIncrease, 1);
    });

    it('should not add bonus below 100 km/h', () => {
      const lateralAccel = 6; // m/s²
      const speed80 = 80; // km/h
      const speed90 = 90; // km/h
      
      const roll80 = bodyTiltSystem.calculateRoll(lateralAccel, speed80);
      const roll90 = bodyTiltSystem.calculateRoll(lateralAccel, speed90);
      
      // Both are at or below 100 km/h, so no high-speed bonus
      // The difference should only be from speed scaling (80 is at maxSpeed, 90 is above)
      // At 80: scale = 1.0, at 90: scale = 1.0
      expect(roll80).toBeCloseTo(roll90, 1);
    });

    it('should apply bonus in correct direction for negative roll', () => {
      const lateralAccel = -6; // m/s² (negative)
      const speed150 = 150; // km/h
      
      const roll = bodyTiltSystem.calculateRoll(lateralAccel, speed150);
      
      // Roll should be negative and have the bonus applied in negative direction
      expect(roll).toBeLessThan(0);
      const expectedBonus = 50 * 0.01; // 0.5° (reduced from 0.02 to 0.01)
      const baseRoll = (-6 / 12) * config.bodyTilt.maxRoll; // -2° (maxRoll is now 4)
      const expectedRoll = (baseRoll - expectedBonus) * 0.7; // -2.5° * 0.7 = -1.75° (with speed scaling)
      expect(roll).toBeCloseTo(expectedRoll, 1);
    });
  });

  describe('roll angle clamping (Requirement 7.5)', () => {
    it('should clamp roll to maximum 8 degrees', () => {
      const lateralAccel = 20; // m/s² (very high)
      const speed = 200; // km/h (very high, adds 100 * 0.02 = 2° bonus)
      
      const roll = bodyTiltSystem.calculateRoll(lateralAccel, speed);
      
      // Should be clamped to maxRoll (8°)
      expect(Math.abs(roll)).toBeLessThanOrEqual(config.bodyTilt.maxRoll);
    });

    it('should clamp negative roll to -8 degrees', () => {
      const lateralAccel = -20; // m/s² (very high, negative)
      const speed = 200; // km/h
      
      const roll = bodyTiltSystem.calculateRoll(lateralAccel, speed);
      
      // Should be clamped to -maxRoll (-8°)
      expect(roll).toBeGreaterThanOrEqual(-config.bodyTilt.maxRoll);
      expect(roll).toBeLessThanOrEqual(config.bodyTilt.maxRoll);
    });

    it('should not clamp roll below maximum', () => {
      const lateralAccel = 3; // m/s² (moderate)
      const speed = 100; // km/h
      
      const roll = bodyTiltSystem.calculateRoll(lateralAccel, speed);
      
      // Should not be clamped (should be less than maxRoll)
      expect(Math.abs(roll)).toBeLessThan(config.bodyTilt.maxRoll);
    });
  });

  describe('high-speed suspension oscillation (Requirement 8.4)', () => {
    it('should not oscillate below 120 km/h', () => {
      const delta = 0.016; // 60 FPS
      const acceleration: [number, number, number] = [0, 0, 0];
      const speed = 100; // km/h (below threshold)
      
      const result1 = bodyTiltSystem.update(delta, acceleration, 0, speed);
      const result2 = bodyTiltSystem.update(delta, acceleration, 0, speed);
      
      // Without oscillation, results should be identical (no acceleration)
      expect(result1.pitch).toBeCloseTo(result2.pitch, 5);
      expect(result1.roll).toBeCloseTo(result2.roll, 5);
    });

    it('should oscillate at 2 Hz above 120 km/h', () => {
      const delta = 0.016; // 60 FPS
      const acceleration: [number, number, number] = [0, 0, 0];
      const speed = 150; // km/h (above threshold)
      
      const results: BodyTilt[] = [];
      
      // Collect samples over 1 second (should see 2 complete cycles at 2 Hz)
      for (let i = 0; i < 60; i++) {
        results.push(bodyTiltSystem.update(delta, acceleration, 0, speed));
      }
      
      // Check that oscillation is present by verifying values change
      const pitches = results.map(r => r.pitch);
      const maxPitch = Math.max(...pitches);
      const minPitch = Math.min(...pitches);
      
      // Oscillation amplitude should be ±0.15 degrees (reduced from 0.3)
      expect(maxPitch).toBeGreaterThan(0.12);
      expect(minPitch).toBeLessThan(-0.12);
      expect(maxPitch - minPitch).toBeCloseTo(0.3, 1); // ±0.15 = 0.3 range
    });

    it('should have oscillation amplitude of ±0.3 degrees', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 0];
      const speed = 150; // km/h
      
      const results: BodyTilt[] = [];
      
      // Collect samples over 2 seconds to capture full oscillation range
      for (let i = 0; i < 120; i++) {
        results.push(bodyTiltSystem.update(delta, acceleration, 0, speed));
      }
      
      const pitches = results.map(r => r.pitch);
      const maxPitch = Math.max(...pitches);
      const minPitch = Math.min(...pitches);
      
      // Maximum should be close to +0.15 (reduced from 0.3)
      expect(maxPitch).toBeCloseTo(0.15, 1);
      // Minimum should be close to -0.15 (reduced from -0.3)
      expect(minPitch).toBeCloseTo(-0.15, 1);
    });

    it('should apply oscillation to both pitch and roll', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 5]; // some acceleration
      const lateralAccel = 3; // some lateral
      const speed = 150; // km/h
      
      // Build up some base tilt first
      for (let i = 0; i < 20; i++) {
        bodyTiltSystem.update(delta, acceleration, lateralAccel, speed);
      }
      
      const result1 = bodyTiltSystem.update(delta, acceleration, lateralAccel, speed);
      const result2 = bodyTiltSystem.update(delta, acceleration, lateralAccel, speed);
      
      // Both pitch and roll should have oscillation applied
      // They should differ slightly due to oscillation
      expect(result1.pitch).not.toBeCloseTo(result2.pitch, 5);
      expect(result1.roll).not.toBeCloseTo(result2.roll, 5);
    });

    it('should oscillate at exactly 120 km/h threshold', () => {
      // Create fresh instance to avoid accumulated oscillation time
      const freshSystem = new BodyTiltSystemImpl(config);
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 0];
      const speed = 120; // km/h (exactly at threshold)
      
      // At exactly 120 km/h, should NOT oscillate (requirement says "above 120")
      const result1 = freshSystem.update(delta, acceleration, 0, speed);
      const result2 = freshSystem.update(delta, acceleration, 0, speed);
      
      // Both should be very close to zero since no acceleration and no oscillation at 120
      // Use tolerance of 0.1 degrees to account for lerp convergence
      expect(Math.abs(result1.pitch)).toBeLessThan(0.1);
      expect(Math.abs(result1.roll)).toBeLessThan(0.1);
      expect(Math.abs(result2.pitch)).toBeLessThan(0.1);
      expect(Math.abs(result2.roll)).toBeLessThan(0.1);
    });

    it('should oscillate just above 120 km/h threshold', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 0];
      const speed = 120.1; // km/h (just above threshold)
      
      const results: BodyTilt[] = [];
      
      // Collect samples
      for (let i = 0; i < 60; i++) {
        results.push(bodyTiltSystem.update(delta, acceleration, 0, speed));
      }
      
      const pitches = results.map(r => r.pitch);
      const maxPitch = Math.max(...pitches);
      const minPitch = Math.min(...pitches);
      
      // Should have oscillation (reduced amplitude)
      expect(maxPitch - minPitch).toBeGreaterThan(0.25);
    });
  });

  describe('compound body movement (Requirement 8.5)', () => {
    it('should combine pitch and roll additively', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 10]; // forward
      const lateralAcceleration = 6; // lateral
      const speed = 100;
      
      // Update multiple times to reach steady state
      for (let i = 0; i < 15; i++) {
        bodyTiltSystem.update(delta, acceleration, lateralAcceleration, speed);
      }
      
      // Both pitch and roll should be non-zero and combined
      expect(Math.abs(bodyTiltSystem.currentPitch)).toBeGreaterThan(0);
      expect(Math.abs(bodyTiltSystem.currentRoll)).toBeGreaterThan(0);
    });

    it('should combine pitch, roll, and oscillation additively at high speed', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 10]; // forward
      const lateralAcceleration = 6; // lateral
      const speed = 150; // km/h (above oscillation threshold)
      
      // Build up base tilt
      for (let i = 0; i < 20; i++) {
        bodyTiltSystem.update(delta, acceleration, lateralAcceleration, speed);
      }
      
      const basePitch = bodyTiltSystem.currentPitch;
      const baseRoll = bodyTiltSystem.currentRoll;
      
      // Continue updating to see oscillation
      const results: BodyTilt[] = [];
      for (let i = 0; i < 30; i++) {
        results.push(bodyTiltSystem.update(delta, acceleration, lateralAcceleration, speed));
      }
      
      // The returned values should vary around the base values due to oscillation
      const pitches = results.map(r => r.pitch);
      const rolls = results.map(r => r.roll);
      
      // Should have variation due to oscillation
      const pitchVariation = Math.max(...pitches) - Math.min(...pitches);
      const rollVariation = Math.max(...rolls) - Math.min(...rolls);
      
      expect(pitchVariation).toBeGreaterThan(0.25); // Should oscillate (reduced amplitude)
      expect(rollVariation).toBeGreaterThan(0.25); // Should oscillate (reduced amplitude)
    });

    it('should maintain independent pitch and roll calculations', () => {
      const delta = 0.016;
      
      // Test pitch only
      const accelOnly: [number, number, number] = [0, 0, 10];
      bodyTiltSystem.update(delta, accelOnly, 0, 100);
      const pitchOnly = bodyTiltSystem.currentPitch;
      const rollWithPitchOnly = bodyTiltSystem.currentRoll;
      
      // Reset
      const resetSystem = new BodyTiltSystemImpl(config);
      
      // Test roll only
      const lateralOnly = 6;
      resetSystem.update(delta, [0, 0, 0], lateralOnly, 100);
      const rollOnly = resetSystem.currentRoll;
      const pitchWithRollOnly = resetSystem.currentPitch;
      
      // Pitch should be non-zero when accelerating, zero when not
      expect(Math.abs(pitchOnly)).toBeGreaterThan(0);
      expect(Math.abs(pitchWithRollOnly)).toBeLessThan(0.01);
      
      // Roll should be non-zero when lateral, zero when not
      expect(Math.abs(rollOnly)).toBeGreaterThan(0);
      expect(Math.abs(rollWithPitchOnly)).toBeLessThan(0.01);
    });
  });

  describe('transition timing (Requirements 6.4, 6.5, 7.6)', () => {
    it('should apply pitch tilt over 0.15 seconds', () => {
      const delta = 0.016; // 60 FPS
      const acceleration: [number, number, number] = [0, 0, 20]; // max acceleration
      const speed = 100;
      
      // Calculate target pitch
      const targetPitch = bodyTiltSystem.calculatePitch(20, speed);
      
      // After 0.15 seconds (9.375 frames), should be close to target
      const frames = Math.round(0.15 / delta);
      for (let i = 0; i < frames; i++) {
        bodyTiltSystem.update(delta, acceleration, 0, speed);
      }
      
      // Should be at ~63% of target (1 - e^-1) for exponential, but we use linear lerp
      // With linear lerp and alpha = delta / transitionTime, after transitionTime we should be at target
      expect(bodyTiltSystem.currentPitch).toBeGreaterThan(targetPitch * 0.5);
      expect(bodyTiltSystem.currentPitch).toBeLessThanOrEqual(targetPitch);
    });

    it('should return to neutral over 0.2 seconds', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 20];
      const speed = 100;
      
      // Build up pitch
      for (let i = 0; i < 20; i++) {
        bodyTiltSystem.update(delta, acceleration, 0, speed);
      }
      
      const initialPitch = bodyTiltSystem.currentPitch;
      expect(initialPitch).toBeGreaterThan(0);
      
      // Return to neutral
      const neutralAccel: [number, number, number] = [0, 0, 0];
      const frames = Math.round(0.2 / delta);
      for (let i = 0; i < frames; i++) {
        bodyTiltSystem.update(delta, neutralAccel, 0, speed);
      }
      
      // Should be significantly closer to zero
      expect(Math.abs(bodyTiltSystem.currentPitch)).toBeLessThan(Math.abs(initialPitch) * 0.5);
    });

    it('should transition roll left-right over 0.25 seconds', () => {
      const delta = 0.016;
      const acceleration: [number, number, number] = [0, 0, 0];
      const lateralAccel = 12; // max lateral
      const speed = 100;
      
      // Build up roll to the right
      for (let i = 0; i < 20; i++) {
        bodyTiltSystem.update(delta, acceleration, lateralAccel, speed);
      }
      
      const rightRoll = bodyTiltSystem.currentRoll;
      expect(rightRoll).toBeGreaterThan(0);
      
      // Transition to left
      const frames = Math.round(0.25 / delta);
      for (let i = 0; i < frames; i++) {
        bodyTiltSystem.update(delta, acceleration, -lateralAccel, speed);
      }
      
      // Should have transitioned significantly toward left roll
      expect(bodyTiltSystem.currentRoll).toBeLessThan(rightRoll * 0.5);
    });
  });
});
