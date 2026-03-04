# Performance Optimization Module

This module provides adaptive performance management and simplified physics for remote vehicles to maintain target frame rates and reduce computational load.

## Components

### AdaptivePerformanceManager

Monitors frame time and automatically adjusts quality settings to maintain 60 FPS target.

**Features:**
- Tracks frame time over 60-sample rolling window
- Degrades quality when average frame time exceeds 20ms (below 50 FPS)
- Improves quality when average frame time below 14ms (above 70 FPS)
- Adjustable LOD settings for visual effects

**Quality Settings:**
1. **Body Tilt** - Vehicle body rotation from weight transfer and centrifugal forces
2. **Suspension Oscillation** - High-speed suspension dynamics (±0.3° at 2 Hz)
3. **Drift Particles** - Visual particle effects during drifting
4. **Gauge Update Rate** - HUD gauge refresh rate (30 Hz or 15 Hz)

**Degradation Order:**
1. Disable suspension oscillation (least noticeable)
2. Reduce gauge update rate to 15 Hz
3. Disable drift particles
4. Disable body tilt (critical performance issue)

**Usage:**

```typescript
import { AdaptivePerformanceManager } from './vehicle/performance';

const perfManager = new AdaptivePerformanceManager();

// In render loop
function render(delta: number) {
  const frameTimeMs = delta * 1000;
  perfManager.recordFrameTime(frameTimeMs);
  
  const settings = perfManager.getSettings();
  
  // Apply settings to visual systems
  if (settings.enableBodyTilt) {
    updateBodyTilt();
  }
  
  if (settings.enableSuspensionOscillation) {
    updateSuspensionOscillation();
  }
  
  if (settings.enableDriftParticles) {
    updateDriftParticles();
  }
  
  gaugeSystem.setUpdateRate(settings.gaugeUpdateRate);
}
```

**Performance Metrics:**

```typescript
// Get average frame time
const avgFrameTime = perfManager.getAverageFrameTime();
console.log(`Average: ${avgFrameTime.toFixed(2)}ms`);

// Get worst frame time
const worstFrameTime = perfManager.getWorstFrameTime();
console.log(`Worst: ${worstFrameTime.toFixed(2)}ms`);

// Reset tracking
perfManager.reset();
```

### RemoteVehiclePhysics

Simplified physics calculations for remote vehicles to reduce CPU load in multiplayer scenarios.

**Features:**
- Position/rotation interpolation only (no complex physics)
- Approximate body tilt from velocity (cheap linear approximation)
- Skips drift detection, tire model, RPM simulation
- 50ms interpolation duration (matches 20 Hz network updates)

**Simplifications:**
- **Body Roll**: Linear approximation from lateral velocity (~0.1°/m/s, max ±8°)
- **Body Pitch**: Linear approximation from speed (~0.02°/m/s, max -4° to 3°)
- **No Drift Physics**: Remote vehicles don't calculate slip angles or grip reduction
- **No Tire Model**: Remote vehicles don't simulate tire forces
- **No RPM Simulation**: Remote vehicles use received RPM values directly

**Usage:**

```typescript
import { RemoteVehiclePhysics } from './vehicle/performance';
import type { NetworkVehicleState } from './vehicle/types';

const remotePhysics = new RemoteVehiclePhysics();

// When receiving network update (20 Hz)
function onNetworkUpdate(networkState: NetworkVehicleState) {
  remotePhysics.updateFromNetwork(networkState);
}

// In render loop (60 Hz)
function render(delta: number) {
  const state = remotePhysics.update(delta);
  
  // Apply to remote vehicle mesh
  mesh.position.set(...state.position);
  mesh.quaternion.set(...state.rotation);
  
  // Apply approximate body tilt
  mesh.rotation.x += state.bodyPitch * (Math.PI / 180);
  mesh.rotation.z += state.bodyRoll * (Math.PI / 180);
}
```

**State Management:**

```typescript
// Get current state without updating
const currentState = remotePhysics.getCurrentState();

// Reset to initial state
remotePhysics.reset();
```

## Performance Impact

### Local Vehicle (Full Physics)
- **CPU Time**: ~2ms per vehicle per frame
- **Features**: Full drift physics, tire model, RPM simulation, body tilt

### Remote Vehicle (Simplified Physics)
- **CPU Time**: ~0.1ms per vehicle per frame (20x faster)
- **Features**: Position/rotation interpolation, approximate body tilt only

### Adaptive Quality
- **Target**: 60 FPS (16.67ms per frame)
- **Degrade Threshold**: 50 FPS (20ms per frame)
- **Improve Threshold**: 70 FPS (14ms per frame)

## Requirements

**Validates:**
- Requirement 10.1: Physics update at 60 Hz
- Requirement 10.6: Performance warning logging
- Requirement 12.3: Remote vehicle position/rotation interpolation
- Requirement 12.4: Remote vehicle body tilt calculation

## Testing

Run tests with:

```bash
npm test -- src/vehicle/performance/__tests__/
```

**Test Coverage:**
- AdaptivePerformanceManager: 17 tests
- RemoteVehiclePhysics: 16 tests
- Total: 33 tests

## Integration

The performance module integrates with:
- **PhysicsController**: Uses AdaptivePerformanceManager to monitor frame time
- **NetworkSyncManager**: Uses RemoteVehiclePhysics for remote vehicles
- **BodyTiltSystem**: Respects enableBodyTilt setting
- **GaugeSystem**: Respects gaugeUpdateRate setting
- **Visual Effects**: Respects enableSuspensionOscillation and enableDriftParticles settings
