"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { OrionEyeMark } from "@/components/shell";

/**
 * Yönetici girişi — panel ve kapı terminali için PIN kapısı.
 *
 * Not (dürüstlük): GitHub Pages sürümünde tüm kod tarayıcıda çalıştığı için bu
 * kapı yetkisiz göz atmayı engelleyen bir hatırlatma katmanıdır; Pages verisi
 * yine kullanıcının kendi tarayıcısında tutulur. Windows (sunuculu) sürümde
 * API tarafının da kilitlenmesi önerilir.
 *
 * Güvenlik: PIN'in kendisi paket içinde DURMAZ; yalnızca SHA-256 özeti saklanır.
 * Oturum imzası da SHA-256 ile üretilir (crypto.subtle'a ihtiyaç duymaz —
 * güvenli bağlam dışında da çalışır).
 */
const AUTH_USER = "CehennemGibiyim";
const SALT = "orion-facegate-p26";
const PIN_HASH = "f6e270bbcfb7ef95d3571978349b1a7b919a6141258270bac38ee05fd024f5c8";
const SESSION_KEY = "p26-admin-session";
const SESSION_DAYS = 30;

/* Standart SHA-256 (TextEncoder ile UTF-8) — bağımlılıksız, senkron. */
const SHA_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
function rotr(x: number, n: number) {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}
export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);
  dv.setUint32(padded.length - 4, bitLen >>> 0, false);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i += 1) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + S1 + ch + SHA_K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  let out = "";
  for (const value of H) out += value.toString(16).padStart(8, "0");
  return out;
}

export function sessionSignature(user: string, exp: number): string {
  return sha256Hex(`${SALT}|session|${user}|${exp}`);
}

function verifyStoredSession(): boolean {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { u?: unknown; exp?: unknown; sig?: unknown };
    if (parsed.u !== AUTH_USER || typeof parsed.exp !== "number" || parsed.exp <= Date.now()) return false;
    return parsed.sig === sessionSignature(AUTH_USER, parsed.exp);
  } catch {
    return false;
  }
}

function openSession() {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const payload = { u: AUTH_USER, exp, sig: sessionSignature(AUTH_USER, exp) };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

/** Paneldeki "Çıkış" düğmeleri için: oturumu siler ve giriş ekranına döner. */
export function logoutP26() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* depolama kapalıysa yine de yenilenir */
  }
  window.location.assign(window.location.pathname);
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const userOk = username.trim() === AUTH_USER;
    const pinOk = sha256Hex(`${SALT}|${pin.trim()}`) === PIN_HASH;
    if (userOk && pinOk) {
      openSession();
      onSuccess();
      return;
    }
    setBusy(false);
    setError("Kullanıcı adı veya PIN hatalı.");
  }

  return (
    <div className="screen-root orion-grid flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="orion-card w-full max-w-[420px] rounded-[28px] p-8 ring-1 ring-white/10"
        aria-label="Yönetici girişi"
      >
        <div className="flex flex-col items-center text-center">
          <OrionEyeMark size={64} />
          <h1 className="font-display mt-4 text-xl tracking-[0.2em] text-white">YÖNETİCİ GİRİŞİ</h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-cyan-300/80">
            ORION FaceGate × Puantaj26
          </p>
        </div>

        <label className="mt-7 block text-[11px] uppercase tracking-[0.2em] text-slate-400" htmlFor="p26-auth-user">
          Kullanıcı adı
        </label>
        <input
          id="p26-auth-user"
          autoFocus
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-1 ring-transparent transition focus:ring-cyan-400/40"
          placeholder="Kullanıcı adı"
        />

        <label className="mt-4 block text-[11px] uppercase tracking-[0.2em] text-slate-400" htmlFor="p26-auth-pin">
          PIN
        </label>
        <input
          id="p26-auth-pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={16}
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-lg tracking-[0.4em] text-cyan-100 outline-none ring-1 ring-transparent transition focus:ring-cyan-400/40"
          placeholder="••••••••"
        />

        {error ? (
          <p role="alert" className="mt-3 text-sm text-rose-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !username.trim() || !pin.trim()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <KeyRound className="h-4 w-4" />
          Giriş Yap
        </button>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] leading-5 text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
          Panale ve kapı terminaline erişim yönetici PIN’i ister.
        </p>
      </form>
    </div>
  );
}

/**
 * Kimliği doğrulanmamış ziyaretçiye giriş ekranı gösterir; oturum geçerliyse
 * children akar. İlk boyamada (hydration) boş döner, sonra durumu değerlendirir.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "locked" | "open">("loading");

  useEffect(() => {
    setState(verifyStoredSession() ? "open" : "locked");
  }, []);

  if (state === "loading") return null;
  if (state === "locked") return <LoginScreen onSuccess={() => setState("open")} />;
  return <>{children}</>;
}
