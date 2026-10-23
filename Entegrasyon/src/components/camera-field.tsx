"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, RotateCw, X } from "lucide-react";
import { captureFrame } from "@/lib/face-client";
import { Button, cn } from "@/components/ui";

/**
 * Biyometrik kameradan personel fotoğrafı yakalar.
 *
 * Kamera yalnızca kullanıcı "Kameradan fotoğraf çek"e bastığında açılır ve
 * fotoğraf alındığında (ya da vazgeçildiğinde) kapatılır — sekme boyunca
 * kamera göstergesi yanmaz. Seçilen görüntü `data:image/jpeg` olarak
 * `value` üzerinden forma geri döner ve POST /api/employees alanındaki
 * `photoUrl` ile kaydedilir.
 */
export function CameraField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (photo: string | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }

  // Bileşen kaldırıldığında (form kapatıldığında) kamerayı mutlaka bırak.
  useEffect(() => stop, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setActive(true);
      // <video> bir sonraki render'da mount olur; mount sonrası akışı bağla.
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;
        video.srcObject = streamRef.current;
        void video.play().catch(() => {});
      });
    } catch {
      setError("Kamera açılamadı — tarayıcı izinlerini kontrol edin.");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const dataUrl = captureFrame(video, 0.85);
    stop();
    if (dataUrl) {
      onChange(dataUrl);
      setError(null);
    } else {
      setError("Görüntü alınamadı, tekrar deneyin.");
    }
  }

  if (active) {
    return (
      <div className="rounded-2xl border border-cyan-400/25 bg-black/40 p-3">
        <div className="relative overflow-hidden rounded-xl">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-44 w-full bg-black object-cover"
          />
          {/* Yüz hizalama nişangâhı — kadraja girmeyi kolaylaştırır */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-28 w-24 rounded-[45%] border border-cyan-300/50 shadow-[0_0_18px_rgba(46,233,208,0.35)]" />
          </div>
          <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-rose-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
            CANLI
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button type="button" onClick={capture} className="gap-2">
            <Check className="h-4 w-4" />
            Fotoğrafı Al
          </Button>
          <Button
            type="button"
            tone="ghost"
            onClick={() => {
              stop();
              setError(null);
            }}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Vazgeç
          </Button>
        </div>
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      {value ? (
        <div className="flex items-center gap-3">
          <img
            src={value}
            alt="Personel fotoğrafı"
            className="h-20 w-20 rounded-xl object-cover ring-1 ring-cyan-400/40"
          />
          <div className="flex flex-col gap-2">
            <Button type="button" tone="ghost" onClick={() => void start()} className="gap-2">
              <RotateCw className="h-4 w-4" />
              Yeniden Çek
            </Button>
            <Button
              type="button"
              tone="ghost"
              onClick={() => onChange(null)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Kaldır
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          tone="ghost"
          onClick={() => void start()}
          className={cn("w-full gap-2 border border-dashed border-cyan-400/35")}
        >
          <Camera className="h-4 w-4" />
          Kameradan Fotoğraf Çek
        </Button>
      )}
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
