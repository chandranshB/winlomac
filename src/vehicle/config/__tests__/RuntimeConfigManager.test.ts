import { describe, it, expect, vi } from 'vitest';
import { RuntimeConfigManager } from '../RuntimeConfigManager';
import { ConfigLoader } from '../ConfigLoader';
import { defaultVehicleConfig } from '../defaultVehicleConfig';

describe('RuntimeConfigManager', () => {
  describe('parameter adjustment methods', () => {
    it('should adjust drift parameters', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const result = manager.adjustDrift('gripReduction', 0.55);
      
      expect(result.isValid).toBe(true);
      expect(manager.getConfig().drift.gripReduction).toBe(0.55);
    });
    
    it('should adjust engine parameters', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const result = manager.adjustEngine('redlineRPM', 7500);
      
      expect(result.isValid).toBe(true);
      expect(manager.getConfig().engine.redlineRPM).toBe(7500);
    });
    
    it('should adjust tire parameters', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const result = manager.adjustTires('baseGripCoefficient', 1.2);
      
      expect(result.isValid).toBe(true);
      expect(manager.getConfig().tires.baseGripCoefficient).toBe(1.2);
    });
    
    it('should adjust body tilt parameters', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const result = manager.adjustBodyTilt('maxRoll', 10);
      
      expect(result.isValid).toBe(true);
      expect(manager.getConfig().bodyTilt.maxRoll).toBe(10);
    });
    
    it('should adjust steering parameters', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const result = manager.adjustSteering('baseTurnSpeed', 3.0);
      
      expect(result.isValid).toBe(true);
      expect(manager.getConfig().steering.baseTurnSpeed).toBe(3.0);
    });
    
    it('should adjust transmission parameters', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const result = manager.adjustTransmission('finalDrive', 4.0);
      
      expect(result.isValid).toBe(true);
      expect(manager.getConfig().transmission.finalDrive).toBe(4.0);
    });
    
    it('should validate adjusted parameters', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const result = manager.adjustDrift('gripReduction', 0.9); // Invalid
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('adjustParameter', () => {
    it('should adjust any parameter using dot notation', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const result = manager.adjustParameter('mass', 1500);
      
      expect(result.isValid).toBe(true);
      expect(manager.getConfig().mass).toBe(1500);
    });
    
    it('should add successful adjustments to history', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      manager.adjustParameter('mass', 1500);
      manager.adjustParameter('drift.gripReduction', 0.55);
      
      const history = manager.getHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].path).toBe('mass');
      expect(history[0].value).toBe(1500);
      expect(history[1].path).toBe('drift.gripReduction');
      expect(history[1].value).toBe(0.55);
    });
    
    it('should not add failed adjustments to history', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      manager.adjustParameter('mass', 1500);
      manager.adjustParameter('mass', 5000); // Invalid
      
      const history = manager.getHistory();
      
      expect(history).toHaveLength(1);
      expect(history[0].value).toBe(1500);
    });
  });
  
  describe('batchUpdate', () => {
    it('should update multiple parameters at once', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const result = manager.batchUpdate([
        { path: 'mass', value: 1500 },
        { path: 'drift.gripReduction', value: 0.55 },
        { path: 'engine.redlineRPM', value: 7500 }
      ]);
      
      expect(result.isValid).toBe(true);
      expect(manager.getConfig().mass).toBe(1500);
      expect(manager.getConfig().drift.gripReduction).toBe(0.55);
      expect(manager.getConfig().engine.redlineRPM).toBe(7500);
    });
    
    it('should reject batch if any parameter is invalid', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      const originalMass = manager.getConfig().mass;
      
      const result = manager.batchUpdate([
        { path: 'mass', value: 1500 },
        { path: 'drift.gripReduction', value: 0.9 } // Invalid
      ]);
      
      expect(result.isValid).toBe(false);
      // Neither parameter should be updated
      expect(manager.getConfig().mass).toBe(originalMass);
    });
    
    it('should add all batch updates to history on success', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      manager.batchUpdate([
        { path: 'mass', value: 1500 },
        { path: 'drift.gripReduction', value: 0.55 }
      ]);
      
      const history = manager.getHistory();
      
      expect(history).toHaveLength(2);
    });
    
    it('should not add to history if batch fails', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      manager.batchUpdate([
        { path: 'mass', value: 1500 },
        { path: 'drift.gripReduction', value: 0.9 } // Invalid
      ]);
      
      const history = manager.getHistory();
      
      expect(history).toHaveLength(0);
    });
    
    it('should handle invalid paths in batch', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const result = manager.batchUpdate([
        { path: 'mass', value: 1500 },
        { path: 'invalid.path', value: 100 }
      ]);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid parameter path');
    });
  });
  
  describe('history management', () => {
    it('should track parameter adjustment history', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      manager.adjustParameter('mass', 1500);
      manager.adjustParameter('mass', 1600);
      manager.adjustParameter('mass', 1700);
      
      const history = manager.getHistory();
      
      expect(history).toHaveLength(3);
      expect(history[0].value).toBe(1500);
      expect(history[1].value).toBe(1600);
      expect(history[2].value).toBe(1700);
    });
    
    it('should include timestamps in history', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      const before = Date.now();
      
      manager.adjustParameter('mass', 1500);
      
      const history = manager.getHistory();
      const after = Date.now();
      
      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });
    
    it('should clear history', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      manager.adjustParameter('mass', 1500);
      manager.adjustParameter('mass', 1600);
      manager.clearHistory();
      
      const history = manager.getHistory();
      
      expect(history).toHaveLength(0);
    });
    
    it('should limit history size', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      // Add more than max history size (50)
      for (let i = 0; i < 60; i++) {
        manager.adjustParameter('mass', 1000 + i);
      }
      
      const history = manager.getHistory();
      
      expect(history.length).toBeLessThanOrEqual(50);
      // Should keep most recent entries
      expect(history[history.length - 1].value).toBe(1059);
    });
  });
  
  describe('undo', () => {
    it('should undo last parameter adjustment', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      manager.adjustParameter('mass', 1500);
      manager.adjustParameter('mass', 1600);
      
      const result = manager.undo();
      
      expect(result.isValid).toBe(true);
      expect(manager.getConfig().mass).toBe(1500);
    });
    
    it('should fail if no history to undo', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const result = manager.undo();
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('No previous parameter');
    });
    
    it('should fail if only one entry in history', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      manager.adjustParameter('mass', 1500);
      
      const result = manager.undo();
      
      expect(result.isValid).toBe(false);
    });
  });
  
  describe('presets', () => {
    it('should create preset from current config', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      manager.adjustParameter('mass', 1500);
      manager.adjustParameter('drift.gripReduction', 0.55);
      
      const preset = manager.createPreset('My Preset');
      
      expect(preset.name).toBe('My Preset');
      expect(preset.config.mass).toBe(1500);
      expect(preset.config.drift.gripReduction).toBe(0.55);
      expect(preset.timestamp).toBeDefined();
    });
    
    it('should load preset configuration', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const preset = manager.createPreset('Test');
      
      // Change config
      manager.adjustParameter('mass', 1500);
      
      // Load preset (should restore original)
      const result = manager.loadPreset(preset);
      
      expect(result.isValid).toBe(true);
      expect(manager.getConfig().mass).toBe(defaultVehicleConfig.mass);
    });
    
    it('should validate preset before loading', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      const invalidPreset = {
        name: 'Invalid',
        config: { ...defaultVehicleConfig, mass: 5000 }, // Invalid
        timestamp: Date.now()
      };
      
      const result = manager.loadPreset(invalidPreset);
      
      expect(result.isValid).toBe(false);
    });
  });
  
  describe('onConfigChange', () => {
    it('should register callback for config changes', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      const callback = vi.fn();
      
      manager.onConfigChange(callback);
      manager.adjustParameter('mass', 1500);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(manager.getConfig());
    });
    
    it('should return unsubscribe function', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      const callback = vi.fn();
      
      const unsubscribe = manager.onConfigChange(callback);
      unsubscribe();
      manager.adjustParameter('mass', 1500);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
  
  describe('integration', () => {
    it('should handle complex tuning workflow', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      
      // Initial tuning
      manager.adjustDrift('gripReduction', 0.55);
      manager.adjustEngine('redlineRPM', 7500);
      
      // Create preset
      const preset1 = manager.createPreset('Setup 1');
      
      // More tuning
      manager.adjustDrift('gripReduction', 0.45);
      manager.adjustBodyTilt('maxRoll', 10);
      
      // Create another preset
      const preset2 = manager.createPreset('Setup 2');
      
      // Load first preset
      manager.loadPreset(preset1);
      
      expect(manager.getConfig().drift.gripReduction).toBe(0.55);
      expect(manager.getConfig().engine.redlineRPM).toBe(7500);
      
      // Load second preset
      manager.loadPreset(preset2);
      
      expect(manager.getConfig().drift.gripReduction).toBe(0.45);
      expect(manager.getConfig().bodyTilt.maxRoll).toBe(10);
    });
    
    it('should maintain consistency with batch updates', () => {
      const loader = new ConfigLoader();
      const manager = new RuntimeConfigManager(loader);
      const callback = vi.fn();
      
      manager.onConfigChange(callback);
      
      // Batch update should trigger callback once
      manager.batchUpdate([
        { path: 'mass', value: 1500 },
        { path: 'drift.gripReduction', value: 0.55 }
      ]);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(manager.getConfig().mass).toBe(1500);
      expect(manager.getConfig().drift.gripReduction).toBe(0.55);
    });
  });
});
