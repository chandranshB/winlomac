import React from 'react';
import type { GaugeSystem, VehicleTelemetry } from '../types';

export class GaugeSystemImpl implements GaugeSystem {
  update(_telemetry: VehicleTelemetry): void {
    // Telemetry updated
  }

  render(): React.ReactNode {
    // TODO: Implement gauge rendering
    return null;
  }
}
