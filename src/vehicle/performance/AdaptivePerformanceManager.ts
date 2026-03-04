/**
 * AdaptivePerformanceManager
 * 
 * Monitors frame time and automatically adjusts quality settings to maintain
 * target frame rate. Implements adaptive LOD for visual effects.
 * 
 * Requirements: 10.1, 10.6
 */

export interface PerformanceSettings {
  enableBodyTilt: boolean;
  enableSuspensionOscillation: boolean;
  enableDriftParticles: boolean;
  gaugeUpdateRate: number; // Hz
}

export class AdaptivePerformanceManager {
  private settings: PerformanceSettings = {
    enableBodyTilt: true,
    enableSuspensionOscillation: true,
    enableDriftParticles: true,
    gaugeUpdateRate: 30,
  };

  private frameTimings: number[] = [];
  private readonly maxSamples = 60;
  private readonly targetFrameTime = 16.67; // 60 FPS
  private readonly degradeThreshold = 20; // Below 50 FPS
  private readonly improveThreshold = 14; // Above 70 FPS

  /**
   * Record a frame time and adapt quality settings if needed
   * @param deltaMs Frame time in milliseconds
   */
  recordFrameTime(deltaMs: number): void {
    this.frameTimings.push(deltaMs);
    if (this.frameTimings.length > this.maxSamples) {
      this.frameTimings.shift();
    }

    // Only adapt after collecting enough samples
    if (this.frameTimings.length < this.maxSamples) {
      return;
    }

    const avgFrameTime = this.getAverageFrameTime();

    if (avgFrameTime > this.degradeThreshold) {
      this.degradeQuality();
    } else if (avgFrameTime < this.improveThreshold) {
      this.improveQuality();
    }
  }

  /**
   * Get current performance settings
   */
  getSettings(): Readonly<PerformanceSettings> {
    return { ...this.settings };
  }

  /**
   * Get average frame time over recent samples
   */
  getAverageFrameTime(): number {
    if (this.frameTimings.length === 0) return 0;
    const sum = this.frameTimings.reduce((a, b) => a + b, 0);
    return sum / this.frameTimings.length;
  }

  /**
   * Get worst (highest) frame time in recent samples
   */
  getWorstFrameTime(): number {
    if (this.frameTimings.length === 0) return 0;
    return Math.max(...this.frameTimings);
  }

  /**
   * Reset performance tracking
   */
  reset(): void {
    this.frameTimings = [];
    this.settings = {
      enableBodyTilt: true,
      enableSuspensionOscillation: true,
      enableDriftParticles: true,
      gaugeUpdateRate: 30,
    };
  }

  /**
   * Degrade quality settings to improve performance
   */
  private degradeQuality(): void {
    // Degrade in order of visual importance
    if (this.settings.enableSuspensionOscillation) {
      this.settings.enableSuspensionOscillation = false;
      console.log('[Performance] Disabled suspension oscillation');
    } else if (this.settings.gaugeUpdateRate > 15) {
      this.settings.gaugeUpdateRate = 15;
      console.log('[Performance] Reduced gauge update rate to 15 Hz');
    } else if (this.settings.enableDriftParticles) {
      this.settings.enableDriftParticles = false;
      console.log('[Performance] Disabled drift particles');
    } else if (this.settings.enableBodyTilt) {
      this.settings.enableBodyTilt = false;
      console.log('[Performance] Disabled body tilt (critical performance issue)');
    }
  }

  /**
   * Improve quality settings when performance allows
   */
  private improveQuality(): void {
    // Improve in reverse order of degradation
    if (!this.settings.enableBodyTilt) {
      this.settings.enableBodyTilt = true;
      console.log('[Performance] Enabled body tilt');
    } else if (!this.settings.enableDriftParticles) {
      this.settings.enableDriftParticles = true;
      console.log('[Performance] Enabled drift particles');
    } else if (this.settings.gaugeUpdateRate < 30) {
      this.settings.gaugeUpdateRate = 30;
      console.log('[Performance] Increased gauge update rate to 30 Hz');
    } else if (!this.settings.enableSuspensionOscillation) {
      this.settings.enableSuspensionOscillation = true;
      console.log('[Performance] Enabled suspension oscillation');
    }
  }
}
