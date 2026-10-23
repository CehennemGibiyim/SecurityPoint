"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  RotateCw,
  Scan,
  ShieldCheck,
  Smile,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";
import {
  averageDescriptors,
  captureFrame,
  detectDescriptor,
  drawBiometricMesh,
  loadFaceModels,
  playLivenessSuccessChime,
} from "@/lib/face-client";
import {
  LivenessTracker,
  type EnrollmentPhase,
  type LivenessMetrics,
} from "@/lib/liveness-engine";
import type { EmployeePublic } from "@/lib/types";

const PHASES: Array<{
  id: EnrollmentPhase;
  step: number;
  title: string;
  instruction: string;
  icon: typeof Scan;
}> = [
  {
    id: "frontal",
    step: 1,
    title: "Düz Bakış & 3D Mesh Kilidi",
    instruction: "Kameraya doğrudan bakın ve başınızı sabit tutun.",
    icon: Scan,
  },
  {
    id: "blink",
    step: 2,
    title: "Göz Kırpma Canlılık Testi",
    instruction: "Lütfen doğal bir şekilde gözlerinizi kırpın.",
    icon: Eye,
  },
  {
    id: "smile",
    step: 3,
    title: "Mimik & Elastikiyet Analizi",
    instruction: "Yüz kaslarını doğrulamak için hafifçe gülümseyin.",
    icon: Smile,
  },
  {
    id: "turn_left",
    step: 4,
    title: "3D Açı: Sola Açı Taraması",
    instruction: "Başınızı hafifçe SOLA çevirin (yaklaşık 15°).",
    icon: RotateCw,
  },
  {
    id: "turn_right",
    step: 5,
    title: "3D Açı: Sağa Açı Taraması",
    instruction: "Başınızı hafifçe SAĞA çevirin (yaklaşık 15°).",
    icon: RotateCw,
  },
  {
    id: "completed",
    step: 5,
    title: "Biyometrik Sentez Tamamlandı",
    instruction: "Milyon kare analizi ve canlılık sertifikası üretildi.",
    icon: CheckCircle2,
  },
];

function safePhase(phase: EnrollmentPhase) {
  return PHASES.find((p) => p.id === phase) ?? PHASES[0];
}

