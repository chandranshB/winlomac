import type { VehicleConfig } from '../types';
import { validateVehicleConfig, type ValidationResult } from './validation';
import { defaultVehicleConfig } from './defaultVehicleConfig';

/**
 * Configuration loader with hot-reload support.
 * Handles loading vehicle configurations from JSON files and runtime parameter adjustments.
 * 
 * Requirements:
 * - 11.1: Load vehicle parameters from configuration file
 * - 11.3: Allow runtime adjustment of physics parameters
 * - 11.4: Apply new parameters within one physics update cycle
 */
export class ConfigLoader {
  private currentConfig: VehicleConfig;
  private configChangeCallbacks: Array<(config: VehicleConfig) => void> = [];
  
  constructor(initialConfig: VehicleConfig = defaultVehicleConfig) {
    this.currentConfig = { ...initialConfig };
  }
  
  /**
   * Get the current vehicle configuration.
   */
  getConfig(): VehicleConfig {
    return this.currentConfig;
  }
  
  /**
   * Load configuration from a JSON string.
   * Validates the configuration before applying it.
   * 
   * @param jsonString - JSON string containing vehicle configuration
   * @returns ValidationResult indicating success or failure with error messages
   */
  loadFromJSON(jsonString: string): ValidationResult {
    try {
      const parsedConfig = JSON.parse(jsonString) as VehicleConfig;
      return this.updateConfig(parsedConfig);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
  
  /**
   * Load configuration from a JSON file (browser environment).
   * 
   * @param file - File object containing JSON configuration
   * @returns Promise resolving to ValidationResult
   */
  async loadFromFile(file: File): Promise<ValidationResult> {
    try {
      const text = await file.text();
      return this.loadFromJSON(text);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
  
  /**
   * Update configuration with a partial config object.
   * Merges the partial config with the current config and validates.
   * 
   * @param partialConfig - Partial configuration to merge
   * @returns ValidationResult indicating success or failure
   */
  updatePartialConfig(partialConfig: Partial<VehicleConfig>): ValidationResult {
    const mergedConfig = this.deepMerge(this.currentConfig, partialConfig);
    return this.updateConfig(mergedConfig);
  }
  
  /**
   * Update a specific parameter at runtime.
   * Uses dot notation for nested properties (e.g., "engine.idleRPM").
   * 
   * @param path - Dot-notation path to the parameter (e.g., "drift.gripReduction")
   * @param value - New value for the parameter
   * @returns ValidationResult indicating success or failure
   */
  updateParameter(path: string, value: unknown): ValidationResult {
    const pathParts = path.split('.');
    const newConfig = JSON.parse(JSON.stringify(this.currentConfig)) as VehicleConfig;
    
    // Navigate to the nested property
    let current: any = newConfig;
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (current[pathParts[i]] === undefined) {
        return {
          isValid: false,
          errors: [`Invalid parameter path: ${path}`]
        };
      }
      current = current[pathParts[i]];
    }
    
    // Set the value
    const lastKey = pathParts[pathParts.length - 1];
    if (current[lastKey] === undefined) {
      return {
        isValid: false,
        errors: [`Invalid parameter path: ${path}`]
      };
    }
    
    current[lastKey] = value;
    
    // Validate and apply
    return this.updateConfig(newConfig);
  }
  
  /**
   * Update the entire configuration.
   * Validates the new configuration and applies it if valid.
   * Notifies all registered callbacks on successful update.
   * 
   * @param newConfig - New vehicle configuration
   * @returns ValidationResult indicating success or failure
   */
  private updateConfig(newConfig: VehicleConfig): ValidationResult {
    // Validate the new configuration
    const validationResult = validateVehicleConfig(newConfig);
    
    if (!validationResult.isValid) {
      return validationResult;
    }
    
    // Apply the new configuration
    this.currentConfig = newConfig;
    
    // Notify all callbacks (one-cycle parameter application - Requirement 11.4)
    this.notifyConfigChange();
    
    return validationResult;
  }
  
  /**
   * Register a callback to be notified when configuration changes.
   * The callback will be invoked immediately when config is updated,
   * ensuring one-cycle parameter application (Requirement 11.4).
   * 
   * @param callback - Function to call when configuration changes
   * @returns Unsubscribe function
   */
  onConfigChange(callback: (config: VehicleConfig) => void): () => void {
    this.configChangeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.configChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.configChangeCallbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * Notify all registered callbacks of configuration change.
   */
  private notifyConfigChange(): void {
    for (const callback of this.configChangeCallbacks) {
      callback(this.currentConfig);
    }
  }
  
  /**
   * Export current configuration as JSON string.
   * 
   * @param pretty - Whether to format the JSON with indentation
   * @returns JSON string representation of current config
   */
  exportToJSON(pretty: boolean = true): string {
    return JSON.stringify(this.currentConfig, null, pretty ? 2 : 0);
  }
  
  /**
   * Reset configuration to default values.
   */
  resetToDefault(): ValidationResult {
    return this.updateConfig({ ...defaultVehicleConfig });
  }
  
  /**
   * Deep merge two objects, with source overriding target.
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}
