"use client";
import { useEffect, useMemo, useState } from "react";
import { Scale, RefreshCw, Moon, Sun, BarChart3, ShieldCheck } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  MONTHS_SHORT, type Department, type Personnel, type ShiftSchedule, type Holiday,
  personnelInDepartment, isWeekendDay,
} from "@/lib/shared";
import { getShiftRangeMetrics } from "@/lib/puantaj-engine";
import { Btn, Spinner, cx } from "@/components/ui-kit";

/** Gini katsayısı: 0 = tam adil, 1 = tam adaletsiz (kaynak projeyle aynı). */
function gini(values: number[]): number {
  const v = values.filter(x => x >= 0).sort((a, b) => a - b);
  const n = v.length;
  const sum = v.reduce((a, b) => a + b, 0);
  if (n === 0 || sum === 0) return 0;
  let cum = 0;
  for (let i = 0; i < n; i++) cum += (i + 1) * v[i];
  return (2 * cum) / (n * sum) - (n + 1) / n;
}

function isNight(s: ShiftSchedule) {
  if (!s.startTime || !s.endTime) return false;
  const sh = Number(s.startTime.split(":")[0]);
  const eh = Number(s.endTime.split(":")[0]);
  return eh <= sh || sh >= 18 || sh < 6;
}

type Row = { pid: string; name: string; hours: number; count: number; night: number; weekend: number; holiday: number };

