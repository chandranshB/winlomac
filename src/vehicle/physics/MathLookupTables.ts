/**
 * Pre-computed lookup tables for expensive trigonometric functions.
 * Provides fast approximations of sin/cos using table lookups.
 */
export class MathLookupTables {
  private static readonly SIN_TABLE_SIZE = 360;
  private static readonly sinTable: Float32Array = new Float32Array(
    MathLookupTables.SIN_TABLE_SIZE
  );
  private static readonly cosTable: Float32Array = new Float32Array(
    MathLookupTables.SIN_TABLE_SIZE
  );

  // Static initialization block
  private static initialized = false;

  /**
   * Initialize lookup tables (called automatically on first use)
   */
  private static initialize(): void {
    if (this.initialized) return;

    // Pre-compute sin/cos values for 0-359 degrees
    for (let i = 0; i < this.SIN_TABLE_SIZE; i++) {
      const angle = (i * Math.PI * 2) / this.SIN_TABLE_SIZE;
      this.sinTable[i] = Math.sin(angle);
      this.cosTable[i] = Math.cos(angle);
    }

    this.initialized = true;
  }

  /**
   * Fast sine approximation using lookup table.
   * 
   * @param degrees - Angle in degrees
   * @returns Sine value (approximate)
   */
  static fastSin(degrees: number): number {
    this.initialize();

    // Normalize to 0-359 range
    const normalized = ((degrees % 360) + 360) % 360;
    const index = Math.floor(normalized);
    
    return this.sinTable[index];
  }

  /**
   * Fast cosine approximation using lookup table.
   * 
   * @param degrees - Angle in degrees
   * @returns Cosine value (approximate)
   */
  static fastCos(degrees: number): number {
    this.initialize();

    // Normalize to 0-359 range
    const normalized = ((degrees % 360) + 360) % 360;
    const index = Math.floor(normalized);
    
    return this.cosTable[index];
  }

  /**
   * Fast sine with linear interpolation for better accuracy.
   * 
   * @param degrees - Angle in degrees
   * @returns Sine value (interpolated)
   */
  static fastSinInterpolated(degrees: number): number {
    this.initialize();

    // Normalize to 0-359 range
    const normalized = ((degrees % 360) + 360) % 360;
    const index = Math.floor(normalized);
    const nextIndex = (index + 1) % this.SIN_TABLE_SIZE;
    const t = normalized - index;

    // Linear interpolation
    return this.sinTable[index] + t * (this.sinTable[nextIndex] - this.sinTable[index]);
  }

  /**
   * Fast cosine with linear interpolation for better accuracy.
   * 
   * @param degrees - Angle in degrees
   * @returns Cosine value (interpolated)
   */
  static fastCosInterpolated(degrees: number): number {
    this.initialize();

    // Normalize to 0-359 range
    const normalized = ((degrees % 360) + 360) % 360;
    const index = Math.floor(normalized);
    const nextIndex = (index + 1) % this.SIN_TABLE_SIZE;
    const t = normalized - index;

    // Linear interpolation
    return this.cosTable[index] + t * (this.cosTable[nextIndex] - this.cosTable[index]);
  }
}

/**
 * Fast linear interpolation without function call overhead.
 * 
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function fastLerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Fast clamping without Math.min/Math.max calls.
 * 
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function fastClamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
