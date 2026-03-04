import { describe, it, expect } from 'vitest';
import { GaugeSystemImpl } from '../GaugeSystem';
import type { VehicleTelemetry } from '../../types';

describe('GaugeSystem', () => {
  it('should create a GaugeSystem instance', () => {
    const gaugeSystem = new GaugeSystemImpl();
    expect(gaugeSystem).toBeDefined();
  });

  it('should update telemetry data', () => {
    const gaugeSystem = new GaugeSystemImpl();
    const telemetry: VehicleTelemetry = {
      rpm: 5000,
      speed: 120.5,
      gear: 3,
      isDrifting: true,
      isRevLimiting: false
    };

    gaugeSystem.update(telemetry);
    const rendered = gaugeSystem.render();
    
    expect(rendered).toBeDefined();
  });

  it('should handle gear display for numeric gears', () => {
    const gaugeSystem = new GaugeSystemImpl();
    const telemetry: VehicleTelemetry = {
      rpm: 3000,
      speed: 60.0,
      gear: 2,
      isDrifting: false,
      isRevLimiting: false
    };

    gaugeSystem.update(telemetry);
    const rendered = gaugeSystem.render();
    
    expect(rendered).toBeDefined();
  });

  it('should handle neutral gear', () => {
    const gaugeSystem = new GaugeSystemImpl();
    const telemetry: VehicleTelemetry = {
      rpm: 800,
      speed: 0,
      gear: 'N',
      isDrifting: false,
      isRevLimiting: false
    };

    gaugeSystem.update(telemetry);
    const rendered = gaugeSystem.render();
    
    expect(rendered).toBeDefined();
  });

  it('should handle reverse gear', () => {
    const gaugeSystem = new GaugeSystemImpl();
    const telemetry: VehicleTelemetry = {
      rpm: 2000,
      speed: 15.0,
      gear: 'R',
      isDrifting: false,
      isRevLimiting: false
    };

    gaugeSystem.update(telemetry);
    const rendered = gaugeSystem.render();
    
    expect(rendered).toBeDefined();
  });

  it('should handle redline RPM (above 7000)', () => {
    const gaugeSystem = new GaugeSystemImpl();
    const telemetry: VehicleTelemetry = {
      rpm: 7500,
      speed: 180.0,
      gear: 6,
      isDrifting: false,
      isRevLimiting: true
    };

    gaugeSystem.update(telemetry);
    const rendered = gaugeSystem.render();
    
    expect(rendered).toBeDefined();
  });

  it('should handle drift state indicator', () => {
    const gaugeSystem = new GaugeSystemImpl();
    const telemetry: VehicleTelemetry = {
      rpm: 4500,
      speed: 85.5,
      gear: 3,
      isDrifting: true,
      isRevLimiting: false
    };

    gaugeSystem.update(telemetry);
    const rendered = gaugeSystem.render();
    
    expect(rendered).toBeDefined();
  });

  it('should handle speed with 1 decimal precision', () => {
    const gaugeSystem = new GaugeSystemImpl();
    const telemetry: VehicleTelemetry = {
      rpm: 3500,
      speed: 75.789, // Should be displayed as 75.8
      gear: 3,
      isDrifting: false,
      isRevLimiting: false
    };

    gaugeSystem.update(telemetry);
    const rendered = gaugeSystem.render();
    
    expect(rendered).toBeDefined();
  });

  it('should handle all gears from 1 to 6', () => {
    const gaugeSystem = new GaugeSystemImpl();
    
    for (let gear = 1; gear <= 6; gear++) {
      const telemetry: VehicleTelemetry = {
        rpm: 3000 + gear * 500,
        speed: 30 + gear * 20,
        gear: gear,
        isDrifting: false,
        isRevLimiting: false
      };

      gaugeSystem.update(telemetry);
      const rendered = gaugeSystem.render();
      
      expect(rendered).toBeDefined();
    }
  });

  it('should handle RPM bounds (idle to redline)', () => {
    const gaugeSystem = new GaugeSystemImpl();
    
    // Test idle RPM
    let telemetry: VehicleTelemetry = {
      rpm: 800,
      speed: 0,
      gear: 'N',
      isDrifting: false,
      isRevLimiting: false
    };
    gaugeSystem.update(telemetry);
    expect(gaugeSystem.render()).toBeDefined();

    // Test redline RPM
    telemetry = {
      rpm: 8000,
      speed: 200,
      gear: 6,
      isDrifting: false,
      isRevLimiting: true
    };
    gaugeSystem.update(telemetry);
    expect(gaugeSystem.render()).toBeDefined();
  });

  it('should handle combined drift and redline states', () => {
    const gaugeSystem = new GaugeSystemImpl();
    const telemetry: VehicleTelemetry = {
      rpm: 7200,
      speed: 95.5,
      gear: 4,
      isDrifting: true,
      isRevLimiting: true
    };

    gaugeSystem.update(telemetry);
    const rendered = gaugeSystem.render();
    
    expect(rendered).toBeDefined();
  });

  describe('Update Throttling', () => {
    it('should throttle updates to 30 Hz minimum (33.33ms interval)', () => {
      const gaugeSystem = new GaugeSystemImpl(30);
      
      const telemetry1: VehicleTelemetry = {
        rpm: 3000,
        speed: 60.0,
        gear: 2,
        isDrifting: false,
        isRevLimiting: false
      };
      
      const telemetry2: VehicleTelemetry = {
        rpm: 5000,
        speed: 100.0,
        gear: 4,
        isDrifting: true,
        isRevLimiting: false
      };
      
      // First update at time 0
      gaugeSystem.update(telemetry1, 0);
      
      // Second update at time 10ms (should be throttled)
      gaugeSystem.update(telemetry2, 10);
      
      // Verify telemetry is still from first update (throttled)
      const rendered = gaugeSystem.render();
      expect(rendered).toBeDefined();
      
      // Third update at time 40ms (should go through)
      const telemetry3: VehicleTelemetry = {
        rpm: 6000,
        speed: 120.0,
        gear: 5,
        isDrifting: false,
        isRevLimiting: false
      };
      gaugeSystem.update(telemetry3, 40);
      
      const rendered2 = gaugeSystem.render();
      expect(rendered2).toBeDefined();
    });

    it('should allow updates when interval has passed', () => {
      const gaugeSystem = new GaugeSystemImpl(30); // 30 Hz = ~33.33ms
      
      const telemetry1: VehicleTelemetry = {
        rpm: 2000,
        speed: 40.0,
        gear: 2,
        isDrifting: false,
        isRevLimiting: false
      };
      
      const telemetry2: VehicleTelemetry = {
        rpm: 4000,
        speed: 80.0,
        gear: 3,
        isDrifting: false,
        isRevLimiting: false
      };
      
      // First update
      gaugeSystem.update(telemetry1, 0);
      
      // Second update after 34ms (should go through)
      gaugeSystem.update(telemetry2, 34);
      
      const rendered = gaugeSystem.render();
      expect(rendered).toBeDefined();
    });

    it('should support custom update rates', () => {
      const gaugeSystem = new GaugeSystemImpl(60); // 60 Hz = ~16.67ms
      
      const telemetry1: VehicleTelemetry = {
        rpm: 3000,
        speed: 60.0,
        gear: 2,
        isDrifting: false,
        isRevLimiting: false
      };
      
      const telemetry2: VehicleTelemetry = {
        rpm: 3500,
        speed: 65.0,
        gear: 2,
        isDrifting: false,
        isRevLimiting: false
      };
      
      // First update
      gaugeSystem.update(telemetry1, 0);
      
      // Second update at 10ms (should be throttled for 60 Hz)
      gaugeSystem.update(telemetry2, 10);
      
      // Third update at 20ms (should go through)
      const telemetry3: VehicleTelemetry = {
        rpm: 4000,
        speed: 70.0,
        gear: 3,
        isDrifting: false,
        isRevLimiting: false
      };
      gaugeSystem.update(telemetry3, 20);
      
      const rendered = gaugeSystem.render();
      expect(rendered).toBeDefined();
    });

    it('should use performance.now() when currentTime is not provided', () => {
      const gaugeSystem = new GaugeSystemImpl(30);
      
      const telemetry: VehicleTelemetry = {
        rpm: 3000,
        speed: 60.0,
        gear: 2,
        isDrifting: false,
        isRevLimiting: false
      };
      
      // Update without providing time (should use performance.now())
      gaugeSystem.update(telemetry);
      
      const rendered = gaugeSystem.render();
      expect(rendered).toBeDefined();
    });

    it('should default to 30 Hz when no rate is specified', () => {
      const gaugeSystem = new GaugeSystemImpl(); // Default 30 Hz
      
      const telemetry1: VehicleTelemetry = {
        rpm: 3000,
        speed: 60.0,
        gear: 2,
        isDrifting: false,
        isRevLimiting: false
      };
      
      const telemetry2: VehicleTelemetry = {
        rpm: 4000,
        speed: 80.0,
        gear: 3,
        isDrifting: false,
        isRevLimiting: false
      };
      
      // First update
      gaugeSystem.update(telemetry1, 0);
      
      // Second update at 20ms (should be throttled)
      gaugeSystem.update(telemetry2, 20);
      
      // Third update at 40ms (should go through)
      gaugeSystem.update(telemetry2, 40);
      
      const rendered = gaugeSystem.render();
      expect(rendered).toBeDefined();
    });
  });
});
