"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown, ClipboardList, CalendarClock, LayoutTemplate, CalendarDays, Repeat, Users, Scale, ShieldAlert, Megaphone, DatabaseBackup, Menu, X, Building2, Plus, Fingerprint, HeartPulse, MonitorDown, Stethoscope, SprayCan, Wrench, Pencil, Trash2, Check, Settings2, Ellipsis, Database, LockKeyhole, Banknote,
} from "lucide-react";
import type { Department, Personnel, Holiday, ShiftTemplate, StaffGroup } from "@/lib/shared";
import { staffGroupMeta, staffGroupOf, personnelInDepartment, listStaffGroups, setExtraGroups, makeCustomGroup, isCustomGroup, parseStaffGroup } from "@/lib/shared";
import { MonthNav, Btn, Modal, Field, TextInput, cx } from "@/components/ui-kit";
import { CustomGroupModal } from "@/components/modals";
import { downloadPanelPreview } from "@/lib/download-preview";
import PuantajPage from "@/components/PuantajPage";
import MaasBordroPage from "@/components/MaasBordroPage";
import NobetPage from "@/components/NobetPage";
import TemplatesPage from "@/components/TemplatesPage";
import LeavesPage from "@/components/LeavesPage";
import SwapPage from "@/components/SwapPage";
import PersonnelPage from "@/components/PersonnelPage";
import AnalysisPage from "@/components/AnalysisPage";
import WarningsPage from "@/components/WarningsPage";
import NotesPage from "@/components/NotesPage";
import BackupPage from "@/components/BackupPage";
import SettingsPage from "@/components/SettingsPage";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";

type PageKey =
  | "nobet" | "puantaj" | "bordro" | "sablon" | "personel" | "izin" | "degisim"
  | "analiz" | "uyarilar" | "duyuru" | "yedek" | "ayarlar";

/** Renkli, yuvarlatılmış simge kutusu (logodaki gibi gradyanlı zemin üzerinde beyaz simge). */
function NavIcon({ grad, size = "md", active = true, children }: { grad: string; size?: "sm" | "md" | "lg"; active?: boolean; children: React.ReactNode }) {
  const box = size === "lg" ? "w-8 h-8 rounded-[10px]" : size === "sm" ? "w-6 h-6 rounded-lg" : "w-7 h-7 rounded-lg";
  return (
    <span className={cx("inline-flex items-center justify-center shrink-0 bg-gradient-to-br text-white shadow-md transition", box, grad, active ? "shadow-black/40 ring-1 ring-white/20" : "opacity-80 group-hover:opacity-100 shadow-black/30")}>
      {children}
    </span>
  );
}

const NAV: { key: PageKey; label: string; icon: React.ReactNode; desc: string; grad: string }[] = [
  { key: "nobet", label: "Nöbet Çizelgesi", icon: <CalendarClock className="w-[17px] h-[17px]" />, desc: "Vardiya atamaları", grad: "from-violet-500 to-purple-600" },
  { key: "puantaj", label: "Puantaj", icon: <ClipboardList className="w-[17px] h-[17px]" />, desc: "Aylık çalışma cetveli", grad: "from-sky-500 to-blue-600" },
  { key: "bordro", label: "Maaş Bordro", icon: <Banknote className="w-[17px] h-[17px]" />, desc: "Otomatik ücret hesaplama", grad: "from-emerald-500 to-cyan-600" },
  { key: "sablon", label: "Vardiya Şablonları", icon: <LayoutTemplate className="w-[17px] h-[17px]" />, desc: "2'li / 3'lü düzenler", grad: "from-fuchsia-500 to-pink-600" },
  { key: "personel", label: "Personel Yönetimi", icon: <Users className="w-[17px] h-[17px]" />, desc: "Ekle, düzenle, departman ata", grad: "from-cyan-500 to-sky-600" },
  { key: "izin", label: "İzin Yönetimi", icon: <CalendarDays className="w-[17px] h-[17px]" />, desc: "Talepler ve onay akışı", grad: "from-emerald-500 to-teal-600" },
  { key: "degisim", label: "Değişim Talepleri", icon: <Repeat className="w-[17px] h-[17px]" />, desc: "Nöbet takası", grad: "from-orange-500 to-amber-600" },
  { key: "analiz", label: "Adalet Analizi", icon: <Scale className="w-[17px] h-[17px]" />, desc: "Nöbet dağılımı", grad: "from-yellow-500 to-orange-500" },
  { key: "uyarilar", label: "Mevzuat Uyarıları", icon: <ShieldAlert className="w-[17px] h-[17px]" />, desc: "Dinlenme ve limitler", grad: "from-rose-500 to-red-600" },
  { key: "duyuru", label: "Duyurular", icon: <Megaphone className="w-[17px] h-[17px]" />, desc: "Servis bildirimleri", grad: "from-pink-500 to-rose-600" },
  { key: "yedek", label: "Yedekleme", icon: <DatabaseBackup className="w-[17px] h-[17px]" />, desc: "Veri güvenliği", grad: "from-indigo-500 to-blue-700" },
  { key: "ayarlar", label: "Ayarlar", icon: <Settings2 className="w-[17px] h-[17px]" />, desc: "Kurum, görünüm ve sistem", grad: "from-slate-500 to-slate-700" },
];

