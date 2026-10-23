"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Banknote,
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coffee,
  DatabaseBackup,
  DoorOpen,
  Fingerprint,
  LayoutTemplate,
  Megaphone,
  Repeat,
  Scale,
  ScanFace,
  Settings,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { LiveClock } from "@/components/live-clock";
import { cn } from "@/components/ui";
import { withBasePath } from "@/lib/asset-path";

type NavEntry = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  /** Menüye ait kendine özel gradyan renk (Personel26 panelindeki renkli ikonlar gibi). */
  grad: string;
};

/** Renkli, yuvarlatılmış simge kutusu (Personel26 panelindeki gibi gradyanlı zemin üzerinde beyaz simge). */
function NavIcon({ grad, active = true, children }: { grad: string; active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-md transition",
        grad,
        active ? "shadow-black/40 ring-1 ring-white/20" : "opacity-80 shadow-black/30 group-hover:opacity-100",
      )}
    >
      {children}
    </span>
  );
}

const FACE_NAV: NavEntry[] = [
  { href: "/", label: "Canlı Panel", icon: Activity, exact: true, grad: "from-cyan-400 to-sky-600" },
  { href: "/terminal", label: "Yüz Terminali", icon: ScanFace, grad: "from-sky-500 to-indigo-500" },
  { href: "/personel", label: "Personel & Biyometri", icon: Users, grad: "from-blue-500 to-violet-500" },
  { href: "/kapilar", label: "Kapılar", icon: DoorOpen, grad: "from-amber-400 to-orange-500" },
  { href: "/yetkiler", label: "Kapı Yetkileri", icon: ShieldCheck, grad: "from-emerald-400 to-teal-600" },
  { href: "/imza", label: "İmza Defteri", icon: ClipboardCheck, grad: "from-violet-500 to-purple-600" },
  { href: "/kapi-imza", label: "Kapı İmza", icon: ClipboardCheck, grad: "from-fuchsia-500 to-pink-600" },
  { href: "/istirahat", label: "İstirahat", icon: Coffee, grad: "from-lime-400 to-emerald-600" },
  { href: "/vardiyalar", label: "Vardiyalar", icon: Clock, grad: "from-indigo-500 to-blue-700" },
  { href: "/izinler", label: "İzin & Devamsızlık", icon: CalendarDays, grad: "from-rose-400 to-rose-600" },
  { href: "/ziyaretciler", label: "Ziyaretçiler", icon: UserCheck, grad: "from-teal-400 to-cyan-600" },
  { href: "/guvenlik", label: "Güvenlik Merkezi", icon: ShieldAlert, grad: "from-red-500 to-rose-700" },
  { href: "/acil-durum", label: "Acil Durum Yoklaması", icon: Siren, grad: "from-orange-500 to-red-600" },
  { href: "/bordro", label: "PDKS Bordro Özeti", icon: Wallet, grad: "from-emerald-500 to-green-700" },
  { href: "/raporlar", label: "Raporlar", icon: BarChart3, grad: "from-yellow-400 to-amber-600" },
  { href: "/ayarlar", label: "Sistem & KVKK", icon: Settings, grad: "from-slate-500 to-slate-700" },
];

const PUANTAJ26_NAV: NavEntry[] = [
  { href: "/puantaj26", label: "Puantaj Cetveli", icon: ClipboardList, exact: true, grad: "from-sky-500 to-blue-600" },
  { href: "/puantaj26/nobet", label: "Nöbet Çizelgesi", icon: CalendarClock, grad: "from-violet-500 to-purple-600" },
  { href: "/puantaj26/bordro", label: "Maaş Bordro (Resmi)", icon: Banknote, grad: "from-emerald-500 to-cyan-600" },
  { href: "/puantaj26/sablon", label: "Vardiya Şablonları", icon: LayoutTemplate, grad: "from-fuchsia-500 to-pink-600" },
  { href: "/puantaj26/personel", label: "Servis & Kadro Yönetimi", icon: Users, grad: "from-cyan-500 to-sky-600" },
  { href: "/puantaj26/izin", label: "Resmi İzin Onayları", icon: CalendarDays, grad: "from-emerald-500 to-teal-600" },
  { href: "/puantaj26/degisim", label: "Nöbet Değişimi (Takas)", icon: Repeat, grad: "from-orange-500 to-amber-600" },
  { href: "/puantaj26/analiz", label: "Adalet Analizi", icon: Scale, grad: "from-yellow-500 to-orange-500" },
  { href: "/puantaj26/uyarilar", label: "Mevzuat Uyarıları", icon: ShieldAlert, grad: "from-rose-500 to-red-600" },
  { href: "/puantaj26/duyuru", label: "Servis Duyuruları", icon: Megaphone, grad: "from-pink-500 to-rose-600" },
  { href: "/puantaj26/yedek", label: "Veri Yedekleme", icon: DatabaseBackup, grad: "from-indigo-500 to-blue-700" },
  { href: "/puantaj26/ayarlar", label: "Kurum & Sistem Ayarları", icon: Settings2, grad: "from-slate-500 to-slate-700" },
  { href: "/personel-sorgu", label: "TC Personel Sorgu", icon: Fingerprint, grad: "from-emerald-500 to-green-600" },
];

