"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Fingerprint, CalendarDays, Moon, Clock, ShieldCheck, KeyRound,
  HeartPulse, AlertCircle, LogOut, ArrowLeft, Sparkles, UserCheck,
} from "lucide-react";
import {
  MONTHS, DAYS_TR, DAYS_FULL, LEAVE_CODE_MAP, fmtTr,
  type ShiftSchedule, type TimesheetEntry, type Holiday,
  isWeekendDay, isNightRange,
} from "@/lib/shared";
import { getShiftRangeMetrics } from "@/lib/puantaj-engine";
import { MonthNav, Badge, Avatar, cx } from "@/components/ui-kit";

type LookupResult = {
  person: {
    id: string;
    name: string; title: string | null; personnelType: string; departmentName: string | null;
    annualLeaveBalance: number | null; sickLeaveBalance: number | null; unpaidLeaveBalance: number | null;
    hasAvatar?: boolean; avatarUpdatedAt?: string | null;
  };
  year: number; month: number;
  schedules: ShiftSchedule[];
  leaves: { id: string; leaveType: string; startDate: string; endDate: string; daysCount: number; status: string; reason: string | null }[];
  entries: TimesheetEntry[];
  holidays: Holiday[];
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Onay bekliyor", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  APPROVED: { label: "Onaylandı", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  REJECTED: { label: "Reddedildi", cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
};

