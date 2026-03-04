import type { Vector3, Quaternion } from '@react-three/fiber';

// ============================================================================
// Configuration Interfaces
// ============================================================================

export interface TorqueCurvePoint {
  rpm: number;
  torqueMultiplier: number; // 0-1
}

export interface GripCurvePoint {
  slipAngle: number; // degrees
  gripPercent: number; // 0-1
}

export interface VehicleConfig {
  // Physical Properties
  mass: number; // kg
  dimensions: {
    width: number;
    height: number;
    length: number;
  };
  centerOfMassHeight: number; // meters above ground
  
  // Engine & Transmission
  engine: {
    idleRPM: number;
    redlineRPM: number;
    revLimiterRPM: number;
    torqueCurve: TorqueCurvePoint[]; // RPM -> Torque multiplier
  };
  transmission: {
    gearRatios: number[]; // 6 forward gears
    reverseRatio: number;
    finalDrive: number;
    shiftTime: number; // seconds
  };
  
  // Performance
  maxSpeed: number; // km/h
  acceleration: number; // force multiplier
  braking: number; // force multiplier
  
  // Handling
  steering: {
    baseTurnSpeed: number;
    speedSensitivity: number; // reduction at high speed
  };
  
  // Drift Parameters
  drift: {
    entrySpeedThreshold: number; // km/h
    entrySteeringThreshold: number; // degrees
    gripReduction: number; // 0.4-0.6 (40-60% reduction)
    counterSteerAssist: number; // 0-1
    minSlipAngle: number; // degrees
    maxSlipAngle: number; // degrees
    spinoutThreshold: number; // degrees
    exitTransitionTime: number; // seconds
  };
  
  // Tire Model
  tires: {
    baseGripCoefficient: number;
    lateralGripCurve: GripCurvePoint[]; // Slip angle -> Grip %
    driftGripCurve: GripCurvePoint[];
  };
  
  // Body Tilt
  bodyTilt: {
    maxPitchAccel: number; // degrees
    maxPitchBrake: number; // degrees
    maxRoll: number; // degrees
    pitchTransitionTime: number; // seconds
    rollTransitionTime: number; // seconds
    speedScaling: {
      minSpeed: number; // km/h
      maxSpeed: number; // km/h
      minScale: number; // 0-1
      maxScale: number; // 0-1
    };
  };
}

// ============================================================================
// Input & State Interfaces
// ============================================================================

export interface VehicleInput {
  throttle: number; // 0-1
  brake: number; // 0-1
  steering: number; // -1 to 1
  handbrake: boolean;
  reset: boolean;
}

export interface VehicleState {
  // Physics State (from Rapier)
  position: Vector3;
  rotation: Quaternion;
  velocity: Vector3;
  angularVelocity: Vector3;
  
  // Derived Physics State
  speed: number; // km/h
  forwardSpeed: number; // m/s
  lateralSpeed: number; // m/s
  isGrounded: boolean;
  
  // Drivetrain State
  rpm: number;
  gear: number; // -1, 1-6
  isShifting: boolean;
  torqueMultiplier: number;
  
  // Drift State
  isDrifting: boolean;
  slipAngle: number;
  driftDuration: number;
  driftScore: number;
  
  // Visual State
  bodyPitch: number;
  bodyRoll: number;
  wheelRotation: number;
  
  // Metadata
  timestamp: number;
  isStuck: boolean;
}

export interface VehicleTelemetry {
  rpm: number;
  speed: number; // km/h
  gear: number | 'N' | 'R';
  isDrifting: boolean;
  isRevLimiting: boolean;
}

// ============================================================================
// Physics Subsystem Interfaces
// ============================================================================

export interface ForceApplication {
  force: Vector3; // Force to apply
  point: Vector3; // Application point (for torque)
  isImpulse: boolean;
}

export interface DriftState {
  isDrifting: boolean;
  gripMultiplier: number; // 0-1
  counterSteerTorque: number;
  slipAngle: number;
}

