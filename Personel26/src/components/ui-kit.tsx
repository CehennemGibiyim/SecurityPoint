"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { MONTHS } from "@/lib/shared";
import { useAvatarSrc } from "@/components/avatar-src";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ─── Modal ───
export function Modal({ title, icon, onClose, children, wide }: {
  title: ReactNode; icon?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-[fadeIn_.15s_ease]" onClick={onClose}>
      <div
        className={cx(
          "panel max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/50 animate-[popIn_.18s_ease]",
          wide ? "w-full max-w-3xl" : "w-full max-w-md"
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 bg-[#101827]/95 backdrop-blur z-10 rounded-t-2xl">
          <h2 className="text-white font-semibold text-xs flex items-center gap-2">{icon}{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Butonlar ───
export function Btn({ children, onClick, variant = "ghost", disabled, title, small }: {
  children: ReactNode; onClick?: () => void; variant?: "ghost" | "primary" | "danger" | "success" | "amber";
  disabled?: boolean; title?: string; small?: boolean;
}) {
  const styles = {
    ghost: "bg-white/5 hover:bg-white/12 border-white/10 text-white/80 hover:text-white",
    primary: "bg-sky-500/90 hover:bg-sky-400 border-sky-300/30 text-white shadow-lg shadow-sky-950/40",
    danger: "bg-rose-500/85 hover:bg-rose-400 border-rose-300/30 text-white",
    success: "bg-emerald-500/85 hover:bg-emerald-400 border-emerald-300/30 text-white",
    amber: "bg-amber-500/85 hover:bg-amber-400 border-amber-300/30 text-amber-950",
  }[variant];
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-lg border font-medium transition active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none",
        small ? "px-2.5 py-1.5 text-xs" : "px-3 py-1.5 text-xs",
        styles
      )}
    >
      {children}
    </button>
  );
}

// ─── Form elemanları ───
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-white/50 text-[11px] font-medium uppercase tracking-wider block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-white/30 text-[10px] mt-1">{hint}</p>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20 transition placeholder:text-white/25",
        props.className
      )}
    />
  );
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70 transition [&>option]:bg-slate-900",
        props.className
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20 transition placeholder:text-white/25 min-h-[90px]",
        props.className
      )}
    />
  );
}

// ─── Profil fotoğrafı (yoksa baş harfler) ───
export function Avatar({ person, size = 36, className, ring }: {
  person: { id: string; name: string; hasAvatar?: boolean; avatarUpdatedAt?: string | null };
  size?: number; className?: string; ring?: boolean;
}) {
  // Fotoğraf adresi: sunuculu sürümde API, statik (GitHub Pages) sürümde
  // tarayıcı veritabanından üretilen blob adresi.
  const src = useAvatarSrc(person);
  const initials = person.name.split(/\s+/).filter(Boolean).map(x => x[0]).join("").slice(0, 2).toLocaleUpperCase("tr");
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center overflow-hidden shrink-0 rounded-xl border border-white/10",
        !src && "bg-gradient-to-br from-sky-500/25 to-violet-500/25 text-white font-bold",
        ring && "ring-2 ring-sky-400/40",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.32)) }}
      title={person.name}
    >
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt={person.name} width={size} height={size} className="w-full h-full object-cover" loading="lazy" />
        : initials}
    </span>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

export function Spinner({ label = "Yükleniyor…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-white/40 text-xs">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({ icon, title, desc }: { icon?: ReactNode; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
      <div className="text-white/20">{icon}</div>
      <div className="text-white/60 font-medium text-xs">{title}</div>
      {desc && <div className="text-white/30 text-xs max-w-xs">{desc}</div>}
    </div>
  );
}

// ─── Ay navigasyonu ───
// HİDRASYON GÜVENLİĞİ: render sırasında new Date() KULLANILMAZ.
// Sunucu ve istemci saatleri farklı olabilir; tarih yalnızca
// olay işleyicileri içinde okunur.
export function MonthNav({ year, month, onChange }: {
  year: number; month: number; onChange: (y: number, m: number) => void;
}) {
  function go(delta: number) {
    const d = new Date(year, month + delta, 1);
    onChange(d.getFullYear(), d.getMonth());
  }
  return (
    <div className="flex items-center gap-1 bg-white/[.06] border border-white/10 rounded-xl p-1">
      <button type="button" onClick={() => go(-1)} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer" title="Önceki ay">
        <ChevronLeft className="w-4 h-4 pointer-events-none" />
      </button>
      <span className="px-3 py-1 rounded-lg text-xs font-bold text-white min-w-[104px] text-center select-none">
        {MONTHS[month]} {year}
      </span>
      <button type="button" onClick={() => go(1)} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer" title="Sonraki ay">
        <ChevronRight className="w-4 h-4 pointer-events-none" />
      </button>
    </div>
  );
}

// ─── Onay diyaloğu (confirm yerine) ───
export function useConfirm() {
  const ref = useRef<{ resolve: (v: boolean) => void } | null>(null);
  return { ref };
}
