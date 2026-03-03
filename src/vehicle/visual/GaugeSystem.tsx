import React from 'react';
import { GaugeSystem, VehicleTelemetry } from '../types';

export class GaugeSystemImpl implements GaugeSystem {
  private telemetry: VehicleTelemetry = {
    rpm: 800,
    speed: 0,
    gear: 1,
    isDrifting: false,
    isRevLimiting: false
  };

  update(telemetry: VehicleTelemetry): void {
    this.telemetry = telemetry;
  }

  render(): React.ReactNode {
    // TODO: Implement gauge rendering
    return null;
  }
}
