import { THEMES, normalizeCustomThemes, type Theme } from "@/lib/themes";
import { parseStaffGroup, isCustomGroup } from "@/lib/shared";
export type AppSettings = {
  institution: string; shortName: string; email: string; phone: string; address: string; logo: string | null;
  theme: string; /** Açıkken tema, işletim sisteminin açık/koyu tercihini izler (yeni kurulumlarda varsayılan). */ themeAuto: boolean; /** Kullanıcının oluşturduğu temalar (en çok 10). */ customThemes: Theme[]; compact: boolean; reducedMotion: boolean; maskTc: boolean;
  autoBackup: boolean; backupRetention: number;
  notifyImports: boolean; notifySystem: boolean; notifyBackups: boolean;
  /** Elle eklenen nöbet grupları ("OZEL:<ad>"); personeli olmayanlar da yedeğe girsin diye veritabanında saklanır. */
  customGroups: string[];
};
export const DEFAULT_SETTINGS: AppSettings = {
  institution: "Personel26 Sağlık Kurumu", shortName: "Personel26", email: "", phone: "", address: "", logo: null,
  theme: "original", themeAuto: true, customThemes: [], compact: false, reducedMotion: false, maskTc: true,
  autoBackup: true, backupRetention: 30,
  notifyImports: true, notifySystem: true, notifyBackups: true,
  customGroups: [],
};
export function validateSettings(input: unknown): AppSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Geçersiz ayar verisi.");
  const value = input as Record<string, unknown>;
  const result = { ...DEFAULT_SETTINGS };
  for (const key of ["institution", "shortName", "email", "phone", "address"] as const) {
    if (typeof value[key] !== "string" || value[key].length > (key === "address" ? 1000 : 180)) throw new Error("Kurum bilgilerini kontrol edin.");
    result[key] = value[key].trim();
  }
  if (!result.institution || !result.shortName) throw new Error("Kurum adı ve kısa ad zorunludur.");
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error("Geçerli bir e-posta adresi girin.");
  if (value.logo !== null && value.logo !== undefined) {
    if (typeof value.logo !== "string" || value.logo.length > 400000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value.logo)) throw new Error("Geçersiz kurum logosu.");
    result.logo = value.logo;
  }
  result.customThemes = normalizeCustomThemes(value.customThemes);
  // Bilinmeyen veya silinmiş tema, kaydı reddetmek yerine ana temaya döner (tema koruması).
  const known = THEMES.some(t => t.id === value.theme) || result.customThemes.some(t => t.id === value.theme);
  result.theme = known ? String(value.theme) : "original";
  // Eski kayıtlarda alan yoktur: mevcut kullanıcıların teması kendiliğinden değişmesin.
  result.themeAuto = typeof value.themeAuto === "boolean" ? value.themeAuto : false;
  for (const key of ["compact", "reducedMotion", "maskTc", "autoBackup", "notifyImports", "notifySystem", "notifyBackups"] as const) {
    if (typeof value[key] !== "boolean") throw new Error("Geçersiz tercih.");
    result[key] = value[key];
  }
  const retention = Number(value.backupRetention);
  if (!Number.isInteger(retention) || retention < 5 || retention > 365) throw new Error("Yedek saklama adedi 5–365 arasında olmalıdır.");
  result.backupRetention = retention;
  result.customGroups = cleanCustomGroups(value.customGroups);
  return result;
}
/** Geçersiz/yinelenen kayıtları ayıklar; en çok 50 özel grup. */
export function cleanCustomGroups(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const item of input) {
    const g = parseStaffGroup(item);
    if (isCustomGroup(g) && !out.includes(g)) out.push(g);
    if (out.length >= 50) break;
  }
  return out;
}
export function publishSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem("p26-settings", JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("p26-settings", { detail: settings }));
}
