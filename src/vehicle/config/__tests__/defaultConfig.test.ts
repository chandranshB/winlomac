import { describe, it, expect } from 'vitest';
import { validateVehicleConfig } from '../validation';
import { defaultVehicleConfig } from '../defaultVehicleConfig';

describe('defaultVehicleConfig', () => {
  it('should be a valid configuration', () => {
    const result = validateVehicleConfig(defaultVehicleConfig);
    
    if (!result.isValid) {
      console.error('Default configuration validation errors:', result.errors);
    }
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should have all required properties', () => {
    expect(defaultVehicleConfig).toHaveProperty('mass');
    expect(defaultVehicleConfig).toHaveProperty('dimensions');
    expect(defaultVehicleConfig).toHaveProperty('engine');
    expect(defaultVehicleConfig).toHaveProperty('transmission');
    expect(defaultVehicleConfig).toHaveProperty('drift');
    expect(defaultVehicleConfig).toHaveProperty('tires');
    expect(defaultVehicleConfig).toHaveProperty('bodyTilt');
  });

  it('should have realistic values', () => {
    // Mass should be reasonable for a car
    expect(defaultVehicleConfig.mass).toBeGreaterThan(500);
    expect(defaultVehicleConfig.mass).toBeLessThan(3000);
    
    // RPM ranges should be realistic
    expect(defaultVehicleConfig.engine.idleRPM).toBe(800);
    expect(defaultVehicleConfig.engine.redlineRPM).toBe(8000);
    
    // Drift parameters should be within spec
    expect(defaultVehicleConfig.drift.gripReduction).toBeGreaterThanOrEqual(0.4);
    expect(defaultVehicleConfig.drift.gripReduction).toBeLessThanOrEqual(0.6);
  });
});
