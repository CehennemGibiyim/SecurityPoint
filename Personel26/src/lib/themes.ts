export type Theme = { id: string; name: string; category: "dark" | "light"; bg: string; panel: string; sidebar: string; accent: string; text: string; muted: string; custom?: boolean };
export const THEMES: Theme[] = [
  { id: "original", name: "Personel26", category: "dark", bg: "#070b14", panel: "#0e1626", sidebar: "#090e1b", accent: "#38bdf8", text: "#e2e8f0", muted: "#8b98ad" },
  { id: "ocean", name: "Okyanus", category: "dark", bg: "#071622", panel: "#102534", sidebar: "#0b1b29", accent: "#22d3ee", text: "#e0f2fe", muted: "#82a1b3" },
  { id: "violet", name: "Gece Moru", category: "dark", bg: "#110c20", panel: "#201831", sidebar: "#171024", accent: "#a78bfa", text: "#ede9fe", muted: "#a498b8" },
  { id: "graphite", name: "Grafit", category: "dark", bg: "#111214", panel: "#1f2125", sidebar: "#16171a", accent: "#cbd5e1", text: "#f1f5f9", muted: "#979ba4" },
  { id: "forest", name: "Orman", category: "dark", bg: "#091811", panel: "#142b21", sidebar: "#0c1e16", accent: "#34d399", text: "#e2f7eb", muted: "#89a695" },
  { id: "sunset", name: "Gün Batımı", category: "dark", bg: "#211211", panel: "#34201c", sidebar: "#281714", accent: "#fb923c", text: "#fff1e5", muted: "#bb9b88" },
  { id: "wine", name: "Bordo", category: "dark", bg: "#1b0b15", panel: "#301626", sidebar: "#230e1d", accent: "#fb7185", text: "#fce7f3", muted: "#b88a9d" },
  { id: "petrol", name: "Petrol", category: "dark", bg: "#081a1d", panel: "#122b30", sidebar: "#0b2024", accent: "#2dd4bf", text: "#def7f4", muted: "#83aaa8" },
  { id: "cobalt", name: "Kobalt", category: "dark", bg: "#09132a", panel: "#132344", sidebar: "#0c1833", accent: "#60a5fa", text: "#e5edff", muted: "#8e9fc3" },
  { id: "lavender", name: "Lavanta", category: "light", bg: "#f3f0fa", panel: "#ffffff", sidebar: "#eae5f5", accent: "#7c3aed", text: "#2d2341", muted: "#80728e" },
  { id: "sapphire", name: "Safir", category: "dark", bg: "#0b1027", panel: "#19203c", sidebar: "#10162e", accent: "#818cf8", text: "#eef2ff", muted: "#939bbe" },
  { id: "olive", name: "Zeytin", category: "dark", bg: "#171b10", panel: "#282f1e", sidebar: "#1c2115", accent: "#a3e635", text: "#f0f5e5", muted: "#a2ad8b" },
  { id: "rose", name: "Gül Kurusu", category: "dark", bg: "#20131d", panel: "#342331", sidebar: "#271824", accent: "#f9a8d4", text: "#fce7f3", muted: "#b49aa9" },
  { id: "sand", name: "Kum", category: "light", bg: "#f4f0e8", panel: "#fffdf8", sidebar: "#eae4d8", accent: "#b77934", text: "#3c3428", muted: "#897d6a" },
  { id: "arctic", name: "Arktik", category: "light", bg: "#edf5fa", panel: "#ffffff", sidebar: "#e1eef5", accent: "#0284c7", text: "#183447", muted: "#708798" },
  { id: "cloud", name: "Bulut", category: "light", bg: "#f4f5f7", panel: "#ffffff", sidebar: "#eceef1", accent: "#475569", text: "#1e293b", muted: "#788496" },
  { id: "mint", name: "Nane", category: "light", bg: "#edf6f1", panel: "#ffffff", sidebar: "#e0eee5", accent: "#059669", text: "#1d3a2c", muted: "#739180" },
  { id: "cream", name: "Krem", category: "light", bg: "#faf5ed", panel: "#fffcf7", sidebar: "#f0e8dc", accent: "#ca8a04", text: "#413625", muted: "#998b74" },
  { id: "anthracite", name: "Antrasit", category: "dark", bg: "#10161b", panel: "#1c2730", sidebar: "#141c23", accent: "#94a3b8", text: "#e2e8f0", muted: "#8696a4" },
  { id: "copper", name: "Bakır", category: "dark", bg: "#1e1512", panel: "#32251f", sidebar: "#251b17", accent: "#d9a06f", text: "#faeee5", muted: "#b59e8e" },
  { id: "aurora", name: "Kuzey Işıkları", category: "dark", bg: "#0d1421", panel: "#192338", sidebar: "#111a2a", accent: "#6ee7b7", text: "#e4f5f2", muted: "#91a8b2" },
];
// ───────── Özel temalar ─────────
export const CUSTOM_THEME_PREFIX = "custom:";
export const MAX_CUSTOM_THEMES = 10;
export const THEME_COLOR_KEYS = ["bg", "panel", "sidebar", "accent", "text", "muted"] as const;
export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];
export const THEME_COLOR_LABELS: Record<ThemeColorKey, string> = {
  bg: "Sayfa arka planı", panel: "Kart / panel", sidebar: "Sol menü", accent: "Vurgu rengi", text: "Yazı rengi", muted: "Soluk yazı",
};