const MONTH_PAGES: PageKey[] = ["nobet", "puantaj", "bordro", "sablon", "izin", "degisim", "analiz", "uyarilar"];
/** Personel grubuna (Hemşire/Sağlık · Temizlik/Destek) göre ayrı çalışan sayfalar */
const GROUP_PAGES: PageKey[] = ["puantaj", "nobet", "sablon", "analiz", "uyarilar"];

export type BootstrapPayload = {
  departments: Department[];
  personnel: Personnel[];
  holidays: Holiday[];
  templates: ShiftTemplate[];
  /** Sunucu tarihi: SSR ve istemci aynı ay ile başlar (hidrasyon uyumu). */
  today?: { year: number; month: number };
};

export default function AppShell({ initialData }: { initialData?: BootstrapPayload }) {
  const [departments, setDepartments] = useState<Department[]>(() => initialData?.departments ?? []);
  const [personnel, setPersonnel] = useState<Personnel[]>(() => initialData?.personnel ?? []);
  const [holidays, setHolidays] = useState<Holiday[]>(() => initialData?.holidays ?? []);
  const [templates, setTemplates] = useState<ShiftTemplate[]>(() => initialData?.templates ?? []);
  const [selectedDept, setSelectedDept] = useState(() => initialData?.departments?.[0]?.id ?? "");
  // KRİTİK: İlk render'da sunucu tarihini kullan. new Date() kullanmak,
  // sunucu ve kullanıcı bilgisayarının saatleri farklıysa hidrasyon
  // uyuşmazlığına ve tüm tıklamaların ölmesine (donuk sayfa) yol açar.
  const [year, setYear] = useState(() => initialData?.today?.year ?? new Date().getFullYear());
  const [month, setMonth] = useState(() => initialData?.today?.month ?? new Date().getMonth());
  const [page, setPage] = useState<PageKey>("ayarlar");
  const [staffGroup, setStaffGroup] = useState<StaffGroup>("SAGLIK");
  // Elle eklenen nöbet grupları veritabanında (ayarlar tablosu) saklanır; böylece yedeğe girer.
  const [customGroups, setCustomGroups] = useState<StaffGroup[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/custom-groups", { cache: "no-store" });
        const data = await res.json();
        let list: StaffGroup[] = Array.isArray(data.groups) ? data.groups : [];
        // Eski sürümde yalnız tarayıcıda tutulan gruplar varsa veritabanına taşı.
        let legacy: StaffGroup[] = [];
        try {
          const raw = JSON.parse(localStorage.getItem("p26-custom-groups") || "[]");
          if (Array.isArray(raw)) legacy = raw.map(parseStaffGroup).filter(isCustomGroup);
        } catch {}
        const missing = legacy.filter(g => !list.includes(g));
        if (missing.length) {
          list = [...list, ...missing];
          const put = await fetch("/api/custom-groups", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groups: list }) });
          if (!put.ok) { setCustomGroups(list); return; }
        }
        try { localStorage.removeItem("p26-custom-groups"); } catch {}
        setCustomGroups(list);
      } catch {}
    })();
  }, []);
  async function saveCustomGroups(list: StaffGroup[]) {
    setCustomGroups(list);
    try {
      await fetch("/api/custom-groups", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groups: list }) });
    } catch {}
  }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState<false | "add" | "edit">(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const deptRef = useRef<HTMLDivElement | null>(null);
  const [bootError, setBootError] = useState("");
  const [settingsDirty, setSettingsDirty] = useState(false);
  function navigate(key: PageKey) {
    if (page === "ayarlar" && key !== "ayarlar" && settingsDirty && !window.confirm("Kaydedilmemiş ayarlarınız var. Kaydetmeden bu sayfadan ayrılmak istiyor musunuz?")) return;
    setPage(key); setSidebarOpen(false);
  }
  useEffect(() => {
    const listener = (event: Event) => setSettingsDirty(Boolean((event as CustomEvent).detail));
    window.addEventListener("p26-dirty", listener);
    return () => window.removeEventListener("p26-dirty", listener);
  }, []);
  const [preferences, setPreferences] = useState<AppSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    try { const stored = localStorage.getItem("p26-settings"); if (stored) setPreferences({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) }); } catch {}
    const handler = (event: Event) => setPreferences((event as CustomEvent<AppSettings>).detail);
    window.addEventListener("p26-settings", handler);
    return () => window.removeEventListener("p26-settings", handler);
  }, []);

  /** İmza alanı gibi servis bilgileri kaydedilince tüm sayfalar (puantaj, nöbet çıktısı) güncel veriyi görsün. */
  const updateDepartment = useCallback((d: Department) => {
    setDepartments(prev => prev.map(x => x.id === d.id ? { ...x, ...d } : x));
  }, []);

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bağlantı hatası");
      setDepartments(data.departments ?? []);
      setPersonnel(data.personnel ?? []);
      setHolidays(data.holidays ?? []);
      setTemplates(data.templates ?? []);
      setSelectedDept(prev => (prev && data.departments?.some((d: Department) => d.id === prev)) ? prev : data.departments?.[0]?.id ?? "");
    } catch (e) {
      setBootError(e instanceof Error ? e.message : "Yüklenemedi");
    }
  }, []);

  useEffect(() => {
    if (!initialData || !initialData.departments?.length) {
      loadBootstrap();
    }
  }, [initialData, loadBootstrap]);

  // Dışına tıklayınca veya ESC ile servis menüsünü kapat
  useEffect(() => {
    if (!deptOpen) return;
    const outside = (e: MouseEvent) => {
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) setDeptOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setDeptOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [deptOpen]);

  const deptName = departments.find(d => d.id === selectedDept)?.name ?? "";
  // Seçili grubun personeli: puantaj/nöbet hesapları yalnızca bu listeyle yapılır
  const groupPersonnel = personnel.filter(p => staffGroupOf(p) === staffGroup);
  setExtraGroups(customGroups);
  const allGroups = listStaffGroups(personnel);
  setExtraGroups(allGroups);
  const groupCount = (g: StaffGroup) =>
    personnel.filter(p => p.isActive && staffGroupOf(p) === g && personnelInDepartment(p, selectedDept)).length;
  const showGroup = GROUP_PAGES.includes(page);
  const [showAddGroup, setShowAddGroup] = useState(false);
  function addCustomGroup(id: StaffGroup) {
    if (!allGroups.includes(id)) saveCustomGroups([...customGroups, id]);
    setStaffGroup(id);
  }
  function removeCustomGroup(g: StaffGroup) {
    if (personnel.some(p => staffGroupOf(p) === g)) { window.alert("Bu grupta personel var. Önce personeli başka bir gruba taşıyın."); return; }
    if (!window.confirm(`"${staffGroupMeta(g).label}" grubu kaldırılsın mı?`)) return;
    saveCustomGroups(customGroups.filter(x => x !== g));
    if (staffGroup === g) setStaffGroup("SAGLIK");
  }
  const groupIcon = (g: StaffGroup) => g === "SAGLIK" ? Stethoscope : g === "DESTEK" ? SprayCan : g === "TEKNISYEN" ? Wrench : ClipboardList;
  const groupSwitch = (compact = false) => (
    <div className="flex items-center gap-1 bg-white/[.05] border border-white/10 rounded-xl p-1 max-w-full overflow-x-auto" role="tablist" aria-label="Personel grubu">
      {allGroups.map(g => {
        const Icon = groupIcon(g);
        const meta = staffGroupMeta(g);
        return (
          <span key={g} className="inline-flex items-center shrink-0">
            <button
              type="button"
              role="tab"
              aria-selected={staffGroup === g}
              onClick={() => setStaffGroup(g)}
              title={`${meta.label} — ${meta.desc}`}
              className={cx(
                "px-2.5 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer whitespace-nowrap",
                staffGroup === g ? meta.tab : "border-transparent text-white/45 hover:text-white"
              )}
            >
              <Icon className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{compact ? meta.short.split(" ")[0] : meta.short}
              <span className="ml-1 opacity-60">({groupCount(g)})</span>
            </button>
            {isCustomGroup(g) && staffGroup === g && (
              <button type="button" aria-label="Grubu kaldır" title="Grubu kaldır (personeli yoksa)" onClick={() => removeCustomGroup(g)} className="ml-0.5 p-1 rounded text-white/40 hover:text-rose-300 cursor-pointer"><X className="w-3 h-3" /></button>
            )}
          </span>
        );
      })}
      <button type="button" onClick={() => setShowAddGroup(true)} title="Elle yeni nöbet grubu ekle" className="px-2 py-1.5 rounded-lg border border-dashed border-white/20 text-white/50 hover:text-white hover:border-white/40 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0">
        <Plus className="w-3.5 h-3.5 inline -mt-0.5" /> Özel
      </button>
    </div>
  );
  const navItem = NAV.find(n => n.key === page)!;

  return (
    <div className={cx("screen-root min-h-screen lg:flex", page === "ayarlar" && "settings-screen")}>
      {/* Mobil üst çubuk */}
      <div className="lg:hidden flex items-center gap-2 px-3 py-2.5 border-b border-white/10 bg-[#0a1020]/95 backdrop-blur sticky top-0 z-40">
        <button aria-label="Menüyü aç" onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-white/5 text-white/70 hover:text-white transition"><Menu className="w-4 h-4" /></button>
        <NavIcon grad={navItem.grad} size="sm">{navItem.icon}</NavIcon>
        <div className="text-white font-bold text-xs">{navItem.label}</div>
        <div className="flex-1" />
        {MONTH_PAGES.includes(page) && (
          <MonthNav year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        )}
      </div>

      {/* Kenar çubuğu */}
      <aside className={cx(
        "fixed inset-y-0 left-0 z-50 w-[264px] bg-[#090e1b] border-r border-white/[.09] flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto",
        sidebarOpen ? "translate-x-0 shadow-2xl shadow-black" : "-translate-x-full"
      )}>
        <div className="px-4 pt-5 pb-4 border-b border-white/[.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shadow-lg shadow-sky-950/50">
              {preferences.logo ? <img src={preferences.logo} alt="Kurum logosu" className="w-full h-full object-cover rounded-xl" /> : <HeartPulse className="w-5 h-5 text-white" />}
            </div>
            <div>
              <div className="text-white font-black text-[15px] leading-tight" style={{ fontFamily: "var(--font-grotesk)" }}>{preferences.shortName}</div>
              <div className="text-white/35 text-[10px] font-medium tracking-wide">Puantaj & Nöbet Yönetimi</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-1.5 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
          <div className="shell-nav-label">ÇALIŞMA ALANI</div>
          {NAV.map(n => (
            <div key={n.key}>
            {n.key === "analiz" && <div className="shell-nav-label">YÖNETİM</div>}
            <button
              key={n.key}
              aria-current={page === n.key ? "page" : undefined}
              type="button"
              onClick={() => navigate(n.key)}
              className={cx(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition cursor-pointer select-none group",
                page === n.key
                  ? "bg-gradient-to-r from-sky-500/20 to-sky-500/5 border border-sky-400/30 text-white shadow-[inset_2px_0_0_0_#38bdf8]"
                  : "text-white/55 hover:text-white hover:bg-white/[.05] border border-transparent"
              )}
            >
              <span className="pointer-events-none"><NavIcon grad={n.grad} active={page === n.key}>{n.icon}</NavIcon></span>
              <span className="flex-1 min-w-0 pointer-events-none">
                <span className="block text-xs font-bold leading-tight">{n.label}</span>
                <span className="block text-[10px] opacity-60 truncate">{n.desc}</span>
              </span>
            </button>
            </div>
          ))}
        </nav>

        {page !== "ayarlar" && <div className="px-3 py-3 border-t border-white/[.08] space-y-2">
          <Link
            href="/personel" target="_blank"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/15 transition text-xs font-bold"
          >
            <Fingerprint className="w-4 h-4" />
            <span>
              Personel Sorgu Ekranı
              <span className="block text-[9.5px] font-medium opacity-60">Şifresiz · TC ile giriş</span>
            </span>
          </Link>
          <PreviewDownloadButton />
          <p className="text-white/20 text-[9px] px-1 leading-relaxed">
            İzinli personelin nöbet listesinden çıkarılması, dinlenme süreleri ve mükerrer vardiya koruması aktiftir.
          </p>
        </div>}
        {page === "ayarlar" && <div className="settings-sidebar-footer">
          <div className="sidebar-workspace"><Database size={16} /><div><b>Kurum çalışma alanı</b><small>{departments.length > 0 ? "PostgreSQL bağlantısı etkin" : "Bağlantı hazırlanıyor"}</small></div></div>
          <div className="sidebar-user-card"><span className="user-avatar">YK</span><div><b>Yönetici</b><small>Kurum yönetimi</small></div><details className="sidebar-tools"><summary aria-label="Ek araçlar"><Ellipsis size={17} /></summary><div><Link href="/personel" target="_blank"><Fingerprint size={14} /> Personel sorgu ekranı</Link><PreviewDownloadButton /></div></details></div>
          <div className="sidebar-version"><LockKeyhole size={9} /> Kurum içi kullanım<span>v1.1.0</span></div>
        </div>}
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* İçerik */}
      <main className="flex-1 min-w-0 relative z-0">
        {page !== "ayarlar" && <header className="hidden lg:block sticky top-0 z-30 bg-[#070b14]/90 backdrop-blur-md border-b border-white/[.07]">
          {/* 1. satır — Departmanlar: en üstte, yan yana, tek satır (taşarsa yatay kaydırma) */}
          <div className="flex items-center gap-2 px-6 pt-3 pb-2.5 border-b border-white/[.05]">
            <span className="flex items-center gap-1.5 text-white/35 text-[10px] font-bold uppercase tracking-widest shrink-0">
              <Building2 className="w-3.5 h-3.5" /> Servisler / Departman
            </span>
            <div className="relative" ref={deptRef}>
              <button
                type="button"
                onClick={() => setDeptOpen(v => !v)}
                aria-haspopup="listbox"
                aria-expanded={deptOpen}
                title="Servis değiştir"
                className={cx(
                  "px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 min-w-[160px] justify-between",
                  selectedDept
                    ? "bg-sky-500/20 border-sky-400/60 text-sky-200 shadow-[0_0_14px_-2px_rgba(56,189,248,.4)]"
                    : "bg-white/[.04] border-white/10 text-white/50 hover:text-white"
                )}
              >
                <span className="truncate">{(departments.find(d => d.id === selectedDept)?.name ?? "Servis seçin")}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
              </button>
              {deptOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 top-full mt-1.5 z-50 min-w-[260px] max-h-[60vh] overflow-y-auto rounded-xl border border-white/15 bg-[#0f1626]/98 backdrop-blur shadow-2xl shadow-black/60 p-1.5 no-scrollbar"
                >
                  {departments.length === 0 ? (
                    <div className="px-3 py-2 text-white/40 text-xs">Henüz servis yok</div>
                  ) : (
                    departments.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        role="option"
                        aria-selected={d.id === selectedDept}
                        onClick={() => { setSelectedDept(d.id); setDeptOpen(false); }}
                        className={cx(
                          "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-between gap-2",
                          d.id === selectedDept ? "bg-sky-500/25 text-sky-100" : "text-white/80 hover:bg-white/10"
                        )}
                      >
                        <span className="truncate">{d.name}</span>
                        {d.id === selectedDept && <Check className="w-3.5 h-3.5 text-sky-300 shrink-0" />}
                      </button>
                    ))
                  )}
                  <div className="border-t border-white/10 mt-1.5 pt-1.5 flex gap-1">
                    <button type="button" onClick={() => { setDeptOpen(false); setShowDeptModal("add"); }} className="flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition flex items-center justify-center gap-1"><Plus className="w-3 h-3" /> Yeni servis</button>
                    <button type="button" onClick={() => { setDeptOpen(false); setShowDeptModal("edit"); }} className="flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition flex items-center justify-center gap-1"><Pencil className="w-3 h-3" /> Yönet</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. satır — Sayfa başlığı (sol) · Ekip sekmeleri + Ay seçici (sağ) */}
          <div className="flex items-center gap-3 px-6 py-3 flex-wrap">
            <div className="min-w-0 mr-auto flex items-center gap-3">
              <NavIcon grad={navItem.grad} size="lg">{navItem.icon}</NavIcon>
              <div className="min-w-0">
                <h1 className="text-white font-black text-base leading-tight truncate" style={{ fontFamily: "var(--font-grotesk)" }}>{navItem.label}</h1>
                <p className="text-white/35 text-[11px] truncate">{navItem.desc}{deptName ? ` · ${deptName}` : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {showGroup && groupSwitch()}
              {MONTH_PAGES.includes(page) && (
                <MonthNav year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
              )}
            </div>
          </div>
        </header>}

        {/* Mobil departman menüsü */}
        <div className={cx("lg:hidden px-3 py-2 flex items-center gap-1.5 border-b border-white/[.07]", page === "ayarlar" && "!hidden")}>
          <div className="relative flex-1" ref={deptRef}>
            <button
              type="button"
              onClick={() => setDeptOpen(v => !v)}
              aria-haspopup="listbox"
              aria-expanded={deptOpen}
              className={cx(
                "w-full px-3 py-1.5 rounded-lg border text-[12px] font-bold transition cursor-pointer flex items-center gap-1.5 justify-between",
                selectedDept ? "bg-sky-500/20 border-sky-400/60 text-sky-200" : "bg-white/[.04] border-white/10 text-white/60"
              )}
            >
              <span className="truncate flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-white/50" />{(departments.find(d => d.id === selectedDept)?.name ?? 'Servis seçin')}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
            </button>
            {deptOpen && (
              <div role="listbox" className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-[60vh] overflow-y-auto rounded-xl border border-white/15 bg-[#0f1626]/98 backdrop-blur shadow-2xl shadow-black/60 p-1.5 no-scrollbar">
                {departments.length === 0 ? (
                  <div className="px-3 py-2 text-white/40 text-xs">Henüz servis yok</div>
                ) : (
                  departments.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      role="option"
                      aria-selected={d.id === selectedDept}
                      onClick={() => { setSelectedDept(d.id); setDeptOpen(false); }}
                      className={cx(
                        "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-between gap-2",
                        d.id === selectedDept ? "bg-sky-500/25 text-sky-100" : "text-white/85 hover:bg-white/10"
                      )}
                    >
                      <span className="truncate">{d.name}</span>
                      {d.id === selectedDept && <Check className="w-3.5 h-3.5 text-sky-300 shrink-0" />}
                    </button>
                  ))
                )}
                <div className="border-t border-white/10 mt-1.5 pt-1.5 flex gap-1">
                  <button type="button" onClick={() => { setDeptOpen(false); setShowDeptModal("add"); }} className="flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/75 transition flex items-center justify-center gap-1"><Plus className="w-3 h-3" /> Yeni</button>
                  <button type="button" onClick={() => { setDeptOpen(false); setShowDeptModal("edit"); }} className="flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/75 transition flex items-center justify-center gap-1"><Pencil className="w-3 h-3" /> Yönet</button>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Mobil grup seçimi */}
        {showGroup && <div className="lg:hidden px-3 pt-2">{groupSwitch(true)}</div>}

        <div className={page === "ayarlar" ? "" : "px-3 sm:px-5 lg:px-6 py-4 max-w-[1600px]"}>
          {selectedDept && (
            <>
              {page === "puantaj" && (
                <PuantajPage
                  key={`p-${staffGroup}`}
                  departments={departments} personnel={groupPersonnel} holidays={holidays}
                  selectedDept={selectedDept} year={year} month={month} staffGroup={staffGroup}
                  onPersonnelChanged={loadBootstrap}
                  onDepartmentUpdated={updateDepartment}
                />
              )}
              {page === "nobet" && (
                <NobetPage key={`n-${staffGroup}`} onDepartmentUpdated={updateDepartment} departments={departments} personnel={groupPersonnel} holidays={holidays} selectedDept={selectedDept} year={year} month={month} staffGroup={staffGroup} />
              )}
              {page === "bordro" && <MaasBordroPage departments={departments} personnel={personnel} holidays={holidays} selectedDept={selectedDept} year={year} month={month} />}
              {page === "sablon" && (
                <TemplatesPage
                  departments={departments} personnel={groupPersonnel} templates={templates} staffGroup={staffGroup}
                  selectedDept={selectedDept} year={year} month={month} onTemplatesChanged={loadBootstrap}
                />
              )}
              {page === "izin" && <LeavesPage departments={departments} personnel={personnel} selectedDept={selectedDept} year={year} />}
              {page === "degisim" && <SwapPage departments={departments} personnel={personnel} selectedDept={selectedDept} year={year} month={month} />}
              {page === "personel" && <PersonnelPage departments={departments} selectedDept={selectedDept} onPersonnelChanged={loadBootstrap} />}
              {page === "analiz" && <AnalysisPage key={`a-${staffGroup}`} departments={departments} personnel={groupPersonnel} holidays={holidays} selectedDept={selectedDept} year={year} month={month} />}
              {page === "uyarilar" && <WarningsPage key={`w-${staffGroup}`} departments={departments} personnel={groupPersonnel} selectedDept={selectedDept} year={year} month={month} />}
              {page === "duyuru" && <NotesPage departments={departments} selectedDept={selectedDept} />}
            </>
          )}
          {page === "yedek" && <BackupPage />}
          {page === "ayarlar" && <SettingsPage departments={departments} onPersonnelChanged={loadBootstrap} onOpenPersonnel={() => navigate("personel")} />}
        </div>
      </main>
      {showAddGroup && (
        <CustomGroupModal existing={allGroups} onAdd={addCustomGroup} onClose={() => setShowAddGroup(false)} />
      )}

      {showDeptModal && (
        <DeptManageModal
          selectedId={selectedDept}
          startWithAdd={showDeptModal === "add"}
          onClose={() => setShowDeptModal(false)}
          onChanged={async (focusId) => { await loadBootstrap(); if (focusId) setSelectedDept(focusId); }}
        />
      )}
    </div>
  );
}

