import { describe, it, expect } from 'vitest';
import { defaultVehicleConfig } from '../../config/defaultVehicleConfig';

describe('Project Setup', () => {
  it('should load default vehicle config', () => {
    expect(defaultVehicleConfig).toBeDefined();
    expect(defaultVehicleConfig.mass).toBe(1200);
    expect(defaultVehicleConfig.engine.idleRPM).toBe(800);
    expect(defaultVehicleConfig.engine.redlineRPM).toBe(8000);
  });

  it('should have valid torque curve', () => {
    expect(defaultVehicleConfig.engine.torqueCurve.length).toBeGreaterThan(0);
    expect(defaultVehicleConfig.engine.torqueCurve[0].rpm).toBe(800);
  });

  it('should have valid drift parameters', () => {
    expect(defaultVehicleConfig.drift.gripReduction).toBeGreaterThanOrEqual(0.4);
    expect(defaultVehicleConfig.drift.gripReduction).toBeLessThanOrEqual(0.6);
  });
});
