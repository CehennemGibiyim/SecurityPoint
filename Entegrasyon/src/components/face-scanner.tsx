"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";
import {
  beep,
  captureFrame,
  detectDescriptor,
  drawBiometricMesh,
  loadFaceModels,
  playLivenessSuccessChime,
} from "@/lib/face-client";
import { LivenessTracker, type LivenessMetrics } from "@/lib/liveness-engine";
import type { AccessAction, AccessResponse, BreakType } from "@/lib/types";

export function FaceScanner({
  doorId,
  action,
  breakType,
  enabled,
  onResult,
}: {
  doorId: number;
  action: AccessAction;
  breakType: BreakType;
  enabled: boolean;
  onResult: (result: AccessResponse) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<LivenessTracker>(new LivenessTracker());

  const [status, setStatus] = useState("Modeller yükleniyor…");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<LivenessMetrics | null>(null);
  const [spoofAlarm, setSpoofAlarm] = useState<string | null>(null);
  const [antiSpoofMode, setAntiSpoofMode] = useState<"standard" | "high_assurance">("standard");

  const busyRef = useRef(false);
  const stableRef = useRef(0);
  const cfgRef = useRef({ doorId, action, breakType, enabled, onResult, antiSpoofMode });
  cfgRef.current = { doorId, action, breakType, enabled, onResult, antiSpoofMode };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let cancelled = false;

    async function loop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || cancelled) return;

      if (video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          try {
            const detection = await detectDescriptor(video);

            if (detection && detection.landmarks) {
              const metrics = trackerRef.current.feed(
                detection.landmarks.positions,
                detection.detection.box,
              );
              setTelemetry(metrics);

              // Draw biometric mesh
              drawBiometricMesh(ctx, detection.landmarks.positions, detection.detection.box, {
                livenessScore: metrics.livenessScore,
                isSpoof: metrics.isSpoofRisk,
                activeColor: "#2ee9d0",
              });

              const cfg = cfgRef.current;

              // Check for presentation attacks (printed photo / static screen)
              if (metrics.isSpoofRisk) {
                setSpoofAlarm("⚠️ SAHTE GİRİŞİM: Statik 2D fotoğraf veya ekran tespit edildi!");
              } else {
                setSpoofAlarm(null);
              }

              if (cfg.enabled && !busyRef.current && detection.detection.score > 0.52) {
                // If high assurance mode is active, require micro-motion / blink / liveness score > 80
                const isLivenessPass =
                  cfg.antiSpoofMode === "high_assurance"
                    ? metrics.livenessScore >= 80 && !metrics.isSpoofRisk
                    : !metrics.isSpoofRisk;

                if (!isLivenessPass && metrics.isSpoofRisk) {
                  // Direct Spoof Alarm to Server
                  busyRef.current = true;
                  setStatus("Sahtecilik Engellendi (Fotoğraf / Ekran)");
                  beep(false);

                  const snapshot = captureFrame(video);
                  void jsonFetch<AccessResponse>("/api/recognize", {
                    method: "POST",
                    body: JSON.stringify({
                      doorId: cfg.doorId,
                      action: cfg.action,
                      breakType: cfg.breakType,
                      snapshot,
                      isSpoof: true,
                      livenessScore: metrics.livenessScore,
                    }),
                  }).then((res) => {
                    cfg.onResult(res);
                  }).finally(() => {
                    window.setTimeout(() => {
                      busyRef.current = false;
                      setStatus("Sonraki yüzü bekliyor");
                      trackerRef.current.reset();
                    }, 3500);
                  });
                  return;
                }

                stableRef.current += 1;
                if (stableRef.current >= 2) {
                  busyRef.current = true;
                  stableRef.current = 0;
                  setStatus("Yüz kilitlendi & Canlılık doğrulandı…");

                  const descriptor = Array.from(detection.descriptor);
                  const snapshot = captureFrame(video);

                  try {
                    const response = await jsonFetch<AccessResponse>("/api/recognize", {
                      method: "POST",
                      body: JSON.stringify({
                        doorId: cfg.doorId,
                        action: cfg.action,
                        breakType: cfg.breakType,
                        descriptor,
                        snapshot,
                        livenessScore: metrics.livenessScore,
                        isSpoof: false,
                      }),
                    });

                    if (response.ok) {
                      playLivenessSuccessChime();
                    } else {
                      beep(false);
                    }

                    cfg.onResult(response);
                    setStatus(response.message);
                  } catch (error) {
                    setStatus(error instanceof Error ? error.message : "Doğrulama hatası");
                  } finally {
                    window.setTimeout(() => {
                      busyRef.current = false;
                      setStatus("Sonraki yüzü bekliyor");
                      trackerRef.current.reset();
                    }, 2800);
                  }
                }
              }
            } else {
              stableRef.current = 0;
              setTelemetry(null);
            }
          } catch {
            /* skip frame */
          }
        }
      }

      timer = window.setTimeout(() => void loop(), 140);
    }

    async function boot() {
      try {
        await loadFaceModels();
        if (cancelled) return;
        setStatus("Kamera açılıyor…");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("Yüzü çerçeveye hizalayın");
        void loop();
      } catch {
        setCameraError(
          "Kamera açılamadı. Tarayıcı izni verin veya sicil tuşlarıyla imza alın.",
        );
        setStatus("Kamera yok — sicil ile devam");
      }
    }

    void boot();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Main Viewfinder Frame */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[28px] bg-black ring-1 ring-cyan-300/20 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        <div className="pointer-events-none absolute inset-5 rounded-3xl border border-cyan-200/20" />
        <div className="scan-line" />

        {/* Spoof Alert Overlay */}
        {spoofAlarm ? (
          <div className="absolute top-4 left-4 right-4 flex items-center gap-2 rounded-xl bg-rose-500/90 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{spoofAlarm}</span>
          </div>
        ) : null}

        {/* Bottom HUD Bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
          <p className="text-sm font-medium text-cyan-100">{cameraError ?? status}</p>
          {telemetry ? (
            <div className="flex items-center gap-2">
              <Badge tone={telemetry.isSpoofRisk ? "bad" : "ok"}>
                {telemetry.isSpoofRisk ? "Sahte Risk" : `Canlılık: %${Math.round(telemetry.livenessScore)}`}
              </Badge>
            </div>
          ) : null}
        </div>
      </div>

      {/* Security Mode Selector & Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/8 bg-white/3 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-cyan-300" />
          <span>Anti-Spoofing Koruması:</span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setAntiSpoofMode("standard")}
            className={`rounded-lg px-2.5 py-1 text-xs transition ${
              antiSpoofMode === "standard"
                ? "bg-cyan-400 text-slate-950 font-semibold"
                : "bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            Hızlı Geçiş (Mikro-hareket)
          </button>
          <button
            onClick={() => setAntiSpoofMode("high_assurance")}
            className={`rounded-lg px-2.5 py-1 text-xs transition ${
              antiSpoofMode === "high_assurance"
                ? "bg-amber-200 text-slate-950 font-semibold"
                : "bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            Yüksek Güvenlik (%80+ Canlılık)
          </button>
        </div>
      </div>
    </div>
  );
}
