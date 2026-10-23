"use client";
import { useEffect, useState } from "react";
import {
  HardDriveDownload, RefreshCw, Download, RotateCcw, DatabaseBackup, CheckCircle2,
  AlertTriangle, FileJson, ShieldCheck,
} from "lucide-react";
import { Btn, Spinner, EmptyState, Badge, cx } from "@/components/ui-kit";
import { downloadFromApi, lastBackupDownload } from "@/lib/download";


type BackupRow = {
  id: string; filename: string; kind: string; recordCounts: Record<string, number> | null; createdAt: string;
};

/** Yedeğe giren veriler (tablo anahtarı → görünen ad). */
const BACKUP_CONTENT: [string, string][] = [
  ["personnel", "Personel"], ["departments", "Servisler ve imza alanları"], ["personnel_departments", "Personel–servis atamaları"],
  ["shift_schedules", "Nöbet çizelgeleri"], ["duty_columns", "Nöbet sütunları"], ["timesheet_entries", "Puantaj kayıtları"],
  ["leave_requests", "İzinler"], ["shift_swap_requests", "Değişim talepleri"], ["shift_templates", "Vardiya şablonları"],
  ["weekly_overrides", "Haftalık düzenlemeler"], ["holidays", "Tatiller"], ["announcements", "Duyurular"],
  ["app_settings", "Ayarlar ve özel nöbet grupları"], ["activity_logs", "İşlem günlüğü"],
];
/** Bu kadar günden uzun süredir yedek indirilmediyse hatırlatılır. */
const REMIND_AFTER_DAYS = 7;

