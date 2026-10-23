"use client";
import { useSyncExternalStore } from "react";
import { systemThemeId } from "@/lib/themes";

/**
 * Arayüzde (render sırasında) sistem temasını okumanın güvenli yolu. Sunucuda ve ilk istemci çizimi
 * her zaman "original" döner; tarayıcı açılış (hydration) bittikten sonra gerçek tercihe geçer.
 * Böylece sunucu ve tarayıcı çıktısı uyuşmazlığı (hydration hatası) oluşmaz.
 * (Ayrı dosyada: themes.ts sunucu kodunca da kullanıldığı için React kancası içeremez.)
 */
export function useSystemThemeId(): string {
  return useSyncExternalStore(
    notify => {
      try {
        const mq = window.matchMedia("(prefers-color-scheme: light)");
        mq.addEventListener("change", notify);
        return () => mq.removeEventListener("change", notify);
      } catch { return () => {}; }
    },
    () => systemThemeId(),
    () => "original",
  );
}