function PreviewDownloadButton() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const res = await downloadPanelPreview();
    setBusy(false);
    if (!res.ok) {
      setFailed(true);
      setTimeout(() => setFailed(false), 4000);
    }
  }
  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title="Nöbet Çizelgesi ekranının statik kopyasını index.html olarak indir"
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/15 active:scale-[.98] transition text-xs font-bold text-left disabled:opacity-60"
    >
      <MonitorDown className={`w-4 h-4 shrink-0 ${busy ? "animate-pulse" : ""}`} />
      <span>
        {busy ? "Hazırlanıyor…" : failed ? "Tekrar Dene — Yeni Sekme Açıldı" : "Arayüzü index.html Olarak İndir"}
        <span className="block text-[9.5px] font-medium opacity-60">Tek dosya · paylaşılabilir · internetsiz açılır</span>
      </span>
    </button>
  );
}

type DeptRow = Department & { stats?: { personnel: number; schedules: number; columns: number } };

/**
 * Servis / Departman Yönetimi: ekleme, ad düzeltme ve silme tek pencerede.
 * Silmede personel kayıtları korunur; yalnızca servise ait nöbet atamaları silinir.
 */
function DeptManageModal({ selectedId, startWithAdd, onClose, onChanged }: {
  selectedId: string;
  startWithAdd?: boolean;
  onClose: () => void;
  onChanged: (focusId?: string) => Promise<void> | void;
}) {
  const [rows, setRows] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/departments", { cache: "no-store" });
      const data = await res.json();
      setRows(data.departments ?? []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function call(method: string, body: unknown) {
    const res = await fetch("/api/departments", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "İşlem başarısız");
    return data;
  }

  async function add() {
    if (newName.trim().length < 2 || busy) return;
    setBusy(true); setMsg(null);
    try {
      const data = await call("POST", { name: newName });
      setNewName("");
      setMsg({ kind: "ok", text: `"${data.department.name}" eklendi.` });
      await load();
      await onChanged(data.department.id);
    } catch (e) { setMsg({ kind: "err", text: e instanceof Error ? e.message : "Eklenemedi" }); }
    finally { setBusy(false); }
  }

  async function saveEdit(d: DeptRow) {
    if (busy) return;
    if (editName.trim() === d.name) { setEditId(null); return; }
    setBusy(true); setMsg(null);
    try {
      const data = await call("PATCH", { id: d.id, name: editName });
      setEditId(null);
      setMsg({ kind: "ok", text: `"${d.name}" → "${data.department.name}" olarak düzeltildi.` });
      await load();
      await onChanged();
    } catch (e) { setMsg({ kind: "err", text: e instanceof Error ? e.message : "Kaydedilemedi" }); }
    finally { setBusy(false); }
  }

  async function remove(d: DeptRow) {
    if (busy) return;
    const st = d.stats ?? { personnel: 0, schedules: 0, columns: 0 };
    const lines = [
      `"${d.name}" servisi silinsin mi?`,
      "",
      st.personnel ? `• ${st.personnel} personel SİLİNMEZ — yalnızca bu servisle bağları kaldırılır (başka servisi olan oraya aktarılır).` : "• Bu serviste kayıtlı personel yok.",
      st.schedules ? `• Bu servise ait ${st.schedules} nöbet ataması ve nöbet sütunları SİLİNİR.` : "• Nöbet ataması yok.",
      "• Personelin puantaj kayıtları korunur.",
      "",
      "Bu işlem geri alınamaz. Öncesinde Yedekleme sayfasından yedek almanız önerilir.",
    ];
    if (!confirm(lines.join("\n"))) return;
    setBusy(true); setMsg(null);
    try {
      await call("DELETE", { id: d.id });
      setMsg({ kind: "ok", text: `"${d.name}" silindi.` });
      await load();
      await onChanged();
    } catch (e) { setMsg({ kind: "err", text: e instanceof Error ? e.message : "Silinemedi" }); }
    finally { setBusy(false); }
  }

  return (
    <Modal wide title={<><Building2 className="w-4 h-4 text-sky-400" /> Servis / Departman Yönetimi</>} onClose={onClose}>
      <div className="space-y-4">
        {/* Ekleme */}
        <div className="flex gap-2">
          <TextInput
            autoFocus={startWithAdd}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
            placeholder="Yeni servis adı, ör. Cerrahi Servisi"
          />
          <Btn variant="primary" onClick={add} disabled={newName.trim().length < 2 || busy}>
            <Plus className="w-4 h-4" /> Ekle
          </Btn>
        </div>

        {msg && (
          <div className={cx(
            "text-xs rounded-lg px-3 py-2 border",
            msg.kind === "ok" ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200" : "bg-rose-500/10 border-rose-500/40 text-rose-200"
          )}>{msg.text}</div>
        )}

        {/* Liste */}
        <div className="space-y-1.5 max-h-[52vh] overflow-y-auto pr-1">
          {loading && <p className="text-white/40 text-xs py-6 text-center">Yükleniyor…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-white/40 text-xs py-6 text-center">Henüz servis yok. Yukarıdan ilk servisinizi ekleyin.</p>
          )}
          {rows.map(d => {
            const st = d.stats ?? { personnel: 0, schedules: 0, columns: 0 };
            const editing = editId === d.id;
            return (
              <div key={d.id} className={cx(
                "flex items-center gap-2 rounded-xl border px-3 py-2 transition",
                d.id === selectedId ? "bg-sky-500/[.08] border-sky-400/40" : "bg-white/[.04] border-white/10"
              )}>
                {editing ? (
                  <TextInput
                    autoFocus
                    value={editName}
                    onFocus={e => e.target.select()}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveEdit(d); if (e.key === "Escape") setEditId(null); }}
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-bold truncate">
                      {d.name}
                      {d.id === selectedId && <span className="ml-2 text-[10px] font-semibold text-sky-300">seçili</span>}
                    </div>
                    <div className="text-white/35 text-[11px]">
                      {st.personnel} personel · {st.schedules} nöbet ataması
                    </div>
                  </div>
                )}
                {editing ? (
                  <>
                    <Btn small variant="success" onClick={() => saveEdit(d)} disabled={busy || editName.trim().length < 2}>
                      <Check className="w-3.5 h-3.5" /> Kaydet
                    </Btn>
                    <Btn small onClick={() => setEditId(null)}>Vazgeç</Btn>
                  </>
                ) : (
                  <>
                    <Btn small onClick={() => { setEditId(d.id); setEditName(d.name); setMsg(null); }} title="Adı düzelt">
                      <Pencil className="w-3.5 h-3.5" /> Düzenle
                    </Btn>
                    <Btn small variant="danger" onClick={() => remove(d)} disabled={busy} title="Servisi sil">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Btn>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-white/30 text-[11px] leading-relaxed">
          Ad düzeltmesi tüm sayfalara ve çıktılara hemen yansır; nöbet ve puantaj kayıtları korunur.
          İmza alanlarını (Sorumlu Hemşire, Müdür, Başhekim) Puantaj sayfasındaki “İmza Alanları” düğmesinden düzenleyebilirsiniz.
        </p>
        <div className="flex justify-end">
          <Btn onClick={onClose}>Kapat</Btn>
        </div>
      </div>
    </Modal>
  );
}