export interface BodyTilt {
  pitch: number; // degrees (positive = nose up)
  roll: number; // degrees (positive = right side down)
}

// ============================================================================
// Controller Interfaces
// ============================================================================

export interface PhysicsController {
  // State
  readonly velocity: Vector3;
  readonly angularVelocity: Vector3;
  readonly speed: number; // km/h
  readonly forwardSpeed: number; // m/s
  readonly isGrounded: boolean;
  
  // Subsystems
  readonly acceleration: AccelerationSystem;
  readonly drift: DriftController;
  readonly tires: TireModel;
  readonly rpm: RPMSystem;
  
  // Methods
  update(delta: number, input: VehicleInput): void;
  reset(): void;
}

export interface AccelerationSystem {
  // State
  readonly currentGear: number; // -1 (reverse), 1-6 (forward)
  readonly isShifting: boolean;
  readonly torqueMultiplier: number; // Current torque curve value
  
  // Methods
  update(
    delta: number,
    input: VehicleInput,
    rpm: number,
    speed: number,
    isGrounded: boolean
  ): ForceApplication;
  
  calculateTorque(rpm: number): number;
  shouldShift(speed: number, rpm: number): number | null; // Returns new gear or null
}

export interface DriftController {
  // State
  readonly isDrifting: boolean;
  readonly slipAngle: number; // degrees
  readonly driftDuration: number; // seconds
  readonly driftScore: number;
  
  // Methods
  update(
    delta: number,
    input: VehicleInput,
    velocity: Vector3,
    angularVelocity: Vector3,
    speed: number,
    isGrounded: boolean
  ): DriftState;
  
  calculateSlipAngle(velocity: Vector3, heading: Vector3): number;
  shouldEnterDrift(input: VehicleInput, speed: number, slipAngle: number): boolean;
  shouldExitDrift(input: VehicleInput, speed: number, slipAngle: number): boolean;
  calculateCounterSteer(slipAngle: number): number;
}

export interface TireModel {
  // Methods
  calculateLateralForce(
    slipAngle: number,
    normalForce: number,
    isDrifting: boolean
  ): number;
  
  calculateLongitudinalForce(
    wheelSpeed: number,
    groundSpeed: number,
    normalForce: number
  ): number;
  
  getGripCoefficient(slipAngle: number, isDrifting: boolean): number;
}

export interface RPMSystem {
  // State
  readonly currentRPM: number;
  readonly isRevLimiting: boolean;
  
  // Methods
  update(
    delta: number,
    gear: number,
    speed: number,
    throttle: number,
    isGrounded: boolean,
    isShifting: boolean
  ): number;
  
  calculateTargetRPM(gear: number, speed: number, throttle: number): number;
  applyRevLimiter(rpm: number): number;
}

export interface BodyTiltSystem {
  // State
  readonly currentPitch: number; // degrees
  readonly currentRoll: number; // degrees
  
  // Methods
  update(
    delta: number,
    acceleration: Vector3,
    lateralAcceleration: number,
    speed: number
  ): BodyTilt;
  
  calculatePitch(longitudinalAccel: number, speed: number): number;
  calculateRoll(lateralAccel: number, speed: number): number;
  applySpeedScaling(tilt: number, speed: number): number;
}

export interface GaugeSystem {
  // Methods
  update(telemetry: VehicleTelemetry): void;
  render(): React.ReactNode;
}

// ============================================================================
// Network Interfaces
// ============================================================================

export interface NetworkVehicleState {
  // Position & Orientation (24 bytes)
  position: [number, number, number]; // Float32 x3
  rotation: [number, number, number, number]; // Quaternion Float32 x4
  
  // Velocity (12 bytes)
  velocity: [number, number, number]; // Float32 x3
  
  // Telemetry (8 bytes)
  rpm: number; // Uint16 (0-10000)
  speed: number; // Uint16 (0-500 km/h)
  gear: number; // Int8 (-1 to 6)
  flags: number; // Uint8 bitfield (isDrifting, isGrounded, isRevLimiting, etc.)
  
  // Total: 44 bytes per vehicle per update
}
