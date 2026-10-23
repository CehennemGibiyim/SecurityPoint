"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Calculator,
  CheckCircle2,
  CircleHelp,
  FileText,
  Printer,
  RotateCcw,
  Save,
  UserRound,
  WalletCards,
  AlertTriangle,
} from "lucide-react";
import type { Department, Personnel, Holiday, TimesheetEntry } from "@/lib/shared";
import { MONTHS, personnelInDepartment } from "@/lib/shared";
import { getShiftMetrics, normalizeShiftCode } from "@/lib/puantaj-engine";
import { Btn, Field, TextInput, cx } from "@/components/ui-kit";

type PayrollOverrides = {
  dailyWage?: number;
  sgkDays?: number;
  workDays?: number;
  overtimeHours?: number;
  foodTravelDays?: number;
  tediyeDays?: number;
  holidayWorkDays?: number;
  socialAid?: number;
  servicePremiumRate?: number;
  nightHours?: number;
  overtimeMultiplier?: number;
  holidayMultiplier?: number;
  serviceSeniorityAllowance?: number;
  travelAllowancePerDay?: number;
  bes?: number;
  unionDeduction?: number;
  garnishment?: number;
  otherDeduction?: number;
  previousAnnualTaxBase?: number;
  incomeTaxRate?: number;
  incomeTaxExemption?: number;
  stampTaxRate?: number;
  stampTaxExemption?: number;
  annualTaxBase?: number;
  monthlyTaxBase?: number;
  stampTax?: number;
  incomeTax?: number;
};

type MoneyFieldProps = {
  label: string;
  value: number;
  autoValue?: number;
  overridden: boolean;
  onChange: (value: number) => void;
  onReset?: () => void;
  suffix?: string;
  help?: string;
};

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