export default function PersonelSelfService() {
  const [mode, setMode] = useState<"tc" | "name">("tc");
  const [tc, setTc] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(8); // Eylül

  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }, []);

  async function lookup(targetYear?: number, targetMonth?: number, override?: { mode: "tc" | "name"; value: string }) {
    const qMode = override?.mode ?? mode;
    const qValue = (override?.value ?? (qMode === "tc" ? tc : fullName)).trim();
    if (qMode === "tc") {
      if (qValue.length !== 11) {
        setErr("Lütfen 11 haneli TC Kimlik Numaranızı girin.");
        return;
      }
    } else if (qValue.split(/\s+/).filter(Boolean).length < 2) {
      setErr("Lütfen adınızı ve soyadınızı birlikte girin.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/personel-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(qMode === "tc" ? { tcNo: qValue } : { fullName: qValue }),
          year: targetYear ?? year,
          month: targetMonth ?? month,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sorgu başarısız");
      setResult(data);
      setYear(data.year);
      setMonth(data.month);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sorgu başarısız");
    } finally {
      setBusy(false);
    }
  }

  function fillDemoAndLookup(demoTc: string) {
    setMode("tc");
    setTc(demoTc);
    lookup(year, month, { mode: "tc", value: demoTc });
  }

  const canSubmit = mode === "tc" ? tc.length === 11 : fullName.trim().split(/\s+/).filter(Boolean).length >= 2;

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-radial-gradient">
        <div className="w-full max-w-md anim-slide space-y-4">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-sky-500/30 border border-white/15 flex items-center justify-center mb-3 shadow-lg shadow-emerald-950/40">
              <Fingerprint className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-sm font-black text-white" style={{ fontFamily: "var(--font-grotesk)" }}>Personel Bilgi Ekranı</h1>
            <p className="text-white/40 text-xs mt-1.5 max-w-xs leading-relaxed">
              Kendi nöbet listenizi, izin durumunuzu ve puantaj özetinizi görüntülemek için TC Kimlik No ile veya Ad Soyad ile sorgulayın.
            </p>
          </div>

          <div className="panel p-5 space-y-4">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[.05] border border-white/10">
              {([["tc", "TC Kimlik No ile"], ["name", "Ad Soyad ile"]] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setErr(""); }}
                  className={cx(
                    "py-2 rounded-lg text-xs font-bold transition cursor-pointer",
                    mode === m ? "bg-emerald-500 text-white shadow" : "text-white/50 hover:text-white",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "tc" ? (
              <div>
                <label className="text-white/50 text-[11px] font-bold uppercase tracking-wider block mb-1.5">TC Kimlik No</label>
                <input
                  value={tc}
                  inputMode="numeric"
                  autoFocus
                  onChange={e => setTc(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  onKeyDown={e => e.key === "Enter" && lookup()}
                  placeholder="11 haneli TC kimlik numaranız"
                  className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2.5 text-white text-xs outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 transition placeholder:text-white/25 tracking-widest"
                />
              </div>
            ) : (
              <div>
                <label className="text-white/50 text-[11px] font-bold uppercase tracking-wider block mb-1.5">Ad Soyad</label>
                <input
                  value={fullName}
                  autoFocus
                  onChange={e => setFullName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && lookup()}
                  placeholder="Adınız ve soyadınız (örn. Ayşe Çelik)"
                  className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2.5 text-white text-xs outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 transition placeholder:text-white/25"
                />
              </div>
            )}
            {err && (
              <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/40 text-rose-200 text-xs rounded-lg px-3 py-2.5 anim-slide">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{err}</span>
              </div>
            )}
            <button
              onClick={() => lookup()}
              disabled={!canSubmit || busy}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs transition active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/50"
            >
              <KeyRound className="w-4 h-4" /> {busy ? "Doğrulanıyor…" : "Bilgilerimi Getir"}
            </button>

            {/* Hızlı Demo Doldurma Butonları */}
            <div className="pt-2 border-t border-white/[.08] space-y-1.5">
              <div className="text-white/35 text-[10px] font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Hızlı Örnek Personel ile Giriş (Test için):
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => fillDemoAndLookup("10000000146")}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[.05] border border-white/10 hover:border-emerald-400/40 text-left text-xs text-white/80 hover:text-white transition cursor-pointer"
                >
                  <span className="block font-bold text-emerald-300">AYŞE ÇELİK</span>
                  <span className="block text-[10px] text-white/40">10000000146</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAndLookup("10000000236")}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[.05] border border-white/10 hover:border-emerald-400/40 text-left text-xs text-white/80 hover:text-white transition cursor-pointer"
                >
                  <span className="block font-bold text-sky-300">MEHMET ŞAHİN</span>
                  <span className="block text-[10px] text-white/40">10000000236</span>
                </button>
              </div>
            </div>
          </div>

          <p className="text-white/25 text-[10px] text-center flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3 h-3" /> Bu ekran salt-okunurdur; şifre gerektirmez ve yalnızca kendi bilgilerinizi gösterir.
          </p>
          <div className="text-center">
            <Link href="/" className="text-sky-400/80 hover:text-sky-300 text-xs font-semibold inline-flex items-center gap-1 transition">
              <ArrowLeft className="w-3.5 h-3.5" /> Yönetim paneline dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { person, schedules, leaves, entries, holidays } = result;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidaySet = new Set(holidays.map(h => h.holidayDate));
  const totalWorked = Math.round(entries.reduce((s, e) => s + e.hoursWorked, 0) * 10) / 10;
  const nightShifts = schedules.filter(s => isNightRange(s.startTime, s.endTime)).length;
  const firstDayOffset = new Date(year, month, 1).getDay();

  return (
    <div className="min-h-screen px-4 py-6 max-w-3xl mx-auto space-y-4">
      {/* Üst bilgi */}
      <div className="panel p-4 flex flex-wrap items-center gap-3">
        {person.hasAvatar
          ? <Avatar person={{ id: person.id, name: person.name, hasAvatar: true, avatarUpdatedAt: person.avatarUpdatedAt }} size={52} className="!rounded-2xl" ring />
          : (
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-sky-500/30 border border-white/15 flex items-center justify-center shadow-lg">
              <HeartPulse className="w-6 h-6 text-emerald-400" />
            </div>
          )}
        <div>
          <div className="text-white font-black text-sm" style={{ fontFamily: "var(--font-grotesk)" }}>{person.name}</div>
          <div className="text-white/40 text-xs">
            {person.title ?? "Personel"} · {person.departmentName ?? "—"} · {person.personnelType === "ISCI" ? "İşçi" : person.personnelType === "HEMSIRE" ? "Hemşire" : "Memur"}
          </div>
        </div>
        <div className="flex-1" />
        <MonthNav year={year} month={month} onChange={(y, m) => lookup(y, m)} />
        <button
          onClick={() => setResult(null)}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition cursor-pointer"
          title="Çıkış Yap"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Bu Ay Çalışılan", value: `${totalWorked}s`, cls: "text-sky-300", icon: <Clock className="w-3.5 h-3.5" /> },
          { label: "Bu Ay Nöbet", value: String(schedules.length), cls: "text-emerald-300", icon: <CalendarDays className="w-3.5 h-3.5" /> },
          { label: "Gece Nöbeti", value: String(nightShifts), cls: "text-violet-300", icon: <Moon className="w-3.5 h-3.5" /> },
        ].map(c => (
          <div key={c.label} className="panel p-3.5">
            <div className="text-white/40 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">{c.icon}{c.label}</div>
            <div className={cx("text-sm font-black mt-1", c.cls)} style={{ fontFamily: "var(--font-grotesk)" }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Nöbet takvimi */}
      <div className="panel p-4">
        <div className="text-white font-bold text-xs mb-3 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-emerald-400" /> Nöbet Takvimim — {MONTHS[month]} {year}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {DAYS_TR.map(d => <div key={d} className="text-white/35 text-[10px] font-bold py-1">{d}</div>)}
          {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`o${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
            const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const mine = schedules.filter(s => s.scheduleDate === date);
            const hol = holidaySet.has(date);
            const wknd = isWeekendDay(year, month, d);
            const leaveEntry = entries.find(e => e.entryDate === date && LEAVE_CODE_MAP[e.shiftType]);
            return (
              <div
                key={d}
                className={cx(
                  "rounded-lg border min-h-[52px] p-1 text-left",
                  leaveEntry ? "bg-emerald-500/10 border-emerald-500/30" :
                  mine.length ? mine.some(s => isNightRange(s.startTime, s.endTime)) ? "bg-violet-500/[.12] border-violet-500/35" : "bg-sky-500/[.12] border-sky-500/35" :
                  hol ? "bg-rose-500/[.06] border-rose-500/20" : wknd ? "bg-amber-500/[.05] border-amber-500/15" : "bg-white/[.02] border-white/[.06]"
                )}
                title={`${d} ${MONTHS[month]} ${DAYS_FULL[new Date(year, month, d).getDay()]}`}
              >
                <div className={cx("text-[10px] font-bold", hol ? "text-rose-300" : wknd ? "text-amber-300" : "text-white/60")}>{d}</div>
                {leaveEntry && <div className="text-[8.5px] font-black text-emerald-300 mt-0.5">{LEAVE_CODE_MAP[leaveEntry.shiftType].code}</div>}
                {mine.map(s => (
                  <div key={s.id} className="text-[8.5px] font-bold text-white/85 leading-tight mt-0.5 flex items-center gap-0.5">
                    {isNightRange(s.startTime, s.endTime) && <Moon className="w-2 h-2 text-violet-300 shrink-0" />}
                    {s.startTime}–{s.endTime}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Nöbet listesi */}
        <div className="panel p-4">
          <div className="text-white font-bold text-xs mb-2.5">Nöbet Listem ({schedules.length})</div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {schedules.length === 0 && <p className="text-white/30 text-xs py-4 text-center">Bu ay planlanmış nöbetiniz yok.</p>}
            {schedules.map(s => {
              const m = getShiftRangeMetrics(s.startTime, s.endTime);
              return (
                <div key={s.id} className="flex items-center gap-2.5 bg-white/[.03] border border-white/[.07] rounded-lg px-3 py-2">
                  {isNightRange(s.startTime, s.endTime)
                    ? <Moon className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                    : <Clock className="w-3.5 h-3.5 text-sky-300 shrink-0" />}
                  <div className="text-white text-xs font-bold">{fmtTr(s.scheduleDate)}</div>
                  <div className="text-white/45 text-[11px]">{s.startTime}–{s.endTime}</div>
                  <div className="flex-1" />
                  <div className="text-sky-300 text-[11px] font-bold">{m.worked}s</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* İzinler */}
        <div className="panel p-4">
          <div className="text-white font-bold text-xs mb-2.5">İzinlerim</div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              ["Yıllık", person.annualLeaveBalance, "text-emerald-300"],
              ["Rapor", person.sickLeaveBalance, "text-rose-300"],
              ["Ücretsiz", person.unpaidLeaveBalance, "text-amber-300"],
            ].map(([label, val, cls]) => (
              <div key={label as string} className="bg-white/[.04] border border-white/[.08] rounded-lg py-1.5 text-center">
                <div className={cx("text-sm font-black", cls as string)}>{val ?? "—"}</div>
                <div className="text-[8.5px] text-white/35 uppercase tracking-wide">{label} hak</div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {leaves.length === 0 && <p className="text-white/30 text-xs py-4 text-center">İzin kaydınız yok.</p>}
            {leaves.map(l => {
              const sm = STATUS_LABEL[l.status] ?? STATUS_LABEL.PENDING;
              const meta = LEAVE_CODE_MAP[l.leaveType];
              return (
                <div key={l.id} className="bg-white/[.03] border border-white/[.07] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={meta?.color ?? ""}>{meta?.label ?? l.leaveType}</Badge>
                    <span className="text-white/70 text-[11px] font-semibold">{fmtTr(l.startDate)} → {fmtTr(l.endDate)}</span>
                    <span className="text-white/35 text-[10px]">({l.daysCount}g)</span>
                    <div className="flex-1" />
                    <Badge className={sm.cls}>{sm.label}</Badge>
                  </div>
                  {l.reason && <div className="text-white/35 text-[10px] italic mt-1">“{l.reason}”</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-white/25 text-[10px] text-center flex items-center justify-center gap-1.5 pt-1">
        <ShieldCheck className="w-3 h-3" /> Bu ekran salt-okunurdur. Bilgileriniz yalnızca görüntülenir, değiştirilemez.
      </p>
    </div>
  );
}
