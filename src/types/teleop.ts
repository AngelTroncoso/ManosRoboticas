export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface FingerAngles {
  mcp: number;
  pip: number;
  total: number;
}

export interface FingerAbductions {
  thumbIndex: number;
  indexMiddle: number;
  middleRing: number;
  ringPinky: number;
}

export interface HandKinematics {
  side: "left" | "right";
  flexions: {
    thumb: FingerAngles;
    index: FingerAngles;
    middle: FingerAngles;
    ring: FingerAngles;
    pinky: FingerAngles;
  };
  pinchAperture: number; // 0.0 (closed) to 1.0 (open)
  abductions: FingerAbductions;
  palmOrientation: {
    roll: number;
    pitch: number;
    yaw: number;
    normal: { x: number; y: number; z: number };
  };
  landmarks?: LandmarkPoint[];
  center3D?: { x: number; y: number; z: number };
  timestamp: number;
}

export interface ServoState {
  thumb: number; // 0.0 - 1.0 (or 0-180)
  index: number;
  middle: number;
  ring: number;
  pinky: number;
  wrist: number;
}

export interface TeleopPacket {
  v: string;
  seq: number;
  ts: number;
  hand: "left" | "right";
  servos: ServoState;
  pinch?: number;
}

export interface ServoHardwareConfig {
  minDeg: number;
  maxDeg: number;
  inverted: boolean;
  channel: number;
  minPulseUs: number;
  maxPulseUs: number;
}

export interface HandHardwareProfile {
  id: string;
  name: string;
  description: string;
  dofPerHand: number;
  microcontroller: "single_esp32_pca9685" | "dual_esp32";
  servosLeft: Record<keyof ServoState, ServoHardwareConfig>;
  servosRight: Record<keyof ServoState, ServoHardwareConfig>;
}

export interface CalibrationRange {
  minAngle: number;
  maxAngle: number;
}

export interface UserCalibrationProfile {
  thumb: CalibrationRange;
  index: CalibrationRange;
  middle: CalibrationRange;
  ring: CalibrationRange;
  pinky: CalibrationRange;
  wrist: CalibrationRange;
}

export interface GeminiAnalysisResult {
  leftStatus: {
    graspType: string;
    stabilityScore: number;
    overextensionRisk: boolean;
    notes: string;
  };
  rightStatus: {
    graspType: string;
    stabilityScore: number;
    overextensionRisk: boolean;
    notes: string;
  };
  overallAssessment: string;
  recommendedAction: string;
  safetyWarning: string | null;
}

export interface AdvancedControlSettings {
  slewRateEnabled: boolean;
  slewMaxSpeedDegPerSec: number; // e.g. 360 deg/sec
  virtualTorqueLimit: number; // 0.6 to 1.0 (limits maximum closing torque)
  pinchLockActive: boolean; // grip hold lock
  deadReckoningFrames: number; // frames to hold position during occlusions (e.g. 15 frames)
  perspectiveMode: "mirror" | "pov"; // Mirror vs First-Person POV
}

export interface MacroKeyframe {
  timestamp: number;
  left: ServoState;
  right: ServoState;
  leftPinch: number;
  rightPinch: number;
}