function numberValue(value: string) {
  const raw = String(value).trim();
  if (!raw) return 0;
  const normalized = raw.includes(",") && raw.includes(".")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function MoneyField({ label, value, autoValue, overridden, onChange, onReset, suffix = "₺", help }: MoneyFieldProps) {
  return (
    <div className="rounded-xl border border-white/[.08] bg-white/[.025] p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <label className="text-[11px] font-bold text-white/65">{label}</label>
        {autoValue !== undefined && (
          <span className={cx("text-[9px] font-bold", overridden ? "text-amber-300" : "text-emerald-300")}>
            {overridden ? "MANUEL" : "OTOMATİK"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={String(value).replace(".", ",")}
          onChange={e => onChange(numberValue(e.target.value))}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1221] px-3 py-2 text-sm font-bold text-white outline-none focus:border-sky-400/60"
        />
        <span className="text-xs text-white/40">{suffix}</span>
        {onReset && overridden && (
          <button type="button" onClick={onReset} title="Otomatik değere dön" className="rounded-lg p-2 text-amber-300/80 hover:bg-amber-400/10 hover:text-amber-200">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {autoValue !== undefined && <div className="mt-1 text-[9px] text-white/35">Otomatik: {money(autoValue)} {suffix}{help ? ` · ${help}` : ""}</div>}
    </div>
  );
}

function ReadonlyMoney({ label, value, tone = "text-white" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[.06] py-2 last:border-0">
      <span className="text-[11px] font-semibold text-white/55">{label}</span>
      <span className={cx("text-sm font-black tabular-nums", tone)}>{money(value)} ₺</span>
    </div>
  );
}

function InputCard({ label, value, onChange, suffix = "", help }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; help?: string }) {
  return (
    <div className="rounded-xl border border-white/[.08] bg-white/[.025] p-3">
      <label className="block text-[11px] font-bold text-white/65 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input inputMode="decimal" value={String(value).replace(".", ",")} onChange={e => onChange(numberValue(e.target.value))} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1221] px-3 py-2 text-sm font-bold text-white outline-none focus:border-sky-400/60" />
        {suffix && <span className="text-xs text-white/40">{suffix}</span>}
      </div>
      {help && <div className="mt-1 text-[9px] text-white/35">{help}</div>}
    </div>
  );
}

function progressiveTax(base: number, rate: number) {
  const b = Math.max(0, base);
  return b * Math.max(0, rate) / 100;
}

export default function MaasBordroPage({
  departments,
  personnel,
  holidays,
  selectedDept,
  year,
  month,
}: {
  departments: Department[];
  personnel: Personnel[];
  holidays: Holiday[];
  selectedDept: string;
  year: number;
  month: number;
}) {
  const people = useMemo(() => personnel.filter(p => personnelInDepartment(p, selectedDept) && p.isActive).sort((a, b) => a.name.localeCompare(b.name, "tr")), [personnel, selectedDept]);
  const [personnelId, setPersonnelId] = useState(people[0]?.id ?? "");
  const person = people.find(p => p.id === personnelId) ?? people[0];
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [saved, setSaved] = useState(false);
  const [overrides, setOverrides] = useState<PayrollOverrides>({});

  useEffect(() => {
    if (!people.some(p => p.id === personnelId)) setPersonnelId(people[0]?.id ?? "");
  }, [people, personnelId]);

  useEffect(() => {
    if (!person?.id) return;
    const key = `p26-payroll-${person.id}-${year}-${month}`;
    try {
      const raw = localStorage.getItem(key);
      setOverrides(raw ? JSON.parse(raw) : {});
    } catch { setOverrides({}); }
  }, [person?.id, year, month]);

  useEffect(() => {
    if (!person?.id) { setEntries([]); return; }
    let cancelled = false;
    setLoadingEntries(true);
    fetch(`/api/timesheet?year=${year}&month=${month}&dept=${selectedDept}&personnel=${person.id}`, { cache: "no-store" })
      .then(r => r.json())
      .then(data => { if (!cancelled) setEntries(Array.isArray(data.entries) ? data.entries : []); })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoadingEntries(false); });
    return () => { cancelled = true; };
  }, [person?.id, year, month, selectedDept]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.holidayDate)), [holidays]);

  const automatic = useMemo(() => {
    let workDays = 0;
    let overtimeHours = 0;
    let nightHours = 0;
    let holidayWorkDays = 0;
    let foodTravelDays = 0;
    for (const e of entries) {
      const value = String(e.shiftType ?? "").trim();
      const numeric = Number(value.replace(",", "."));
      const metrics = Number.isFinite(numeric) ? getShiftMetrics(numeric, holidaySet.has(e.entryDate)) : getShiftMetrics(normalizeShiftCode(value), holidaySet.has(e.entryDate));
      if (metrics.worked > 0) workDays += 1;
      overtimeHours += metrics.extra;
      nightHours += metrics.night;
      if (metrics.holiday > 0) holidayWorkDays += 1;
      if (metrics.worked > 0) foodTravelDays += 1;
    }
    return {
      dailyWage: 0,
      sgkDays: 30,
      workDays: workDays || daysInMonth,
      overtimeHours,
      foodTravelDays,
      tediyeDays: 0,
      holidayWorkDays,
      socialAid: 0,
      servicePremiumRate: 13,
      nightHours,
      overtimeMultiplier: 1.7,
      holidayMultiplier: 2,
      serviceSeniorityAllowance: 0,
      travelAllowancePerDay: 0,
      bes: 0,
      unionDeduction: 0,
      garnishment: 0,
      otherDeduction: 0,
      previousAnnualTaxBase: 0,
      incomeTaxRate: 15,
      incomeTaxExemption: 0,
      stampTaxRate: 0.759,
      stampTaxExemption: 0,
    };
  }, [entries, holidaySet, daysInMonth]);

  const val = <K extends keyof PayrollOverrides>(key: K, fallback: number) => overrides[key] ?? fallback;
  const setVal = <K extends keyof PayrollOverrides>(key: K, value: number) => setOverrides(prev => ({ ...prev, [key]: value }));
  const resetVal = <K extends keyof PayrollOverrides>(key: K) => setOverrides(prev => { const next = { ...prev }; delete next[key]; return next; });
  const isOverridden = (key: keyof PayrollOverrides) => overrides[key] !== undefined;

  const calc = useMemo(() => {
    const dailyWage = val("dailyWage", automatic.dailyWage);
    const sgkDays = val("sgkDays", automatic.sgkDays);
    const workDays = val("workDays", automatic.workDays);
    const overtimeHours = val("overtimeHours", automatic.overtimeHours);
    const foodTravelDays = val("foodTravelDays", automatic.foodTravelDays);
    const tediyeDays = val("tediyeDays", automatic.tediyeDays);
    const holidayWorkDays = val("holidayWorkDays", automatic.holidayWorkDays);
    const socialAid = val("socialAid", automatic.socialAid);
    const servicePremiumRate = val("servicePremiumRate", automatic.servicePremiumRate);
    const nightHours = val("nightHours", automatic.nightHours);
    const overtimeMultiplier = val("overtimeMultiplier", automatic.overtimeMultiplier);
    const holidayMultiplier = val("holidayMultiplier", automatic.holidayMultiplier);
    const serviceSeniorityAllowance = val("serviceSeniorityAllowance", automatic.serviceSeniorityAllowance);
    const travelAllowancePerDay = val("travelAllowancePerDay", automatic.travelAllowancePerDay);
    const bes = val("bes", automatic.bes);
    const unionDeduction = val("unionDeduction", automatic.unionDeduction);
    const garnishment = val("garnishment", automatic.garnishment);
    const otherDeduction = val("otherDeduction", automatic.otherDeduction);
    const previousAnnualTaxBase = val("previousAnnualTaxBase", automatic.previousAnnualTaxBase);
    const incomeTaxRate = val("incomeTaxRate", automatic.incomeTaxRate);
    const incomeTaxExemption = val("incomeTaxExemption", automatic.incomeTaxExemption);
    const stampTaxRate = val("stampTaxRate", automatic.stampTaxRate);
    const stampTaxExemption = val("stampTaxExemption", automatic.stampTaxExemption);

    const wage = dailyWage * workDays;
    const servicePremium = wage * servicePremiumRate / 100;
    const nightPay = nightHours * (dailyWage / 7.5);
    const tediye = tediyeDays * dailyWage;
    const overtime = overtimeHours * (dailyWage / 7.5) * overtimeMultiplier;
    const holidayPay = holidayWorkDays * (dailyWage / 7.5) * holidayMultiplier;
    const travel = foodTravelDays * travelAllowancePerDay;
    const gross = wage + socialAid + servicePremium + nightPay + tediye + overtime + holidayPay + serviceSeniorityAllowance + travel;

    const sgkEmployee = gross * 0.14;
    const unemploymentEmployee = gross * 0.01;
    const sgkEmployer = gross * 0.205;
    const unemploymentEmployer = gross * 0.0225;
    const monthlyTaxBase = gross - sgkEmployee - unemploymentEmployee;
    const annualTaxBase = previousAnnualTaxBase + monthlyTaxBase;
    const taxBefore = progressiveTax(previousAnnualTaxBase, incomeTaxRate);
    const taxAfter = progressiveTax(annualTaxBase, incomeTaxRate);
    const incomeTaxAuto = Math.max(0, taxAfter - taxBefore - incomeTaxExemption);
    const stampTaxBase = Math.max(0, gross - stampTaxExemption);
    const stampTaxAuto = Math.max(0, stampTaxBase * stampTaxRate / 100);
    const incomeTax = overrides.incomeTax ?? incomeTaxAuto;
    const stampTax = overrides.stampTax ?? stampTaxAuto;
    const deductions = sgkEmployee + unemploymentEmployee + incomeTax + stampTax + bes + unionDeduction + garnishment + otherDeduction;
    const net = gross - deductions;
    const tahakkuk = gross + sgkEmployer + unemploymentEmployer;

    return {
      dailyWage, sgkDays, workDays, overtimeHours, foodTravelDays, tediyeDays, holidayWorkDays, socialAid,
      servicePremiumRate, servicePremium, nightHours, nightPay, tediye, overtimeMultiplier, overtime,
      holidayMultiplier, holidayPay, serviceSeniorityAllowance, travelAllowancePerDay, travel, wage, gross,
      sgkEmployee, unemploymentEmployee, sgkEmployer, unemploymentEmployer, bes, unionDeduction, garnishment,
      otherDeduction, previousAnnualTaxBase, monthlyTaxBase, annualTaxBase, incomeTaxRate, incomeTaxExemption,
      incomeTaxAuto, incomeTax, stampTaxRate, stampTaxExemption, stampTaxAuto, stampTax, deductions, net, tahakkuk,
    };
  }, [overrides, automatic]);

  function save() {
    if (!person?.id) return;
    localStorage.setItem(`p26-payroll-${person.id}-${year}-${month}`, JSON.stringify(overrides));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function resetAll() {
    setOverrides({});
  }

  function print() {
    window.print();
  }

  if (!person) {
    return <div className="panel p-8 text-center text-white/55">Bu servis için aktif personel bulunamadı.</div>;
  }

  const detailRows = [
    ["Sosyal Yardım", automatic.socialAid, calc.socialAid, "socialAid" as const],
    ["Hizmet Primi (%13)", calc.wage * automatic.servicePremiumRate / 100, calc.servicePremium, "servicePremiumRate" as const],
    ["Gece Çalışması", 0, calc.nightPay, "nightHours" as const],
    ["TEDİYE 1 GÜNLÜK", 0, calc.tediye, "tediyeDays" as const],
    ["Fazla Mesai %60", 0, calc.overtime, "overtimeHours" as const],
    ["BAYRAM (TATİL-PAZAR) ÇALIŞMASI", 0, calc.holidayPay, "holidayWorkDays" as const],
    ["Hizmet Zammı 4 Yıllık", automatic.serviceSeniorityAllowance, calc.serviceSeniorityAllowance, "serviceSeniorityAllowance" as const],
    ["İşe Gidiş Dönüş Yol Yardımı", 0, calc.travel, "travelAllowancePerDay" as const],
    ["Günlük Ücret (Md.33)", 0, calc.wage, "dailyWage" as const],
  ] as const;

  return (
    <div className="space-y-4 payroll-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg shadow-emerald-950/30"><Banknote className="h-5 w-5" /></span>
            <div>
              <h1 className="text-xl font-black text-white">Maaş Bordro</h1>
              <p className="text-xs text-white/45">Otomatik hesapla, kontrol et, gerektiğinde manuel düzelt.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <Btn onClick={resetAll} variant="ghost"><RotateCcw className="h-3.5 w-3.5" /> Otomatiklere Dön</Btn>
          <Btn onClick={save}><Save className="h-3.5 w-3.5" /> {saved ? "Kaydedildi" : "Kaydet"}</Btn>
          <Btn onClick={print}><Printer className="h-3.5 w-3.5" /> Yazdır / PDF</Btn>
        </div>
      </div>

      <div className="panel p-4 border-emerald-400/20 bg-gradient-to-r from-emerald-500/[.07] to-sky-500/[.04]">
        <div className="flex items-start gap-3">
          <CircleHelp className="h-5 w-5 shrink-0 text-emerald-300" />
          <div className="text-xs text-white/60 leading-relaxed">
            <b className="text-white">Günlük Ücret</b> özellikle manuel bırakıldı. Diğer alanlar puantajdan ve bordro kurallarından otomatik hesaplanır; her hesaplanan değeri sonradan elle değiştirebilirsin. Manuel değişen alanlar <b className="text-amber-300">MANUEL</b> olarak işaretlenir ve yanındaki geri alma düğmesiyle otomatiğe döner.
          </div>
        </div>
      </div>

      <div className="panel p-4 no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Personel">
            <select value={personnelId} onChange={e => setPersonnelId(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0b1221] px-3 py-2.5 text-sm font-bold text-white outline-none">
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Yıl"><TextInput value={String(year)} readOnly /></Field>
          <Field label="Ay"><TextInput value={MONTHS[month]} readOnly /></Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-white/40">
          <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" /> {person.fullName ?? person.name}</span>
          {person.tcNo && <span>TC: {person.tcNo}</span>}
          {person.title && <span>{person.title}</span>}
          <span>{loadingEntries ? "Puantaj okunuyor…" : `${entries.length} puantaj kaydı bulundu`}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 no-print">
        <div className="panel p-4 xl:col-span-2">
          <div className="flex items-center gap-2 mb-3"><Calculator className="h-4 w-4 text-sky-300" /><h2 className="text-sm font-black text-white">Hesaplama girişleri</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <InputCard label="Günlük Ücret (manuel)" value={calc.dailyWage} onChange={v => setVal("dailyWage", v)} suffix="₺" help="Bordrodan/kurumdan gelen günlük ücret; otomatik değiştirilmez." />
            <MoneyField label="Sosyal Yardım" value={calc.socialAid} autoValue={automatic.socialAid} overridden={isOverridden("socialAid")} onChange={v => setVal("socialAid", v)} onReset={() => resetVal("socialAid")} />
            <MoneyField label="4 Yıllık Hizmet Zammı" value={calc.serviceSeniorityAllowance} autoValue={automatic.serviceSeniorityAllowance} overridden={isOverridden("serviceSeniorityAllowance")} onChange={v => setVal("serviceSeniorityAllowance", v)} onReset={() => resetVal("serviceSeniorityAllowance")} />
            <MoneyField label="Yol Yardımı / Gün" value={calc.travelAllowancePerDay} autoValue={automatic.travelAllowancePerDay} overridden={isOverridden("travelAllowancePerDay")} onChange={v => setVal("travelAllowancePerDay", v)} onReset={() => resetVal("travelAllowancePerDay")} />
            <InputCard label="SGK Günü" value={calc.sgkDays} onChange={v => setVal("sgkDays", v)} suffix="gün" />
            <InputCard label="Çalışma Günü" value={calc.workDays} onChange={v => setVal("workDays", v)} suffix="gün" help={`Puantaj otomatiği: ${automatic.workDays}`} />
            <InputCard label="Fazla Mesai Saati" value={calc.overtimeHours} onChange={v => setVal("overtimeHours", v)} suffix="saat" help={`Puantaj otomatiği: ${automatic.overtimeHours.toFixed(2)}`} />
            <InputCard label="Yemek / Yol Günü" value={calc.foodTravelDays} onChange={v => setVal("foodTravelDays", v)} suffix="gün" />
            <InputCard label="İkramiye / Tediye Günü" value={calc.tediyeDays} onChange={v => setVal("tediyeDays", v)} suffix="gün" />
            <InputCard label="Tatil Çalışma Günü" value={calc.holidayWorkDays} onChange={v => setVal("holidayWorkDays", v)} suffix="gün" />
            <InputCard label="Gece Çalışması" value={calc.nightHours} onChange={v => setVal("nightHours", v)} suffix="saat" />
            <InputCard label="Hizmet Primi" value={calc.servicePremiumRate} onChange={v => setVal("servicePremiumRate", v)} suffix="%" />
          </div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-3"><WalletCards className="h-4 w-4 text-emerald-300" /><h2 className="text-sm font-black text-white">Kesinti ayarları</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
            <MoneyField label="BES Kesintisi" value={calc.bes} autoValue={0} overridden={isOverridden("bes")} onChange={v => setVal("bes", v)} onReset={() => resetVal("bes")} />
            <MoneyField label="Sendika Kesintisi" value={calc.unionDeduction} autoValue={0} overridden={isOverridden("unionDeduction")} onChange={v => setVal("unionDeduction", v)} onReset={() => resetVal("unionDeduction")} />
            <MoneyField label="İcra / Nafaka" value={calc.garnishment} autoValue={0} overridden={isOverridden("garnishment")} onChange={v => setVal("garnishment", v)} onReset={() => resetVal("garnishment")} />
            <MoneyField label="Diğer Kesinti" value={calc.otherDeduction} autoValue={0} overridden={isOverridden("otherDeduction")} onChange={v => setVal("otherDeduction", v)} onReset={() => resetVal("otherDeduction")} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 no-print">
        <div className="panel p-4">
          <h2 className="text-sm font-black text-white mb-3">Vergi / prim kontrolü</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MoneyField label="Önceki Kümülatif Vergi Matrahı" value={calc.previousAnnualTaxBase} autoValue={0} overridden={isOverridden("previousAnnualTaxBase")} onChange={v => setVal("previousAnnualTaxBase", v)} onReset={() => resetVal("previousAnnualTaxBase")} />
            <InputCard label="Gelir Vergisi Oranı" value={calc.incomeTaxRate} onChange={v => setVal("incomeTaxRate", v)} suffix="%" help="Kurum uygulamasına göre kontrol edilebilir." />
            <MoneyField label="Gelir Vergisi İstisnası" value={calc.incomeTaxExemption} autoValue={0} overridden={isOverridden("incomeTaxExemption")} onChange={v => setVal("incomeTaxExemption", v)} onReset={() => resetVal("incomeTaxExemption")} />
            <MoneyField label="Damga Vergisi İstisnası" value={calc.stampTaxExemption} autoValue={0} overridden={isOverridden("stampTaxExemption")} onChange={v => setVal("stampTaxExemption", v)} onReset={() => resetVal("stampTaxExemption")} />
            <InputCard label="Damga Vergisi Oranı" value={calc.stampTaxRate} onChange={v => setVal("stampTaxRate", v)} suffix="‰" help="0,759 = %0,759" />
          </div>
          <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[.04] p-3 text-[10px] text-white/50 flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" /> Vergi ve kesinti oranları bordro dönemine ve kurum uygulamasına göre değişebildiği için hesaplanan tutarlar özellikle manuel düzeltmeye açık bırakıldı.</div>
        </div>

        <div className="panel p-4">
          <h2 className="text-sm font-black text-white mb-3">Hesaplanan sonuçlar</h2>
          <ReadonlyMoney label="Ücret Tutarı" value={calc.wage} tone="text-sky-300" />
          <ReadonlyMoney label="Sosyal Yardım" value={calc.socialAid} />
          <ReadonlyMoney label="Hizmet Primi" value={calc.servicePremium} />
          <ReadonlyMoney label="Gece Çalışması" value={calc.nightPay} />
          <ReadonlyMoney label="Fazla Mesai" value={calc.overtime} />
          <ReadonlyMoney label="Tatil Çalışması" value={calc.holidayPay} />
          <ReadonlyMoney label="Hizmet Zammı" value={calc.serviceSeniorityAllowance} />
          <ReadonlyMoney label="Yol Yardımı" value={calc.travel} />
          <div className="mt-3 rounded-xl bg-sky-500/10 border border-sky-400/20 p-3"><ReadonlyMoney label="Gelirler Toplamı" value={calc.gross} tone="text-sky-200" /></div>
          <div className="mt-2 rounded-xl bg-emerald-500/10 border border-emerald-400/20 p-3"><ReadonlyMoney label="Net Ödenen Tutar" value={calc.net} tone="text-emerald-300" /></div>
          <div className="mt-2 text-[10px] text-white/35">Tahakkuk Tutarı (işveren primleri dahil): {money(calc.tahakkuk)} ₺</div>
        </div>
      </div>

      <div className="panel p-4 no-print">
        <div className="flex items-center gap-2 mb-3"><FileText className="h-4 w-4 text-violet-300" /><h2 className="text-sm font-black text-white">Gelirler detayı</h2></div>
        <div className="overflow-x-auto rounded-xl border border-white/[.08]">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-white/[.04] text-white/55"><tr><th className="px-3 py-2 text-left">Gelir Adı</th><th className="px-3 py-2 text-right">Otomatik</th><th className="px-3 py-2 text-right">Hesaplanan / Manuel</th><th className="px-3 py-2 text-left">Kontrol</th></tr></thead>
            <tbody>{detailRows.map(([label, auto, current, key]) => <tr key={label} className="border-t border-white/[.06]"><td className="px-3 py-2 font-semibold text-white/75">{label}</td><td className="px-3 py-2 text-right text-white/40">{money(auto)} ₺</td><td className="px-3 py-2 text-right font-black text-white">{money(current)} ₺</td><td className="px-3 py-2">{key === "servicePremiumRate" ? <span className="text-white/35">Oran: {calc.servicePremiumRate}%</span> : isOverridden(key) ? <span className="text-amber-300">Manuel düzeltildi</span> : <span className="text-emerald-300">Otomatik</span>}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="payroll-print printdoc">
        <div className="print-title"><h1>İŞÇİ ÜCRET BORDROSU</h1><p>{departments.find(d => d.id === selectedDept)?.name ?? ""} · {MONTHS[month]} {year}</p></div>
        <table className="print-payroll-table"><tbody><tr><th>TC Kimlik No</th><td>{person.tcNo ?? ""}</td><th>Adı Soyad</th><td>{person.fullName ?? person.name}</td></tr></tbody></table>
        <h2>GELİRLER</h2>
        <table className="print-payroll-table"><tbody>
          <tr><th>Günlük Ücret</th><td>{money(calc.dailyWage)}</td><th>Aylık Ücret</th><td>{money(calc.wage)}</td><th>SGK Günü</th><td>{money(calc.sgkDays)}</td></tr>
          <tr><th>Çalışma Günü</th><td>{money(calc.workDays)}</td><th>Tatil Çalışma Günü</th><td>{money(calc.holidayWorkDays)}</td><th>İkramiye / Tediye Günü</th><td>{money(calc.tediyeDays)}</td></tr>
          <tr><th>Fazla Mesai Saati</th><td>{money(calc.overtimeHours)}</td><th>Yemek / Yol Günü</th><td>{money(calc.foodTravelDays)}</td><th>Ücret Tutarı</th><td>{money(calc.wage)}</td></tr>
          <tr><th>Tatil Çalışma Tutarı</th><td>{money(calc.holidayPay)}</td><th>Sosyal Yardım Tutarı</th><td>{money(calc.socialAid)}</td><th>Fazla Mesai Tutarı</th><td>{money(calc.overtime)}</td></tr>
          <tr><th>İkramiye / Tediye Tutarı</th><td>{money(calc.tediye)}</td><th>SGK İşveren Katkısı</th><td>{money(calc.sgkEmployer)}</td><th>SGK İşsiz İşveren Katkısı</th><td>{money(calc.unemploymentEmployer)}</td></tr>
          <tr><th>Tahakkuk Tutarı</th><td>{money(calc.tahakkuk)}</td><td colSpan={4}></td></tr>
        </tbody></table>
        <h2>GELİRLER DETAY</h2>
        <table className="print-payroll-table"><tbody>{detailRows.map(([label, , current]) => <tr key={label}><th>{label}</th><td>{money(current)}</td><th>İstisna Tutarı</th><td>0,00</td></tr>)}</tbody></table>
        <h2>KESİNTİLER</h2>
        <table className="print-payroll-table"><tbody>
          <tr><th>SGK PEK Tutarı</th><td>{money(calc.gross)}</td><th>BES Kesintisi</th><td>{money(calc.bes)}</td><th>SGK İşveren Katkısı</th><td>{money(calc.sgkEmployer)}</td></tr>
          <tr><th>SGK İşsiz İşveren Katkısı</th><td>{money(calc.unemploymentEmployer)}</td><th>SGK Çalışan Katkısı</th><td>{money(calc.sgkEmployee)}</td><th>SGK İşsiz Çalışan Katkısı</th><td>{money(calc.unemploymentEmployee)}</td></tr>
          <tr><th>Yıllık Vergi Matrahı</th><td>{money(calc.annualTaxBase)}</td><th>Aylık Vergi Matrahı</th><td>{money(calc.monthlyTaxBase)}</td><th>Gelir Vergisi</th><td>{money(calc.incomeTax)}</td></tr>
          <tr><th>Gelir Vergisi İstisnası</th><td>{money(calc.incomeTaxExemption)}</td><th>Damga Vergisi</th><td>{money(calc.stampTax)}</td><th>Sendika Kesintisi</th><td>{money(calc.unionDeduction)}</td></tr>
          <tr><th>İcra / Nafaka Kesintisi</th><td>{money(calc.garnishment)}</td><th>Diğer Kesinti</th><td>{money(calc.otherDeduction)}</td><th>Kesinti Toplamı</th><td>{money(calc.deductions)}</td></tr>
        </tbody></table>
        <div className="print-net">Net Ödenen Tutar : <b>{money(calc.net)} ₺</b></div>
      </div>
    </div>
  );
}
