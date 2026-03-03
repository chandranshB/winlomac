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
    shiftTime: 0.2 // seconds
  },
  
  // Performance
  maxSpeed: 250, // km/h
  acceleration: 1.0, // force multiplier
  braking: 1.0, // force multiplier
  
  // Handling
  steering: {
    baseTurnSpeed: 2.5,
    speedSensitivity: 0.5 // reduction at high speed
  },
  
  // Drift Parameters
  drift: {
    entrySpeedThreshold: 40, // km/h
    entrySteeringThreshold: 20, // degrees
    gripReduction: 0.5, // 50% reduction
    counterSteerAssist: 0.6, // 0-1
    minSlipAngle: 15, // degrees
    maxSlipAngle: 45, // degrees
    spinoutThreshold: 50, // degrees
    exitTransitionTime: 0.3 // seconds
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
    maxPitchAccel: 3, // degrees
    maxPitchBrake: 4, // degrees
    maxRoll: 8, // degrees
    pitchTransitionTime: 0.15, // seconds
    rollTransitionTime: 0.25, // seconds
    speedScaling: {
      minSpeed: 30, // km/h
      maxSpeed: 80, // km/h
      minScale: 0.5, // 0-1
      maxScale: 1.0 // 0-1
    }
  }
};
