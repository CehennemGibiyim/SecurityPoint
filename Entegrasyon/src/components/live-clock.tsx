"use client";

import { useEffect, useState } from "react";

export function LiveClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return <span className={className}>—</span>;

  const time = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const date = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(now);

  return (
    <div className={className}>
      <div className="font-mono text-lg font-semibold tracking-wide text-white">{time}</div>
      <div className="text-[11px] capitalize text-slate-400">{date} · İstanbul</div>
    </div>
  );
}
