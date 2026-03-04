import type { VehicleConfig } from '../types';
import { ConfigLoader } from './ConfigLoader';
import type { ValidationResult } from './validation';

/**
 * Runtime configuration manager for easy parameter adjustments.
 * Provides a convenient interface for tuning physics parameters during development.
 * 
 * Requirements:
 * - 11.3: Allow runtime adjustment of physics parameters through debug interface
 * - 11.4: Apply new parameters within one physics update cycle
 */
export class RuntimeConfigManager {
  private configLoader: ConfigLoader;
  private parameterHistory: Array<{ path: string; value: unknown; timestamp: number }> = [];
  private maxHistorySize = 50;
  
  constructor(configLoader: ConfigLoader) {
    this.configLoader = configLoader;
  }
  
  /**
   * Get the current configuration.
   */
  getConfig(): VehicleConfig {
    return this.configLoader.getConfig();
  }
  
  /**
   * Adjust a drift parameter.
   */
  adjustDrift(param: keyof VehicleConfig['drift'], value: number): ValidationResult {
    return this.adjustParameter(`drift.${param}`, value);
  }
  
  /**
   * Adjust an engine parameter.
   */
  adjustEngine(param: keyof VehicleConfig['engine'], value: number | any[]): ValidationResult {
    return this.adjustParameter(`engine.${param}`, value);
  }
  
  /**
   * Adjust a tire parameter.
   */
  adjustTires(param: keyof VehicleConfig['tires'], value: number | any[]): ValidationResult {
    return this.adjustParameter(`tires.${param}`, value);
  }
  
  /**
   * Adjust a body tilt parameter.
   */
  adjustBodyTilt(param: keyof VehicleConfig['bodyTilt'], value: number | any): ValidationResult {
    return this.adjustParameter(`bodyTilt.${param}`, value);
  }
  
  /**
   * Adjust a steering parameter.
   */
  adjustSteering(param: keyof VehicleConfig['steering'], value: number): ValidationResult {
    return this.adjustParameter(`steering.${param}`, value);
  }
  
  /**
   * Adjust a transmission parameter.
   */
  adjustTransmission(param: keyof VehicleConfig['transmission'], value: number | number[]): ValidationResult {
    return this.adjustParameter(`transmission.${param}`, value);
  }
  
  /**
   * Adjust any parameter using dot notation.
   */
  adjustParameter(path: string, value: unknown): ValidationResult {
    const result = this.configLoader.updateParameter(path, value);
    
    if (result.isValid) {
      this.addToHistory(path, value);
    }
    
    return result;
  }
  
  /**
   * Batch update multiple parameters at once.
   * All parameters are validated together before applying.
   */
  batchUpdate(updates: Array<{ path: string; value: unknown }>): ValidationResult {
    const currentConfig = this.configLoader.getConfig();
    const newConfig = JSON.parse(JSON.stringify(currentConfig)) as VehicleConfig;
    
    // Apply all updates to a copy
    for (const update of updates) {
      const pathParts = update.path.split('.');
      let current: any = newConfig;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (current[pathParts[i]] === undefined) {
          return {
            isValid: false,
            errors: [`Invalid parameter path: ${update.path}`]
          };
        }
        current = current[pathParts[i]];
      }
      
      const lastKey = pathParts[pathParts.length - 1];
      if (current[lastKey] === undefined) {
        return {
          isValid: false,
          errors: [`Invalid parameter path: ${update.path}`]
        };
      }
      
      current[lastKey] = update.value;
    }
    
    // Validate and apply all at once
    const result = this.configLoader.updatePartialConfig(newConfig);
    
    if (result.isValid) {
      for (const update of updates) {
        this.addToHistory(update.path, update.value);
      }
    }
    
    return result;
  }
  
  /**
   * Get parameter adjustment history.
   */
  getHistory(): Array<{ path: string; value: unknown; timestamp: number }> {
    return [...this.parameterHistory];
  }
  
  /**
   * Clear parameter adjustment history.
   */
  clearHistory(): void {
    this.parameterHistory = [];
  }
  
  /**
   * Undo the last parameter adjustment.
   * Note: This only works if the previous value is still in history.
   */
  undo(): ValidationResult {
    if (this.parameterHistory.length < 2) {
      return {
        isValid: false,
        errors: ['No previous parameter to undo to']
      };
    }
    
    // Remove the last entry
    this.parameterHistory.pop();
    
    // Get the previous entry
    const previous = this.parameterHistory[this.parameterHistory.length - 1];
    
    // Apply it (without adding to history again)
    return this.configLoader.updateParameter(previous.path, previous.value);
  }
  
  /**
   * Create a preset from current configuration.
   */
  createPreset(name: string): ConfigPreset {
    return {
      name,
      config: this.configLoader.getConfig(),
      timestamp: Date.now()
    };
  }
  
  /**
   * Load a preset configuration.
   */
  loadPreset(preset: ConfigPreset): ValidationResult {
    return this.configLoader.updatePartialConfig(preset.config);
  }
  
  /**
   * Register a callback for configuration changes.
   */
  onConfigChange(callback: (config: VehicleConfig) => void): () => void {
    return this.configLoader.onConfigChange(callback);
  }
  
  /**
   * Add a parameter change to history.
   */
  private addToHistory(path: string, value: unknown): void {
    this.parameterHistory.push({
      path,
      value,
      timestamp: Date.now()
    });
    
    // Limit history size
    if (this.parameterHistory.length > this.maxHistorySize) {
      this.parameterHistory.shift();
    }
  }
}

/**
 * Configuration preset for saving and loading tuned configurations.
 */
export interface ConfigPreset {
  name: string;
  config: VehicleConfig;
  timestamp: number;
}
