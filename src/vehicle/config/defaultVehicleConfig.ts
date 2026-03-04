import type { VehicleConfig } from '../types';

export const defaultVehicleConfig: VehicleConfig = {
  // Physical Properties
  mass: 1200, // kg
  dimensions: {
    width: 1.8,
    height: 1.4,
    length: 4.5
  },
  centerOfMassHeight: 0.5, // meters above ground
  
  // Engine & Transmission
  engine: {
    idleRPM: 800,
    redlineRPM: 8000,
    revLimiterRPM: 7500,
    torqueCurve: [
      { rpm: 800, torqueMultiplier: 0.3 },
      { rpm: 2000, torqueMultiplier: 0.6 },
      { rpm: 4000, torqueMultiplier: 1.0 },
      { rpm: 6000, torqueMultiplier: 0.95 },
      { rpm: 7500, torqueMultiplier: 0.8 },
      { rpm: 8000, torqueMultiplier: 0.7 }
    ]
  },
  transmission: {
    gearRatios: [3.5, 2.5, 1.8, 1.4, 1.1, 0.9], // 6 forward gears
    reverseRatio: 3.8,
    finalDrive: 3.7,
    shiftTime: 0.15 // seconds (reduced from 0.2 for quicker, smoother shifts)
  },
  
  // Performance
  maxSpeed: 200, // km/h
  acceleration: 0.9, // force multiplier (decreased from 1.3 for manageable acceleration)
  braking: 1.3, // force multiplier (increased from 1.2 for better braking)
  
  // Handling
  steering: {
    baseTurnSpeed: 3.5, // increased from 3.0 for sharper turn-in response
    speedSensitivity: 0.35 // reduced from 0.4 for less reduction at high speed
  },
  
  // Drift Parameters - Ultra-polished for smooth, predictable drifting
  drift: {
    entrySpeedThreshold: 35, // km/h (balanced between easy and realistic)
    entrySteeringThreshold: 18, // degrees (balanced)
    gripReduction: 0.40, // 40% reduction (minimum allowed by validation)
    counterSteerAssist: 0.85, // 0-1 (increased from 0.80 for better assistance)
    minSlipAngle: 12, // degrees (balanced)
    maxSlipAngle: 45, // degrees
    spinoutThreshold: 50, // degrees
    exitTransitionTime: 0.35 // seconds (increased from 0.3 for smoother exit)
  },
  
  // Tire Model
  tires: {
    baseGripCoefficient: 1.0,
    lateralGripCurve: [
      { slipAngle: 0, gripPercent: 1.0 },
      { slipAngle: 10, gripPercent: 1.0 },
      { slipAngle: 25, gripPercent: 0.7 },
      { slipAngle: 90, gripPercent: 0.6 }
    ],
    driftGripCurve: [
      { slipAngle: 0, gripPercent: 0.6 },
      { slipAngle: 20, gripPercent: 0.8 },
      { slipAngle: 45, gripPercent: 0.6 },
      { slipAngle: 90, gripPercent: 0.5 }
    ]
  },
  
  // Body Tilt
  bodyTilt: {
    maxPitchAccel: 1.5, // degrees (reduced from 3 for less bending)
    maxPitchBrake: 2, // degrees (reduced from 4 for less bending)
    maxRoll: 4, // degrees (reduced from 8 for less bending)
    pitchTransitionTime: 0.15, // seconds
    rollTransitionTime: 0.25, // seconds
    speedScaling: {
      minSpeed: 30, // km/h
      maxSpeed: 80, // km/h
      minScale: 0.3, // 0-1 (reduced from 0.5 for less bending at low speed)
      maxScale: 0.7 // 0-1 (reduced from 1.0 for less bending at high speed)
    }
  }
};
