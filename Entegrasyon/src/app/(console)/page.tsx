"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Coffee,
  DoorOpen,
  ScanFace,
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { Avatar, Badge, PageHeader } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";
import { withBasePath } from "@/lib/asset-path";
import { formatTimeTr } from "@/lib/time";
import type { EmployeePublic, PresenceStatus } from "@/lib/types";

type Presence = EmployeePublic & {
  presenceStatus: PresenceStatus;
  clockIn: string | null;
  clockOut: string | null;
  lateMinutes: number;
  breakMinutes: number;
  workLabel: string;
  openBreakType: string | null;
  openBreakSince: string | null;
};

type Dash = {
  today: string;
  stats: {
    totalEmployees: number;
    present: number;
    onBreak: number;
    left: number;
    absent: number;
    late: number;
    enrolledFaces: number;
    deniedToday: number;
    doors: number;
  };
  presence: Presence[];
  doors: Array<{
    id: number;
    name: string;
    code: string;
    location: string;
    type: string;
    isActive: boolean;
    isLocked: boolean;
    imageUrl: string | null;
  }>;
  recentLogs: Array<{
    id: number;
    eventType: string;
    result: string;
    reason: string | null;
    createdAt: string;
    employeeName: string;
    employeeNo: string | null;
    photoUrl: string | null;
    doorName: string;
  }>;
};

const statusMeta: Record<
  PresenceStatus,
  { label: string; tone: "ok" | "warn" | "bad" | "neutral" | "info"; ring: string }
> = {
  present: { label: "İçeride", tone: "ok", ring: "ring-emerald-400/50" },
  break: { label: "İstirahat", tone: "warn", ring: "ring-amber-300/50" },
  left: { label: "Çıktı", tone: "info", ring: "ring-cyan-300/40" },
  absent: { label: "Gelmedi", tone: "bad", ring: "ring-rose-400/30" },
  inactive: { label: "Pasif", tone: "neutral", ring: "ring-white/10" },
};

export default function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const json = await jsonFetch<Dash>("/api/dashboard");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Panel yüklenemedi");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  if (error && !data) {
    return <p className="text-rose-300">{error}</p>;
  }
  if (!data) {
    return <p className="text-slate-400">Operasyon paneli hazırlanıyor…</p>;
  }

  const stats = [
    { label: "Kadro", value: data.stats.totalEmployees, icon: Users, extra: "aktif personel" },
    { label: "İçeride", value: data.stats.present, icon: UserCheck, extra: "şu an sahada" },
    { label: "İstirahat", value: data.stats.onBreak, icon: Coffee, extra: "açık mola" },
    { label: "Çıktı", value: data.stats.left, icon: DoorOpen, extra: "mesai kapandı" },
    { label: "Gelmedi", value: data.stats.absent, icon: UserX, extra: "bugün yok" },
    { label: "Reddedilen", value: data.stats.deniedToday, icon: ShieldAlert, extra: "yetkisiz deneme" },
  ];

  return (
    <div>
      <PageHeader
        kicker="Canlı operasyon"
        title="Tesis nabzı"
        description="Yüz okuma, giriş-çıkış imzası, istirahat dakikaları ve kapı yetkileri tek ekranda. Veriler her 4 saniyede yenilenir."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/puantaj26"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-200 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-100 transition"
            >
              Resmi Puantaj26 Cetveli
            </Link>
            <Link
              href="/terminal"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 transition"
            >
              <ScanFace className="h-4 w-4" />
              Yüz terminalini aç
            </Link>
          </div>
        }
      />

      <section className="relative mb-8 overflow-hidden rounded-[28px] border border-white/10">
        <img src={withBasePath("/scenes/turnstile.jpg")} alt="" className="h-52 w-full object-cover md:h-64" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06080f] via-[#06080f]/80 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
          <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200">Anadolu Endüstri A.Ş.</p>
          <h2 className="font-display mt-2 max-w-xl text-3xl text-white md:text-4xl">
            Yüz tanımalı kapı ve PDKS
          </h2>
          <p className="mt-2 max-w-lg text-sm text-slate-300">
            {data.stats.enrolledFaces} yüz şablonu kayıtlı · {data.stats.doors} kapı noktası ·
            bugün {data.stats.late} geç giriş
          </p>
        </div>
      </section>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="orion-card rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] uppercase tracking-[0.16em]">{item.label}</span>
                <Icon className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-3 font-mono text-3xl text-white">{item.value}</div>
              <p className="mt-1 text-xs text-slate-500">{item.extra}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="orion-card rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Kim içeride?</h3>
            <Badge tone="info">{data.today}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.presence.map((person) => {
              const meta = statusMeta[person.presenceStatus];
              return (
                <Link
                  key={person.id}
                  href={`/personel/detay?id=${person.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-white/3 p-3 ring-1 ring-white/5 transition hover:bg-white/6"
                >
                  <div className={`rounded-2xl ring-2 ${meta.ring}`}>
                    <Avatar
                      src={person.photoUrl}
                      name={`${person.firstName} ${person.lastName}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-white">
                      {person.firstName} {person.lastName}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {person.employeeNo} · {person.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <span>Giriş {formatTimeTr(person.clockIn)}</span>
                      {person.clockOut ? <span>Çıkış {formatTimeTr(person.clockOut)}</span> : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="space-y-6">
          <section className="orion-card rounded-3xl p-5">
            <h3 className="mb-4 text-lg font-semibold text-white">Anlık geçişler</h3>
            <div className="space-y-3">
              {data.recentLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <Avatar src={log.photoUrl} name={log.employeeName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-white">{log.employeeName}</p>
                      <Badge tone={log.result === "granted" ? "ok" : "bad"}>
                        {log.result === "granted" ? "Onay" : "Red"}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {log.doorName} · {formatTimeTr(log.createdAt)}
                    </p>
                    <p className="truncate text-xs text-slate-400">{log.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="orion-card rounded-3xl p-5">
            <h3 className="mb-4 text-lg font-semibold text-white">Kapı noktaları</h3>
            <div className="space-y-2">
              {data.doors.map((door) => (
                <div key={door.id} className="flex items-center justify-between rounded-xl bg-white/3 px-3 py-2">
                  <div>
                    <p className="text-sm text-white">{door.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {door.code} · {door.location}
                    </p>
                  </div>
                  <Badge tone={door.isActive ? "ok" : "bad"}>
                    {door.isActive ? (door.isLocked ? "Kilitli / hazır" : "Açık") : "Devre dışı"}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