const KIND_LABEL: Record<string, { label: string; cls: string }> = {
  AUTO: { label: "Otomatik", cls: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  MANUAL: { label: "Manuel", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  SAFETY: { label: "Güvenlik", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
};

export default function BackupPage() {
  const [items, setItems] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [lastDl, setLastDl] = useState<Date | null>(null);
  useEffect(() => { setLastDl(lastBackupDownload()); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/backup");
    const data = await res.json();
    setItems(data.backups ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createNow() {
    setBusy(true); setMsg(""); setErr("");
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(`Yedek alındı: ${data.filename}`);
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Yedek alınamadı"); }
    finally { setBusy(false); }
  }

  async function downloadBackup(b: BackupRow) {
    // Sunucusuz (GitHub Pages) sürümde de çalışması için fetch + blob kullanılır.
    try {
      await downloadFromApi(`/api/backup/${b.id}`, b.filename);
      setLastDl(lastBackupDownload());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İndirme başarısız");
    }
  }

  async function restore(b: BackupRow) {
    if (!confirm(`"${b.filename}" geri yüklenecek. Mevcut tüm veriler bu yedekle değiştirilecek (önce otomatik güvenlik yedeği alınır). Devam?`)) return;
    setBusy(true); setMsg(""); setErr("");
    try {
      const res = await fetch(`/api/backup/${b.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "GERİ YÜKLE" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg("Geri yükleme tamamlandı. Sayfa yenileniyor…");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) { setErr(e instanceof Error ? e.message : "Geri yükleme başarısız"); setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-grotesk)" }}>
          <DatabaseBackup className="w-4 h-4 text-emerald-400" /> Yedekleme
        </h2>
        <span className="text-white/35 text-xs">Günlük otomatik yedek · son 30 yedek saklanır</span>
        <div className="flex-1" />
        <Btn small onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Btn>
        <Btn small variant="primary" onClick={createNow} disabled={busy}>
          <HardDriveDownload className="w-3.5 h-3.5" /> Şimdi Yedek Al
        </Btn>
      </div>

      {(() => {
        const days = lastDl ? Math.floor((Date.now() - lastDl.getTime()) / 86400000) : null;
        const stale = days === null || days >= REMIND_AFTER_DAYS;
        return (
          <div className={cx("flex flex-wrap items-start gap-2 rounded-xl border px-4 py-2.5 text-xs", stale ? "bg-amber-500/10 border-amber-500/40 text-amber-100" : "bg-emerald-500/10 border-emerald-500/40 text-emerald-100")}>
            {stale ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />}
            <div className="min-w-0 flex-1">
              <div className="font-bold">
                Son indirilen yedek: {lastDl ? `${lastDl.toLocaleString("tr-TR")} (${days === 0 ? "bugün" : `${days} gün önce`})` : "henüz hiç indirilmedi"}
              </div>
              <div className="opacity-80 mt-0.5">
                {stale
                  ? "Uygulama içindeki yedekler veritabanıyla aynı yerde durur. Tarayıcı verisi silinirse veya disk bozulursa birlikte kaybolur. Aşağıdan bir yedeği İndir'le başka bir yere (USB, bulut) kaydedin."
                  : "Yedeğin bir kopyası bu bilgisayardan dışarı alınmış. Önemli değişikliklerden sonra yenilemeyi unutmayın."}
              </div>
            </div>
          </div>
        );
      })()}

      <details className="panel px-4 py-3 text-xs text-white/70">
        <summary className="cursor-pointer font-bold text-white/85">Bu yedeğe ne giriyor?</summary>
        <div className="mt-2.5 grid sm:grid-cols-2 gap-x-6 gap-y-1">
          {BACKUP_CONTENT.map(([key, label]) => {
            const n = items[0]?.recordCounts?.[key];
            return (
              <div key={key} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{label}</span>
                {n !== undefined && <span className="text-white/35 ml-auto">{n.toLocaleString("tr-TR")} kayıt</span>}
              </div>
            );
          })}
        </div>
        <p className="mt-2.5 text-white/40 leading-relaxed">
          Kayıt sayıları en son yedeğe aittir. Yedeğe girmeyenler: bu tarayıcıya özel görünüm tercihleri (tema, yazdırma dipnotları) ve yedeklerin kendisi.
        </p>
      </details>

      {msg && <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 text-xs rounded-xl px-4 py-2.5 anim-slide"><CheckCircle2 className="w-4 h-4" />{msg}</div>}
      {err && <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/40 text-rose-200 text-xs rounded-xl px-4 py-2.5 anim-slide"><AlertTriangle className="w-4 h-4" />{err}</div>}

      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<DatabaseBackup className="w-8 h-8" />} title="Henüz yedek yok" desc="Uygulama her gün otomatik yedek alır; ayrıca manuel yedek oluşturabilirsiniz." />
      ) : (
        <div className="grid gap-2">
          {items.map((b, i) => {
            const kl = KIND_LABEL[b.kind] ?? KIND_LABEL.MANUAL;
            const total = Object.values(b.recordCounts ?? {}).reduce((s, n) => s + (n || 0), 0);
            return (
              <div key={b.id} className="panel px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2 anim-slide" style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
                <FileJson className="w-4 h-4 text-white/30 shrink-0" />
                <div className="min-w-0">
                  <div className="text-white font-bold text-xs truncate">{b.filename}</div>
                  <div className="text-white/35 text-[11px]">
                    {new Date(b.createdAt).toLocaleString("tr-TR")} · {total.toLocaleString("tr-TR")} kayıt
                    {b.recordCounts ? ` · ${b.recordCounts.personnel ?? 0} personel, ${b.recordCounts.shift_schedules ?? 0} vardiya, ${b.recordCounts.timesheet_entries ?? 0} puantaj` : ""}
                  </div>
                </div>
                <Badge className={kl.cls}>{kl.label}</Badge>
                <div className="flex-1" />
                <Btn small onClick={() => downloadBackup(b)}>
                  <Download className="w-3.5 h-3.5" /> İndir
                </Btn>
                <Btn small variant="amber" onClick={() => restore(b)} disabled={busy}>
                  <RotateCcw className="w-3.5 h-3.5" /> Geri Yükle
                </Btn>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
