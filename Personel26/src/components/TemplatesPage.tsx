"use client";
import { useState } from "react";
import { LayoutTemplate, Plus, Trash2, Wand2, Save, X, CheckCircle2, AlertCircle } from "lucide-react";
import {
  MONTHS, type Department, type Personnel, type ShiftTemplate, type TemplateColumn,
  personnelInDepartment, normalizeTemplateColumns, formatDutyColumn,
} from "@/lib/shared";
import { staffGroupMeta, type StaffGroup } from "@/lib/shared";
import { Btn, Modal, Field, TextInput, cx } from "@/components/ui-kit";

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "İşlem başarısız");
  return data;
}

const PRESET_2: TemplateColumn[] = [
  { service: "Genel Servis", shiftLabel: "08:00–20:00", startTime: "08:00", endTime: "20:00" },
  { service: "Genel Servis", shiftLabel: "20:00–08:00", startTime: "20:00", endTime: "08:00" },
];
const PRESET_3: TemplateColumn[] = [
  { service: "Genel Servis", shiftLabel: "08:00–16:00", startTime: "08:00", endTime: "16:00" },
  { service: "Genel Servis", shiftLabel: "16:00–00:00", startTime: "16:00", endTime: "00:00" },
  { service: "Genel Servis", shiftLabel: "00:00–08:00", startTime: "00:00", endTime: "08:00" },
];

type Editing = { id: string; departmentId: string | null; name: string; columns: TemplateColumn[] };

