import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptivePerformanceManager } from '../AdaptivePerformanceManager';

describe('AdaptivePerformanceManager', () => {
  let manager: AdaptivePerformanceManager;

  beforeEach(() => {
    manager = new AdaptivePerformanceManager();
  });

  describe('initialization', () => {
    it('should start with all features enabled', () => {
      const settings = manager.getSettings();
      expect(settings.enableBodyTilt).toBe(true);
      expect(settings.enableSuspensionOscillation).toBe(true);
      expect(settings.enableDriftParticles).toBe(true);
      expect(settings.gaugeUpdateRate).toBe(30);
    });

    it('should have empty frame timings initially', () => {
      expect(manager.getAverageFrameTime()).toBe(0);
      expect(manager.getWorstFrameTime()).toBe(0);
    });
  });

  describe('frame time recording', () => {
    it('should record frame times', () => {
      manager.recordFrameTime(16);
      manager.recordFrameTime(17);
      manager.recordFrameTime(15);

      expect(manager.getAverageFrameTime()).toBeCloseTo(16, 1);
    });

    it('should calculate average frame time correctly', () => {
      for (let i = 0; i < 10; i++) {
        manager.recordFrameTime(16);
      }
      expect(manager.getAverageFrameTime()).toBe(16);
    });

    it('should track worst frame time', () => {
      manager.recordFrameTime(16);
      manager.recordFrameTime(25);
      manager.recordFrameTime(18);

      expect(manager.getWorstFrameTime()).toBe(25);
    });

    it('should limit frame timing samples to 60', () => {
      for (let i = 0; i < 100; i++) {
        manager.recordFrameTime(16);
      }
      // Should only keep last 60 samples
      expect(manager.getAverageFrameTime()).toBe(16);
    });
  });

  describe('quality degradation', () => {
    it('should degrade quality when frame time exceeds 20ms', () => {
      // Fill with 60 samples above threshold
      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(22);
      }

      const settings = manager.getSettings();
      // First degradation: disable suspension oscillation
      expect(settings.enableSuspensionOscillation).toBe(false);
    });

    it('should degrade quality in correct order', () => {
      // First degradation: suspension oscillation
      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(22);
      }
      expect(manager.getSettings().enableSuspensionOscillation).toBe(false);

      // Second degradation: gauge update rate
      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(22);
      }
      expect(manager.getSettings().gaugeUpdateRate).toBe(15);

      // Third degradation: drift particles
      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(22);
      }
      expect(manager.getSettings().enableDriftParticles).toBe(false);

      // Fourth degradation: body tilt (critical)
      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(22);
      }
      expect(manager.getSettings().enableBodyTilt).toBe(false);
    });

    it('should not degrade before collecting 60 samples', () => {
      for (let i = 0; i < 30; i++) {
        manager.recordFrameTime(25);
      }

      const settings = manager.getSettings();
      expect(settings.enableSuspensionOscillation).toBe(true);
    });
  });

  describe('quality improvement', () => {
    it('should improve quality when frame time below 14ms', () => {
      // First degrade
      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(22);
      }
      expect(manager.getSettings().enableSuspensionOscillation).toBe(false);

      // Then improve
      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(12);
      }
      expect(manager.getSettings().enableSuspensionOscillation).toBe(true);
    });

    it('should improve quality in reverse order of degradation', () => {
      // Degrade all the way
      for (let i = 0; i < 240; i++) {
        manager.recordFrameTime(22);
      }
      expect(manager.getSettings().enableBodyTilt).toBe(false);

      // Improve step by step
      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(12);
      }
      expect(manager.getSettings().enableBodyTilt).toBe(true);

      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(12);
      }
      expect(manager.getSettings().enableDriftParticles).toBe(true);

      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(12);
      }
      expect(manager.getSettings().gaugeUpdateRate).toBe(30);

      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(12);
      }
      expect(manager.getSettings().enableSuspensionOscillation).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all settings to defaults', () => {
      // Degrade quality
      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(22);
      }

      manager.reset();

      const settings = manager.getSettings();
      expect(settings.enableBodyTilt).toBe(true);
      expect(settings.enableSuspensionOscillation).toBe(true);
      expect(settings.enableDriftParticles).toBe(true);
      expect(settings.gaugeUpdateRate).toBe(30);
    });

    it('should clear frame timings', () => {
      for (let i = 0; i < 10; i++) {
        manager.recordFrameTime(16);
      }

      manager.reset();

      expect(manager.getAverageFrameTime()).toBe(0);
      expect(manager.getWorstFrameTime()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle stable frame times (no degradation or improvement)', () => {
      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(16);
      }

      const settings = manager.getSettings();
      expect(settings.enableBodyTilt).toBe(true);
      expect(settings.enableSuspensionOscillation).toBe(true);
      expect(settings.enableDriftParticles).toBe(true);
      expect(settings.gaugeUpdateRate).toBe(30);
    });

    it('should handle frame times at threshold boundaries', () => {
      // Exactly at degrade threshold (20ms)
      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(20);
      }
      // Should not degrade at exactly 20ms
      expect(manager.getSettings().enableSuspensionOscillation).toBe(true);

      manager.reset();

      // Just above degrade threshold
      for (let i = 0; i < 60; i++) {
        manager.recordFrameTime(20.1);
      }
      expect(manager.getSettings().enableSuspensionOscillation).toBe(false);
    });

    it('should not improve beyond maximum quality', () => {
      // Already at max quality
      for (let i = 0; i < 120; i++) {
        manager.recordFrameTime(12);
      }

      const settings = manager.getSettings();
      expect(settings.enableBodyTilt).toBe(true);
      expect(settings.enableSuspensionOscillation).toBe(true);
      expect(settings.enableDriftParticles).toBe(true);
      expect(settings.gaugeUpdateRate).toBe(30);
    });

    it('should not degrade beyond minimum quality', () => {
      // Degrade all the way
      for (let i = 0; i < 300; i++) {
        manager.recordFrameTime(25);
      }

      const settings = manager.getSettings();
      expect(settings.enableBodyTilt).toBe(false);
      expect(settings.enableSuspensionOscillation).toBe(false);
      expect(settings.enableDriftParticles).toBe(false);
      expect(settings.gaugeUpdateRate).toBe(15);
    });
  });
});
