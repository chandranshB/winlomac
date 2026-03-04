import type { TorqueCurvePoint, GripCurvePoint } from '../types';
import { fastLerp } from './MathLookupTables';

/**
 * Optimized torque curve lookup using binary search (O(log n)).
 * Much faster than linear search for curves with many points.
 * 
 * @param rpm - Current engine RPM
 * @param curve - Torque curve points (must be sorted by RPM)
 * @returns Interpolated torque multiplier
 */
export function fastTorqueLookup(
  rpm: number,
  curve: TorqueCurvePoint[]
): number {
  const len = curve.length;
  
  // Early exit for boundary cases
  if (rpm <= curve[0].rpm) return curve[0].torqueMultiplier;
  if (rpm >= curve[len - 1].rpm) return curve[len - 1].torqueMultiplier;
  
  // Binary search for O(log n) instead of O(n)
  let low = 0;
  let high = len - 1;
  
  while (high - low > 1) {
    const mid = (low + high) >> 1; // Bit shift for fast division by 2
    if (curve[mid].rpm < rpm) {
      low = mid;
    } else {
      high = mid;
    }
  }
  
  // Linear interpolation using fastLerp
  const lower = curve[low];
  const upper = curve[high];
  const t = (rpm - lower.rpm) / (upper.rpm - lower.rpm);
  return fastLerp(lower.torqueMultiplier, upper.torqueMultiplier, t);
}

/**
 * Optimized grip curve lookup using binary search.
 * 
 * @param slipAngle - Tire slip angle in degrees
 * @param curve - Grip curve points (must be sorted by slip angle)
 * @returns Interpolated grip percentage (0-1)
 */
export function fastGripLookup(
  slipAngle: number,
  curve: GripCurvePoint[]
): number {
  const absSlipAngle = Math.abs(slipAngle);
  const len = curve.length;
  
  // Early exit for boundary cases
  if (absSlipAngle <= curve[0].slipAngle) return curve[0].gripPercent;
  if (absSlipAngle >= curve[len - 1].slipAngle) return curve[len - 1].gripPercent;
  
  // Binary search
  let low = 0;
  let high = len - 1;
  
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (curve[mid].slipAngle < absSlipAngle) {
      low = mid;
    } else {
      high = mid;
    }
  }
  
  // Linear interpolation
  const lower = curve[low];
  const upper = curve[high];
  const t = (absSlipAngle - lower.slipAngle) / (upper.slipAngle - lower.slipAngle);
  return fastLerp(lower.gripPercent, upper.gripPercent, t);
}

/**
 * Cached curve lookup with frame-based invalidation.
 * Useful for values that are accessed multiple times per frame.
 */
export class CachedCurveLookup<T extends { rpm?: number; slipAngle?: number }> {
  private cachedValue: number = 0;
  private cachedInput: number = -1;
  private cachedFrame: number = -1;
  private currentFrame: number = 0;

  /**
   * Lookup with caching. Returns cached value if input matches and frame is current.
   * 
   * @param input - Input value (RPM or slip angle)
   * @param curve - Curve points
   * @param lookupFn - Lookup function to use
   * @returns Interpolated value
   */
  lookup(
    input: number,
    curve: T[],
    lookupFn: (input: number, curve: T[]) => number
  ): number {
    // Return cached value if already calculated this frame with same input
    if (this.cachedFrame === this.currentFrame && this.cachedInput === input) {
      return this.cachedValue;
    }

    // Calculate and cache
    this.cachedValue = lookupFn(input, curve);
    this.cachedInput = input;
    this.cachedFrame = this.currentFrame;
    return this.cachedValue;
  }

  /**
   * Advance to next frame (invalidates cache).
   */
  nextFrame(): void {
    this.currentFrame++;
  }

  /**
   * Reset cache.
   */
  reset(): void {
    this.cachedValue = 0;
    this.cachedInput = -1;
    this.cachedFrame = -1;
    this.currentFrame = 0;
  }
}

/**
 * Optimized smooth interpolation with early exit for negligible changes.
 * 
 * @param current - Current value
 * @param target - Target value
 * @param smoothTime - Time to reach target (seconds)
 * @param delta - Time step (seconds)
 * @param threshold - Minimum change threshold (skip if below this)
 * @returns Interpolated value
 */
export function smoothInterpolate(
  current: number,
  target: number,
  smoothTime: number,
  delta: number,
  threshold: number = 0.001
): number {
  const diff = target - current;
  
  // Early exit if change is negligible
  if (Math.abs(diff) < threshold) {
    return target;
  }

  // Exponential smoothing
  const alpha = 1 - Math.exp(-delta / smoothTime);
  return current + diff * alpha;
}
