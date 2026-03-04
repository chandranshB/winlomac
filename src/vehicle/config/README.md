# Vehicle Configuration System

This directory contains the vehicle configuration system with hot-reload support for runtime parameter adjustments.

## Features

- **JSON Configuration Loading**: Load vehicle configurations from JSON files
- **Runtime Parameter Adjustment**: Modify physics parameters at runtime with validation
- **Hot-Reload**: Changes apply within one physics update cycle
- **Parameter Validation**: All changes are validated before being applied
- **History Tracking**: Track parameter adjustments with undo support
- **Presets**: Save and load configuration presets

## Usage

### Basic Configuration Loading

```typescript
import { ConfigLoader } from './config';

const loader = new ConfigLoader();

// Load from JSON string
const jsonConfig = '{"mass": 1500, "drift": {"gripReduction": 0.55}}';
const result = loader.loadFromJSON(jsonConfig);

if (result.isValid) {
  console.log('Configuration loaded successfully');
} else {
  console.error('Validation errors:', result.errors);
}
```

### Runtime Parameter Adjustment

```typescript
import { ConfigLoader, RuntimeConfigManager } from './config';

const loader = new ConfigLoader();
const manager = new RuntimeConfigManager(loader);

// Adjust specific parameters
manager.adjustDrift('gripReduction', 0.55);
manager.adjustEngine('redlineRPM', 7500);
manager.adjustBodyTilt('maxRoll', 10);

// Or use dot notation for any parameter
manager.adjustParameter('mass', 1500);
manager.adjustParameter('bodyTilt.speedScaling.minSpeed', 40);
```

### Batch Updates

```typescript
// Update multiple parameters atomically
const result = manager.batchUpdate([
  { path: 'mass', value: 1500 },
  { path: 'drift.gripReduction', value: 0.55 },
  { path: 'engine.redlineRPM', value: 7500 }
]);

// All parameters are validated together
// If any fails, none are applied
```

### Configuration Change Callbacks

```typescript
// Register callback for immediate notification (one-cycle application)
const unsubscribe = loader.onConfigChange((config) => {
  console.log('Config updated:', config);
  // Update physics systems with new config
  physicsController.updateConfig(config);
});

// Unsubscribe when done
unsubscribe();
```

### Presets

```typescript
// Create preset from current configuration
const driftSetup = manager.createPreset('Drift Setup');

// Make changes
manager.adjustDrift('gripReduction', 0.45);

// Load preset to restore previous configuration
manager.loadPreset(driftSetup);
```

### History and Undo

```typescript
// Adjust parameters
manager.adjustParameter('mass', 1500);
manager.adjustParameter('mass', 1600);

// View history
const history = manager.getHistory();
console.log(history); // [{ path: 'mass', value: 1500, timestamp: ... }, ...]

// Undo last change
manager.undo(); // Reverts to mass: 1500

// Clear history
manager.clearHistory();
```

### File Loading (Browser)

```typescript
// Load from file input
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const result = await loader.loadFromFile(file);
  
  if (result.isValid) {
    console.log('Configuration loaded from file');
  }
});
```

### Export Configuration

```typescript
// Export current config as JSON
const jsonString = loader.exportToJSON(true); // Pretty-printed

// Save to file or send to server
const blob = new Blob([jsonString], { type: 'application/json' });
const url = URL.createObjectURL(blob);
// ... download logic
```

## Integration with Physics Systems

```typescript
import { ConfigLoader, RuntimeConfigManager } from './config';
import { PhysicsController } from '../physics/PhysicsController';

// Initialize
const loader = new ConfigLoader();
const manager = new RuntimeConfigManager(loader);
const physics = new PhysicsController(loader.getConfig());

// Subscribe to config changes for hot-reload
loader.onConfigChange((config) => {
  // Physics systems will use new config on next update cycle
  physics.updateConfig(config);
});

// Now any parameter adjustment will automatically update physics
manager.adjustDrift('gripReduction', 0.55);
// Physics will use new grip reduction on next frame
```

## Validation

All parameter changes are validated before being applied:

```typescript
const result = manager.adjustDrift('gripReduction', 0.9); // Invalid: must be 0.4-0.6

if (!result.isValid) {
  console.error('Validation failed:', result.errors);
  // Original config is unchanged
}
```

## Requirements Satisfied

- **11.1**: Load vehicle parameters from configuration file
- **11.3**: Allow runtime adjustment of physics parameters through debug interface
- **11.4**: Apply new parameters within one physics update cycle
- **11.5**: Validate all configuration parameters against defined ranges

## Files

- `ConfigLoader.ts` - Core configuration loading and hot-reload system
- `RuntimeConfigManager.ts` - Convenient interface for runtime parameter adjustments
- `validation.ts` - Configuration validation logic
- `defaultVehicleConfig.ts` - Default vehicle configuration values
- `index.ts` - Public API exports
