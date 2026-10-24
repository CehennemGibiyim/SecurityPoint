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
import { logoutP26 } from "@/components/auth-gate";
import { Avatar, Badge, Button, cn } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";
import { beep } from "@/lib/face-client";
import { formatTimeTr } from "@/lib/time";
import {
  cacheDoorsSnapshot,
  cachePermissionsSnapshot,
  flushQueue,
  offlineEvaluate,
  pendingCount,
  queueEvent,
  readDoorsSnapshot,
  readPermissionsSnapshot,
  type CachedPermission,
} from "@/lib/terminal-online";
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
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);
  // Kiosk modu: /terminal?kiosk=1 → ilk dokunuşta tam ekran (tarayıcılar
  // kullanıcı etkileşimi olmadan tam ekranı açmaya izin vermez).
  const [kiosk, setKiosk] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("kiosk")) setKiosk(true);
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const enterFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => { /* izin yoksa düz devam */ });
    }
  }, []);

  // Ağ kesintisi tamponu: kapı + yetki anlık görüntüsü al, kuyruğu boşalt;
  // bağlantı koptuysa son bilinen listeyle devam et.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await jsonFetch<{ items: DoorPublic[] }>("/api/doors");
        if (!alive) return;
        setDoors(data.items);
        setDoorId((prev) => prev ?? data.items[0]?.id ?? null);
        cacheDoorsSnapshot(data.items);
        setOffline(false);
        try {
          const perms = await jsonFetch<{ items: CachedPermission[] }>("/api/permissions");
          if (alive && Array.isArray(perms.items) && perms.items.length) {
            cachePermissionsSnapshot(perms.items);
          }
        } catch { /* yetki anlık görüntüsü opsiyonel */ }
        const synced = await flushQueue();
        if (alive && synced > 0) setQueued(pendingCount());
      } catch {
        const snap = readDoorsSnapshot();
        if (alive && snap?.doors?.length) {
          setDoors(snap.doors as DoorPublic[]);
          setDoorId((prev) => prev ?? (snap.doors[0] as DoorPublic)?.id ?? null);
        }
        if (alive) setOffline(true);
      }
      if (alive) setQueued(pendingCount());
    })();
    const onOnline = () => {
      setOffline(false);
      void flushQueue().then(() => setQueued(pendingCount()));
    };
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      alive = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
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
    } catch {
      // ÇEVİMDIŞI: son bilinen yetki listesiyle değerlendir, olayı kuyruğa al.
      // Bağlantı geri gelince flushQueue() olayı /api/offline-queue'a yazar.
      const snap = readPermissionsSnapshot();
      const verdict = snap ? offlineEvaluate(snap.perms, sicil.trim(), doorId) : null;
      const count = queueEvent(doorId, { action, breakType, employeeNo: sicil.trim() });
      setQueued(count);
      setOffline(true);
      beep(verdict?.ok ?? false);
      setResult({
        ok: verdict?.ok ?? false,
        result: verdict?.ok ? "granted" : "denied",
        eventType: action,
        reason: verdict?.reason ?? "Çevrimdışı: yetki listesi önbellekte yok — olay kuyruğa alındı.",
        message: verdict
          ? verdict.ok
            ? `${verdict.employeeName ?? "Hoş geldiniz"} — kapı açıldı (ÇEVRİMDIŞI · son yetki listesi). Olay kuyruğa alındı; bağlantı gelince sunucu kaydına düşecek.`
            : verdict.reason
          : "Sunucuya ulaşılamıyor — olay kuyruğa alındı; bağlantı gelince sunucu kaydına düşecek.",
        doorUnlocked: verdict?.ok ?? false,
        confidence: verdict?.ok ? 100 : null,
        matchDistance: null,
        employee: null,
        door: null,
        attendance: null,
        at: new Date().toISOString(),
      });
      if (verdict?.ok) setSicil("");
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
    <div className="orion-grid min-h-screen" onClickCapture={kiosk ? enterFullscreen : undefined}>
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
          <div className="flex flex-col items-end gap-1">
            <Badge tone="gold">{door?.name ?? "Kapı seçin"}</Badge>
            {offline ? (
              <Badge tone="bad">ÇEVRİMDIŞI{queued ? ` · kuyruk ${queued}` : ""}</Badge>
            ) : queued > 0 ? (
              <Badge tone="warn">Kuyrukta {queued} olay</Badge>
            ) : null}
            <button
              type="button"
              onClick={logoutP26}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-400 transition hover:border-rose-400/40 hover:text-rose-300"
              title="Yönetici oturumunu kapat"
            >
              <LogOut className="h-3 w-3" /> Çıkış
            </button>
          </div>
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

      {kiosk && !fullscreen ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-cyan-400/30 bg-[#06080f]/95 px-5 py-2.5 text-xs text-cyan-200 shadow-lg shadow-black/50">
          Kiosk modu — tam ekran için ekrana dokunun / tıklayın (ESC ile çıkılır)
        </div>
      ) : null}
    </div>
  );
}