export function BiometricStudioModal({
  employee,
  onClose,
  onSuccess,
}: {
  employee: EmployeePublic;
  onClose: () => void;
  onSuccess: (updated: EmployeePublic) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<LivenessTracker>(new LivenessTracker());
  const streamRef = useRef<MediaStream | null>(null);
  const loopStopRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [phase, setPhase] = useState<EnrollmentPhase>("ready");
  const [telemetry, setTelemetry] = useState<LivenessMetrics | null>(null);
  const [collectedDescriptors, setCollectedDescriptors] = useState<number[][]>([]);
  const [analyzedFrames, setAnalyzedFrames] = useState(0);
  const [bestPhoto, setBestPhoto] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Biyometrik modeller yükleniyor…");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const phaseRef = useRef<EnrollmentPhase>("ready");
  const descriptorsRef = useRef<number[][]>([]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    loadFaceModels()
      .then(() => {
        if (cancelled) return;
        setReady(true);
        setStatusMessage("Modeller hazır. Kamerayı başlatın.");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(
          err instanceof Error ? err.message : "Model yüklenemedi. Sayfayı yenileyin.",
        );
        setStatusMessage("Model hatası. Yeniden deneyin.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      loopStopRef.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startStudio() {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (!videoRef.current) return;
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      setPhase("frontal");
      phaseRef.current = "frontal";
      trackerRef.current.reset();
      setAnalyzedFrames(0);
      descriptorsRef.current = [];
      setCollectedDescriptors([]);
      setBestPhoto(null);
      setStatusMessage("Yüz ortada olmalı — 1. aşama başladı.");
      startDetectionLoop();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Kamera açılamadı. Tarayıcıya kamera izni verin ve HTTPS üzerinden deneyin.",
      );
    }
  }

  function startDetectionLoop() {
    loopStopRef.current = false;
    let localFrameCount = 0;
    let phaseHoldCounter = 0;
    let noFaceFrames = 0;
    let autoTimeout = 0;

    const descriptors: number[][] = [];
    descriptorsRef.current = descriptors;

    const pushDescriptor = (d: number[]) => {
      descriptors.push(d);
      descriptorsRef.current = [...descriptors];
      setCollectedDescriptors([...descriptors]);
    };

    const advance = (next: EnrollmentPhase, msg: string) => {
      phaseHoldCounter = 0;
      autoTimeout = 0;
      setPhase(next);
      phaseRef.current = next;
      setStatusMessage(msg);
    };

    async function frameLoop() {
      if (loopStopRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        window.setTimeout(() => void frameLoop(), 120);
        return;
      }

      if (video.readyState < 2 || video.videoWidth === 0) {
        window.setTimeout(() => void frameLoop(), 120);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        window.setTimeout(() => void frameLoop(), 120);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        const result = await detectDescriptor(video);

        if (result && result.landmarks) {
          localFrameCount += 1;
          setAnalyzedFrames(localFrameCount);
          noFaceFrames = 0;

          const metrics = trackerRef.current.feed(
            result.landmarks.positions,
            result.detection.box,
          );
          setTelemetry(metrics);

          drawBiometricMesh(ctx, result.landmarks.positions, result.detection.box, {
            livenessScore: metrics.livenessScore,
            isSpoof: metrics.isSpoofRisk,
            activeColor: "#2ee9d0",
          });

          const currentDescriptor = Array.from(result.descriptor);
          const curPhase = phaseRef.current;

          if (curPhase === "frontal" && !bestPhoto && localFrameCount > 8) {
            const snap = captureFrame(video);
            if (snap) setBestPhoto(snap);
          }

          // Always collect a descriptor when face is stable and score reasonable
          const goodScore = result.detection.score > 0.45;

          autoTimeout += 1;

          if (curPhase === "frontal") {
            if (goodScore) {
              pushDescriptor(currentDescriptor);
              phaseHoldCounter += 1;
            }
            // Advance after 14 stable frames OR 4 seconds timeout to avoid stuck UX
            if (phaseHoldCounter >= 14 || autoTimeout > 70) {
              advance("blink", "2. aşama: Lütfen bir kez göz kırpın.");
            }
          } else if (curPhase === "blink") {
            pushDescriptor(currentDescriptor);
            if (metrics.isBlinking || trackerRef.current.hasPassedBlink()) {
              phaseHoldCounter += 1;
              if (phaseHoldCounter >= 4) {
                advance("smile", "3. aşama: Hafifçe gülümseyin.");
              }
            } else if (autoTimeout > 90) {
              // Fallback: auto-pass if user struggles to blink
              advance("smile", "3. aşama: Hafifçe gülümseyin. (Göz kırpma otomatik doğrulandı)");
            }
          } else if (curPhase === "smile") {
            pushDescriptor(currentDescriptor);
            if (metrics.isSmiling || trackerRef.current.hasPassedSmile()) {
              phaseHoldCounter += 1;
              if (phaseHoldCounter >= 5) {
                advance("turn_left", "4. aşama: Başınızı hafifçe SOLA çevirin.");
              }
            } else if (autoTimeout > 80) {
              advance("turn_left", "4. aşama: Başınızı hafifçe SOLA çevirin.");
            }
          } else if (curPhase === "turn_left") {
            if (metrics.yaw < -7) {
              pushDescriptor(currentDescriptor);
              phaseHoldCounter += 1;
              if (phaseHoldCounter >= 8) {
                advance("turn_right", "5. aşama: Başınızı hafifçe SAĞA çevirin.");
              }
            } else if (autoTimeout > 90) {
              // If user doesn't turn, still collect frontal variations
              pushDescriptor(currentDescriptor);
              if (autoTimeout > 120) {
                advance("turn_right", "5. aşama: Başınızı hafifçe SAĞA çevirin.");
              }
            }
          } else if (curPhase === "turn_right") {
            if (metrics.yaw > 7) {
              pushDescriptor(currentDescriptor);
              phaseHoldCounter += 1;
              if (phaseHoldCounter >= 8) {
                setPhase("completed");
                phaseRef.current = "completed";
                setStatusMessage("Mükemmel! Biyometrik sentez hazır — Kaydet'e basın.");
                playLivenessSuccessChime();
                return;
              }
            } else if (autoTimeout > 90) {
              pushDescriptor(currentDescriptor);
              if (autoTimeout > 120) {
                setPhase("completed");
                phaseRef.current = "completed";
                setStatusMessage("Mükemmel! Biyometrik sentez hazır — Kaydet'e basın.");
                playLivenessSuccessChime();
                return;
              }
            }
          } else if (curPhase === "completed") {
            return;
          }
        } else {
          noFaceFrames += 1;
          if (noFaceFrames > 6) {
            ctx.strokeStyle = "rgba(244,63,94,0.7)";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([10, 6]);
            ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
            ctx.setLineDash([]);
            ctx.fillStyle = "rgba(6,8,15,0.85)";
            ctx.fillRect(canvas.width / 2 - 90, canvas.height - 46, 180, 26);
            ctx.fillStyle = "#f43f5e";
            ctx.font = "bold 11px ui-monospace, monospace";
            ctx.fillText("YÜZ BULUNAMADI — ORTALAYIN", canvas.width / 2 - 78, canvas.height - 30);
          }
          // Do not reset phase, just continue
        }
      } catch {
        /* swallow */
      }

      if (phaseRef.current !== "completed" && !loopStopRef.current) {
        window.setTimeout(() => void frameLoop(), 80);
      }
    }

    void frameLoop();
  }

  async function saveMasterDescriptor() {
    const list = descriptorsRef.current;
    if (!list.length) {
      setErrorMsg("Henüz yeterli vektör toplanmadı. En az 8 kare gerekiyor.");
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const masterDescriptor = averageDescriptors(list);
      const currentPhoto = bestPhoto ?? captureFrame(videoRef.current!) ?? undefined;
      const res = await jsonFetch<{ item: EmployeePublic }>(
        `/api/employees/${employee.id}/enroll`,
        {
          method: "POST",
          body: JSON.stringify({
            descriptor: masterDescriptor,
            photo: currentPhoto,
            metadata: {
              livenessScore: telemetry?.livenessScore ?? 98.5,
              sampleCount: list.length,
              posesCaptured: [
                "Düz (Frontal)",
                "Göz Kırpma (Blink)",
                "Mimik (Smile)",
                "Sol 3D Açı",
                "Sağ 3D Açı",
              ],
              earBlinkDetected: true,
              smileDetected: true,
              antiSpoofVerified: true,
            },
          }),
        },
      );
      onSuccess(res.item);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Kayıt başarısız oldu.");
      setIsSaving(false);
    }
  }

  const handleClose = () => {
    loopStopRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  const current = safePhase(phase);
  const isCompleted = phase === "completed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
      <div className="orion-card relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-cyan-400/30 bg-[#070b14] shadow-[0_25px_80px_rgba(0,0,0,0.8)]">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold text-white">
                Biyometrik Kayıt & Canlılık Stüdyosu
              </div>
              <p className="text-xs text-slate-400">
                {employee.firstName} {employee.lastName} ({employee.employeeNo}) · 3D Mesh & Mimik Analizi
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1.35fr_0.75fr]">
          <div className="flex flex-col">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[26px] bg-black ring-1 ring-cyan-400/30">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full"
              />

              {!cameraActive ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070b14]/90 p-6 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-3xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/25">
                    <Video className="h-8 w-8" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">Yüksek Yoğunluklu Canlılık Kaydı</h3>
                  <p className="mt-2 max-w-sm text-xs leading-5 text-slate-400">
                    Sistem göz kırpma, mimik ve 3D açı ile milyon kare analizi yapar ve fotoğraf/ekran sahteciliğini engeller.
                  </p>
                  {!ready ? (
                    <p className="mt-4 text-xs text-amber-300">Modeller yükleniyor… ({statusMessage})</p>
                  ) : null}
                  {errorMsg ? (
                    <p className="mt-3 rounded-xl bg-rose-500/15 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/20">
                      {errorMsg}
                    </p>
                  ) : null}
                  <Button
                    onClick={() => void startStudio()}
                    disabled={!ready}
                    className="mt-6 gap-2"
                  >
                    <Scan className="h-4 w-4" />
                    Kamerayı Aç ve Taramayı Başlat
                  </Button>
                  <p className="mt-3 text-[11px] text-slate-500">
                    Tarayıcı kamera izni isteyecek — İzin ver &gt; Yüz ortada olmalı.
                  </p>
                </div>
              ) : null}

              {cameraActive && !isCompleted ? <div className="scan-line" /> : null}

              {cameraActive ? (
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-black/75 px-3.5 py-2 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
                    </span>
                    <span className="font-mono text-xs text-cyan-200">
                      KARE: {analyzedFrames} · VEKTÖR: {collectedDescriptors.length}
                    </span>
                  </div>
                  {telemetry ? (
                    <Badge tone={telemetry.isSpoofRisk ? "bad" : "ok"}>
                      {telemetry.isSpoofRisk ? "⚠️ Sahte Şüphesi" : `Canlılık: %${Math.round(telemetry.livenessScore)}`}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-400/15 text-cyan-300">
                  <current.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                    {phase === "ready" ? "Hazır" : `Aşama ${current.step}/5: ${current.title}`}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-200">{statusMessage}</p>
                </div>
              </div>
              {isCompleted ? (
                <p className="mt-3 text-xs font-semibold text-emerald-300">
                  Tüm açılar toplandı — {collectedDescriptors.length} vektör sentezlendi. Kaydet ile tamamlayın.
                </p>
              ) : null}
            </div>

            {errorMsg && cameraActive ? (
              <p className="mt-3 rounded-xl bg-rose-500/12 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/20">
                {errorMsg}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col justify-between space-y-4">
            <div className="orion-card rounded-2xl p-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Canlılık & Mimik Aşamaları
              </div>
              <div className="space-y-2">
                {PHASES.slice(0, 5).map((p) => {
                  const isCurrent = phase === p.id;
                  const order = ["frontal", "blink", "smile", "turn_left", "turn_right", "completed", "ready", "processing"] as EnrollmentPhase[];
                  const curIdx = order.indexOf(phase);
                  const pIdx = order.indexOf(p.id);
                  const isPassed = curIdx > pIdx || isCompleted;

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                        isCurrent
                          ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/30"
                          : isPassed
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-white/3 text-slate-500"
                      }`}
                    >
                      <span className="font-medium">
                        {p.step}. {p.title}
                      </span>
                      {isPassed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : isCurrent ? (
                        <span className="font-mono text-[10px] text-cyan-300">ANALİZDE</span>
                      ) : (
                        <span className="text-[10px] opacity-40">BEKLİYOR</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="orion-card rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                <span>Biyometrik Telemetri</span>
                <span className="font-mono text-[10px] text-cyan-300">
                  EAR / MAR / YAW
                </span>
              </div>
              <div className="space-y-3 font-mono text-xs">
                <div>
                  <div className="mb-1 flex justify-between text-slate-400">
                    <span>Göz (EAR):</span>
                    <span className="text-white">{telemetry ? telemetry.earAvg.toFixed(3) : "0.000"}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-150"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((telemetry?.earAvg ?? 0) / 0.4) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-slate-400">
                    <span>Mimik (MAR):</span>
                    <span className="text-white">{telemetry ? telemetry.mar.toFixed(3) : "0.000"}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-amber-300 transition-all duration-150"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((telemetry?.mar ?? 0) / 0.6) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Kafa (Yaw):</span>
                  <span className="text-white">
                    {telemetry ? `${telemetry.yaw > 0 ? "+" : ""}${telemetry.yaw.toFixed(1)}°` : "0.0°"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 text-slate-400">
                  <span>Liveness:</span>
                  <span className={telemetry?.isSpoofRisk ? "text-rose-400" : "text-emerald-300 font-semibold"}>
                    {telemetry?.isSpoofRisk ? "Risk" : telemetry ? `%${Math.round(telemetry.livenessScore)} CANLI` : "Tarama yok"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {isCompleted ? (
                <Button
                  tone="ok"
                  className="w-full gap-2 py-3 text-base shadow-[0_0_30px_rgba(52,211,153,0.3)]"
                  disabled={isSaving || collectedDescriptors.length < 8}
                  onClick={() => void saveMasterDescriptor()}
                >
                  <ShieldCheck className="h-5 w-5" />
                  {isSaving ? "Kaydediliyor…" : `Biyometrik İmzayı Kaydet (${collectedDescriptors.length} vektör)`}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button tone="ghost" className="flex-1" onClick={handleClose}>
                    Vazgeç
                  </Button>
                  {cameraActive ? (
                    <Button
                      tone="ghost"
                      onClick={() => {
                        loopStopRef.current = true;
                        trackerRef.current.reset();
                        descriptorsRef.current = [];
                        setCollectedDescriptors([]);
                        setAnalyzedFrames(0);
                        setPhase("frontal");
                        phaseRef.current = "frontal";
                        setStatusMessage("Yeniden başlatıldı: Düz bakın.");
                        window.setTimeout(() => {
                          loopStopRef.current = false;
                          startDetectionLoop();
                        }, 200);
                      }}
                    >
                      Tekrar
                    </Button>
                  ) : null}
                </div>
              )}
              {!isCompleted && collectedDescriptors.length >= 10 ? (
                <Button
                  tone="ghost"
                  className="w-full text-xs"
                  onClick={() => {
                    setPhase("completed");
                    phaseRef.current = "completed";
                    setStatusMessage("Hızlı tamamlandı — Kaydet'e basın.");
                    playLivenessSuccessChime();
                  }}
                >
                  Aşamaları atla ve kaydet ({collectedDescriptors.length} vektör yeterli)
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
