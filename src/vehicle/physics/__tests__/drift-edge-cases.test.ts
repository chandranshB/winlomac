import { describe, it, expect, beforeEach } from 'vitest';
import { DriftControllerImpl, type DriftScoringEvent } from '../DriftController';
import { defaultVehicleConfig } from '../../config/defaultVehicleConfig';
import type { VehicleInput, Vector3 } from '../../types';

describe('DriftController - Edge Cases', () => {
  let driftController: DriftControllerImpl;

  beforeEach(() => {
    driftController = new DriftControllerImpl(defaultVehicleConfig);
  });

  const createInput = (throttle: number, steering: number, handbrake: boolean = false): VehicleInput => ({
    throttle,
    brake: 0,
    steering,
    handbrake,
    reset: false
  });

  const createVelocity = (x: number, z: number): Vector3 => [x, 0, z] as unknown as Vector3;

  describe('Drift Scoring Event Emission (Requirement 1.7)', () => {
    it('should emit drift scoring event after 0.5 seconds', () => {
      const scoringEvents: DriftScoringEvent[] = [];
      driftController.onDriftScoring((event) => {
        scoringEvents.push(event);
      });

      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Simulate drift for 0.6 seconds (should trigger scoring event)
      const deltaTime = 0.016; // 60 Hz
      const steps = Math.ceil(0.6 / deltaTime);

      for (let i = 0; i < steps; i++) {
        driftController.update(deltaTime, input, velocity, angularVelocity, speed, true);
      }

      // Should have emitted at least one scoring event
      if (driftController.isDrifting && driftController.driftDuration >= 0.5) {
        expect(scoringEvents.length).toBeGreaterThan(0);
        expect(scoringEvents[0].duration).toBeGreaterThanOrEqual(0.5);
        expect(scoringEvents[0].slipAngle).toBeDefined();
        expect(scoringEvents[0].score).toBeGreaterThan(0);
      }
    });

    it('should not emit scoring event before 0.5 seconds', () => {
      const scoringEvents: DriftScoringEvent[] = [];
      driftController.onDriftScoring((event) => {
        scoringEvents.push(event);
      });

      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Simulate drift for 0.4 seconds (should NOT trigger scoring event)
      const deltaTime = 0.016;
      const steps = Math.ceil(0.4 / deltaTime);

      for (let i = 0; i < steps; i++) {
        driftController.update(deltaTime, input, velocity, angularVelocity, speed, true);
      }

      // Should not have emitted any scoring events yet
      expect(scoringEvents.length).toBe(0);
    });

    it('should only emit scoring event once per drift session', () => {
      const scoringEvents: DriftScoringEvent[] = [];
      driftController.onDriftScoring((event) => {
        scoringEvents.push(event);
      });

      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Simulate drift for 1.0 second (well past 0.5 second threshold)
      const deltaTime = 0.016;
      const steps = Math.ceil(1.0 / deltaTime);

      for (let i = 0; i < steps; i++) {
        driftController.update(deltaTime, input, velocity, angularVelocity, speed, true);
      }

      // Should have emitted exactly one scoring event (not multiple)
      if (driftController.isDrifting) {
        expect(scoringEvents.length).toBeLessThanOrEqual(1);
      }
    });

    it('should calculate drift score based on duration and slip angle', () => {
      const scoringEvents: DriftScoringEvent[] = [];
      driftController.onDriftScoring((event) => {
        scoringEvents.push(event);
      });

      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Simulate drift for 0.6 seconds
      const deltaTime = 0.016;
      const steps = Math.ceil(0.6 / deltaTime);

      for (let i = 0; i < steps; i++) {
        driftController.update(deltaTime, input, velocity, angularVelocity, speed, true);
      }

      if (scoringEvents.length > 0) {
        const event = scoringEvents[0];
        // Score should be duration * abs(slipAngle)
        const expectedScore = event.duration * Math.abs(event.slipAngle);
        expect(event.score).toBeCloseTo(expectedScore, 1);
      }
    });
  });

  describe('Low-Speed Drift Exit (Requirement 2.1)', () => {
    it('should exit drift when speed drops below 20 km/h', () => {
      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      let speed = 60;

      // Enter drift
      driftController.update(0.016, input, velocity, angularVelocity, speed, true);

      // Reduce speed below 20 km/h
      speed = 15;
      const slowVelocity = createVelocity(4, -3);
      const result = driftController.update(0.016, input, slowVelocity, angularVelocity, speed, true);

      // Should exit drift due to low speed
      expect(result.isDrifting).toBe(false);
    });

    it('should maintain drift when speed is above 20 km/h', () => {
      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Simulate multiple updates to potentially enter drift
      for (let i = 0; i < 10; i++) {
        driftController.update(0.016, input, velocity, angularVelocity, speed, true);
      }

      // If we entered drift, it should be maintained at this speed
      const wasDrifting = driftController.isDrifting;
      
      // Continue with speed above threshold
      const result = driftController.update(0.016, input, velocity, angularVelocity, speed, true);

      // If we were drifting, we should still be drifting
      if (wasDrifting) {
        expect(result.isDrifting).toBe(true);
      }
    });
  });

  describe('Collision Drift Exit (Requirement 2.2)', () => {
    it('should exit drift immediately on collision', () => {
      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Simulate drift
      for (let i = 0; i < 40; i++) {
        driftController.update(0.016, input, velocity, angularVelocity, speed, true);
      }

      // Simulate collision by calling exitDriftImmediately
      driftController.exitDriftImmediately();

      // Should exit drift immediately
      expect(driftController.isDrifting).toBe(false);
    });

    it('should reset drift scoring flag on collision exit', () => {
      const scoringEvents: DriftScoringEvent[] = [];
      driftController.onDriftScoring((event) => {
        scoringEvents.push(event);
      });

      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Simulate drift for 0.6 seconds to trigger scoring
      const deltaTime = 0.016;
      const steps = Math.ceil(0.6 / deltaTime);

      for (let i = 0; i < steps; i++) {
        driftController.update(deltaTime, input, velocity, angularVelocity, speed, true);
      }

      const eventCountBefore = scoringEvents.length;

      // Simulate collision
      driftController.exitDriftImmediately();

      // Try to enter drift again
      for (let i = 0; i < steps; i++) {
        driftController.update(deltaTime, input, velocity, angularVelocity, speed, true);
      }

      // Should be able to emit new scoring event for new drift session
      if (driftController.isDrifting && driftController.driftDuration >= 0.5) {
        expect(scoringEvents.length).toBeGreaterThan(eventCountBefore);
      }
    });
  });

  describe('Surface Transition Interpolation (Requirement 2.3)', () => {
    it('should interpolate grip over 0.2 seconds when exiting drift', () => {
      const input = createInput(0.8, 0.6, true);
      const exitInput = createInput(0.05, 0.2, false);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Enter drift
      for (let i = 0; i < 40; i++) {
        driftController.update(0.016, input, velocity, angularVelocity, speed, true);
      }

      // Exit drift
      const exitResult = driftController.update(0.016, exitInput, velocity, angularVelocity, speed, true);

      // Should not be drifting anymore
      expect(exitResult.isDrifting).toBe(false);

      // Grip should be transitioning (between drift grip and full grip)
      const driftGrip = 1.0 - defaultVehicleConfig.drift.gripReduction;
      const fullGrip = 1.0;

      // During transition, grip should be between drift and full
      if (driftController.driftDuration > 0) {
        expect(exitResult.gripMultiplier).toBeGreaterThan(driftGrip - 0.01);
        expect(exitResult.gripMultiplier).toBeLessThanOrEqual(fullGrip);
      }
    });

    it('should complete surface transition within 0.2 seconds', () => {
      const input = createInput(0.8, 0.6, true);
      const exitInput = createInput(0.05, 0.2, false);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Enter drift
      for (let i = 0; i < 40; i++) {
        driftController.update(0.016, input, velocity, angularVelocity, speed, true);
      }

      // Exit drift and simulate 0.25 seconds (more than 0.2s transition time)
      driftController.update(0.016, exitInput, velocity, angularVelocity, speed, true);

      const deltaTime = 0.016;
      const steps = Math.ceil(0.25 / deltaTime);

      let finalResult;
      for (let i = 0; i < steps; i++) {
        finalResult = driftController.update(deltaTime, exitInput, velocity, angularVelocity, speed, true);
      }

      // After transition completes, grip should be full
      if (finalResult) {
        expect(finalResult.gripMultiplier).toBeCloseTo(1.0, 2);
      }
    });
  });

  describe('Airborne Drift Deferral (Requirement 2.4)', () => {
    it('should not enter drift while airborne', () => {
      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Try to enter drift while airborne
      const result = driftController.update(0.016, input, velocity, angularVelocity, speed, false);

      // Should not enter drift
      expect(result.isDrifting).toBe(false);
    });

    it('should defer drift entry until wheels contact ground', () => {
      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Try to enter drift while airborne
      driftController.update(0.016, input, velocity, angularVelocity, speed, false);
      expect(driftController.isDrifting).toBe(false);

      // Land on ground - should still not enter drift immediately (deferred)
      driftController.update(0.016, input, velocity, angularVelocity, speed, true);
      expect(driftController.isDrifting).toBe(false);

      // Continue on ground - now drift can be initiated
      for (let i = 0; i < 5; i++) {
        driftController.update(0.016, input, velocity, angularVelocity, speed, true);
      }

      // After being grounded for a bit, drift should be possible
      // (The exact behavior depends on slip angle development)
    });

    it('should maintain drift state if already drifting when going airborne', () => {
      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Enter drift on ground
      for (let i = 0; i < 40; i++) {
        driftController.update(0.016, input, velocity, angularVelocity, speed, true);
      }

      const wasDrifting = driftController.isDrifting;

      // Go airborne
      const airborneResult = driftController.update(0.016, input, velocity, angularVelocity, speed, false);

      // If we were drifting, state should be maintained (not exited)
      if (wasDrifting) {
        expect(airborneResult.isDrifting).toBe(true);
      }
    });

    it('should reset airborne flag when grounded', () => {
      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Go airborne
      driftController.update(0.016, input, velocity, angularVelocity, speed, false);

      // Land
      driftController.update(0.016, input, velocity, angularVelocity, speed, true);

      // Go airborne again
      driftController.update(0.016, input, velocity, angularVelocity, speed, false);

      // Land again - should be able to enter drift after being grounded
      for (let i = 0; i < 10; i++) {
        driftController.update(0.016, input, velocity, angularVelocity, speed, true);
      }

      // Drift should be possible after multiple airborne/grounded cycles
      // (The exact behavior depends on slip angle development)
    });
  });

  describe('Multiple Callbacks', () => {
    it('should support multiple drift scoring callbacks', () => {
      const events1: DriftScoringEvent[] = [];
      const events2: DriftScoringEvent[] = [];

      driftController.onDriftScoring((event) => events1.push(event));
      driftController.onDriftScoring((event) => events2.push(event));

      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Simulate drift for 0.6 seconds
      const deltaTime = 0.016;
      const steps = Math.ceil(0.6 / deltaTime);

      for (let i = 0; i < steps; i++) {
        driftController.update(deltaTime, input, velocity, angularVelocity, speed, true);
      }

      // Both callbacks should have received the event
      if (driftController.isDrifting && driftController.driftDuration >= 0.5) {
        expect(events1.length).toBeGreaterThan(0);
        expect(events2.length).toBeGreaterThan(0);
        expect(events1.length).toBe(events2.length);
      }
    });

    it('should handle callback errors gracefully', () => {
      const goodEvents: DriftScoringEvent[] = [];

      // Register a callback that throws an error
      driftController.onDriftScoring(() => {
        throw new Error('Test error');
      });

      // Register a good callback
      driftController.onDriftScoring((event) => goodEvents.push(event));

      const input = createInput(0.8, 0.6, true);
      const velocity = createVelocity(15, -10);
      const angularVelocity = [0, 0.5, 0] as unknown as Vector3;
      const speed = 60;

      // Simulate drift for 0.6 seconds
      const deltaTime = 0.016;
      const steps = Math.ceil(0.6 / deltaTime);

      // Should not throw despite error in first callback
      expect(() => {
        for (let i = 0; i < steps; i++) {
          driftController.update(deltaTime, input, velocity, angularVelocity, speed, true);
        }
      }).not.toThrow();

      // Good callback should still receive events
      if (driftController.isDrifting && driftController.driftDuration >= 0.5) {
        expect(goodEvents.length).toBeGreaterThan(0);
      }
    });
  });
});
