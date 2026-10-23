import type { FacePoint } from "@/types/face-api";

export type LivenessMetrics = {
  earLeft: number;
  earRight: number;
  earAvg: number;
  mar: number;
  yaw: number;
  pitch: number;
  roll: number;
  isBlinking: boolean;
  isSmiling: boolean;
  isMouthOpen: boolean;
  headPose: "center" | "left" | "right" | "up" | "down";
  livenessScore: number;
  isSpoofRisk: boolean;
  spoofReason?: string;
};

export type EnrollmentPhase =
  | "ready"
  | "frontal"
  | "blink"
  | "smile"
  | "turn_left"
  | "turn_right"
  | "processing"
  | "completed";

export function distance(p1: FacePoint, p2: FacePoint): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Eye Aspect Ratio (EAR) - Soukupová and Čech formula
 * EAR = (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)
 */
export function calculateEAR(eye: FacePoint[]): number {
  if (!eye || eye.length < 6) return 0.3;
  const p1 = eye[0];
  const p2 = eye[1];
  const p3 = eye[2];
  const p4 = eye[3];
  const p5 = eye[4];
  const p6 = eye[5];

  const vertical1 = distance(p2, p6);
  const vertical2 = distance(p3, p5);
  const horizontal = distance(p1, p4);

  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Mouth Aspect Ratio (MAR) & Smile Ratio
 * Uses inner/outer lip landmarks for muscular elasticity check
 */
export function calculateMAR(mouth: FacePoint[]): { mar: number; smileRatio: number } {
  if (!mouth || mouth.length < 12) return { mar: 0, smileRatio: 1.0 };
  const leftCorner = mouth[0];
  const rightCorner = mouth[6];
  const mouthWidth = distance(leftCorner, rightCorner);

  const topLip = mouth[3];
  const bottomLip = mouth[9];
  const mouthHeight = distance(topLip, bottomLip);

  const mar = mouthWidth === 0 ? 0 : mouthHeight / mouthWidth;

  const topInner = mouth.length >= 18 ? mouth[14] : topLip;
  const bottomInner = mouth.length >= 18 ? mouth[18] : bottomLip;
  const innerHeight = distance(topInner, bottomInner);

  const smileRatio = mouthWidth === 0 ? 0 : innerHeight / mouthWidth;

  return { mar, smileRatio };
}

/**
 * 3D Head Pose Approximation (Yaw & Pitch) from 2D Landmarks
 * Compares nose tip position relative to eye midpoint & jaw boundaries
 */
export function estimateHeadPose(
  landmarks: FacePoint[],
): { yaw: number; pitch: number; roll: number; pose: "center" | "left" | "right" | "up" | "down" } {
  if (!landmarks || landmarks.length < 68) {
    return { yaw: 0, pitch: 0, roll: 0, pose: "center" };
  }

  const leftEyeOuter = landmarks[36];
  const rightEyeOuter = landmarks[45];
  const noseTip = landmarks[30];
  const noseRoot = landmarks[27];
  const chin = landmarks[8];
  const leftCheek = landmarks[0];
  const rightCheek = landmarks[16];

  // Roll: Angle between eyes
  const eyeDx = rightEyeOuter.x - leftEyeOuter.x;
  const eyeDy = rightEyeOuter.y - leftEyeOuter.y;
  const roll = (Math.atan2(eyeDy, eyeDx) * 180) / Math.PI;

  // Yaw: Asymmetry of nose tip relative to left/right cheeks
  const distToLeft = distance(noseTip, leftCheek);
  const distToRight = distance(noseTip, rightCheek);
  const totalWidth = distToLeft + distToRight;
  const yawRatio = totalWidth === 0 ? 0 : (distToRight - distToLeft) / totalWidth;
  const yaw = yawRatio * 60; // approximate degrees (-30 to +30)

  // Pitch: Nose tip vs nose root and chin
  const upperNoseLen = distance(noseRoot, noseTip);
  const lowerNoseToChin = distance(noseTip, chin);
  const pitchRatio = lowerNoseToChin === 0 ? 1 : upperNoseLen / lowerNoseToChin;
  const pitch = (pitchRatio - 0.65) * 50; // approximate pitch

  let pose: "center" | "left" | "right" | "up" | "down" = "center";
  if (yaw > 12) pose = "right";
  else if (yaw < -12) pose = "left";
  else if (pitch > 14) pose = "up";
  else if (pitch < -14) pose = "down";

  return { yaw, pitch, roll, pose };
}

/**
 * Multi-frame Landmark History Tracker for Liveness & Micro-motion Verification
 */
export class LivenessTracker {
  private history: {
    timestamp: number;
    ear: number;
    mar: number;
    yaw: number;
    pitch: number;
    boxCenter: { x: number; y: number };
  }[] = [];

  private maxHistory = 45; // ~2-3 seconds at 15-20fps
  private blinkDetected = false;
  private smileDetected = false;
  private yawMotionDetected = false;

  reset() {
    this.history = [];
    this.blinkDetected = false;
    this.smileDetected = false;
    this.yawMotionDetected = false;
  }

  feed(landmarks: FacePoint[], box: { x: number; y: number; width: number; height: number }): LivenessMetrics {
    const leftEye = landmarks.slice(36, 42);
    const rightEye = landmarks.slice(42, 48);
    const mouth = landmarks.slice(48, 68);

    const earLeft = calculateEAR(leftEye);
    const earRight = calculateEAR(rightEye);
    const earAvg = (earLeft + earRight) / 2.0;

    const { mar, smileRatio } = calculateMAR(mouth);
    const { yaw, pitch, roll, pose } = estimateHeadPose(landmarks);

    const boxCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    this.history.push({
      timestamp: Date.now(),
      ear: earAvg,
      mar,
      yaw,
      pitch,
      boxCenter,
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Dynamic Blink Detection: EAR drops below 0.20 and rises back above 0.26
    const minEar = Math.min(...this.history.map((h) => h.ear));
    const maxEar = Math.max(...this.history.map((h) => h.ear));
    const earVariance = maxEar - minEar;
    const isBlinking = earAvg < 0.21;
    if (earVariance > 0.08 && minEar < 0.22) {
      this.blinkDetected = true;
    }

    // Smile/Mouth Elasticity: MAR changes or wide smile detected
    const isSmiling = mar > 0.28 || smileRatio > 0.18;
    const isMouthOpen = mar > 0.45;
    const marVariance =
      Math.max(...this.history.map((h) => h.mar)) - Math.min(...this.history.map((h) => h.mar));
    if (marVariance > 0.12 || isSmiling) {
      this.smileDetected = true;
    }

    // Yaw/3D Parallax: Yaw changes naturally
    const minYaw = Math.min(...this.history.map((h) => h.yaw));
    const maxYaw = Math.max(...this.history.map((h) => h.yaw));
    const yawVariance = maxYaw - minYaw;
    if (yawVariance > 8.0) {
      this.yawMotionDetected = true;
    }

    // Calculate overall Liveness Score (0 to 100)
    let score = 65; // base score for detected valid face

    // Micro-motion bonus (a real face is never 100.00% completely static like a photo print)
    if (this.history.length >= 8) {
      const centerDx =
        Math.max(...this.history.map((h) => h.boxCenter.x)) -
        Math.min(...this.history.map((h) => h.boxCenter.x));
      const centerDy =
        Math.max(...this.history.map((h) => h.boxCenter.y)) -
        Math.min(...this.history.map((h) => h.boxCenter.y));
      const microJitter = centerDx + centerDy;

      // Natural micro-jitter is between 0.8px and 25px. Exactly 0px indicates a frozen frame/photo mount.
      if (microJitter > 0.5) score += 10;
      if (earVariance > 0.03) score += 10;
      if (this.blinkDetected) score += 10;
      if (this.yawMotionDetected || yawVariance > 3) score += 5;
    }

    const clampedScore = Math.min(100, Math.max(10, score));

    // Anti-spoof risk logic:
    // If analyzed for > 20 frames and earVariance == 0 AND yawVariance == 0 -> likely static photo
    const isSpoofRisk =
      this.history.length >= 25 &&
      earVariance < 0.015 &&
      yawVariance < 1.0;

    return {
      earLeft,
      earRight,
      earAvg,
      mar,
      yaw,
      pitch,
      roll,
      isBlinking,
      isSmiling,
      isMouthOpen,
      headPose: pose,
      livenessScore: clampedScore,
      isSpoofRisk,
      spoofReason: isSpoofRisk ? "Statik görüntü / 2D fotoğraf şüphesi (göz ve kafa mikro-hareketi yok)" : undefined,
    };
  }

  hasPassedBlink() {
    return this.blinkDetected;
  }

  hasPassedSmile() {
    return this.smileDetected;
  }

  hasPassedYaw() {
    return this.yawMotionDetected;
  }
}