export default function TemplatesPage({
  departments, personnel, templates, selectedDept, year, month, onTemplatesChanged, staffGroup = "SAGLIK",
}: {
  departments: Department[]; personnel: Personnel[]; templates: ShiftTemplate[];
  selectedDept: string; year: number; month: number;
  /** Şablon hangi grubun çizelgesine uygulanacak */
  staffGroup?: StaffGroup;
  onTemplatesChanged: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [clearOnApply, setClearOnApply] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const deptName = departments.find(d => d.id === selectedDept)?.name ?? "";
  const visible = templates.filter(t => !t.departmentId || t.departmentId === selectedDept);
  const deptPersonnel = personnel.filter(p => personnelInDepartment(p, selectedDept) && p.isActive);

  function newTemplate(count: 2 | 3) {
    setEditing({
      id: "", departmentId: null,
      name: count === 2 ? "2'li Vardiya Düzeni" : "3'lü Vardiya Düzeni",
      columns: (count === 2 ? PRESET_2 : PRESET_3).map(s => ({ ...s })),
    });
    setMsg(""); setErr("");
  }

  function startEdit(t: ShiftTemplate) {
    setEditing({
      id: t.id, departmentId: t.departmentId, name: t.name,
      columns: normalizeTemplateColumns(t.slots).map(c => ({ ...c })),
    });
    setMsg(""); setErr("");
  }

  async function saveTemplate() {
    if (!editing || !editing.name.trim() || !editing.columns.length) return;
    setBusy(true); setErr("");
    try {
      const payload = { name: editing.name.trim(), departmentId: editing.departmentId, slots: editing.columns };
      if (editing.id) {
        await api("/api/templates", "PATCH", { id: editing.id, ...payload });
      } else {
        await api("/api/templates", "POST", payload);
      }
      setEditing(null);
      setMsg("Şablon kaydedildi.");
      await onTemplatesChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Kaydedilemedi"); }
    finally { setBusy(false); }
  }

  async function removeTemplate(id: string) {
    if (!confirm("Şablon silinsin mi?")) return;
    await api("/api/templates", "DELETE", { id });
    await onTemplatesChanged();
  }

  async function applyTemplate(t: ShiftTemplate) {
    const cols = normalizeTemplateColumns(t.slots);
    if (!cols.length) return;
    if (clearOnApply && !confirm(`"${t.name}" şablonu ${deptName} servisine uygulanacak ve ${MONTHS[month]} ${year} ayındaki atamalar silinecek. Diğer aylar korunur. Devam?`)) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const res = await api("/api/templates/apply", "POST", {
        templateId: t.id, departmentId: selectedDept, clearAssignments: clearOnApply, year, month, staffGroup,
      });
      setMsg(`"${t.name}" uygulandı — ${res.columns} sütun kuruldu. Nöbet Çizelgesi sayfasından “Taslak Oluştur” ile doldurabilirsiniz.`);
      await onTemplatesChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Uygulanamadı"); }
    finally { setBusy(false); }
  }

  async function processTemplate(t: ShiftTemplate) {
    const cols = normalizeTemplateColumns(t.slots);
    if (!cols.length) return;
    if (!confirm(`"${t.name}" şablonu ${deptName} servisinde ${MONTHS[month]} ${year} ayına işlenecek:\n• ${cols.length} sütun kurulacak\n• Ay dengeli taslakla doldurulacak\n• Mevcut atamalar silinecek\n\nDevam?`)) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const res = await api("/api/templates/process", "POST", {
        templateId: t.id, departmentId: selectedDept, year, month, staffGroup,
      });
      setMsg(`"${res.template}" işlendi: ${res.columns} sütun kuruldu, ${res.placed} atama yerleştirildi${res.skipped ? ` (${res.skipped} hücre boş bırakıldı)` : ""}. Sonucu Nöbet Çizelgesi sayfasında görebilirsiniz.`);
      await onTemplatesChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "İşlenemedi"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-grotesk)" }}>
          <LayoutTemplate className="w-4 h-4 text-violet-400" /> Vardiya Şablonları
        </h2>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-white/60 text-xs bg-white/[.05] border border-white/10 rounded-lg px-3 py-2 cursor-pointer">
          <input type="checkbox" checked={clearOnApply} onChange={e => setClearOnApply(e.target.checked)} className="accent-sky-400" />
          Uygularken bu ayın atamalarını temizle (diğer aylar korunur)
        </label>
        <Btn small variant="primary" onClick={() => newTemplate(2)}><Plus className="w-3.5 h-3.5" /> 2&apos;li Şablon</Btn>
        <Btn small variant="primary" onClick={() => newTemplate(3)}><Plus className="w-3.5 h-3.5" /> 3&apos;lü Şablon</Btn>
      </div>

      {msg && <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 text-xs rounded-xl px-4 py-2.5 anim-slide"><CheckCircle2 className="w-4 h-4" />{msg}</div>}
      {err && <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/40 text-rose-200 text-xs rounded-xl px-4 py-2.5 anim-slide"><AlertCircle className="w-4 h-4" />{err}</div>}

      <p className="text-white/40 text-xs">
        Şablonlar, nöbet çizelgesindeki <b className="text-white/65">“Hizmet (Saat)” sütun düzenlerini</b> kaydeder.
        Hedef: <b className="text-white/70">{deptName} · {MONTHS[month]} {year}</b> ({deptPersonnel.length} aktif personel) ·
        <b className="text-white/65"> Uygula</b> yalnızca sütunları kurar, <b className="text-white/65">İşle</b> sütunları kurup ayı taslakla doldurur.
      </p>

      <div className="grid md:grid-cols-2 gap-3">
        {visible.map(t => {
          const cols = normalizeTemplateColumns(t.slots);
          return (
            <div key={t.id} className="panel p-4 space-y-3 anim-slide">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-white font-bold text-xs">{t.name}</div>
                  <div className="text-white/35 text-[11px]">{cols.length} sütun · {t.departmentId ? deptName : "Tüm servisler"}</div>
                </div>
                <div className="flex gap-1.5">
                  <Btn small onClick={() => startEdit(t)}>Düzenle</Btn>
                  <Btn small variant="danger" onClick={() => removeTemplate(t.id)}><Trash2 className="w-3.5 h-3.5" /></Btn>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cols.map((c, i) => (
                  <span key={i} className="text-[11px] bg-white/[.06] border border-white/12 rounded-md px-2 py-1 text-white/75">
                    <b className="text-white">{formatDutyColumn(c)}</b>
                    <span className="text-white/40 ml-1">{c.startTime}–{c.endTime}</span>
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn small variant="amber" onClick={() => applyTemplate(t)} disabled={busy} title="Yalnızca sütun düzenini kur">
                  {deptName} · {staffGroupMeta(staffGroup).short} çizelgesine uygula
                </Btn>
                <Btn small variant="primary" onClick={() => processTemplate(t)} disabled={busy} title={`${MONTHS[month]} ${year} ayını bu şablonla doldur`}>
                  <Wand2 className="w-3.5 h-3.5" /> {MONTHS[month]} {year} Ayına İşle
                </Btn>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="panel p-8 text-center text-white/40 text-xs md:col-span-2">
            Henüz şablon yok. Sağ üstten 2&apos;li veya 3&apos;lü düzen ekleyin.
          </div>
        )}
      </div>

      {editing && (
        <Modal wide title={<><Save className="w-4 h-4 text-sky-400" /> {editing.id ? "Şablonu Düzenle" : "Yeni Şablon"}</>} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <Field label="Şablon Adı">
              <TextInput value={editing.name} onChange={e => setEditing(p => p ? { ...p, name: e.target.value } : p)} />
            </Field>
            <Field label="Genel şablon mu?" hint="İşaretli ise şablon tüm servislerde kullanılabilir.">
              <label className="flex items-center gap-2 text-white/70 text-xs bg-white/5 rounded-lg px-3 py-2 cursor-pointer">
                <input
                  type="checkbox" className="accent-sky-400"
                  checked={!editing.departmentId}
                  onChange={e => setEditing(p => p ? { ...p, departmentId: e.target.checked ? null : selectedDept } : p)}
                />
                Tüm servislerde görünsün
              </label>
            </Field>
            <div className="space-y-2">
              {editing.columns.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-end gap-2 bg-white/[.03] border border-white/10 rounded-xl p-2.5">
                  <Field label="Hizmet">
                    <TextInput value={c.service} onChange={e => setEditing(p => p ? { ...p, columns: p.columns.map((x, j) => j === i ? { ...x, service: e.target.value } : x) } : p)} />
                  </Field>
                  <Field label="Saat Etiketi">
                    <TextInput value={c.shiftLabel} placeholder="08:00–20:00" onChange={e => setEditing(p => p ? { ...p, columns: p.columns.map((x, j) => j === i ? { ...x, shiftLabel: e.target.value } : x) } : p)} />
                  </Field>
                  <Field label="Başlangıç">
                    <input type="time" value={c.startTime} onChange={e => setEditing(p => p ? { ...p, columns: p.columns.map((x, j) => j === i ? { ...x, startTime: e.target.value } : x) } : p)}
                      className="bg-white/[.07] border border-white/15 rounded-lg px-2 py-2 text-white text-xs outline-none focus:border-sky-400/70" />
                  </Field>
                  <Field label="Bitiş">
                    <input type="time" value={c.endTime} onChange={e => setEditing(p => p ? { ...p, columns: p.columns.map((x, j) => j === i ? { ...x, endTime: e.target.value } : x) } : p)}
                      className="bg-white/[.07] border border-white/15 rounded-lg px-2 py-2 text-white text-xs outline-none focus:border-sky-400/70" />
                  </Field>
                  <button
                    onClick={() => setEditing(p => p ? { ...p, columns: p.columns.filter((_, j) => j !== i) } : p)}
                    className={cx("p-2 rounded-lg text-white/40 hover:text-rose-300 hover:bg-rose-500/10 transition", editing.columns.length <= 1 && "opacity-30 pointer-events-none")}
                    title="Sütunu sil"
                  ><X className="w-4 h-4" /></button>
                </div>
              ))}
              <Btn small onClick={() => setEditing(p => p ? { ...p, columns: [...p.columns, { service: deptName, shiftLabel: "", startTime: "08:00", endTime: "16:00" }] } : p)}>
                <Plus className="w-3.5 h-3.5" /> Sütun Ekle
              </Btn>
            </div>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setEditing(null)}>İptal</Btn>
              <Btn variant="primary" onClick={saveTemplate} disabled={busy || !editing.name.trim() || !editing.columns.length}>
                <Save className="w-4 h-4" /> Kaydet
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
