import { describe, it, expect, vi } from 'vitest';
import { ConfigLoader } from '../ConfigLoader';
import { defaultVehicleConfig } from '../defaultVehicleConfig';
import type { VehicleConfig } from '../../types';

describe('ConfigLoader', () => {
  describe('loadFromJSON', () => {
    it('should load valid JSON configuration', () => {
      const loader = new ConfigLoader();
      const config = { ...defaultVehicleConfig, mass: 1500 };
      const jsonString = JSON.stringify(config);
      
      const result = loader.loadFromJSON(jsonString);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(loader.getConfig().mass).toBe(1500);
    });
    
    it('should reject invalid JSON', () => {
      const loader = new ConfigLoader();
      const invalidJSON = '{ invalid json }';
      
      const result = loader.loadFromJSON(invalidJSON);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to parse JSON');
    });
    
    it('should reject configuration with invalid parameters', () => {
      const loader = new ConfigLoader();
      const invalidConfig = { ...defaultVehicleConfig, mass: 5000 }; // Too heavy
      const jsonString = JSON.stringify(invalidConfig);
      
      const result = loader.loadFromJSON(jsonString);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('mass');
    });
    
    it('should not update config if validation fails', () => {
      const loader = new ConfigLoader();
      const originalMass = loader.getConfig().mass;
      const invalidConfig = { ...defaultVehicleConfig, mass: 5000 };
      const jsonString = JSON.stringify(invalidConfig);
      
      loader.loadFromJSON(jsonString);
      
      expect(loader.getConfig().mass).toBe(originalMass);
    });
  });
  
  describe('updatePartialConfig', () => {
    it('should merge partial config with current config', () => {
      const loader = new ConfigLoader();
      const originalIdleRPM = loader.getConfig().engine.idleRPM;
      
      const result = loader.updatePartialConfig({
        mass: 1500,
        engine: {
          ...loader.getConfig().engine,
          redlineRPM: 7500
        }
      });
      
      expect(result.isValid).toBe(true);
      expect(loader.getConfig().mass).toBe(1500);
      expect(loader.getConfig().engine.redlineRPM).toBe(7500);
      expect(loader.getConfig().engine.idleRPM).toBe(originalIdleRPM); // Unchanged
    });
    
    it('should validate merged config', () => {
      const loader = new ConfigLoader();
      
      const result = loader.updatePartialConfig({
        drift: {
          ...loader.getConfig().drift,
          gripReduction: 0.9 // Invalid: must be 0.4-0.6
        }
      });
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('updateParameter', () => {
    it('should update a top-level parameter', () => {
      const loader = new ConfigLoader();
      
      const result = loader.updateParameter('mass', 1500);
      
      expect(result.isValid).toBe(true);
      expect(loader.getConfig().mass).toBe(1500);
    });
    
    it('should update a nested parameter using dot notation', () => {
      const loader = new ConfigLoader();
      
      const result = loader.updateParameter('drift.gripReduction', 0.55);
      
      expect(result.isValid).toBe(true);
      expect(loader.getConfig().drift.gripReduction).toBe(0.55);
    });
    
    it('should update deeply nested parameters', () => {
      const loader = new ConfigLoader();
      
      const result = loader.updateParameter('bodyTilt.speedScaling.minSpeed', 40);
      
      expect(result.isValid).toBe(true);
      expect(loader.getConfig().bodyTilt.speedScaling.minSpeed).toBe(40);
    });
    
    it('should reject invalid parameter paths', () => {
      const loader = new ConfigLoader();
      
      const result = loader.updateParameter('invalid.path.here', 100);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid parameter path');
    });
    
    it('should validate parameter value', () => {
      const loader = new ConfigLoader();
      
      const result = loader.updateParameter('drift.gripReduction', 0.9); // Invalid
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should not update if validation fails', () => {
      const loader = new ConfigLoader();
      const originalValue = loader.getConfig().drift.gripReduction;
      
      loader.updateParameter('drift.gripReduction', 0.9);
      
      expect(loader.getConfig().drift.gripReduction).toBe(originalValue);
    });
  });
  
  describe('onConfigChange', () => {
    it('should notify callback when config changes', () => {
      const loader = new ConfigLoader();
      const callback = vi.fn();
      
      loader.onConfigChange(callback);
      loader.updateParameter('mass', 1500);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(loader.getConfig());
    });
    
    it('should notify multiple callbacks', () => {
      const loader = new ConfigLoader();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      loader.onConfigChange(callback1);
      loader.onConfigChange(callback2);
      loader.updateParameter('mass', 1500);
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
    
    it('should not notify callback after unsubscribe', () => {
      const loader = new ConfigLoader();
      const callback = vi.fn();
      
      const unsubscribe = loader.onConfigChange(callback);
      unsubscribe();
      loader.updateParameter('mass', 1500);
      
      expect(callback).not.toHaveBeenCalled();
    });
    
    it('should not notify callback if validation fails', () => {
      const loader = new ConfigLoader();
      const callback = vi.fn();
      
      loader.onConfigChange(callback);
      loader.updateParameter('mass', 5000); // Invalid
      
      expect(callback).not.toHaveBeenCalled();
    });
    
    it('should apply config changes within one cycle (Requirement 11.4)', () => {
      const loader = new ConfigLoader();
      let capturedConfig: VehicleConfig | null = null;
      
      loader.onConfigChange((config) => {
        capturedConfig = config;
      });
      
      loader.updateParameter('mass', 1500);
      
      // Config should be immediately available in callback
      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.mass).toBe(1500);
    });
  });
  
  describe('exportToJSON', () => {
    it('should export config as JSON string', () => {
      const loader = new ConfigLoader();
      loader.updateParameter('mass', 1500);
      
      const jsonString = loader.exportToJSON(false);
      const parsed = JSON.parse(jsonString);
      
      expect(parsed.mass).toBe(1500);
    });
    
    it('should export pretty-printed JSON when requested', () => {
      const loader = new ConfigLoader();
      
      const prettyJSON = loader.exportToJSON(true);
      const compactJSON = loader.exportToJSON(false);
      
      expect(prettyJSON.length).toBeGreaterThan(compactJSON.length);
      expect(prettyJSON).toContain('\n');
    });
  });
  
  describe('resetToDefault', () => {
    it('should reset config to default values', () => {
      const loader = new ConfigLoader();
      loader.updateParameter('mass', 1500);
      
      const result = loader.resetToDefault();
      
      expect(result.isValid).toBe(true);
      expect(loader.getConfig().mass).toBe(defaultVehicleConfig.mass);
    });
    
    it('should notify callbacks on reset', () => {
      const loader = new ConfigLoader();
      const callback = vi.fn();
      
      loader.onConfigChange(callback);
      loader.updateParameter('mass', 1500);
      callback.mockClear();
      
      loader.resetToDefault();
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('loadFromFile', () => {
    it('should load config from File object', async () => {
      const loader = new ConfigLoader();
      const config = { ...defaultVehicleConfig, mass: 1500 };
      const jsonString = JSON.stringify(config);
      const file = new File([jsonString], 'config.json', { type: 'application/json' });
      
      const result = await loader.loadFromFile(file);
      
      expect(result.isValid).toBe(true);
      expect(loader.getConfig().mass).toBe(1500);
    });
    
    it('should handle file read errors', async () => {
      const loader = new ConfigLoader();
      // Create a mock file that will fail to read
      const badFile = {
        text: () => Promise.reject(new Error('Read error'))
      } as File;
      
      const result = await loader.loadFromFile(badFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Failed to read file');
    });
  });
  
  describe('integration', () => {
    it('should handle multiple sequential updates', () => {
      const loader = new ConfigLoader();
      
      loader.updateParameter('mass', 1500);
      loader.updateParameter('drift.gripReduction', 0.55);
      loader.updateParameter('engine.redlineRPM', 7500);
      
      expect(loader.getConfig().mass).toBe(1500);
      expect(loader.getConfig().drift.gripReduction).toBe(0.55);
      expect(loader.getConfig().engine.redlineRPM).toBe(7500);
    });
    
    it('should maintain config consistency across operations', () => {
      const loader = new ConfigLoader();
      const callback = vi.fn();
      
      loader.onConfigChange(callback);
      
      // Valid update
      loader.updateParameter('mass', 1500);
      expect(callback).toHaveBeenCalledTimes(1);
      
      // Invalid update
      loader.updateParameter('mass', 5000);
      expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
      
      // Config should still have valid value
      expect(loader.getConfig().mass).toBe(1500);
    });
  });
});
