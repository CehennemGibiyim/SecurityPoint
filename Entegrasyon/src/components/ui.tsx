"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { withBasePath } from "@/lib/asset-path";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
          {kicker}
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "ok" | "warn" | "bad" | "info" | "neutral" | "gold";
  children: ReactNode;
}) {
  const map = {
    ok: "bg-emerald-500/12 text-emerald-300 ring-emerald-400/25",
    warn: "bg-amber-500/12 text-amber-300 ring-amber-400/25",
    bad: "bg-rose-500/12 text-rose-300 ring-rose-400/25",
    info: "bg-cyan-500/12 text-cyan-300 ring-cyan-400/25",
    gold: "bg-amber-200/10 text-amber-200 ring-amber-200/20",
    neutral: "bg-white/5 text-slate-300 ring-white/10",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1",
        map[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  tone = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "ghost" | "danger" | "gold" | "ok";
}) {
  const tones = {
    primary: "bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:bg-cyan-400/40",
    gold: "bg-amber-200 text-slate-950 hover:bg-amber-100",
    ok: "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
    danger: "bg-rose-500/90 text-white hover:bg-rose-400",
    ghost: "bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10",
  } as const;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20";

export function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [failed, setFailed] = useState(false);
  const dim = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-11 w-11 text-xs",
    lg: "h-16 w-16 text-base",
    xl: "h-24 w-24 text-xl",
  }[size];
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
  const resolved = src ? withBasePath(src) : null;
  return resolved && !failed ? (
    <img
      src={resolved}
      alt={name}
      onError={() => setFailed(true)}
      className={cn(dim, "rounded-2xl object-cover ring-1 ring-white/10")}
    />
  ) : (
    <div
      className={cn(
        dim,
        "grid place-items-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-amber-200/20 font-semibold text-white ring-1 ring-white/10",
      )}
    >
      {initials}
    </div>
  );
}
