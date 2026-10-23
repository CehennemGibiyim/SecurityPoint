"use client";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { buildWarnings, KIND_META, type WarningItem } from "@/lib/warnings";
import { MONTHS, type Department, type Personnel, type ShiftSchedule, personnelInDepartment } from "@/lib/shared";
import { Btn, Spinner, EmptyState, Badge, cx } from "@/components/ui-kit";

export default function WarningsPage({
  departments, personnel, selectedDept, year, month,
}: {
  departments: Department[]; personnel: Personnel[]; selectedDept: string; year: number; month: number;
}) {
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [openKinds, setOpenKinds] = useState<Record<string, boolean>>({ REST: true, CONSECUTIVE: true, WEEKLY: true, NIGHT: true });

  const deptName = departments.find(d => d.id === selectedDept)?.name ?? "";
  const deptPersonnel = personnel.filter(p => personnelInDepartment(p, selectedDept));

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/schedules?dept=${selectedDept}&year=${year}&month=${month}`);
    const data = await res.json();
    setShifts(data.schedules ?? []);
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedDept) load(); }, [selectedDept, year, month, personnel]);

  const warnings = useMemo(() => buildWarnings(shifts.filter(s => deptPersonnel.some(p => p.id === s.personnelId)), deptPersonnel), [shifts, deptPersonnel]);
  const grouped = useMemo(() => {
    const g: Record<string, WarningItem[]> = { REST: [], CONSECUTIVE: [], WEEKLY: [], NIGHT: [] };
    warnings.forEach(w => g[w.kind].push(w));
    return g;
  }, [warnings]);
  const highCount = warnings.filter(w => w.level === "HIGH").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-grotesk)" }}>
          <AlertTriangle className="w-4 h-4 text-orange-400" /> Mevzuat Uyarıları
        </h2>
        <span className="text-white/35 text-xs">{deptName} · {MONTHS[month]} {year}</span>
        <div className="flex-1" />
        <Btn small onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Btn>
      </div>

      <p className="text-white/40 text-xs">
        İş Kanunu kontrolleri: en az 11 saat dinlenme, ardışık nöbet sınırı, haftalık 45/40 saat limiti ve gece çalışma süreleri.
      </p>

      {loading ? <Spinner label="Kontroller yapılıyor…" /> : warnings.length === 0 ? (
        <div className="panel p-8 text-center anim-slide">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <div className="text-emerald-300 font-bold">Her şey mevzuata uygun</div>
          <div className="text-white/40 text-xs mt-1">Bu ay için dinlenme süresi, ardışık nöbet veya limit ihlali bulunamadı.</div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KIND_META) as (keyof typeof KIND_META)[]).map(k => (
              <div key={k} className={cx("panel px-3 py-2 flex items-center gap-2 border", KIND_META[k].cls.replace("bg-", "border-").split(" ")[2] ?? "")}>
                <span className={cx("w-2 h-2 rounded-full", KIND_META[k].dot)} />
                <span className="text-white/75 text-xs font-semibold">{KIND_META[k].label}</span>
                <span className="text-white font-black text-xs">{grouped[k].length}</span>
              </div>
            ))}
            <div className="panel px-3 py-2 flex items-center gap-2 border-rose-500/50">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-[pulseGlow_1.5s_infinite]" />
              <span className="text-white/75 text-xs font-semibold">Kritik seviye</span>
              <span className="text-rose-300 font-black text-xs">{highCount}</span>
            </div>
          </div>

          {(Object.keys(KIND_META) as (keyof typeof KIND_META)[]).filter(k => grouped[k].length > 0).map(k => (
            <div key={k} className="panel overflow-hidden anim-slide">
              <button
                onClick={() => setOpenKinds(p => ({ ...p, [k]: !p[k] }))}
                className="w-full px-4 py-2.5 border-b border-white/10 flex items-center gap-2 hover:bg-white/[.03] transition"
              >
                <Badge className={KIND_META[k].cls}>{KIND_META[k].label}</Badge>
                <span className="text-white/40 text-xs">{grouped[k].length} bulgu</span>
                <div className="flex-1" />
                {openKinds[k] ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
              </button>
              {openKinds[k] && (
                <div className="divide-y divide-white/5">
                  {grouped[k].map((w, i) => (
                    <div key={i} className="px-4 py-2 flex items-center gap-3 hover:bg-white/[.02]">
                      <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", w.level === "HIGH" ? "bg-rose-400" : "bg-amber-400")} />
                      <span className="text-white font-semibold text-xs w-44 shrink-0 truncate">{w.personnelName}</span>
                      <span className="text-white/55 text-xs">{w.text}</span>
                      <div className="flex-1" />
                      <Badge className={w.level === "HIGH" ? "bg-rose-500/15 text-rose-300 border-rose-500/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}>
                        {w.level === "HIGH" ? "Kritik" : "Dikkat"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
