"use client";
/**
 * GitHub Pages (statik) sürümünde paneli saran kapı.
 *
 * Tarayıcıdaki PostgreSQL hazır olana kadar bir "hazırlanıyor" ekranı gösterir;
 * hazır olduğunda paneli (AppShell) yükler. Böylece ilk API çağrısı, veritabanı
 * köprüsü kurulmadan asla yapılmaz.
 *
 * Durum, React dışındaki bir kaynaktan (window.__P26_READY + durum olayları)
 * `useSyncExternalStore` ile okunur. Sunuculu sürümde bu bileşen kullanılmaz.
 */
import { useSyncExternalStore, useState, type ReactNode } from "react";

type Phase = "waiting" | "ready" | "error";

type GateState = {
  phase: Phase;
  message: string;
  error: string;
  stats: Record<string, number | string> | null;
};

type BridgeWindow = Window & {
  __P26_READY?: Promise<void>;
  __p26LastStatus?: string;
  __p26?: {
    info?: () => Promise<Record<string, number | string>>;
    reset?: () => Promise<void>;
  };
};

const DEFAULT_MESSAGE = "Tarayıcı veritabanı hazırlanıyor…";
const WAIT_TIMEOUT_MS = 60_000;

const initialState: GateState = { phase: "waiting", message: DEFAULT_MESSAGE, error: "", stats: null };

let state: GateState = initialState;
const listeners = new Set<() => void>();
let watching = false;

function emit() {
  for (const listener of [...listeners]) listener();
}

function patch(next: Partial<GateState>) {
  state = { ...state, ...next };
  emit();
}

/** Veritabanı betiğini izlemeye başlar (yalnızca bir kez). */
function startWatching() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  const w = window as BridgeWindow;

  document.addEventListener("p26-status", (event) => {
    const detail = (event as CustomEvent<string>).detail;
    if (detail) patch({ message: detail });
  });
  if (w.__p26LastStatus) state = { ...state, message: w.__p26LastStatus };

  const startedAt = Date.now();
  const watch = () => {
    const ready = w.__P26_READY;
    if (ready) {
      ready.then(
        () => {
          patch({ phase: "ready" });
          const info = w.__p26?.info?.();
          if (info) info.then(stats => patch({ stats })).catch(() => {});
        },
        (err: unknown) => {
          patch({
            phase: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        },
      );
      return;
    }
    if (Date.now() - startedAt > WAIT_TIMEOUT_MS) {
      patch({
        phase: "error",
        error:
          "Veritabanı dosyaları yüklenemedi (pglite/app.js). Sayfayı yenilemeyi veya ağ bağlantısını kontrol etmeyi deneyin.",
      });
      return;
    }
    window.setTimeout(watch, 120);
  };
  watch();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  startWatching();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => initialState;

export default function BrowserDbGate({ children }: { children: ReactNode }) {
  const { phase, message, error, stats } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (phase === "ready") {
    return (
      <>
        {children}
        <DemoBadge stats={stats} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[.04] p-6 shadow-2xl shadow-black/50">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300 text-lg font-bold">
            26
          </span>
          <div>
            <h1 className="text-sm font-semibold">Personel26 — Puantaj ve Nöbet Yönetimi</h1>
            <p className="text-[11px] text-white/50">GitHub Pages sürümü · veritabanı tarayıcıda çalışır</p>
          </div>
        </div>

        {phase === "waiting" ? (
          <div className="mt-6 space-y-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-sky-400/80" />
            </div>
            <p className="text-xs text-white/70">{message}</p>
            <p className="text-[11px] leading-relaxed text-white/40">
              İlk açılışta tarayıcıya PostgreSQL (WASM) motoru indirilir — bağlantı hızına göre
              10–30 saniye sürebilir. Sonraki açılışlarda önbellekten gelir ve verileriniz
              tarayıcınızda (IndexedDB) saklanır.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold text-rose-300">Veritabanı başlatılamadı</p>
            <p className="text-[11px] leading-relaxed text-white/60">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-sky-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-400"
            >
              Tekrar dene
            </button>
            <p className="text-[11px] text-white/40">
              Sunuculu (canlı veritabanlı) sürüm için depodaki WEB-YAYINLAMA.md → Vercel adımlarına bakın.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Sağ altta küçük demo rozeti: kayıt sayısı + verileri sıfırlama. */
function DemoBadge({ stats }: { stats: Record<string, number | string> | null }) {
  const [busy, setBusy] = useState(false);
  const total =
    stats && typeof stats.personnel === "number"
      ? `${stats.personnel} personel · ${stats.schedules ?? 0} nöbet kaydı`
      : null;

  async function reset() {
    const w = window as BridgeWindow;
    if (!w.__p26?.reset) return;
    if (!window.confirm("Tarayıcıdaki tüm veriler silinip örnek veriler yeniden kurulacak. Devam?")) return;
    setBusy(true);
    await w.__p26.reset();
  }

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-40 print:hidden">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1424]/95 px-3 py-1.5 text-[11px] text-white/60 shadow-lg shadow-black/40 backdrop-blur">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span title="Veriler bu tarayıcıda (IndexedDB) saklanır">
          Tarayıcı veritabanı{total ? ` · ${total}` : ""}
        </span>
        <button
          onClick={reset}
          disabled={busy}
          className="rounded-full border border-white/10 px-2 py-0.5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          {busy ? "Sıfırlanıyor…" : "Sıfırla"}
        </button>
      </div>
    </div>
  );
}
