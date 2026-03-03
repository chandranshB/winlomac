import type { VehicleConfig } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a VehicleConfig object against defined ranges and constraints.
 * Ensures all parameters are within acceptable bounds for stable physics simulation.
 * 
 * @param config - The vehicle configuration to validate
 * @returns ValidationResult with isValid flag and array of error messages
 */
export function validateVehicleConfig(config: VehicleConfig): ValidationResult {
  const errors: string[] = [];
  
  // Validate mass (Requirement 11.5)
  if (config.mass < 500 || config.mass > 3000) {
    errors.push(`Invalid mass: ${config.mass}. Must be between 500-3000 kg`);
  }
  
  // Validate dimensions
  if (config.dimensions.width <= 0 || config.dimensions.width > 3) {
    errors.push(`Invalid width: ${config.dimensions.width}. Must be between 0-3 meters`);
  }
  if (config.dimensions.height <= 0 || config.dimensions.height > 3) {
    errors.push(`Invalid height: ${config.dimensions.height}. Must be between 0-3 meters`);
  }
  if (config.dimensions.length <= 0 || config.dimensions.length > 10) {
    errors.push(`Invalid length: ${config.dimensions.length}. Must be between 0-10 meters`);
  }
  
  // Validate center of mass height
  if (config.centerOfMassHeight < 0 || config.centerOfMassHeight > config.dimensions.height) {
    errors.push(`Invalid centerOfMassHeight: ${config.centerOfMassHeight}. Must be between 0 and vehicle height`);
  }
  
  // Validate RPM ranges (Requirement 11.5)
  if (config.engine.idleRPM < 500 || config.engine.idleRPM > 2000) {
    errors.push(`Invalid idleRPM: ${config.engine.idleRPM}. Must be between 500-2000 RPM`);
  }
  if (config.engine.redlineRPM < 5000 || config.engine.redlineRPM > 10000) {
    errors.push(`Invalid redlineRPM: ${config.engine.redlineRPM}. Must be between 5000-10000 RPM`);
  }
  if (config.engine.revLimiterRPM < 5000 || config.engine.revLimiterRPM > 10000) {
    errors.push(`Invalid revLimiterRPM: ${config.engine.revLimiterRPM}. Must be between 5000-10000 RPM`);
  }
  if (config.engine.idleRPM >= config.engine.redlineRPM) {
    errors.push('Idle RPM must be less than redline RPM');
  }
  if (config.engine.revLimiterRPM > config.engine.redlineRPM) {
    errors.push('Rev limiter RPM should not exceed redline RPM');
  }
  
  // Validate torque curve (Requirement 11.5)
  if (config.engine.torqueCurve.length < 2) {
    errors.push('Torque curve must have at least 2 points');
  }
  for (let i = 0; i < config.engine.torqueCurve.length; i++) {
    const point = config.engine.torqueCurve[i];
    if (point.rpm < 0 || point.rpm > 15000) {
      errors.push(`Invalid torque curve RPM at index ${i}: ${point.rpm}. Must be between 0-15000`);
    }
    if (point.torqueMultiplier < 0 || point.torqueMultiplier > 1) {
      errors.push(`Invalid torque multiplier at index ${i}: ${point.torqueMultiplier}. Must be between 0-1`);
    }
    // Check for ascending RPM order
    if (i > 0 && point.rpm <= config.engine.torqueCurve[i - 1].rpm) {
      errors.push(`Torque curve RPM values must be in ascending order at index ${i}`);
    }
  }
  
  // Validate transmission
  if (config.transmission.gearRatios.length < 1 || config.transmission.gearRatios.length > 8) {
    errors.push(`Invalid number of gears: ${config.transmission.gearRatios.length}. Must be between 1-8`);
  }
  for (let i = 0; i < config.transmission.gearRatios.length; i++) {
    const ratio = config.transmission.gearRatios[i];
    if (ratio <= 0 || ratio > 10) {
      errors.push(`Invalid gear ratio at index ${i}: ${ratio}. Must be between 0-10`);
    }
    // Check for descending gear ratios (higher gears should have lower ratios)
    if (i > 0 && ratio >= config.transmission.gearRatios[i - 1]) {
      errors.push(`Gear ratios must be in descending order at index ${i}`);
    }
  }
  if (config.transmission.reverseRatio <= 0 || config.transmission.reverseRatio > 10) {
    errors.push(`Invalid reverse ratio: ${config.transmission.reverseRatio}. Must be between 0-10`);
  }
  if (config.transmission.finalDrive <= 0 || config.transmission.finalDrive > 10) {
    errors.push(`Invalid final drive: ${config.transmission.finalDrive}. Must be between 0-10`);
  }
  if (config.transmission.shiftTime < 0 || config.transmission.shiftTime > 2) {
    errors.push(`Invalid shift time: ${config.transmission.shiftTime}. Must be between 0-2 seconds`);
  }
  
  // Validate performance
  if (config.maxSpeed <= 0 || config.maxSpeed > 500) {
    errors.push(`Invalid maxSpeed: ${config.maxSpeed}. Must be between 0-500 km/h`);
  }
  if (config.acceleration <= 0 || config.acceleration > 10) {
    errors.push(`Invalid acceleration: ${config.acceleration}. Must be between 0-10`);
  }
  if (config.braking <= 0 || config.braking > 10) {
    errors.push(`Invalid braking: ${config.braking}. Must be between 0-10`);
  }
  
  // Validate steering
  if (config.steering.baseTurnSpeed <= 0 || config.steering.baseTurnSpeed > 10) {
    errors.push(`Invalid baseTurnSpeed: ${config.steering.baseTurnSpeed}. Must be between 0-10`);
  }
  if (config.steering.speedSensitivity < 0 || config.steering.speedSensitivity > 1) {
    errors.push(`Invalid speedSensitivity: ${config.steering.speedSensitivity}. Must be between 0-1`);
  }
  
  // Validate drift parameters (Requirement 11.5)
  if (config.drift.entrySpeedThreshold < 0 || config.drift.entrySpeedThreshold > 200) {
    errors.push(`Invalid entrySpeedThreshold: ${config.drift.entrySpeedThreshold}. Must be between 0-200 km/h`);
  }
  if (config.drift.entrySteeringThreshold < 0 || config.drift.entrySteeringThreshold > 90) {
    errors.push(`Invalid entrySteeringThreshold: ${config.drift.entrySteeringThreshold}. Must be between 0-90 degrees`);
  }
  if (config.drift.gripReduction < 0.4 || config.drift.gripReduction > 0.6) {
    errors.push(`Invalid gripReduction: ${config.drift.gripReduction}. Must be between 0.4-0.6`);
  }
  if (config.drift.counterSteerAssist < 0 || config.drift.counterSteerAssist > 1) {
    errors.push(`Invalid counterSteerAssist: ${config.drift.counterSteerAssist}. Must be between 0-1`);
  }
  if (config.drift.minSlipAngle < 0 || config.drift.minSlipAngle > 90) {
    errors.push(`Invalid minSlipAngle: ${config.drift.minSlipAngle}. Must be between 0-90 degrees`);
  }
  if (config.drift.maxSlipAngle < 0 || config.drift.maxSlipAngle > 90) {
    errors.push(`Invalid maxSlipAngle: ${config.drift.maxSlipAngle}. Must be between 0-90 degrees`);
  }
  if (config.drift.minSlipAngle >= config.drift.maxSlipAngle) {
    errors.push('minSlipAngle must be less than maxSlipAngle');
  }
  if (config.drift.spinoutThreshold < 0 || config.drift.spinoutThreshold > 90) {
    errors.push(`Invalid spinoutThreshold: ${config.drift.spinoutThreshold}. Must be between 0-90 degrees`);
  }
  if (config.drift.exitTransitionTime < 0 || config.drift.exitTransitionTime > 2) {
    errors.push(`Invalid exitTransitionTime: ${config.drift.exitTransitionTime}. Must be between 0-2 seconds`);
  }
  
  // Validate tire model
  if (config.tires.baseGripCoefficient <= 0 || config.tires.baseGripCoefficient > 2) {
    errors.push(`Invalid baseGripCoefficient: ${config.tires.baseGripCoefficient}. Must be between 0-2`);
  }
  
  // Validate lateral grip curve
  if (config.tires.lateralGripCurve.length < 2) {
    errors.push('Lateral grip curve must have at least 2 points');
  }
  for (let i = 0; i < config.tires.lateralGripCurve.length; i++) {
    const point = config.tires.lateralGripCurve[i];
    if (point.slipAngle < 0 || point.slipAngle > 90) {
      errors.push(`Invalid lateral grip curve slip angle at index ${i}: ${point.slipAngle}. Must be between 0-90 degrees`);
    }
    if (point.gripPercent < 0 || point.gripPercent > 1) {
      errors.push(`Invalid lateral grip percent at index ${i}: ${point.gripPercent}. Must be between 0-1`);
    }
    // Check for ascending slip angle order
    if (i > 0 && point.slipAngle <= config.tires.lateralGripCurve[i - 1].slipAngle) {
      errors.push(`Lateral grip curve slip angles must be in ascending order at index ${i}`);
    }
  }
  
  // Validate drift grip curve
  if (config.tires.driftGripCurve.length < 2) {
    errors.push('Drift grip curve must have at least 2 points');
  }
  for (let i = 0; i < config.tires.driftGripCurve.length; i++) {
    const point = config.tires.driftGripCurve[i];
    if (point.slipAngle < 0 || point.slipAngle > 90) {
      errors.push(`Invalid drift grip curve slip angle at index ${i}: ${point.slipAngle}. Must be between 0-90 degrees`);
    }
    if (point.gripPercent < 0 || point.gripPercent > 1) {
      errors.push(`Invalid drift grip percent at index ${i}: ${point.gripPercent}. Must be between 0-1`);
    }
    // Check for ascending slip angle order
    if (i > 0 && point.slipAngle <= config.tires.driftGripCurve[i - 1].slipAngle) {
      errors.push(`Drift grip curve slip angles must be in ascending order at index ${i}`);
    }
  }
  
  // Validate body tilt
  if (config.bodyTilt.maxPitchAccel < 0 || config.bodyTilt.maxPitchAccel > 15) {
    errors.push(`Invalid maxPitchAccel: ${config.bodyTilt.maxPitchAccel}. Must be between 0-15 degrees`);
  }
  if (config.bodyTilt.maxPitchBrake < 0 || config.bodyTilt.maxPitchBrake > 15) {
    errors.push(`Invalid maxPitchBrake: ${config.bodyTilt.maxPitchBrake}. Must be between 0-15 degrees`);
  }
  if (config.bodyTilt.maxRoll < 0 || config.bodyTilt.maxRoll > 30) {
    errors.push(`Invalid maxRoll: ${config.bodyTilt.maxRoll}. Must be between 0-30 degrees`);
  }
  if (config.bodyTilt.pitchTransitionTime < 0 || config.bodyTilt.pitchTransitionTime > 2) {
    errors.push(`Invalid pitchTransitionTime: ${config.bodyTilt.pitchTransitionTime}. Must be between 0-2 seconds`);
  }
  if (config.bodyTilt.rollTransitionTime < 0 || config.bodyTilt.rollTransitionTime > 2) {
    errors.push(`Invalid rollTransitionTime: ${config.bodyTilt.rollTransitionTime}. Must be between 0-2 seconds`);
  }
  
  // Validate speed scaling
  if (config.bodyTilt.speedScaling.minSpeed < 0 || config.bodyTilt.speedScaling.minSpeed > 200) {
    errors.push(`Invalid speedScaling.minSpeed: ${config.bodyTilt.speedScaling.minSpeed}. Must be between 0-200 km/h`);
  }
  if (config.bodyTilt.speedScaling.maxSpeed < 0 || config.bodyTilt.speedScaling.maxSpeed > 500) {
    errors.push(`Invalid speedScaling.maxSpeed: ${config.bodyTilt.speedScaling.maxSpeed}. Must be between 0-500 km/h`);
  }
  if (config.bodyTilt.speedScaling.minSpeed >= config.bodyTilt.speedScaling.maxSpeed) {
    errors.push('speedScaling.minSpeed must be less than speedScaling.maxSpeed');
  }
  if (config.bodyTilt.speedScaling.minScale < 0 || config.bodyTilt.speedScaling.minScale > 1) {
    errors.push(`Invalid speedScaling.minScale: ${config.bodyTilt.speedScaling.minScale}. Must be between 0-1`);
  }
  if (config.bodyTilt.speedScaling.maxScale < 0 || config.bodyTilt.speedScaling.maxScale > 1) {
    errors.push(`Invalid speedScaling.maxScale: ${config.bodyTilt.speedScaling.maxScale}. Must be between 0-1`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
