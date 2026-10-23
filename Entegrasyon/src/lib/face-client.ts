import type { FaceDetectionResult, FacePoint } from "@/types/face-api";

let modelsPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.faceapi) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-faceapi]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("face-api yüklenemedi")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    const base = (process.env.NEXT_PUBLIC_P26_BASE_PATH ?? "").replace(/\/$/, "");
    script.src = `${base}/vendor/face-api.min.js`;
    script.async = true;
    script.dataset.faceapi = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("face-api yüklenemedi"));
    document.body.appendChild(script);
  });
}

export function loadFaceModels(): Promise<void> {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      await loadScript();
      const faceapi = window.faceapi;
      if (!faceapi) throw new Error("Yüz motoru hazır değil");
      const base = (process.env.NEXT_PUBLIC_P26_BASE_PATH ?? "").replace(/\/$/, "");
      const modelUri = `${base}/models`;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelUri),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelUri),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelUri),
      ]);
    })().catch((error) => {
      modelsPromise = null;
      throw error;
    });
  }
  return modelsPromise;
}

export function detectorOptions(): unknown {
  const faceapi = window.faceapi;
  if (!faceapi) throw new Error("Yüz motoru hazır değil");
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.42,
  });
}

export async function detectDescriptor(video: HTMLVideoElement): Promise<FaceDetectionResult | null> {
  const faceapi = window.faceapi;
  if (!faceapi) return null;
  const res = await faceapi
    .detectSingleFace(video, detectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  return res ?? null;
}

export function captureFrame(video: HTMLVideoElement, quality = 0.85): string | null {
  const canvas = document.createElement("canvas");
  const w = 640;
  const h = Math.round((video.videoHeight / Math.max(video.videoWidth, 1)) * w) || 480;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export function averageDescriptors(list: number[][]): number[] {
  if (!list.length) return [];
  const dim = list[0].length;
  const out = new Array<number>(dim).fill(0);
  for (const item of list) {
    for (let i = 0; i < dim; i += 1) out[i] += item[i] ?? 0;
  }
  return out.map((value) => value / list.length);
}

/**
 * Draws Futuristic 3D Biometric Mesh Wireframe & HUD Elements on Canvas
 */
export function drawBiometricMesh(
  ctx: CanvasRenderingContext2D,
  landmarks: FacePoint[],
  box: { x: number; y: number; width: number; height: number },
  options: {
    livenessScore?: number;
    isSpoof?: boolean;
    activeColor?: string;
    showMeshLines?: boolean;
  } = {},
) {
  const color = options.isSpoof ? "#f43f5e" : options.activeColor || "#2ee9d0";
  const { x, y, width, height } = box;

  // 1. Futuristic Bounding Corners
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;

  const cornerLen = Math.min(28, width * 0.2);
  // Top-Left
  ctx.beginPath();
  ctx.moveTo(x, y + cornerLen);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cornerLen, y);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(x + width - cornerLen, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + cornerLen);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(x, y + height - cornerLen);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + cornerLen, y + height);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(x + width - cornerLen, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - cornerLen);
  ctx.stroke();

  // Soft box fill
  ctx.fillStyle = options.isSpoof ? "rgba(244,63,94,0.08)" : "rgba(46,233,208,0.06)";
  ctx.fillRect(x, y, width, height);

  // 2. Draw Landmark Points & Connecting Lines (Face Mesh Wireframe)
  if (landmarks && landmarks.length >= 68) {
    ctx.fillStyle = options.isSpoof ? "#f43f5e" : "#e8c36a";

    // Draw individual nodes
    for (let i = 0; i < landmarks.length; i += 1) {
      const pt = landmarks[i];
      if (!pt) continue;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, i >= 27 && i <= 35 ? 2.2 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Connect eyes, eyebrows, nose bridge, lips and jaw line
    ctx.strokeStyle = options.isSpoof ? "rgba(244,63,94,0.4)" : "rgba(46,233,208,0.35)";
    ctx.lineWidth = 1;

    const connect = (indices: number[], close = false) => {
      ctx.beginPath();
      for (let i = 0; i < indices.length; i += 1) {
        const pt = landmarks[indices[i]];
        if (!pt) continue;
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      if (close) ctx.closePath();
      ctx.stroke();
    };

    // Jaw outline (0-16)
    connect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    // Eyebrows
    connect([17, 18, 19, 20, 21]);
    connect([22, 23, 24, 25, 26]);
    // Nose bridge & base
    connect([27, 28, 29, 30]);
    connect([31, 32, 33, 34, 35], true);
    // Left eye (36-41)
    connect([36, 37, 38, 39, 40, 41], true);
    // Right eye (42-47)
    connect([42, 43, 44, 45, 46, 47], true);
    // Outer lips (48-59)
    connect([48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59], true);
    // Inner lips (60-67)
    connect([60, 61, 62, 63, 64, 65, 66, 67], true);

    // Cross-mesh depth triangulation lines for 3D visual effect
    if (options.showMeshLines !== false) {
      ctx.strokeStyle = "rgba(232,195,106,0.18)";
      ctx.beginPath();
      // Nose tip to eyes
      const noseTip = landmarks[30];
      const leftPupil = landmarks[36];
      const rightPupil = landmarks[45];
      const chin = landmarks[8];
      if (noseTip && leftPupil && rightPupil && chin) {
        ctx.moveTo(leftPupil.x, leftPupil.y);
        ctx.lineTo(noseTip.x, noseTip.y);
        ctx.lineTo(rightPupil.x, rightPupil.y);
        ctx.lineTo(chin.x, chin.y);
        ctx.lineTo(noseTip.x, noseTip.y);
      }
      ctx.stroke();
    }
  }

  // 3. Mini telemetry tag above box
  ctx.fillStyle = "rgba(6,8,15,0.85)";
  ctx.fillRect(x, Math.max(0, y - 24), Math.min(180, width), 20);
  ctx.fillStyle = color;
  ctx.font = "bold 11px ui-monospace, monospace";
  const tagText = options.isSpoof
    ? "⚠️ SPOOF DETECTED"
    : `LIVENESS: ${options.livenessScore ? `${Math.round(options.livenessScore)}%` : "SCANNING"}`;
  ctx.fillText(tagText, x + 6, Math.max(14, y - 10));

  ctx.restore();
}

export function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = ok ? "sine" : "square";
    osc.frequency.value = ok ? 880 : 196;
    gain.gain.value = 0.04;
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.14 : 0.32));
  } catch {
    /* ignore */
  }
}

export function playLivenessSuccessChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.04, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    };

    playTone(523.25, now, 0.12); // C5
    playTone(659.25, now + 0.1, 0.12); // E5
    playTone(783.99, now + 0.2, 0.25); // G5
  } catch {
    /* ignore */
  }
}
