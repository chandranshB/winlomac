import type { TireModel, VehicleConfig, GripCurvePoint } from '../types';
import { fastGripLookup } from './OptimizedCurveLookup';

export class TireModelImpl implements TireModel {
  private config: VehicleConfig;

  constructor(config: VehicleConfig) {
    this.config = config;
  }

  /**
   * Get grip coefficient based on slip angle and drift state
   * Uses optimized binary search interpolation between grip curve points
   * 
   * @param slipAngle - Slip angle in degrees
   * @param isDrifting - Whether the vehicle is in drift state
   * @returns Grip coefficient (0-1)
   */
  getGripCoefficient(slipAngle: number, isDrifting: boolean): number {
    const curve = isDrifting 
      ? this.config.tires.driftGripCurve 
      : this.config.tires.lateralGripCurve;
    
    // Use optimized binary search lookup instead of linear search
    return fastGripLookup(slipAngle, curve);
  }

  /**
   * Calculate lateral (sideways) force based on slip angle
   * 
   * @param slipAngle - Slip angle in degrees
   * @param normalForce - Normal force pressing tire to ground (N)
   * @param isDrifting - Whether the vehicle is in drift state
   * @returns Lateral force in Newtons
   */
  calculateLateralForce(
    slipAngle: number,
    normalForce: number,
    isDrifting: boolean
  ): number {
    const gripCoefficient = this.getGripCoefficient(slipAngle, isDrifting);
    const baseGrip = this.config.tires.baseGripCoefficient;
    
    // Lateral force = grip coefficient × base grip × normal force
    return gripCoefficient * baseGrip * normalForce;
  }

  /**
   * Calculate longitudinal (forward/backward) force based on wheel slip
   * 
   * @param wheelSpeed - Speed of wheel rotation (m/s)
   * @param groundSpeed - Actual ground speed (m/s)
   * @param normalForce - Normal force pressing tire to ground (N)
   * @returns Longitudinal force in Newtons
   */
  calculateLongitudinalForce(
    wheelSpeed: number,
    groundSpeed: number,
    normalForce: number
  ): number {
    // Calculate slip ratio: (wheel speed - ground speed) / ground speed
    // Avoid division by zero
    const slipRatio = groundSpeed !== 0 
      ? (wheelSpeed - groundSpeed) / Math.abs(groundSpeed)
      : 0;
    
    // Clamp slip ratio to reasonable range
    const clampedSlipRatio = Math.max(-1, Math.min(1, slipRatio));
    
    // Use a simplified Pacejka-like curve for longitudinal grip
    // Peak grip at ~10% slip, then gradual falloff
    const slipAngle = Math.abs(clampedSlipRatio) * 90; // Convert to degrees for curve lookup
    const gripCoefficient = this.getGripCoefficient(slipAngle, false);
    const baseGrip = this.config.tires.baseGripCoefficient;
    
    // Longitudinal force = grip × normal force × slip direction
    const force = gripCoefficient * baseGrip * normalForce;
    return force * Math.sign(clampedSlipRatio);
  }
}
