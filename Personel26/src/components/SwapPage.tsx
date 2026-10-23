"use client";
import { useEffect, useMemo, useState } from "react";
import { Repeat, Plus, Check, X, Trash2, Clock, ArrowLeftRight } from "lucide-react";
import {
  type Department, type Personnel, type SwapRequest, type ShiftSchedule,
  personnelInDepartment, fmtTr,
} from "@/lib/shared";
import { Btn, Modal, Field, TextArea, Badge, Spinner, EmptyState, cx } from "@/components/ui-kit";

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

export default function SwapPage({
  departments, personnel, selectedDept, year, month,
}: {
  departments: Department[]; personnel: Personnel[]; selectedDept: string; year: number; month: number;
}) {
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const persMap = useMemo(() => new Map(personnel.map(p => [p.id, p])), [personnel]);
  const deptName = departments.find(d => d.id === selectedDept)?.name ?? "";

  async function load() {
    setLoading(true);
    const dim = new Date(year, month + 1, 0).getDate();
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
    const [swRes, scRes] = await Promise.all([
      fetch("/api/swaps"),
      fetch(`/api/schedules?dept=${selectedDept}&start=${start}&end=${end}`),
    ]);
    const sw = await swRes.json();
    const sc = await scRes.json();
    const deptPids = new Set(personnel.filter(p => personnelInDepartment(p, selectedDept)).map(p => p.id));
    setSwaps((sw.swaps ?? []).filter((s: SwapRequest) => deptPids.has(s.requesterId) || (s.targetPersonnelId && deptPids.has(s.targetPersonnelId))));
    setSchedules(sc.schedules ?? []);
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedDept) load(); }, [selectedDept, year, month, personnel]);

  async function decide(r: SwapRequest, action: "approve" | "reject") {
    await api("/api/swaps", "PATCH", { id: r.id, action, by: "Yönetici" });
    await load();
  }
  async function remove(r: SwapRequest) {
    if (!confirm("Talep silinsin mi?")) return;
    await api("/api/swaps", "DELETE", { id: r.id });
    await load();
  }

  const filtered = filter === "ALL" ? swaps : swaps.filter(s => s.status === filter);
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: swaps.length };
    swaps.forEach(s => { c[s.status] = (c[s.status] || 0) + 1; });
    return c;
  }, [swaps]);

  function shiftLabel(id: string | null) {
    if (!id) return null;
    const s = schedules.find(x => x.id === id);
    if (!s) return "vardiya silinmiş";
    return `${fmtTr(s.scheduleDate)} ${s.startTime}–${s.endTime}`;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-grotesk)" }}>
          <Repeat className="w-4 h-4 text-pink-400" /> Vardiya Değişim Talepleri
        </h2>
        <span className="text-white/35 text-xs">{deptName}</span>
        <div className="flex-1" />
        <Btn small variant="primary" onClick={() => setShowModal(true)}><Plus className="w-3.5 h-3.5" /> Yeni Talep</Btn>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[["ALL", "Tümü"], ["PENDING", "Bekleyen"], ["APPROVED", "Onaylı"], ["REJECTED", "Reddedilen"]].map(([k, label]) => (
          <button
            key={k} onClick={() => setFilter(k)}
            className={cx(
              "px-3 py-1.5 rounded-lg border text-xs font-semibold transition",
              filter === k ? "bg-sky-500/15 border-sky-400/60 text-sky-300" : "bg-white/[.04] border-white/10 text-white/50 hover:text-white"
            )}
          >{label} <span className="opacity-60">({counts[k] ?? 0})</span></button>
        ))}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={<ArrowLeftRight className="w-8 h-8" />} title="Değişim talebi yok" desc="Personel, nöbetini başka bir personelle değiştirmek için talep oluşturabilir." />
      ) : (
        <div className="grid gap-2">
          {filtered.map(r => {
            const req = persMap.get(r.requesterId);
            const tgt = r.targetPersonnelId ? persMap.get(r.targetPersonnelId) : null;
            const sm = STATUS_META[r.status] ?? STATUS_META.PENDING;
            return (
              <div key={r.id} className="panel px-4 py-3 anim-slide">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <ArrowLeftRight className="w-4 h-4 text-pink-400 shrink-0" />
                  <div className="text-white font-bold text-xs">{req?.name ?? "?"}</div>
                  <div className="text-white/60 text-xs">
                    {fmtTr(r.swapDate)} tarihli nöbetini {tgt ? <b className="text-white/85">{tgt.name}</b> : "uygun bir personel"} ile değiştirmek istiyor
                  </div>
                  <div className="flex-1" />
                  <Badge className={sm.cls}>{sm.label}</Badge>
                </div>
                {(shiftLabel(r.requesterShiftId) || shiftLabel(r.targetShiftId) || r.reason) && (
                  <div className="mt-1.5 text-white/40 text-xs flex flex-wrap gap-x-4 gap-y-0.5">
                    {shiftLabel(r.requesterShiftId) && <span>Talep edenin vardiyası: <b className="text-white/65">{shiftLabel(r.requesterShiftId)}</b></span>}
                    {shiftLabel(r.targetShiftId) && <span>Karşılık vardiya: <b className="text-white/65">{shiftLabel(r.targetShiftId)}</b></span>}
                    {r.reason && <span className="italic">“{r.reason}”</span>}
                  </div>
                )}
                {r.status === "PENDING" && (
                  <div className="flex justify-end gap-1.5 mt-2.5 pt-2.5 border-t border-white/[.07]">
                    <Btn small variant="success" onClick={() => decide(r, "approve")}><Check className="w-3.5 h-3.5" /> Onayla ve Değiştir</Btn>
                    <Btn small variant="danger" onClick={() => decide(r, "reject")}><X className="w-3.5 h-3.5" /> Reddet</Btn>
                    <Btn small onClick={() => remove(r)}><Trash2 className="w-3.5 h-3.5" /></Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <NewSwapModal
          personnel={personnel.filter(p => personnelInDepartment(p, selectedDept) && p.isActive).sort((a, b) => a.name.localeCompare(b.name, "tr"))}
          schedules={schedules}
          onClose={() => setShowModal(false)}
          onCreated={() => { load(); setShowModal(false); }}
        />
      )}
    </div>
  );
}

function NewSwapModal({ personnel, schedules, onCreated, onClose }: {
  personnel: Personnel[]; schedules: ShiftSchedule[]; onCreated: () => void; onClose: () => void;
}) {
  const [requesterId, setRequesterId] = useState(personnel[0]?.id ?? "");
  const [requesterShiftId, setRequesterShiftId] = useState("");
  const [targetPersonnelId, setTargetPersonnelId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const reqShifts = schedules.filter(s => s.personnelId === requesterId).sort((a, b) => a.scheduleDate.localeCompare(b.scheduleDate));
  const selShift = schedules.find(s => s.id === requesterShiftId);

  async function save() {
    if (!requesterId || !requesterShiftId) return;
    setSaving(true);
    await api("/api/swaps", "POST", {
      requesterId, requesterShiftId,
      targetPersonnelId: targetPersonnelId || null,
      swapDate: selShift?.scheduleDate, reason: reason || null,
    });
    setSaving(false);
    onCreated();
  }

  return (
    <Modal title={<><Repeat className="w-4 h-4 text-pink-400" /> Yeni Değişim Talebi</>} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Talep Eden Personel">
          <select value={requesterId} onChange={e => { setRequesterId(e.target.value); setRequesterShiftId(""); }}
            className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none [&>option]:bg-slate-900">
            {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Değiştirilecek Vardiya" hint="Bu ay içindeki vardiyalar listelenir.">
          <select value={requesterShiftId} onChange={e => setRequesterShiftId(e.target.value)}
            className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none [&>option]:bg-slate-900">
            <option value="">Vardiya seç…</option>
            {reqShifts.map(s => <option key={s.id} value={s.id}>{s.scheduleDate} · {s.startTime}–{s.endTime}</option>)}
          </select>
        </Field>
        <Field label="Hedef Personel (opsiyonel)" hint="Seçilirse onayda vardiya bu personele devredilir.">
          <select value={targetPersonnelId} onChange={e => setTargetPersonnelId(e.target.value)}
            className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none [&>option]:bg-slate-900">
            <option value="">Herhangi biri</option>
            {personnel.filter(p => p.id !== requesterId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Gerekçe">
          <TextArea value={reason} onChange={e => setReason(e.target.value)} placeholder="Değişim nedeni…" />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>İptal</Btn>
          <Btn variant="primary" onClick={save} disabled={!requesterId || !requesterShiftId || saving}>
            <Clock className="w-4 h-4" /> Talep Oluştur
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