let customThemes: Theme[] = [];
/** Ayarlardaki özel temaları kaydeder; applyTheme/findTheme bunları da tanır. */
export function setCustomThemes(list: Theme[] | undefined) { customThemes = Array.isArray(list) ? list : []; }
export function allThemes(): Theme[] { return [...THEMES, ...customThemes]; }
/** Bulunamazsa ana temaya (original) düşer: bozuk veya silinmiş bir tema paneli asla bozmaz. */
export function findTheme(id: string | null | undefined): Theme { return allThemes().find(t => t.id === id) ?? THEMES[0]; }

export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
function channel(c: number) { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
/** WCAG kontrast oranı (1–21). Yazı için 4.5 ve üzeri okunaklı sayılır. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export const categoryFor = (bg: string): "dark" | "light" => (luminance(bg) > 0.4 ? "light" : "dark");

/** Gelen özel tema listesini temizler: geçerli renk, benzersiz kimlik, en çok 10 tema. */
export function normalizeCustomThemes(input: unknown): Theme[] {
  if (!Array.isArray(input)) return [];
  const out: Theme[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Record<string, unknown>;
    const id = typeof t.id === "string" && /^custom:[a-z0-9-]{3,40}$/.test(t.id) ? t.id : "";
    const name = typeof t.name === "string" ? t.name.replace(/\s+/g, " ").trim().slice(0, 30) : "";
    if (!id || name.length < 2 || out.some(x => x.id === id)) continue;
    if (!THEME_COLOR_KEYS.every(k => isHex(t[k]))) continue;
    const c = Object.fromEntries(THEME_COLOR_KEYS.map(k => [k, String(t[k]).toLowerCase()])) as Record<ThemeColorKey, string>;
    out.push({ id, name, category: categoryFor(c.bg), ...c, custom: true });
    if (out.length >= MAX_CUSTOM_THEMES) break;
  }
  return out;
}
export const newCustomThemeId = () => CUSTOM_THEME_PREFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ───────── Otomatik tema (sistem tercihi) ─────────
/** İşletim sisteminin açık/koyu tercihine göre eşleşen yerleşik tema: koyu → ana tema, açık → Bulut. */
export function systemThemeId(): string {
  try { return window.matchMedia("(prefers-color-scheme: light)").matches ? "cloud" : "original"; } catch { return "original"; }
}
type ThemeSettingsLike = { theme: string; compact: boolean; reducedMotion: boolean; themeAuto?: boolean; customThemes?: Theme[] };
/** Gerçekte uygulanacak tema kimliği: otomatik açıksa sistem tercihi, değilse seçili tema. */
export function effectiveThemeId(s: Pick<ThemeSettingsLike, "theme" | "themeAuto">, system: string = systemThemeId()): string {
  return s.themeAuto ? system : s.theme;
}
export function applyThemeFromSettings(s: ThemeSettingsLike) {
  setCustomThemes(s.customThemes);
  applyTheme(effectiveThemeId(s), s.compact, s.reducedMotion);
}

export function applyTheme(id: string, compact = false, reducedMotion = false) {
  if (typeof document === "undefined") return;
  const theme = findTheme(id);
  const root = document.documentElement;
  root.dataset.p26Theme = theme.id === "original" ? "original" : theme.custom ? "custom" : theme.id;
  root.dataset.p26Light = String(theme.category === "light");
  root.dataset.p26Compact = String(compact);
  root.dataset.p26Motion = String(reducedMotion);
  Object.entries({ bg: theme.bg, panel: theme.panel, sidebar: theme.sidebar, accent: theme.accent, text: theme.text, muted: theme.muted }).forEach(([key, value]) => root.style.setProperty(`--theme-${key}`, value));
}
