"use client";

import { useEffect } from "react";

/**
 * Service worker kaydı (PWA).
 *
 * - Yalnızca üretim derlemesinde çalışır → `next dev` ve HMR davranışı değişmez.
 * - Alt dizin yayınında (`NEXT_PUBLIC_P26_BASE_PATH`) doğru kapsamla kaydolur.
 * - Hata olursa sessizce yutulur: PWA desteklenmeyen tarayıcıda panel aynı çalışır.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") return;

    const base = (process.env.NEXT_PUBLIC_P26_BASE_PATH ?? "").replace(/\/$/, "");
    let timer: number | undefined;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(`${base}/sw.js`, {
          scope: `${base}/`,
        });
        // Yeni sürüm yayınlandığında bir sonraki açılışta devreye girer.
        timer = window.setInterval(() => void registration.update().catch(() => {}), 60 * 60 * 1000);
      } catch {
        // PWA opsiyoneldir; kayıt başarısız olsa da panel çalışır.
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      window.removeEventListener("load", register);
      if (timer) window.clearInterval(timer);
    };
  }, []);

  return null;
}