const ALL_NAV = [...FACE_NAV, ...PUANTAJ26_NAV];

/**
 * Sol menüdeki iki ana bölümün (Kapı Geçiş Sistemi / Personel26) açık-kapalı hali.
 * Tercih localStorage'da saklanır; ilk açılışta her ikisi de açıktır.
 */
const NAV_COLLAPSE_KEY = "orion-nav-collapsed";
type NavCollapsed = { doors: boolean; p26: boolean };

function useNavCollapse(): [NavCollapsed, (key: keyof NavCollapsed) => void] {
  const [collapsed, setCollapsed] = useState<NavCollapsed>({ doors: false, p26: false });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NAV_COLLAPSE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<NavCollapsed>;
        setCollapsed({
          doors: Boolean(parsed.doors),
          p26: Boolean(parsed.p26),
        });
      }
    } catch {
      /* bozuk kayıt yok sayılır */
    }
  }, []);

  const toggle = (key: keyof NavCollapsed) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(NAV_COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        /* depolama kapalıysa sessizce geç */
      }
      return next;
    });
  };

  return [collapsed, toggle];
}

/** Menü bölüm başlığı — tıklanınca grubu genişletir/daraltır. */
function NavGroupHeader({
  label,
  accent,
  collapsed,
  onToggle,
}: {
  label: string;
  accent: "cyan" | "amber";
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className={cn(
        "group mb-1 mt-4 flex w-full items-center justify-between gap-2 border-t px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] transition first:mt-0 first:border-t-0 first:pt-1",
        accent === "cyan"
          ? "border-cyan-200/12 text-cyan-300/70 hover:text-cyan-200"
          : "border-amber-200/12 text-amber-200/85 hover:text-amber-100",
      )}
    >
      <span className="truncate">{label}</span>
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-transform duration-300",
          collapsed && "-rotate-90",
        )}
      />
    </button>
  );
}

function isRouteActive(pathname: string, item: NavEntry): boolean {
  const clean = pathname.replace(/\/$/, "") || "/";
  const target = item.href.replace(/\/$/, "") || "/";
  if (item.exact) return clean === target;
  return clean === target || clean.startsWith(`${target}/`);
}

/**
 * ORION FaceGate × Puantaj26 — kapı yüz/göz okuma sistemi için yapay zekâ işlevli oynar marka ikonu.
 * Çekirdeğinde aurora paletine dönüştürülmüş nokta bulutu yüz taraması (dönen GIF) döner;
 * çevresinde nefes alan altın tarama çerçevesi, ters yöne dönen HUD halkaları ve yüzün
 * üzerinden süpüren tarama çizgisi bulunur. Animasyonlar globals.css'teki `.orion-*`
 * kurallarıyla sürüdür ve hareket azaltma tercihinde kendiliğinden durur.
 */
