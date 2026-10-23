"use client";
import { useSyncExternalStore, useState, type ReactNode } from "react";
import { OrionEyeMark } from "@/components/shell";

type Phase = "waiting" | "ready" | "error";

type GateState = {
  phase: Phase;
  message: string;
  error: string;
  slow: boolean;
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
/** Söz verildiğinden beri hiçbir sonuç gelmezse kullanıcıya uyarı göster. */
const SLOW_HINT_MS = 45_000;

const initialState: GateState = {
  phase: "waiting",
  message: DEFAULT_MESSAGE,
  error: "",
  slow: false,
  stats: null,
};

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
  let slowTimer: number | undefined;
  const watch = () => {
    const ready = w.__P26_READY;
    if (ready) {
      // Söz var ama uzun süre çözülmüyorsa (ağ yavaş/ilk indirme ~19 MB),
      // kullanıcıya bilgi + yenileme seçeneği sun; söz çözülürse kapı yine açılır.
      if (slowTimer === undefined) {
        slowTimer = window.setTimeout(() => {
          if (state.phase === "waiting") patch({ slow: true });
        }, SLOW_HINT_MS);
      }
      ready.then(
        () => {
          patch({ phase: "ready" });
          const info = w.__p26?.info?.();
          if (info) info.then((stats) => patch({ stats })).catch(() => {});
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
  const { phase, message, error, slow, stats } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (phase === "ready") {
    return (
      <>
        {children}
        <DemoBadge stats={stats} />
      </>
    );
  }

  return (
    <div className="orion-grid min-h-screen text-white flex items-center justify-center p-6">
      <div className="orion-card w-full max-w-md rounded-3xl p-6">
        <div className="flex items-center gap-3.5">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black/40 ring-1 ring-amber-200/30">
            <OrionEyeMark size={40} />
          </span>
          <div>
            <h1 className="font-display text-base font-semibold tracking-[0.12em] text-amber-200">
              ORION FaceGate × Puantaj26
            </h1>
            <p className="text-[11px] text-cyan-300/80">
              GitHub Web Sürümü · Tarayıcı içi PostgreSQL motoru
            </p>
          </div>
        </div>

        {phase === "waiting" ? (
          <div className="mt-6 space-y-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-400/90" />
            </div>
            <p className="text-xs text-slate-200">{message}</p>
            <p className="text-[11px] leading-relaxed text-slate-400">
              İlk açılışta tarayıcıya gerçek PostgreSQL (WASM) motoru ve biyometrik PDKS + resmi
              Puantaj26 şeması yüklenir. Tüm kayıtlarınız tarayıcınızda (IndexedDB) kalıcı saklanır.
            </p>
            {slow ? (
              <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-3 space-y-2">
                <p className="text-[11px] leading-relaxed text-amber-200">
                  İlk açılış uzun sürüyor: ~19 MB motor dosyası indiriliyor (ağınız yavaş olabilir)
                  ya da tarayıcı veritabanı kilitlenmiş olabilir. İndirme sürüyorsa biraz bekleyin;
                  hiç ilerlemiyorsa sayfayı yenileyin.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-lg bg-amber-300 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-amber-200"
                >
                  Yenile
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold text-rose-300">Veritabanı başlatılamadı</p>
            <p className="text-[11px] leading-relaxed text-white/60">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-cyan-400 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Tekrar dene
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DemoBadge({ stats }: { stats: Record<string, number | string> | null }) {
  const [busy, setBusy] = useState(false);
  const total =
    stats && typeof stats.personnel === "number"
      ? `${stats.personnel} personel · ${stats.schedules ?? 0} nöbet kaydı`
      : null;

  async function reset() {
    const w = window as BridgeWindow;
    if (!w.__p26?.reset) return;
    if (!window.confirm("Tarayıcıdaki tüm veriler silinip örnek veriler yeniden kurulacak. Devam?"))
      return;
    setBusy(true);
    await w.__p26.reset();
  }

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-40 print:hidden">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1424]/95 px-3 py-1.5 text-[11px] text-white/60 shadow-lg shadow-black/40 backdrop-blur">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span title="Veriler bu tarayıcıda (IndexedDB) saklanır">
          Tarayıcı DB{total ? ` · ${total}` : ""}
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
