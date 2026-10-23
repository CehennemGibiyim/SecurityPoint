"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Coffee,
  Delete,
  DoorOpen,
  LogIn,
  LogOut,
  ScanFace,
  Unlock,
} from "lucide-react";
import { FaceScanner } from "@/components/face-scanner";
import { Avatar, Badge, Button, cn } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";
import { beep } from "@/lib/face-client";
import { formatTimeTr } from "@/lib/time";
import type { AccessAction, AccessResponse, BreakType, DoorPublic } from "@/lib/types";

const MODES: Array<{ id: AccessAction; label: string; hint: string; icon: typeof ScanFace }> = [
  { id: "auto", label: "Otomatik", hint: "Giriş kapısında imza, çıkışta mesai kapatır", icon: ScanFace },
  { id: "clock_in", label: "Giriş", hint: "Günün ilk imzası", icon: LogIn },
  { id: "clock_out", label: "Çıkış", hint: "Mesai bitiş imzası", icon: LogOut },
  { id: "break_start", label: "İstirahat", hint: "Mola başlat", icon: Coffee },
  { id: "break_end", label: "Mola bitir", hint: "Sahaya dönüş", icon: Unlock },
  { id: "door_only", label: "Sadece kapı", hint: "İmza atmadan geçiş", icon: DoorOpen },
];

const BREAKS: BreakType[] = ["yemek", "cay", "namaz", "sigara", "diger"];
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"];

export default function TerminalPage() {
  const [doors, setDoors] = useState<DoorPublic[]>([]);
  const [doorId, setDoorId] = useState<number | null>(null);
  const [action, setAction] = useState<AccessAction>("auto");
  const [breakType, setBreakType] = useState<BreakType>("cay");
  const [sicil, setSicil] = useState("");
  const [result, setResult] = useState<AccessResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void jsonFetch<{ items: DoorPublic[] }>("/api/doors").then((data) => {
      setDoors(data.items);
      setDoorId(data.items[0]?.id ?? null);
    });
  }, []);

  const door = useMemo(() => doors.find((item) => item.id === doorId) ?? null, [doors, doorId]);

  const handleResult = useCallback((value: AccessResponse) => {
    setResult(value);
  }, []);

  async function submitSicil() {
    if (!doorId || !sicil.trim()) return;
    setBusy(true);
    try {
      const response = await jsonFetch<AccessResponse>("/api/recognize", {
        method: "POST",
        body: JSON.stringify({
          doorId,
          action,
          breakType,
          employeeNo: sicil.trim(),
        }),
      });
      beep(response.ok);
      setResult(response);
      if (response.ok) setSicil("");
    } catch (error) {
      setResult({
        ok: false,
        result: "denied",
        eventType: action,
        reason: error instanceof Error ? error.message : "Hata",
        message: error instanceof Error ? error.message : "Hata",
        doorUnlocked: false,
        confidence: null,
        matchDistance: null,
        employee: null,
        door: null,
        attendance: null,
        at: new Date().toISOString(),
      });
    } finally {
      setBusy(false);
    }
  }

  function press(key: string) {
    if (key === "C") setSicil("");
    else if (key === "OK") void submitSicil();
    else setSicil((prev) => (prev + key).slice(0, 12));
  }

  return (
    <div className="orion-grid min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 md:px-8">
        <header className="mb-4 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Panele dön
          </Link>
          <div className="text-center">
            <div className="font-display tracking-[0.28em] text-amber-200">ORION FACEGATE</div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300/80">
              Canlı yüz okuma terminali
            </p>
          </div>
          <Badge tone="gold">{door?.name ?? "Kapı seçin"}</Badge>
        </header>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {doors.map((item) => (
            <button
              key={item.id}
              onClick={() => setDoorId(item.id)}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-xs ring-1 transition",
                doorId === item.id
                  ? "bg-cyan-400 text-slate-950 ring-cyan-300"
                  : "bg-white/5 text-slate-300 ring-white/10",
              )}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="grid flex-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            {doorId ? (
              <FaceScanner
                doorId={doorId}
                action={action}
                breakType={breakType}
                enabled={!result || result.result === "cooldown"}
                onResult={handleResult}
              />
            ) : (
              <div className="orion-card grid aspect-[4/3] place-items-center rounded-[28px]">
                Kapı yükleniyor…
              </div>
            )}
            {result ? (
              <div
                className={cn(
                  "mt-4 rounded-3xl p-5 ring-1",
                  result.ok
                    ? "unlock-flash bg-emerald-400/10 ring-emerald-300/30"
                    : "bg-rose-500/10 ring-rose-400/30",
                )}
              >
                <div className="flex items-center gap-4">
                  {result.employee ? (
                    <Avatar
                      src={result.employee.photoUrl}
                      name={`${result.employee.firstName} ${result.employee.lastName}`}
                      size="lg"
                    />
                  ) : null}
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      {result.ok ? "Kapı açıldı" : result.result === "cooldown" ? "Bekleyin" : "Erişim reddedildi"}
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">{result.message}</h2>
                    {result.attendance ? (
                      <p className="mt-1 text-sm text-slate-400">
                        Giriş {formatTimeTr(result.attendance.clockIn)} · Çıkış{" "}
                        {formatTimeTr(result.attendance.clockOut)} · İstirahat{" "}
                        {result.attendance.breakMinutes} dk
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button tone="ghost" className="mt-4" onClick={() => setResult(null)}>
                  Yeni tarama
                </Button>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <section className="orion-card rounded-3xl p-4">
              <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-slate-400">İşlem modu</p>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setAction(mode.id)}
                      className={cn(
                        "rounded-2xl p-3 text-left ring-1 transition",
                        action === mode.id
                          ? "bg-cyan-400/12 ring-cyan-300/40"
                          : "bg-white/3 ring-white/8 hover:bg-white/6",
                      )}
                    >
                      <Icon className="mb-2 h-4 w-4 text-cyan-300" />
                      <div className="text-sm font-medium text-white">{mode.label}</div>
                      <div className="text-[11px] text-slate-500">{mode.hint}</div>
                    </button>
                  );
                })}
              </div>
              {action === "break_start" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {BREAKS.map((item) => (
                    <button
                      key={item}
                      onClick={() => setBreakType(item)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs capitalize",
                        breakType === item ? "bg-amber-200 text-slate-950" : "bg-white/5 text-slate-300",
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="orion-card rounded-3xl p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Sicil ile imza (kamera yoksa)
              </p>
              <div className="mt-3 rounded-2xl bg-black/40 px-4 py-3 font-mono text-2xl tracking-[0.3em] text-cyan-100">
                {sicil || "ORN-"}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {KEYS.map((key) => (
                  <button
                    key={key}
                    disabled={busy}
                    onClick={() => press(key)}
                    className={cn(
                      "rounded-2xl py-3 text-lg font-semibold ring-1 ring-white/10",
                      key === "OK"
                        ? "bg-cyan-400 text-slate-950"
                        : "bg-white/5 text-white hover:bg-white/10",
                    )}
                  >
                    {key === "C" ? <Delete className="mx-auto h-5 w-5" /> : key}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                Örnek sicil: 1001 … 1012. Yüz kaydı için personel kartından 3 kare alın.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
