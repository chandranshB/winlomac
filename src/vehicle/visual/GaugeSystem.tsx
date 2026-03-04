import React from 'react';
import type { GaugeSystem, VehicleTelemetry } from '../types';
import { GaugeDisplay } from './GaugeDisplay';

export class GaugeSystemImpl implements GaugeSystem {
  private telemetry: VehicleTelemetry = {
    rpm: 800,
    speed: 0,
    gear: 1,
    isDrifting: false,
    isRevLimiting: false
  };

  private lastUpdateTime = 0;
  private readonly updateInterval: number; // ms

  constructor(updateRate: number = 30) {
    // 30 Hz minimum update rate = ~33.33ms interval
    this.updateInterval = 1000 / updateRate;
  }

  update(telemetry: VehicleTelemetry, currentTime?: number): void {
    // Use provided time or performance.now()
    const now = currentTime ?? performance.now();
    
    // Throttle updates to save CPU
    if (now - this.lastUpdateTime < this.updateInterval) {
      return;
    }
    
    this.lastUpdateTime = now;
    this.telemetry = telemetry;
  }

  render(): React.ReactNode {
    return <GaugeDisplay telemetry={this.telemetry} />;
  }
}

