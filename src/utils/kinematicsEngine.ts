import {
  LandmarkPoint,
  HandKinematics,
  FingerAngles,
  UserCalibrationProfile,
  ServoState,
} from "../types/teleop";

// Landmarks indices
export const WRIST = 0;
export const THUMB = [1, 2, 3, 4];
export const INDEX = [5, 6, 7, 8];
export const MIDDLE = [9, 10, 11, 12];
export const RING = [13, 14, 15, 16];
export const PINKY = [17, 18, 19, 20];

export const FINGER_MAP: Record<string, number[]> = {
  thumb: THUMB,
  index: INDEX,
  middle: MIDDLE,
  ring: RING,
  pinky: PINKY,
};

type Vec3 = [number, number, number];

export function vec(p1: LandmarkPoint, p2: LandmarkPoint): Vec3 {
  return [p2.x - p1.x, p2.y - p1.y, (p2.z ?? 0) - (p1.z ?? 0)];
}

export function dot(v1: Vec3, v2: Vec3): number {
  return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

export function mag(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) + 1e-8;
}

export function angleBetween(v1: Vec3, v2: Vec3): number {
  const m1 = mag(v1);
  const m2 = mag(v2);
  if (m1 < 1e-9 || m2 < 1e-9) return 0;
  const d = dot(v1, v2);
  const cosTheta = Math.max(-1, Math.min(1, d / (m1 * m2)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

export function cross(v1: Vec3, v2: Vec3): Vec3 {
  return [
    v1[1] * v2[2] - v1[2] * v2[1],
    v1[2] * v2[0] - v1[0] * v2[2],
    v1[0] * v2[1] - v1[1] * v2[0],
  ];
}

export function calculateFingerFlexion(
  landmarks: LandmarkPoint[],
  finger: "thumb" | "index" | "middle" | "ring" | "pinky"
): FingerAngles {
  const [p0_idx, p1_idx, p2_idx, p3_idx] = FINGER_MAP[finger];
  const wrist = landmarks[WRIST];
  const p0 = landmarks[p0_idx]; // MCP (or CMC for thumb)
  const p1 = landmarks[p1_idx]; // PIP (or MCP for thumb)
  const p2 = landmarks[p2_idx]; // DIP (or IP for thumb)
  const p3 = landmarks[p3_idx]; // TIP

  if (!p0 || !p1 || !p2 || !p3 || !wrist) {
    return { mcp: 0, pip: 0, total: 0 };
  }

  // Segment vectors
  const vMeta = vec(wrist, p0);
  const vProx = vec(p0, p1);
  const vMed = vec(p1, p2);
  const vDist = vec(p2, p3);

  // Angular flexions at joints
  const angleKnuckle = angleBetween(vMeta, vProx);
  const angleMcp = angleBetween(vProx, vMed);
  const anglePip = angleBetween(vMed, vDist);

  // Anatomical bone lengths
  const lenProx = mag(vProx);
  const lenMed = mag(vMed);
  const lenDist = mag(vDist);
  const boneSum = lenProx + lenMed + lenDist + 1e-6;

  // Direct distance from knuckle (MCP) to fingertip (TIP)
  const tipSpan = mag(vec(p0, p3));
  const spanRatio = tipSpan / boneSum; // ~0.92 when straight, ~0.25 when curled

  // Distance from tip to wrist relative to hand size
  const wristMcpDist = mag(vMeta) + 1e-6;
  const wristTipDist = mag(vec(wrist, p3));
  const wristRatio = wristTipDist / wristMcpDist; // ~1.8 when straight, ~0.8 when curled

  let total = 0;

  if (finger === "thumb") {
    // Thumb opposes and curls toward palm center (middle MCP landmark 9)
    const palmCenter = landmarks[9] || landmarks[5];
    const thumbToPalm = mag(vec(p3, palmCenter)) / (wristMcpDist + 1e-6);

    // Contraction factors for thumb
    const thumbSpanCurl = Math.max(0, Math.min(1, (0.86 - spanRatio) / (0.86 - 0.44))) * 180;
    const thumbOpposeCurl = Math.max(0, Math.min(1, (1.30 - thumbToPalm) / (1.30 - 0.48))) * 180;
    const jointCurl = Math.max(0, angleMcp - 10) * 0.6 + Math.max(0, anglePip - 8) * 0.9;

    total = jointCurl * 0.35 + thumbSpanCurl * 0.35 + thumbOpposeCurl * 0.30;
  } else {
    // Standard fingers (Index, Middle, Ring, Pinky)
    // 1. Contraction from span (Tip to MCP distance reduction as fingers curl)
    const spanCurl = Math.max(0, Math.min(1, (0.88 - spanRatio) / (0.88 - 0.28))) * 180;

    // 2. Contraction towards wrist/palm
    const wristCurl = Math.max(0, Math.min(1, (1.70 - wristRatio) / (1.70 - 0.85))) * 180;

    // 3. Articular joint angles sum (Knuckle MCP + PIP + DIP with natural offset threshold)
    const jointSum =
      Math.max(0, angleKnuckle - 6) * 0.35 +
      Math.max(0, angleMcp - 8) * 0.50 +
      Math.max(0, anglePip - 6) * 0.65;

    // Weighted fusion: robust against 2D perspective foreshortening & camera angles
    total = spanCurl * 0.40 + wristCurl * 0.25 + jointSum * 0.35;
  }

  total = Math.max(0, Math.min(180, total));

  return {
    mcp: angleMcp,
    pip: anglePip,
    total,
  };
}

export function calculatePinchAperture(landmarks: LandmarkPoint[]): number {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];

  const pinchVec = vec(thumbTip, indexTip);
  const pinchDist = mag(pinchVec);

  const handScaleVec = vec(wrist, middleMcp);
  const handScale = mag(handScaleVec);

  if (handScale < 1e-4) return 1.0;

  const normalizedDist = pinchDist / handScale;
  const aperture = (normalizedDist - 0.15) / 1.05;
  return Math.max(0, Math.min(1, aperture));
}

export function calculatePalmOrientation(landmarks: LandmarkPoint[]) {
  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];

  const v1 = vec(wrist, indexMcp);
  const v2 = vec(wrist, pinkyMcp);

  const norm = cross(v1, v2);
  const normMag = mag(norm);
  const nx = norm[0] / normMag;
  const ny = norm[1] / normMag;
  const nz = norm[2] / normMag;

  const roll = (Math.atan2(ny, nx) * 180) / Math.PI;
  const pitch = (Math.asin(Math.max(-1, Math.min(1, -nz))) * 180) / Math.PI;
  const yaw = (Math.atan2(v1[0], v1[1]) * 180) / Math.PI;

  return {
    roll,
    pitch,
    yaw,
    normal: { x: nx, y: ny, z: nz },
  };
}

export function computeHandKinematics(
  landmarks: LandmarkPoint[],
  side: "left" | "right"
): HandKinematics {
  const flexions = {
    thumb: calculateFingerFlexion(landmarks, "thumb"),
    index: calculateFingerFlexion(landmarks, "index"),
    middle: calculateFingerFlexion(landmarks, "middle"),
    ring: calculateFingerFlexion(landmarks, "ring"),
    pinky: calculateFingerFlexion(landmarks, "pinky"),
  };

  const pinchAperture = calculatePinchAperture(landmarks);
  const palmOrientation = calculatePalmOrientation(landmarks);

  const wrist = landmarks[0];
  const vThumb = vec(wrist, landmarks[2]);
  const vIndex = vec(wrist, landmarks[5]);
  const vMiddle = vec(wrist, landmarks[9]);
  const vRing = vec(wrist, landmarks[13]);
  const vPinky = vec(wrist, landmarks[17]);

  const center3D = {
    x: (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3,
    y: (landmarks[0].y + landmarks[5].y + landmarks[17].y) / 3,
    z: (landmarks[0].z + landmarks[5].z + landmarks[17].z) / 3,
  };

  return {
    side,
    flexions,
    pinchAperture,
    abductions: {
      thumbIndex: angleBetween(vThumb, vIndex),
      indexMiddle: angleBetween(vIndex, vMiddle),
      middleRing: angleBetween(vMiddle, vRing),
      ringPinky: angleBetween(vRing, vPinky),
    },
    palmOrientation,
    landmarks,
    center3D,
    timestamp: Date.now() / 1000,
  };
}

// Adaptive 1 Euro Filter Implementation in TypeScript
export class OneEuroFilterTS {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev: number | null = null;
  private lastTime: number | null = null;

  constructor(minCutoff = 1.2, beta = 0.01, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  filter(x: number, timestamp?: number): number {
    const now = timestamp ?? Date.now() / 1000;
    if (this.lastTime === null || this.xPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0;
      this.lastTime = now;
      return x;
    }

    const dt = Math.max(1e-4, now - this.lastTime);
    this.lastTime = now;

    const dx = (x - this.xPrev) / dt;
    const aD = this.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * (this.dxPrev ?? 0);
    this.dxPrev = dxHat;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;

    return xHat;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = null;
    this.lastTime = null;
  }
}

export class HandFilterBankTS {
  private filters: Record<string, OneEuroFilterTS> = {};

  filter(key: string, value: number, ts?: number): number {
    if (!this.filters[key]) {
      // 1.0Hz cutoff for motionless stillness, beta 0.022 for zero lag on quick gestures
      this.filters[key] = new OneEuroFilterTS(1.0, 0.022, 1.0);
    }
    return this.filters[key].filter(value, ts);
  }

  reset() {
    Object.values(this.filters).forEach((f) => f.reset());
  }
}

// S-Curve Slew Rate Limiter to protect mechanical servos from violent step-changes
export class SlewRateLimiter {
  private maxRate: number; // Maximum change in normalized value (0.0 - 1.0) per second
  private currentVal: number | null = null;
  private lastTime: number | null = null;

  constructor(maxRatePerSec = 2.5) {
    this.maxRate = maxRatePerSec;
  }

  setRate(maxRatePerSec: number) {
    this.maxRate = maxRatePerSec;
  }

  limit(target: number, ts?: number): number {
    const now = ts ?? Date.now() / 1000;
    if (this.currentVal === null || this.lastTime === null) {
      this.currentVal = target;
      this.lastTime = now;
      return target;
    }

    const dt = Math.max(0.001, Math.min(0.2, now - this.lastTime));
    this.lastTime = now;

    if (this.maxRate <= 0) {
      this.currentVal = target;
      return target;
    }

    const maxDelta = this.maxRate * dt;
    const delta = target - this.currentVal;

    if (Math.abs(delta) <= maxDelta) {
      this.currentVal = target;
    } else {
      this.currentVal += Math.sign(delta) * maxDelta;
    }

    return this.currentVal;
  }

  reset() {
    this.currentVal = null;
    this.lastTime = null;
  }
}

export class SlewRateBank {
  private limiters: Record<string, SlewRateLimiter> = {};
  private maxRate: number;

  constructor(maxRate = 2.5) {
    this.maxRate = maxRate;
  }

  setRate(maxRate: number) {
    this.maxRate = maxRate;
    Object.values(this.limiters).forEach((lim) => lim.setRate(maxRate));
  }

  limit(key: string, value: number, ts?: number): number {
    if (!this.limiters[key]) {
      this.limiters[key] = new SlewRateLimiter(this.maxRate);
    }
    return this.limiters[key].limit(value, ts);
  }

  reset() {
    Object.values(this.limiters).forEach((lim) => lim.reset());
  }
}

export const DEFAULT_CALIBRATION: UserCalibrationProfile = {
  thumb: { minAngle: 12, maxAngle: 145 },
  index: { minAngle: 10, maxAngle: 155 },
  middle: { minAngle: 10, maxAngle: 155 },
  ring: { minAngle: 10, maxAngle: 150 },
  pinky: { minAngle: 10, maxAngle: 145 },
  wrist: { minAngle: -55, maxAngle: 55 },
};

export function normalizeServoAngles(
  kinematics: HandKinematics,
  calibration: UserCalibrationProfile = DEFAULT_CALIBRATION
): ServoState {
  const norm = (val: number, min: number, max: number) => {
    if (max <= min) return 0;
    const raw = (val - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, raw));
    // 3% deadband near 0 to avoid jitter when fingers are relaxed/open
    if (clamped < 0.03) return 0;
    // 3% deadband near 1 for confident full fist closure
    if (clamped > 0.97) return 1;
    // Rescale smoothly in between
    return (clamped - 0.03) / (0.97 - 0.03);
  };

  return {
    thumb: norm(kinematics.flexions.thumb.total, calibration.thumb.minAngle, calibration.thumb.maxAngle),
    index: norm(kinematics.flexions.index.total, calibration.index.minAngle, calibration.index.maxAngle),
    middle: norm(kinematics.flexions.middle.total, calibration.middle.minAngle, calibration.middle.maxAngle),
    ring: norm(kinematics.flexions.ring.total, calibration.ring.minAngle, calibration.ring.maxAngle),
    pinky: norm(kinematics.flexions.pinky.total, calibration.pinky.minAngle, calibration.pinky.maxAngle),
    wrist: norm(kinematics.palmOrientation.roll, calibration.wrist.minAngle, calibration.wrist.maxAngle),
  };
}

// Generator for synthetic testing (useful for testing or when camera is offline)
export function generateSyntheticHand(
  side: "left" | "right",
  pose: "open" | "fist" | "pinch" | "point" | "peace" | "bump" | "clap",
  t: number = 0
): LandmarkPoint[] {
  const lms: LandmarkPoint[] = [];
  const isBump = pose === "bump";
  const isClap = pose === "clap";
  
  // Position hands closer together when doing bump or clap
  const cx = isBump || isClap
    ? side === "left"
      ? 0.44 + Math.sin(t) * 0.01
      : 0.56 - Math.sin(t) * 0.01
    : side === "left"
    ? 0.35
    : 0.65;
  const cy = 0.65;

  // Wrist
  lms.push({ x: cx, y: cy, z: isBump ? 0.05 : 0 });

  const isFist = pose === "fist" || isBump;
  const isPinch = pose === "pinch";
  const isPoint = pose === "point";
  const isPeace = pose === "peace";

  // Flexion factors per finger (0 = open, 1 = closed)
  const flexions = {
    thumb: isFist ? 0.95 : isPinch ? 0.75 : isClap ? 0.1 : 0.15,
    index: isFist || (isPinch && 0.8) ? 0.95 : isPoint || isPeace || isClap ? 0.05 : 0.1,
    middle: isFist || isPoint ? 0.95 : isPeace || isClap ? 0.05 : 0.1,
    ring: isFist || isPoint || isPeace ? 0.95 : isClap ? 0.05 : 0.1,
    pinky: isFist || isPoint || isPeace ? 0.95 : isClap ? 0.05 : 0.1,
  };

  // Build 4 points per finger
  const fingerBases = [
    { name: "thumb", base: [-0.08, -0.05], length: 0.14, angle: side === "left" ? -45 : 45 },
    { name: "index", base: [-0.05, -0.15], length: 0.22, angle: -10 },
    { name: "middle", base: [0.0, -0.17], length: 0.24, angle: 0 },
    { name: "ring", base: [0.04, -0.15], length: 0.21, angle: 8 },
    { name: "pinky", base: [0.08, -0.12], length: 0.17, angle: 16 },
  ];

  for (const f of fingerBases) {
    const fFactor = (flexions as any)[f.name] + Math.sin(t * 2) * 0.03;
    const bend = Math.max(0, Math.min(1, fFactor));
    const bx = cx + (side === "left" ? -f.base[0] : f.base[0]);
    const by = cy + f.base[1];

    lms.push({ x: bx, y: by, z: 0 }); // MCP
    const seg = f.length / 3;

    // Phalanx 1
    const p1_y = by - seg * Math.cos(bend * 0.5);
    const p1_z = seg * Math.sin(bend * 0.5);
    lms.push({ x: bx, y: p1_y, z: p1_z });

    // Phalanx 2
    const p2_y = p1_y - seg * Math.cos(bend * 1.2);
    const p2_z = p1_z + seg * Math.sin(bend * 1.2);
    lms.push({ x: bx, y: p2_y, z: p2_z });

    // Tip
    const tip_y = p2_y - seg * Math.cos(bend * 1.8);
    const tip_z = p2_z + seg * Math.sin(bend * 1.8);
    lms.push({ x: bx, y: tip_y, z: tip_z });
  }

  return lms;
}
