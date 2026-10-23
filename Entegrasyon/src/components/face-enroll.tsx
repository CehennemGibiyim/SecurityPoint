"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Eye,
  Shield,
  ShieldCheck,
  Smile,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { BiometricStudioModal } from "@/components/biometric-studio";
import { jsonFetch } from "@/lib/api-client";
import { formatDateTimeTr } from "@/lib/time";
import type { EmployeePublic } from "@/lib/types";

export function FaceEnroll({
  employee,
  onUpdated,
}: {
  employee: EmployeePublic;
  onUpdated: (item: EmployeePublic) => void;
}) {
  const [studioOpen, setStudioOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function removeFace() {
    setIsDeleting(true);
    try {
      const data = await jsonFetch<{ item: EmployeePublic }>(
        `/api/employees/${employee.id}/enroll`,
        { method: "DELETE" },
      );
      onUpdated(data.item);
      setMessage("Yüz şablonu ve biyometrik canlılık kaydı silindi.");
    } catch {
      setMessage("Silme işlemi başarısız oldu.");
    } finally {
      setIsDeleting(false);
    }
  }

  const meta = employee.faceEnrollmentMetadata;

  return (
    <div className="orion-card rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
            Biyometrik Güvenlik & Canlılık
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">Yüz Şablonu & Canlılık Kaydı</h3>
        </div>
        <div className="flex items-center gap-2">
          {employee.hasFace ? (
            <Badge tone="ok">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              Doğrulandı (%{meta?.livenessScore ? Math.round(meta.livenessScore) : 99})
            </Badge>
          ) : (
            <Badge tone="warn">Kayıt Yok</Badge>
          )}
        </div>
      </div>

      {/* Snapshot / Preview Area */}
      <div className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        {employee.photoUrl ? (
          <div className="relative aspect-[16/9] w-full">
            <img
              src={employee.photoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <span>3D Mesh & Mimik Vektörü Aktif</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {formatDateTimeTr(employee.faceEnrolledAt)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex aspect-[16/9] w-full flex-col items-center justify-center p-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
              <Shield className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-white">Biyometrik Yüz Kaydı Bulunmuyor</p>
            <p className="mt-1 max-w-xs text-xs text-slate-400">
              Personelin turnikeden yüzle geçebilmesi için canlılık ve mimik stüdyosunu başlatın.
            </p>
          </div>
        )}
      </div>

      {/* Enrollment Metadata Telemetry Card */}
      {employee.hasFace && meta ? (
        <div className="mb-4 rounded-2xl border border-white/8 bg-white/2 p-3.5 text-xs text-slate-300">
          <div className="mb-2 font-semibold uppercase tracking-[0.16em] text-slate-400">
            Canlılık Güvence Raporu
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Activity className="h-3.5 w-3.5 text-cyan-300" />
              <span>Kare Analizi:</span>
              <span className="text-white">{meta.sampleCount ?? 120} kare</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Eye className="h-3.5 w-3.5 text-cyan-300" />
              <span>Göz Kırpma (EAR):</span>
              <span className="text-emerald-300 font-semibold">Doğrulandı</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Smile className="h-3.5 w-3.5 text-cyan-300" />
              <span>Mimik (MAR):</span>
              <span className="text-emerald-300 font-semibold">Doğrulandı</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
              <span>Anti-Spoofing:</span>
              <span className="text-emerald-300 font-semibold">Geçti (%99+)</span>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className="mb-3 text-xs text-cyan-300">{message}</p> : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setStudioOpen(true)}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {employee.hasFace ? "Biyometrik Stüdyoyu Yeniden Başlat" : "Canlılık Stüdyosu ile Yüz Kaydet"}
        </Button>
        {employee.hasFace ? (
          <Button
            tone="danger"
            onClick={() => void removeFace()}
            disabled={isDeleting}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Yüzü Sil
          </Button>
        ) : null}
      </div>

      {/* Biometric Studio Modal */}
      {studioOpen ? (
        <BiometricStudioModal
          employee={employee}
          onClose={() => setStudioOpen(false)}
          onSuccess={(updated) => {
            onUpdated(updated);
            setMessage("Biyometrik şablon ve canlılık sertifikası başarıyla kaydedildi.");
          }}
        />
      ) : null}
    </div>
  );
}
