"use client";
import { useEffect, useRef, useState } from "react";
import { Database, Download, Upload, RotateCcw, ShieldCheck, RefreshCw, HardDriveDownload, FileJson, FileCode2, Clock3, X, AlertTriangle, Loader2, Check, ArrowUpRight } from "lucide-react";
import { downloadFromApi } from "@/lib/download";
import type { AppSettings } from "@/lib/settings";
import { cx } from "@/components/ui-kit";
type BackupRow = { id: string; filename: string; kind: string; recordCounts: Record<string, number>; createdAt: string };
export default function DatabaseSettings({ settings, setSettings, schemaVersion, onChanged, notify }: { settings: AppSettings; setSettings: (settings: AppSettings) => void; schemaVersion: string; onChanged: () => void; notify: (message: string, error?: boolean) => void }) {
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [restore, setRestore] = useState<{ id?: string; name: string; data?: unknown; counts: Record<string, number> } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [update, setUpdate] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function load() {
    try { const res = await fetch("/api/backup"); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Yedekler alınamadı."); setBackups(data.backups ?? []); }
    catch (e) { notify(e instanceof Error ? e.message : "Yedekler alınamadı.", true); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function create() {
    setBusy(true);
    try { const res = await fetch("/api/backup", { method: "POST" }); const data = await res.json(); if (!res.ok) throw new Error(data.error); notify("Yeni yedeğiniz güvenle oluşturuldu."); await load(); onChanged(); }
    catch (e) { notify(e instanceof Error ? e.message : "Yedek alınamadı.", true); } finally { setBusy(false); }
  }
  async function download(url: string, name: string) { try { await downloadFromApi(url, name); } catch (e) { notify(e instanceof Error ? e.message : "Dosya indirilemedi.", true); } }
  async function readBackup(file: File) {
    setBusy(true);
    try {
      if (!/\.json$/i.test(file.name)) throw new Error("Panelden geri yüklemek için Personel26 JSON yedeği seçin. SQL yedekleri Windows geri yükleme aracıyla açılır.");
      if (file.size > 30 * 1024 * 1024) throw new Error("Yedek en fazla 30 MB olabilir.");
      const input = JSON.parse(await file.text());
      const res = await fetch("/api/database", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview", data: input }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setRestore({ name: file.name, data: input, counts: data.counts }); setConfirm("");
    } catch (e) { notify(e instanceof Error ? e.message : "Dosya doğrulanamadı.", true); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function restoreNow() {
    if (!restore) return;
    setBusy(true);
    try {
      const res = await fetch(restore.id ? `/api/backup/${restore.id}` : "/api/database", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", data: restore.data, confirm }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      notify("Geri yükleme tamamlandı. Güvenlik yedeği saklandı. Panel yenileniyor…"); setRestore(null);
      setTimeout(() => window.location.reload(), 1300);
    } catch (e) { notify(e instanceof Error ? e.message : "Geri yükleme başarısız.", true); }
    finally { setBusy(false); }
  }
  async function updateNow() {
    setBusy(true);
    try { const res = await fetch("/api/database", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", confirm: "GÜNCELLE" }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); notify(`Şema ${data.version} sürümüne güncellendi. Verileriniz korundu.`); setUpdate(false); await load(); onChanged(); }
    catch (e) { notify(e instanceof Error ? e.message : "Güncelleme başarısız.", true); } finally { setBusy(false); }
  }
  return <div className="database-settings">
    <div className="database-actions"><div className="settings-card"><span className="settings-icon blue"><HardDriveDownload size={21} /></span><h3>Verilerinizi güvene alın</h3><p>Tüm personel, nöbet, puantaj ve ayarların anlık yedeğini oluşturun.</p><button className="settings-btn primary" onClick={create} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <HardDriveDownload size={15} />} Şimdi yedek al</button></div><div className="settings-card"><span className="settings-icon violet"><Upload size={21} /></span><h3>Yedekten geri yükleyin</h3><p>Bilgisayarınızdaki JSON yedeğini doğrulayın, içeriğini görün ve geri yükleyin.</p><button className="settings-btn" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={15} /> Yedek dosyası seç</button><input hidden type="file" accept=".json" ref={fileRef} onChange={e => { if (e.target.files?.[0]) void readBackup(e.target.files[0]); }} /></div><div className="settings-card"><span className="settings-icon green"><FileCode2 size={21} /></span><h3>SQL ile dışa aktarın</h3><p>Başka bir PostgreSQL kurulumuna taşımak için tam veri SQL’ini indirin.</p><button className="settings-btn" onClick={() => download("/api/database?format=sql", "personel26_veri_yedegi.sql")}><Download size={15} /> SQL yedeğini indir</button></div></div>
    <div className="settings-card backup-preferences"><div className="section-heading"><span className="settings-icon blue"><Clock3 size={19} /></span><div><h3>Otomatik yedekleme</h3><p>Her gün ilk kullanımda, son yedek 24 saatten eskiyse yeni yedek alınır.</p></div><button role="switch" aria-label="Otomatik yedekleme" aria-checked={settings.autoBackup} className={cx("settings-switch", settings.autoBackup && "on")} onClick={() => setSettings({ ...settings, autoBackup: !settings.autoBackup })}><span /></button></div><div className="backup-retention"><label>Saklanacak son yedek sayısı<input aria-label="Saklanacak yedek sayısı" className="settings-input" type="number" min={5} max={365} value={settings.backupRetention} onChange={e => setSettings({ ...settings, backupRetention: Number(e.target.value) })} /></label><p><ShieldCheck size={15} />Geri yüklemeden ve şema güncellemesinden önce güvenlik yedeği her zaman alınır.</p></div></div>
    <div className="settings-card backup-list"><div className="section-heading"><span className="settings-icon blue"><Database size={19} /></span><div><h3>Yedek geçmişi <span className="count-pill">{backups.length}</span></h3><p>Yedeklerinizi indirin veya güvenli bir tarihe geri dönün.</p></div><button className="settings-btn icon-only" aria-label="Yedekleri yenile" onClick={load}><RefreshCw size={15} /></button></div><div className="backup-table-scroll"><table className="settings-table"><thead><tr><th>YEDEK DOSYASI</th><th>TARİH</th><th>TÜR</th><th>KAYIT</th><th>İŞLEMLER</th></tr></thead><tbody>{backups.map(backup => <tr key={backup.id}><td><span className="backup-name"><FileJson size={18} /><b>{backup.filename}</b></span></td><td>{new Date(backup.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</td><td><span className={cx("row-status", backup.kind === "AUTO" ? "valid" : backup.kind === "SAFETY" ? "warning" : "manual")}>{({ AUTO: "Otomatik", MANUAL: "Manuel", SAFETY: "Güvenlik" } as Record<string, string>)[backup.kind]}</span></td><td>{Object.values(backup.recordCounts ?? {}).reduce((a, b) => a + b, 0).toLocaleString("tr-TR")}</td><td><div className="backup-row-actions"><button aria-label="JSON yedeğini indir" onClick={() => download(`/api/backup/${backup.id}`, backup.filename)}><Download size={15} /></button><button aria-label="Bu yedeği geri yükle" disabled={busy} onClick={() => { setRestore({ id: backup.id, name: backup.filename, counts: backup.recordCounts }); setConfirm(""); }}><RotateCcw size={15} /></button></div></td></tr>)}</tbody></table></div>{!backups.length && <div className="settings-empty">{loading ? "Yedekler yükleniyor…" : "Henüz yedek yok. İlk yedeğinizi oluşturabilirsiniz."}</div>}</div>
    <div className="settings-card schema-card"><div className="section-heading"><span className="settings-icon green"><FileCode2 size={20} /></span><div><h3>Veritabanı şeması <span className="row-status valid">{schemaVersion === "2026.01" ? "Güncel" : "Güncelleme mevcut"}</span></h3><p>Sürüm {schemaVersion} · Tekrar çalıştırılabilir SQL · Mevcut kayıtlar silinmez.</p></div></div><div className="schema-actions"><button className="settings-btn" onClick={() => download("/api/database?format=schema", "personel26_sema_guncellemesi.sql")}><Download size={15} /> Güncelleme SQL’ini indir</button><button className="settings-btn" disabled={busy} onClick={() => setUpdate(true)}><RefreshCw size={15} /> Şemayı güncelle</button><a className="settings-text-link" href={`${process.env.NEXT_PUBLIC_P26_BASE_PATH ?? ""}/database/personel26-schema.sql`} download>İlk kurulum SQL’i <ArrowUpRight size={14} /></a></div></div>
    <div className="settings-note"><ShieldCheck size={18} /><p><b>Önemli:</b> Aynı diskteki yedek donanım arızasına karşı yeterli değildir. JSON veya SQL yedeğinizi düzenli olarak başka bir diske kopyalayın. SQL dosyaları panelde çalıştırılmaz; Windows geri yükleme aracıyla kullanılır.</p></div>
    {(restore || update) && <div className="settings-modal-overlay" role="presentation" onClick={() => { if (!busy) { setRestore(null); setUpdate(false); } }}><div className="settings-modal" role="dialog" aria-modal="true" aria-label={restore ? "Yedeği geri yükle" : "Şemayı güncelle"} onClick={e => e.stopPropagation()}><button aria-label="Pencereyi kapat" className="settings-modal-close" disabled={busy} onClick={() => { setRestore(null); setUpdate(false); }}><X size={18} /></button><span className="settings-icon amber"><AlertTriangle size={25} /></span><h3>{restore ? "Yedeği geri yüklemek üzeresiniz" : "Şema güncellemesini onaylayın"}</h3><p>{restore ? "Mevcut verileriniz bu yedek ile değiştirilecek. İşlem öncesinde otomatik güvenlik yedeği alınacak." : "Önce güvenlik yedeği alınır. Ardından yalnızca sabit, veri silmeyen şema güncellemeleri uygulanır."}</p>{restore && <><div className="restore-preview"><b>{restore.name}</b><span>{restore.counts.personnel ?? 0} personel · {restore.counts.departments ?? 0} servis · {restore.counts.timesheet_entries ?? 0} puantaj kaydı</span></div><label className="restore-confirm-label">Onaylamak için <b>GERİ YÜKLE</b> yazın<input autoFocus className="settings-input" placeholder="GERİ YÜKLE" value={confirm} onChange={e => setConfirm(e.target.value)} /></label></>}<div className="settings-modal-actions"><button className="settings-btn" disabled={busy} onClick={() => { setRestore(null); setUpdate(false); }}>Vazgeç</button><button className="settings-btn primary" disabled={busy || Boolean(restore && confirm !== "GERİ YÜKLE")} onClick={restore ? restoreNow : updateNow}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{restore ? "Güvenle geri yükle" : "Güncellemeyi uygula"}</button></div></div></div>}
  </div>;
}