export function OrionEyeMark({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("orion-mark relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Yüzün arkasındaki kuzey ışığı halesi */}
      <span className="orion-face-glow absolute inset-[14%] rounded-full" />
      {/* Aurora nokta bulutu yüz taraması — siyah zemin ekranda kaybolur */}
      <img
        src={withBasePath("/brand/orion-face-aurora.gif")}
        alt=""
        className="orion-face absolute inset-[26.5%] rounded-full object-cover mix-blend-screen"
      />
      {/* Hareket azaltma tercihinde GIF yerine görünen durağan ilk kare */}
      <img
        src={withBasePath("/brand/orion-face-aurora.png")}
        alt=""
        className="orion-face-static absolute inset-[26.5%] hidden rounded-full object-cover mix-blend-screen"
      />

      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="orionScan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2ee9d0" stopOpacity="0" />
          <stop offset="50%" stopColor="#2ee9d0" />
          <stop offset="100%" stopColor="#2ee9d0" stopOpacity="0" />
        </linearGradient>
        <clipPath id="orionEyeClip">
          <circle cx="32" cy="32" r="15" />
        </clipPath>
      </defs>

      {/* Altın tarama çerçevesi — köşeleri açık, nefes alır */}
      <g className="orion-corner" fill="none" stroke="#e8c36a" strokeWidth="2.4" strokeLinecap="round">
        <path d="M9 26 V21 A12 12 0 0 1 21 9 H26" />
        <path d="M38 9 H43 A12 12 0 0 1 55 21 V26" />
        <path d="M55 38 V43 A12 12 0 0 1 43 55 H38" />
        <path d="M26 55 H21 A12 12 0 0 1 9 43 V38" />
      </g>

      {/* Dış HUD halkası — saat yönünde döner, tepesinde sinyal noktası */}
      <g className="orion-ring-outer" fill="none">
        <circle cx="32" cy="32" r="21" stroke="#e8c36a" strokeWidth="1.4" strokeDasharray="2 6" opacity=".65" />
        <circle cx="32" cy="32" r="18" stroke="#2ee9d0" strokeWidth="1.7" strokeDasharray="13 6 3 6" strokeLinecap="round" opacity=".9" />
        <circle cx="32" cy="14" r="1.7" fill="#2ee9d0" stroke="none" />
      </g>

      {/* İç HUD halkası — ters yönde döner, sağda altın vurgu yayı */}
      <g className="orion-ring-inner" fill="none">
        <circle cx="32" cy="32" r="13.5" stroke="#38bdf8" strokeWidth="1.3" strokeDasharray="3 5" opacity=".85" />
        <path d="M41.5 22.5 A13.5 13.5 0 0 1 41.5 41.5" stroke="#e8c36a" strokeWidth="2.1" strokeLinecap="round" />
      </g>

      {/* Nişangâh köşelikleri — okuma anında yüzü hizalar */}
      <g className="orion-reticle" stroke="#2ee9d0" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".8">
        <path d="M22 24 v-2.5 h2.5" />
        <path d="M42 24 v-2.5 h-2.5" />
        <path d="M22 40 v2.5 h2.5" />
        <path d="M42 40 v2.5 h-2.5" />
      </g>

      {/* Tarama çizgisi yüzün üzerinden süpürür */}
      <g clipPath="url(#orionEyeClip)">
        <rect className="orion-scan" x="15" y="31.2" width="34" height="1.8" rx="1" fill="url(#orionScan)" />
      </g>
      </svg>
    </span>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isP26 = pathname === "/puantaj26" || pathname.startsWith("/puantaj26/");
  const [collapsed, toggleCollapsed] = useNavCollapse();

  return (
    <div className="screen-root orion-grid min-h-screen">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[274px] shrink-0 flex-col border-r border-white/8 bg-black/35 px-4 py-5 backdrop-blur-xl lg:flex">
          <Link href="/" className="mb-6 flex items-center gap-3 px-2">
            <OrionEyeMark size={48} />
            <div>
              <div className="font-display orion-shimmer text-lg leading-none tracking-[0.18em]">
                ORION
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">
                FaceGate × Puantaj26
              </div>
            </div>
          </Link>

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
            <NavGroupHeader
              label="Kapı Geçiş Sistemi"
              accent="cyan"
              collapsed={collapsed.doors}
              onToggle={() => toggleCollapsed("doors")}
            />
            {collapsed.doors ? null : FACE_NAV.map((item) => {
              const active = isRouteActive(pathname, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition",
                    active
                      ? "bg-cyan-400/12 font-medium text-cyan-200 ring-1 ring-cyan-400/25"
                      : "text-slate-400 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <NavIcon grad={item.grad} active={active}>
                    <Icon className="h-3.5 w-3.5" />
                  </NavIcon>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}

            <NavGroupHeader
              label="Personel26"
              accent="amber"
              collapsed={collapsed.p26}
              onToggle={() => toggleCollapsed("p26")}
            />
            {collapsed.p26 ? null : PUANTAJ26_NAV.map((item) => {
              const active = isRouteActive(pathname, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition",
                    active
                      ? "bg-amber-200/14 font-medium text-amber-200 ring-1 ring-amber-200/30"
                      : "text-slate-400 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <NavIcon grad={item.grad} active={active}>
                    <Icon className="h-3.5 w-3.5" />
                  </NavIcon>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 rounded-2xl border border-white/8 bg-white/3 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Entegre Platform
            </p>
            <p className="mt-1 text-sm font-medium text-white">Anadolu Endüstri & Sağlık</p>
            <p className="text-xs text-slate-500">Tek Veritabanı · Canlı Biyometri + Resmi Puantaj</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/8 bg-[#06080f]/85 px-4 py-3 backdrop-blur-xl md:px-8">
            <div className="flex items-center gap-2 lg:hidden">
              <OrionEyeMark size={22} />
              <div className="font-display orion-shimmer tracking-[0.2em]">ORION × P26</div>
            </div>
            <div className="hidden text-sm text-slate-400 lg:block">
              {isP26
                ? "Puantaj26 resmi nöbet, aylık çalışma cetveli, bordro ve onay modülleri"
                : "Yüz tanımalı giriş-çıkış, biyometrik kadro, imza ve kapı yetki platformu"}
            </div>
            <LiveClock className="text-right" />
          </header>

          <div className="mobile-chip-nav flex gap-2 overflow-x-auto border-b border-white/5 px-3 py-2 lg:hidden">
            {ALL_NAV.map((item) => {
              const active = isRouteActive(pathname, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs",
                    active
                      ? "bg-cyan-400/15 font-medium text-cyan-200"
                      : "bg-white/5 text-slate-400",
                  )}
                >
                  <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded-[5px] bg-gradient-to-br text-white shadow", item.grad)}>
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>

          <main className={isP26 ? "p-0" : "px-4 py-6 md:px-8 md:py-8"}>{children}</main>
        </div>
      </div>
    </div>
  );
}
