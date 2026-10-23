"use client";
import { useEffect } from "react";
import { applyThemeFromSettings } from "@/lib/themes";
import { type AppSettings, publishSettings } from "@/lib/settings";
export default function ThemeLoader() {
  useEffect(() => {
    let current: AppSettings | null = null;
    function apply(settings: AppSettings) { current = settings; applyThemeFromSettings(settings); }
    try { const local = localStorage.getItem("p26-settings"); if (local) apply(JSON.parse(local)); } catch { /* Yerel tercih bozulmuşsa sunucu tercihi kullanılır. */ }
    const listener = (event: Event) => apply((event as CustomEvent<AppSettings>).detail);
    window.addEventListener("p26-settings", listener);
    // İlk açılışta (kayıtlı tercih yokken) sistem temasına göre başlar; sistem tercihi değişirse otomatik izler.
    let mq: MediaQueryList | null = null;
    const onSystemChange = () => { if (current?.themeAuto) applyThemeFromSettings(current); };
    try { mq = window.matchMedia("(prefers-color-scheme: light)"); mq.addEventListener("change", onSystemChange); } catch { /* eski tarayıcı */ }
    fetch("/api/settings").then(async response => { if (!response.ok) return; const data = await response.json(); apply(data.settings); publishSettings(data.settings); }).catch(() => {});
    return () => { window.removeEventListener("p26-settings", listener); mq?.removeEventListener("change", onSystemChange); };
  }, []);
  return null;
}
