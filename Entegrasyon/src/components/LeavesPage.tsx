"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Plus, Check, X, Trash2, CheckCircle2, XCircle, ShieldCheck,
  Clock, FileSpreadsheet, Filter,
} from "lucide-react";
import {
  LEAVE_TYPES, LEAVE_CODE_MAP, APPROVAL_FLOW, nextStage, daysBetween, fmtTr,
  type Department, type Personnel, type LeaveRequest, personnelInDepartment,
} from "@/lib/shared";
import { Btn, Modal, Field, TextInput, SelectInput, TextArea, Badge, Spinner, EmptyState, Avatar, cx } from "@/components/ui-kit";
import { downloadFromApi } from "@/lib/download";


async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "İşlem başarısız");
  return data;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Bekliyor", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  APPROVED: { label: "Onaylandı", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  REJECTED: { label: "Reddedildi", cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  CANCELLED: { label: "İptal", cls: "bg-slate-500/15 text-slate-300 border-slate-500/40" },
};

export default function LeavesPage({
  departments, personnel, selectedDept, year,
}: {
  departments: Department[]; personnel: Personnel[]; selectedDept: string; year: number;
}) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [showModal, setShowModal] = useState(false);
  const [err, setErr] = useState("");

  const dept = departments.find(d => d.id === selectedDept);
  const deptPersonnel = useMemo(
    () => personnel.filter(p => personnelInDepartment(p, selectedDept)).sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [personnel, selectedDept]
  );
  const persMap = useMemo(() => new Map(personnel.map(p => [p.id, p])), [personnel]);

  async function load() {
    setLoading(true);
    const ids = deptPersonnel.map(p => p.id);
    const res = await fetch(`/api/leaves?personnel=${ids.join(",")}`);
    const data = await res.json();
    setLeaves(data.leaves ?? []);
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedDept) load(); }, [selectedDept, personnel]);

  function signerFor(stage: string): string {
    if (stage === "HEMSIRE") return dept?.sorumluHemsire ?? "Sorumlu Hemşire";
    if (stage === "MUDUR") return dept?.saglikBakimMuduru ?? "Sağlık Bakım Müdürü";
    return dept?.bashekim ?? "Başhekim";
  }

  async function approveStage(l: LeaveRequest) {
    setErr("");
    try {
      await api("/api/leaves", "PATCH", { id: l.id, action: "approve-stage", by: signerFor(l.approvalStage) });
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Onaylanamadı"); }
  }
  async function rejectLeave(l: LeaveRequest) {
    const note = prompt("Ret gerekçesi (opsiyonel):") ?? "";
    if (note === null) return;
    setErr("");
    try { await api("/api/leaves", "PATCH", { id: l.id, action: "reject", by: signerFor(l.approvalStage), note }); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Reddedilemedi"); }
  }
  async function cancelLeave(l: LeaveRequest) {
    if (!confirm("Onaylanmış izin iptal edilsin mi? Puantajdaki izin kodları geri alınır.")) return;
    try { await api("/api/leaves", "PATCH", { id: l.id, action: "cancel" }); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "İptal edilemedi"); }
  }
  async function deleteLeave(l: LeaveRequest) {
    if (!confirm("İzin kaydı kalıcı olarak silinsin mi?")) return;
    await api("/api/leaves", "DELETE", { id: l.id });
    await load();
  }

  const filtered = filter === "ALL" ? leaves : leaves.filter(l => l.status === filter);
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: leaves.length };
    leaves.forEach(l => { c[l.status] = (c[l.status] || 0) + 1; });
    return c;
  }, [leaves]);

  function annualUsed(pid: string) {
    return leaves
      .filter(l => l.personnelId === pid && l.leaveType === "YILLIK" && l.status === "APPROVED" && l.startDate.startsWith(String(year)))
      .reduce((s, l) => s + l.daysCount, 0);
  }

  function exportExcel() {
    // Statik (GitHub Pages) sürümde de çalışması için fetch + blob ile indirilir.
    void downloadFromApi(
      `/api/export/izinler?dept=${selectedDept}&year=${year}&status=${filter}`,
      "izin_listesi.xlsx",
    ).catch(e => alert(e instanceof Error ? e.message : "İndirme başarısız"));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-grotesk)" }}>
          <CalendarDays className="w-4 h-4 text-emerald-400" /> İzin Yönetimi
        </h2>
        <div className="flex-1" />
        <Btn small onClick={exportExcel}><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</Btn>
        <Btn small variant="primary" onClick={() => setShowModal(true)}><Plus className="w-3.5 h-3.5" /> Yeni İzin Talebi</Btn>
      </div>

      <p className="text-white/40 text-xs flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
        Onay akışı: Sorumlu Hemşire → Sağlık Bakım Müdürü → Başhekim. Onaylanan izinler puantaja otomatik işlenir.
      </p>

      {err && <div className="bg-rose-500/10 border border-rose-500/40 text-rose-200 text-xs rounded-xl px-4 py-2.5 anim-slide">{err}</div>}

      {/* Filtre */}
      <div className="flex flex-wrap gap-1.5">
        {[["ALL", "Tümü"], ["PENDING", "Bekleyen"], ["APPROVED", "Onaylı"], ["REJECTED", "Reddedilen"], ["CANCELLED", "İptal"]].map(([k, label]) => (
          <button
            key={k} onClick={() => setFilter(k)}
            className={cx(
              "px-3 py-1.5 rounded-lg border text-xs font-semibold transition flex items-center gap-1.5",
              filter === k ? "bg-sky-500/15 border-sky-400/60 text-sky-300" : "bg-white/[.04] border-white/10 text-white/50 hover:text-white"
            )}
          >
            <Filter className="w-3 h-3 opacity-50" />{label}
            <span className="bg-white/10 rounded px-1.5 py-0.5 text-[10px]">{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>

      {loading ? <Spinner label="İzinler yükleniyor…" /> : filtered.length === 0 ? (
        <EmptyState icon={<CalendarDays className="w-8 h-8" />} title="Kayıt yok" desc="Bu filtrede izin talebi bulunmuyor." />
      ) : (
        <div className="grid gap-2">
          {filtered.map(l => {
            const p = persMap.get(l.personnelId);
            const meta = LEAVE_CODE_MAP[l.leaveType];
            const sm = STATUS_META[l.status] ?? STATUS_META.PENDING;
            const stage = APPROVAL_FLOW.find(f => f.stage === l.approvalStage);
            return (
              <div key={l.id} className="panel px-4 py-3 anim-slide">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Avatar person={p ?? { id: l.personnelId, name: "?" }} size={36} />
                  <div className="min-w-[150px]">
                    <div className="text-white font-bold text-xs">{p?.name ?? "?"}</div>
                    <div className="text-white/35 text-[11px]">
                      {p?.title ?? ""}
                      {l.leaveType === "YILLIK" && p ? ` · Yıllık: ${annualUsed(p.id)}/${p.annualLeaveBalance ?? "-"} gün` : ""}
                    </div>
                  </div>
                  <Badge className={meta?.color ?? "bg-slate-500/20 text-slate-300 border-slate-500/40"}>{meta?.label ?? l.leaveType}</Badge>
                  <div className="text-white/80 text-xs font-medium whitespace-nowrap">
                    {fmtTr(l.startDate)} → {fmtTr(l.endDate)}
                    <span className="text-white/40 text-xs ml-1.5">({l.daysCount} gün)</span>
                  </div>
                  {l.reason && <div className="text-white/40 text-xs italic truncate max-w-[220px]" title={l.reason}>“{l.reason}”</div>}
                  <div className="flex-1" />
                  <Badge className={sm.cls}>{sm.label}</Badge>
                  {l.status === "PENDING" && stage && (
                    <Badge className="bg-white/[.06] text-white/60 border-white/15"><Clock className="w-3 h-3" />{stage.short} bekliyor</Badge>
                  )}
                </div>

                {/* Aşama çubuğu */}
                <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2.5 border-t border-white/[.07]">
                  <div className="flex items-center gap-1">
                    {APPROVAL_FLOW.map((f, i) => {
                      const done = l.status === "APPROVED" ||
                        (f.stage === "HEMSIRE" && l.approvalStage !== "HEMSIRE") ||
                        (f.stage === "MUDUR" && ["BASHEKIM", "DONE"].includes(l.approvalStage)) ||
                        (f.stage === "BASHEKIM" && l.approvalStage === "DONE");
                      const current = l.status === "PENDING" && l.approvalStage === f.stage;
                      return (
                        <div key={f.stage} className="flex items-center gap-1">
                          <div className={cx(
                            "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition",
                            done ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
                            current ? "bg-amber-500/15 text-amber-300 border-amber-500/40 animate-[pulseGlow_1.6s_infinite]" :
                            "bg-white/[.04] text-white/30 border-white/10"
                          )}>
                            {done ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 text-center">{i + 1}</span>}
                            {f.short}
                          </div>
                          {i < APPROVAL_FLOW.length - 1 && <span className="text-white/20 text-xs">→</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex-1" />
                  {l.status === "PENDING" && (
                    <>
                      <Btn small variant="success" onClick={() => approveStage(l)}>
                        <Check className="w-3.5 h-3.5" /> {stage ? `${stage.short} Onayla` : "Onayla"}
                      </Btn>
                      <Btn small variant="danger" onClick={() => rejectLeave(l)}>
                        <XCircle className="w-3.5 h-3.5" /> Reddet
                      </Btn>
                    </>
                  )}
                  {l.status === "APPROVED" && (
                    <Btn small variant="amber" onClick={() => cancelLeave(l)}><X className="w-3.5 h-3.5" /> İptal Et</Btn>
                  )}
                  <Btn small onClick={() => deleteLeave(l)} title="Kaydı sil"><Trash2 className="w-3.5 h-3.5" /></Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <NewLeaveModal
          personnel={deptPersonnel.filter(p => p.isActive)}
          onCreated={() => { load(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function NewLeaveModal({ personnel, onCreated, onClose }: {
  personnel: Personnel[]; onCreated: () => void; onClose: () => void;
}) {
  const [pid, setPid] = useState(personnel[0]?.id ?? "");
  const [type, setType] = useState("YILLIK");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const days = start && end ? daysBetween(start, end) : 0;

  async function save() {
    if (!pid || !start || !end) return;
    setSaving(true); setErr("");
    try {
      await api("/api/leaves", "POST", { personnelId: pid, leaveType: type, startDate: start, endDate: end, reason: reason || null });
      onCreated();
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Kaydedilemedi"); setSaving(false); }
  }

  return (
    <Modal title={<><Plus className="w-4 h-4 text-emerald-400" /> Yeni İzin Talebi</>} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Personel">
          <SelectInput value={pid} onChange={e => setPid(e.target.value)}>
            {personnel.map(p => <option key={p.id} value={p.id}>{p.name}{p.title ? ` — ${p.title}` : ""}</option>)}
          </SelectInput>
        </Field>
        <Field label="İzin Türü">
          <div className="grid grid-cols-3 gap-1.5">
            {LEAVE_TYPES.map(t => (
              <button
                key={t.key} onClick={() => setType(t.key)}
                className={cx(
                  "px-2 py-2 rounded-lg border text-[11px] font-bold transition",
                  type === t.key ? t.color : "bg-white/[.04] border-white/10 text-white/45 hover:text-white"
                )}
              >{t.label}</button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Başlangıç">
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70" />
          </Field>
          <Field label="Bitiş">
            <input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)}
              className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70" />
          </Field>
        </div>
        {days > 0 && <p className="text-sky-300 text-xs font-semibold">{days} gün sürecek</p>}
        <Field label="Gerekçe (opsiyonel)">
          <TextArea value={reason} onChange={e => setReason(e.target.value)} placeholder="İzin gerekçesi…" />
        </Field>
        {err && <p className="text-rose-300 text-xs bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>İptal</Btn>
          <Btn variant="primary" onClick={save} disabled={!pid || !start || !end || saving}>
            <Check className="w-4 h-4" /> {saving ? "Kaydediliyor…" : "Talep Oluştur"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