export default function AnalysisPage({
  departments, personnel, holidays, selectedDept, year, month,
}: {
  departments: Department[]; personnel: Personnel[]; holidays: Holiday[];
  selectedDept: string; year: number; month: number;
}) {
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<"hours" | "count" | "night">("hours");

  const deptName = departments.find(d => d.id === selectedDept)?.name ?? "";
  const deptPersonnel = personnel.filter(p => personnelInDepartment(p, selectedDept) && p.isActive);
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.holidayDate)), [holidays]);

  const months = useMemo(() => {
    const arr: { y: number; m: number; key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      arr.push({ y: d.getFullYear(), m: d.getMonth(), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` });
    }
    return arr;
  }, [year, month]);

  async function load() {
    setLoading(true);
    const start = `${months[0].key}-01`;
    const endDim = new Date(months[5].y, months[5].m + 1, 0).getDate();
    const end = `${months[5].key}-${String(endDim).padStart(2, "0")}`;
    const res = await fetch(`/api/schedules?dept=${selectedDept}&start=${start}&end=${end}`);
    const data = await res.json();
    setShifts(data.schedules ?? []);
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedDept) load(); }, [selectedDept, year, month, personnel]);

  const rows: Row[] = useMemo(() => deptPersonnel.map(p => {
    const mine = shifts.filter(s => s.personnelId === p.id);
    let hours = 0, night = 0, weekend = 0, holiday = 0;
    mine.forEach(s => {
      const w = getShiftRangeMetrics(s.startTime, s.endTime).worked;
      hours += w;
      if (isNight(s)) night += w;
      const [yy, mm, dd] = s.scheduleDate.split("-").map(Number);
      if (isWeekendDay(yy, mm - 1, dd)) weekend++;
      if (holidaySet.has(s.scheduleDate)) holiday++;
    });
    return { pid: p.id, name: p.name, hours: Math.round(hours * 10) / 10, count: mine.length, night: Math.round(night * 10) / 10, weekend, holiday };
  }).filter(r => r.count > 0).sort((a, b) => b.hours - a.hours), [deptPersonnel, shifts, holidaySet]);

  const g = useMemo(() => gini(rows.map(r => r.hours)), [rows]);
  const fairnessScore = Math.round((1 - g) * 100);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.hours, 0) / rows.length * 10) / 10 : 0;

  const chartData = rows.map((r, i) => ({
    name: r.name.split(" ").map((x, j) => (j === 0 ? x : x[0] + ".")).join(" "),
    value: r[metric], fill: "", first: i === 0, last: i === rows.length - 1,
  }));

  const metricMeta = {
    hours: { label: "Toplam Saat", icon: <BarChart3 className="w-3.5 h-3.5" />, unit: "s" },
    count: { label: "Nöbet Adedi", icon: <Sun className="w-3.5 h-3.5" />, unit: "" },
    night: { label: "Gece Saati", icon: <Moon className="w-3.5 h-3.5" />, unit: "s" },
  }[metric];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-grotesk)" }}>
          <Scale className="w-4 h-4 text-amber-400" /> Adalet Analizi
        </h2>
        <span className="text-white/35 text-xs">{deptName} · son 6 ay ({months[0].label} – {months[5].label})</span>
        <div className="flex-1" />
        <div className="flex gap-1 bg-white/[.05] border border-white/10 rounded-lg p-0.5">
          {(["hours", "count", "night"] as const).map(m => (
            <button
              key={m} onClick={() => setMetric(m)}
              className={cx("px-2.5 py-1.5 rounded-md text-[11px] font-bold transition",
                metric === m ? "bg-sky-500/25 text-sky-300" : "text-white/45 hover:text-white")}
            >{{ hours: "Saat", count: "Adet", night: "Gece" }[m]}</button>
          ))}
        </div>
        <Btn small onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Btn>
      </div>

      {/* Özet kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="panel p-4 anim-slide">
          <div className="text-white/40 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Adalet Skoru</div>
          <div className={cx("text-xl font-black mt-1", fairnessScore >= 80 ? "text-emerald-300" : fairnessScore >= 60 ? "text-amber-300" : "text-rose-300")} style={{ fontFamily: "var(--font-grotesk)" }}>
            %{fairnessScore}
          </div>
          <div className="text-white/35 text-[10px]">Gini: {g.toFixed(3)} · {fairnessScore >= 80 ? "dağılım adil" : fairnessScore >= 60 ? "kabul edilebilir" : "dengesiz"}</div>
        </div>
        <div className="panel p-4 anim-slide anim-slide-1">
          <div className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Ortalama Yük</div>
          <div className="text-xl font-black text-sky-300 mt-1" style={{ fontFamily: "var(--font-grotesk)" }}>{avg}<span className="text-xs font-semibold text-white/40 ml-1">s/kişi</span></div>
          <div className="text-white/35 text-[10px]">{rows.length} personel nöbet aldı</div>
        </div>
        <div className="panel p-4 anim-slide anim-slide-2">
          <div className="text-white/40 text-[10px] uppercase tracking-widest font-bold">En Yüksek</div>
          <div className="text-sm font-black text-white mt-1.5 truncate">{rows[0]?.name ?? "—"}</div>
          <div className="text-white/35 text-[10px]">{rows[0] ? `${rows[0].hours}s · ${rows[0].count} nöbet` : ""}</div>
        </div>
        <div className="panel p-4 anim-slide anim-slide-3">
          <div className="text-white/40 text-[10px] uppercase tracking-widest font-bold">En Düşük</div>
          <div className="text-sm font-black text-white mt-1.5 truncate">{rows[rows.length - 1]?.name ?? "—"}</div>
          <div className="text-white/35 text-[10px]">{rows[rows.length - 1] ? `${rows[rows.length - 1].hours}s · ${rows[rows.length - 1].count} nöbet` : ""}</div>
        </div>
      </div>

      {/* Grafik */}
      <div className="panel p-4">
        <div className="text-white font-semibold text-xs mb-3 flex items-center gap-2">{metricMeta.icon} Personel Bazında {metricMeta.label} — Son 6 Ay</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.12)" vertical={false} />
              <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fill: "rgba(226,232,240,.55)", fontSize: 10 }} stroke="rgba(148,163,184,.2)" />
              <YAxis tick={{ fill: "rgba(226,232,240,.45)", fontSize: 10 }} stroke="rgba(148,163,184,.2)" />
              <Tooltip
                cursor={{ fill: "rgba(56,189,248,.08)" }}
                contentStyle={{ background: "#0e1729", border: "1px solid rgba(148,163,184,.25)", borderRadius: 10, fontSize: 12 }}
                formatter={(v: unknown) => [`${v}${metricMeta.unit}`, metricMeta.label]}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.first ? "#f59e0b" : d.last ? "#fb7185" : "#38bdf8"} fillOpacity={d.first || d.last ? 0.9 : 0.55} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detay tablo */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/45 text-[11px] uppercase tracking-wider">
                <th className="text-left px-4 py-2">Personel</th>
                <th className="text-center px-2 py-2 text-sky-300">Toplam Saat</th>
                <th className="text-center px-2 py-2">Nöbet</th>
                <th className="text-center px-2 py-2 text-violet-300">Gece (s)</th>
                <th className="text-center px-2 py-2 text-amber-300">Hafta Sonu</th>
                <th className="text-center px-2 py-2 text-rose-300">Tatil</th>
                <th className="text-center px-2 py-2">Ortalamadan Sapma</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const dev = avg ? ((r.hours - avg) / avg) * 100 : 0;
                return (
                  <tr key={r.pid} className="border-b border-white/5 hover:bg-white/[.03] transition">
                    <td className="px-4 py-1.5 text-white font-medium">{r.name}</td>
                    <td className="text-center text-sky-300 font-bold">{r.hours}</td>
                    <td className="text-center text-white/70">{r.count}</td>
                    <td className="text-center text-violet-300">{r.night}</td>
                    <td className="text-center text-amber-300">{r.weekend}</td>
                    <td className="text-center text-rose-300">{r.holiday}</td>
                    <td className={cx("text-center font-bold", Math.abs(dev) < 10 ? "text-emerald-300" : "text-amber-300")}>
                      {dev > 0 ? "+" : ""}{dev.toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-white/30 text-xs">Bu dönemde nöbet kaydı yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
