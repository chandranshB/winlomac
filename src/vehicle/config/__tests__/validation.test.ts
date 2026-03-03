import { describe, it, expect } from 'vitest';
import { validateVehicleConfig } from '../validation';
import { defaultVehicleConfig } from '../defaultVehicleConfig';
import type { VehicleConfig } from '../../types';

describe('validateVehicleConfig', () => {
  describe('valid configurations', () => {
    it('should accept the default vehicle configuration', () => {
      const result = validateVehicleConfig(defaultVehicleConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept a minimal valid configuration', () => {
      const config: VehicleConfig = {
        mass: 1000,
        dimensions: { width: 1.8, height: 1.4, length: 4.5 },
        centerOfMassHeight: 0.5,
        engine: {
          idleRPM: 800,
          redlineRPM: 8000,
          revLimiterRPM: 7500,
          torqueCurve: [
            { rpm: 800, torqueMultiplier: 0.3 },
            { rpm: 8000, torqueMultiplier: 0.7 }
          ]
        },
        transmission: {
          gearRatios: [3.5, 2.5],
          reverseRatio: 3.8,
          finalDrive: 3.7,
          shiftTime: 0.2
        },
        maxSpeed: 200,
        acceleration: 1.0,
        braking: 1.0,
        steering: {
          baseTurnSpeed: 2.5,
          speedSensitivity: 0.5
        },
        drift: {
          entrySpeedThreshold: 40,
          entrySteeringThreshold: 20,
          gripReduction: 0.5,
          counterSteerAssist: 0.6,
          minSlipAngle: 15,
          maxSlipAngle: 45,
          spinoutThreshold: 50,
          exitTransitionTime: 0.3
        },
        tires: {
          baseGripCoefficient: 1.0,
          lateralGripCurve: [
            { slipAngle: 0, gripPercent: 1.0 },
            { slipAngle: 90, gripPercent: 0.6 }
          ],
          driftGripCurve: [
            { slipAngle: 0, gripPercent: 0.6 },
            { slipAngle: 90, gripPercent: 0.5 }
          ]
        },
        bodyTilt: {
          maxPitchAccel: 3,
          maxPitchBrake: 4,
          maxRoll: 8,
          pitchTransitionTime: 0.15,
          rollTransitionTime: 0.25,
          speedScaling: {
            minSpeed: 30,
            maxSpeed: 80,
            minScale: 0.5,
            maxScale: 1.0
          }
        }
      };

      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('invalid mass', () => {
    it('should reject mass below 500 kg', () => {
      const config = { ...defaultVehicleConfig, mass: 400 };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid mass: 400. Must be between 500-3000 kg');
    });

    it('should reject mass above 3000 kg', () => {
      const config = { ...defaultVehicleConfig, mass: 3500 };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid mass: 3500. Must be between 500-3000 kg');
    });
  });

  describe('invalid RPM ranges', () => {
    it('should reject idle RPM >= redline RPM', () => {
      const config = {
        ...defaultVehicleConfig,
        engine: {
          ...defaultVehicleConfig.engine,
          idleRPM: 8000,
          redlineRPM: 8000
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Idle RPM must be less than redline RPM');
    });

    it('should reject idle RPM below 500', () => {
      const config = {
        ...defaultVehicleConfig,
        engine: {
          ...defaultVehicleConfig.engine,
          idleRPM: 300
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid idleRPM: 300. Must be between 500-2000 RPM');
    });

    it('should reject redline RPM above 10000', () => {
      const config = {
        ...defaultVehicleConfig,
        engine: {
          ...defaultVehicleConfig.engine,
          redlineRPM: 12000
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid redlineRPM: 12000. Must be between 5000-10000 RPM');
    });
  });

  describe('invalid torque curve', () => {
    it('should reject torque curve with less than 2 points', () => {
      const config = {
        ...defaultVehicleConfig,
        engine: {
          ...defaultVehicleConfig.engine,
          torqueCurve: [{ rpm: 800, torqueMultiplier: 0.5 }]
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Torque curve must have at least 2 points');
    });

    it('should reject torque curve with non-ascending RPM values', () => {
      const config = {
        ...defaultVehicleConfig,
        engine: {
          ...defaultVehicleConfig.engine,
          torqueCurve: [
            { rpm: 2000, torqueMultiplier: 0.5 },
            { rpm: 1000, torqueMultiplier: 0.3 }
          ]
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Torque curve RPM values must be in ascending order at index 1');
    });

    it('should reject torque multiplier outside 0-1 range', () => {
      const config = {
        ...defaultVehicleConfig,
        engine: {
          ...defaultVehicleConfig.engine,
          torqueCurve: [
            { rpm: 800, torqueMultiplier: 0.5 },
            { rpm: 8000, torqueMultiplier: 1.5 }
          ]
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid torque multiplier at index 1: 1.5. Must be between 0-1');
    });
  });

  describe('invalid drift parameters', () => {
    it('should reject grip reduction below 0.4', () => {
      const config = {
        ...defaultVehicleConfig,
        drift: {
          ...defaultVehicleConfig.drift,
          gripReduction: 0.3
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid gripReduction: 0.3. Must be between 0.4-0.6');
    });

    it('should reject grip reduction above 0.6', () => {
      const config = {
        ...defaultVehicleConfig,
        drift: {
          ...defaultVehicleConfig.drift,
          gripReduction: 0.8
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid gripReduction: 0.8. Must be between 0.4-0.6');
    });

    it('should reject minSlipAngle >= maxSlipAngle', () => {
      const config = {
        ...defaultVehicleConfig,
        drift: {
          ...defaultVehicleConfig.drift,
          minSlipAngle: 50,
          maxSlipAngle: 45
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('minSlipAngle must be less than maxSlipAngle');
    });
  });

  describe('invalid gear ratios', () => {
    it('should reject non-descending gear ratios', () => {
      const config = {
        ...defaultVehicleConfig,
        transmission: {
          ...defaultVehicleConfig.transmission,
          gearRatios: [2.5, 3.5, 1.8] // Second gear higher than first
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Gear ratios must be in descending order at index 1');
    });

    it('should reject too many gears', () => {
      const config = {
        ...defaultVehicleConfig,
        transmission: {
          ...defaultVehicleConfig.transmission,
          gearRatios: [4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.2, 1.0, 0.8] // 9 gears
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid number of gears: 9. Must be between 1-8');
    });
  });

  describe('invalid grip curves', () => {
    it('should reject lateral grip curve with less than 2 points', () => {
      const config = {
        ...defaultVehicleConfig,
        tires: {
          ...defaultVehicleConfig.tires,
          lateralGripCurve: [{ slipAngle: 0, gripPercent: 1.0 }]
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Lateral grip curve must have at least 2 points');
    });

    it('should reject drift grip curve with non-ascending slip angles', () => {
      const config = {
        ...defaultVehicleConfig,
        tires: {
          ...defaultVehicleConfig.tires,
          driftGripCurve: [
            { slipAngle: 20, gripPercent: 0.8 },
            { slipAngle: 10, gripPercent: 0.6 }
          ]
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Drift grip curve slip angles must be in ascending order at index 1');
    });
  });

  describe('invalid body tilt parameters', () => {
    it('should reject minSpeed >= maxSpeed in speed scaling', () => {
      const config = {
        ...defaultVehicleConfig,
        bodyTilt: {
          ...defaultVehicleConfig.bodyTilt,
          speedScaling: {
            minSpeed: 100,
            maxSpeed: 80,
            minScale: 0.5,
            maxScale: 1.0
          }
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('speedScaling.minSpeed must be less than speedScaling.maxSpeed');
    });

    it('should reject invalid maxRoll', () => {
      const config = {
        ...defaultVehicleConfig,
        bodyTilt: {
          ...defaultVehicleConfig.bodyTilt,
          maxRoll: 35
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid maxRoll: 35. Must be between 0-30 degrees');
    });
  });

  describe('missing required fields', () => {
    it('should handle missing nested properties gracefully', () => {
      const config = {
        ...defaultVehicleConfig,
        engine: {
          ...defaultVehicleConfig.engine,
          torqueCurve: []
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Torque curve must have at least 2 points');
    });
  });

  describe('multiple validation errors', () => {
    it('should return all validation errors', () => {
      const config = {
        ...defaultVehicleConfig,
        mass: 400, // Invalid
        engine: {
          ...defaultVehicleConfig.engine,
          idleRPM: 9000, // Invalid (>= redline)
          redlineRPM: 8000
        },
        drift: {
          ...defaultVehicleConfig.drift,
          gripReduction: 0.8 // Invalid
        }
      };
      const result = validateVehicleConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Invalid mass: 400. Must be between 500-3000 kg');
      expect(result.errors).toContain('Idle RPM must be less than redline RPM');
      expect(result.errors).toContain('Invalid gripReduction: 0.8. Must be between 0.4-0.6');
    });
  });
});
