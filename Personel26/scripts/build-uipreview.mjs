/**
 * Personel26 — statik arayüz önizlemesi üretici.
 * Nöbet Çizelgesi ekranının görsel kopyasını tek dosyalık, bağımsız
 * (harici CSS/JS/font gerektirmeyen) bir HTML olarak public/ altına yazar.
 *
 * Çalıştırma:  node scripts/build-uipreview.mjs
 * Çıktı:      public/panel-onizleme.html
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ─── Temsilî veri ───
const YEAR = 2026, MONTH = 8; // Eylül (0-bazlı)
const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const DAYS_TR = ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"];
const PERSONS = [
  { name: "AYŞE ÇELİK", type: "MEMUR" },
  { name: "MEHMET ŞAHİN", type: "ISCI" },
  { name: "HATİCE YILMAZ", type: "MEMUR" },
  { name: "OSMAN KOÇ", type: "ISCI" },
  { name: "SERKAN AKDOĞAN", type: "MEMUR" },
];
const COLUMNS = [
  { service: "Acil Servis", label: "07:00–15:00", start: "07:00", end: "15:00" },
  { service: "Acil Servis", label: "15:00–23:00", start: "15:00", end: "23:00" },
  { service: "Acil Servis", label: "23:00–07:00", start: "23:00", end: "07:00" },
];
const dim = new Date(YEAR, MONTH + 1, 0).getDate(); // 30
const NET = 7.5; // 8 saatlik vardiya neti

// Atama: dengeli rotasyon (gün içinde tekrar yok)
const grid = [];
for (let d = 1; d <= dim; d++) {
  const row = [];
  for (let c = 0; c < COLUMNS.length; c++) row.push((d + c * 2) % PERSONS.length);
  grid.push(row);
}
// Gösterim amaçlı: 19. gün 2. sütunu SERKAN'a ver (aynı-gün çakışma uyarısı demosu)
grid[18][1] = 4;
// Gösterim amaçlı: 30. gün gece hücresini boş bırak ("—" durumu)
grid[29][2] = -1;

const WARN_CELLS = new Set(["19-0", "19-1"]); // uyarı vurgulu hücreler (1-bazlı gün + sütun)
const wd = (d) => new Date(YEAR, MONTH, d).getDay();
const isSat = (d) => wd(d) === 6;
const isSun = (d) => wd(d) === 0;

// Özetler (veriden hesaplanır — tutarlı)
let totalCount = 0, nightCount = 0;
const per = PERSONS.map(() => ({ count: 0, night: 0, weekend: 0, days: new Set() }));
grid.forEach((row, di) => {
  const d = di + 1;
  const weekend = isSat(d) || isSun(d);
  row.forEach((p, c) => {
    if (p < 0) return;
    totalCount++;
    per[p].count++;
    per[p].days.add(d);
    if (c === 2) { nightCount++; per[p].night++; }
    if (weekend) per[p].weekend++;
  });
});
const r2 = (n) => Math.round(n * 100) / 100;
const totals = {
  count: totalCount,
  gross: totalCount * 8,
  net: r2(totalCount * NET),
  night: r2(nightCount * NET),
  extra: 0,
};
const sundays = Array.from({ length: dim }, (_, i) => i + 1).filter(isSun).length;
const workDays = dim - sundays;
const requiredFor = (t) => r2(workDays * (t === "ISCI" ? 7.5 : 40 / 6));

// ─── SVG sprite (lucide tarzı, satır içi) ───
const sprite = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.2 12h5.3l.5-1 2 4.5 2-7 1.6 3.5h4.2"/></symbol>
<symbol id="i-clipboard" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></symbol>
<symbol id="i-template" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/></symbol>
<symbol id="i-calendar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></symbol>
<symbol id="i-repeat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></symbol>
<symbol id="i-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></symbol>
<symbol id="i-scale" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></symbol>
<symbol id="i-mega" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></symbol>
<symbol id="i-db" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></symbol>
<symbol id="i-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></symbol>
<symbol id="i-wand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></symbol>
<symbol id="i-xls" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></symbol>
<symbol id="i-file" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/></symbol>
<symbol id="i-printer" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></symbol>
<symbol id="i-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></symbol>
<symbol id="i-pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></symbol>
<symbol id="i-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></symbol>
<symbol id="i-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></symbol>
<symbol id="i-save" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7H7v7"/><path d="M7 3v5h8"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></symbol>
<symbol id="i-chevl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></symbol>
<symbol id="i-chevr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></symbol>
<symbol id="i-building" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/><path d="M12 14h.01"/></symbol>
<symbol id="i-finger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .96-3.26"/><path d="M8 8v.01"/><path d="M8 16v.01"/><path d="M12 20v.01"/><path d="M12 14v.01"/><path d="M16 10v.01"/><path d="M16 16v.01"/><path d="M19 10v.01"/><path d="M19 16a4 4 0 0 0-.34-1.63"/><path d="M21 12.34A6 6 0 0 0 19 6.96"/><path d="M22 16v.01"/></symbol>
</defs></svg>`;

const ic = (id, size = 15) =>
  `<svg class="ic" width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"/></svg>`;

// ─── Kenar çubuğu ───
const NAV = [
  ["i-clipboard", "Puantaj", "Aylık çalışma cetveli", false],
  ["i-clock", "Nöbet Çizelgesi", "Vardiya atamaları", true],
  ["i-template", "Vardiya Şablonları", "2'li / 3'lü düzenler", false],
  ["i-calendar", "İzin Yönetimi", "Talepler ve onay akışı", false],
  ["i-repeat", "Değişim Talepleri", "Nöbet takası", false],
  ["i-users", "Personel Rehberi", "İletişim ve bakiyeler", false],
  ["i-scale", "Adalet Analizi", "Nöbet dağılımı", false],
  ["i-shield", "Mevzuat Uyarıları", "Dinlenme ve limitler", false],
  ["i-mega", "Duyurular", "Servis bildirimleri", false],
  ["i-db", "Yedekleme", "Veri güvenliği", false],
];
const sidebar = `
<aside class="sidebar">
  <div class="brand">
    <div class="brand-logo">${ic("i-logo", 20)}</div>
    <div><div class="brand-name">Personel26</div><div class="brand-sub">Puantaj &amp; Nöbet Yönetimi</div></div>
  </div>
  <nav class="nav">
    ${NAV.map(([icon, label, desc, active]) => `
    <span class="nav-item${active ? " active" : ""}">
      <span class="nav-ic">${ic(icon, 17)}</span>
      <span class="nav-txt"><span class="nav-label">${label}</span><span class="nav-desc">${desc}</span></span>
    </span>`).join("")}
  </nav>
  <div class="side-foot">
    <span class="query-box">${ic("i-finger", 16)}<span>Personel Sorgu Ekranı<span class="query-sub">Şifresiz · TC ile giriş</span></span></span>
    <p class="side-note">İzinli personelin nöbet listesinden çıkarılması, dinlenme süreleri ve mükerrer vardiya koruması aktiftir.</p>
  </div>
</aside>`;

// ─── Izgara satırları ───
const rosterRows = Array.from({ length: dim }, (_, i) => {
  const d = i + 1;
  const cls = ["roster-row"];
  if (isSat(d)) cls.push("is-saturday");
  if (isSun(d)) cls.push("is-sunday");
  const cells = COLUMNS.map((col, c) => {
    const p = grid[i][c];
    const warn = WARN_CELLS.has(`${d}-${c}`);
    const opts = [`<option value="">—</option>`, ...PERSONS.map((pp, pi) =>
      `<option value="${pi}"${pi === p ? " selected" : ""}>${pp.name}</option>`)].join("");
    return `<td class="roster-td"><select class="roster-select${p >= 0 ? " is-filled" : ""}${warn ? " has-warning" : ""}"${warn ? ` title="⚠ Çakışma/dinlenme uyarısı"` : ""}>${opts}</select></td>`;
  }).join("");
  return `<tr class="${cls.join(" ")}"><td class="roster-td roster-date">${d}.09</td><td class="roster-td roster-day">${DAYS_TR[wd(d)]}</td>${cells}</tr>`;
}).join("");

// ─── Personel özet satırları ───
const summaryRows = PERSONS.map((p, i) => {
  const req = requiredFor(p.type);
  const worked = r2(per[i].count * NET);
  const night = r2(per[i].night * NET);
  const extra = r2(per[i].weekend * NET);
  const diff = r2(worked - req);
  return `<tr class="sum-row">
    <td class="sum-name">${p.name}</td>
    <td class="c-req">${req}</td><td class="c-wrk b">${worked}</td>
    <td class="c-night">${night}</td><td class="c-hol">${extra}</td>
    <td class="c-dim">${per[i].days.size}</td>
    <td class="${diff >= 0 ? "c-pos" : "c-neg"} b">${diff > 0 ? "+" : ""}${diff}</td>
  </tr>`;
}).join("");

const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personel26 — Nöbet Çizelgesi (Arayüz Önizleme)</title>
<!--
  Personel26 · Nöbet Çizelgesi ekranının STATİK görsel önizlemesi.
  Tek dosya, bağımsız (harici CSS/JS/font yok). Veriler temsilîdir, işlem yapılamaz.
  Üretim: node scripts/build-uipreview.mjs
-->
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--line:rgba(148,163,184,.14)}
html{color-scheme:dark}
body{background:radial-gradient(1200px 600px at 80% -10%,rgba(56,189,248,.07),transparent 60%),radial-gradient(900px 500px at -10% 30%,rgba(245,158,11,.05),transparent 55%),#070b14;background-attachment:fixed;color:#e2e8f0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-feature-settings:"tnum" 1}
::selection{background:rgba(56,189,248,.35)}
.ic{flex:none;vertical-align:-2px}
.layout{display:flex;min-height:100vh}
/* ── Kenar çubuğu ── */
.sidebar{width:264px;flex:none;background:#090e1b;border-right:1px solid rgba(255,255,255,.09);display:flex;flex-direction:column;position:sticky;top:0;height:100vh}
.brand{display:flex;align-items:center;gap:10px;padding:20px 16px 16px;border-bottom:1px solid rgba(255,255,255,.08)}
.brand-logo{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 8px 20px -6px rgba(56,189,248,.5)}
.brand-name{color:#fff;font-weight:800;font-size:15px;letter-spacing:.01em}
.brand-sub{color:rgba(255,255,255,.35);font-size:10px;font-weight:500}
.nav{flex:1;overflow-y:auto;padding:12px 10px;display:flex;flex-direction:column;gap:2px}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid transparent;color:rgba(255,255,255,.55)}
.nav-item.active{background:linear-gradient(90deg,rgba(56,189,248,.2),rgba(56,189,248,.05));border-color:rgba(56,189,248,.3);color:#fff;box-shadow:inset 2px 0 0 0 #38bdf8}
.nav-ic{color:rgba(255,255,255,.35)}
.nav-item.active .nav-ic{color:#38bdf8}
.nav-txt{display:flex;flex-direction:column;min-width:0}
.nav-label{font-size:13px;font-weight:700;line-height:1.2}
.nav-desc{font-size:10px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.side-foot{padding:12px;border-top:1px solid rgba(255,255,255,.08)}
.query-box{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.25);color:#6ee7b7;font-size:12px;font-weight:700}
.query-sub{display:block;font-size:9.5px;font-weight:500;opacity:.6}
.side-note{color:rgba(255,255,255,.2);font-size:9px;padding:8px 4px 0;line-height:1.5}
/* ── İçerik ── */
.main{flex:1;min-width:0}
.topbar{display:flex;align-items:center;gap:12px;padding:20px 24px 16px;position:sticky;top:0;z-index:30;background:rgba(7,11,20,.85);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.07);flex-wrap:wrap}
.topbar h1{color:#fff;font-weight:800;font-size:20px;line-height:1.1}
.topbar .sub{color:rgba(255,255,255,.35);font-size:11px}
.dept-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;color:rgba(255,255,255,.3)}
.chip{padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(255,255,255,.5);font-size:12px;font-weight:700}
.chip.on{background:rgba(56,189,248,.2);border-color:rgba(56,189,248,.6);color:#bae6fd;box-shadow:0 0 14px -2px rgba(56,189,248,.4)}
.chip.add{border-style:dashed;display:inline-flex;align-items:center}
.spacer{flex:1}
.monthnav{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:4px}
.monthnav .mn-btn{padding:6px;border-radius:8px;color:rgba(255,255,255,.6);display:inline-flex}
.monthnav .mn-label{padding:4px 12px;font-size:14px;font-weight:800;color:#fff;min-width:128px;text-align:center;white-space:nowrap}
.content{padding:16px 24px 40px;max-width:1600px;display:flex;flex-direction:column;gap:12px}
.panel{background:linear-gradient(165deg,rgba(23,32,52,.85),rgba(13,20,36,.92));border:1px solid var(--line);border-radius:16px;backdrop-filter:blur(14px)}
.toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.toolbar .t-title{display:flex;align-items:center;gap:8px;color:#fff;font-weight:800;font-size:22px}
.toolbar .t-title .ic{color:#38bdf8}
.toolbar .t-sub{color:rgba(255,255,255,.35);font-size:12px}
.btn{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.8);font-size:12px;font-weight:600;white-space:nowrap}
.btn.primary{background:rgba(14,165,233,.9);border-color:rgba(125,211,252,.3);color:#fff}
.btn.success{background:rgba(16,185,129,.85);border-color:rgba(110,231,183,.3);color:#fff}
.btn.amber{background:rgba(245,158,11,.85);border-color:rgba(252,211,77,.3);color:#451a03}
/* ── Özet kartları ── */
.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.card{background:linear-gradient(165deg,rgba(23,32,52,.85),rgba(13,20,36,.92));border:1px solid var(--line);border-radius:12px;padding:8px 12px;text-align:center}
.card .v{font-size:20px;font-weight:800}
.card .l{color:rgba(255,255,255,.35);font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700}
/* ── Uyarılar ── */
.warns{border:1px solid rgba(245,158,11,.4);border-radius:16px;overflow:hidden;background:linear-gradient(165deg,rgba(23,32,52,.85),rgba(13,20,36,.92))}
.warns-head{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid rgba(245,158,11,.25);background:rgba(245,158,11,.06);color:#fde68a;font-weight:700;font-size:14px}
.warns-head .ic{color:#fbbf24}
.warns-head small{font-weight:500;color:rgba(253,230,138,.7);font-size:12px}
.warns ul{list-style:none;padding:8px 16px 12px;display:flex;flex-direction:column;gap:4px}
.warns li{font-size:12px;color:rgba(255,255,255,.65);display:flex;align-items:center;gap:8px}
.dot{width:6px;height:6px;border-radius:99px;flex:none}
.dot.rose{background:#fb7185}.dot.amber{background:#fbbf24}
/* ── Izgara ── */
.grid-head{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.1)}
.grid-head h2{color:#fff;font-weight:600;font-size:14px}
.grid-head p{color:rgba(255,255,255,.35);font-size:11px}
.grid-head .count{margin-left:auto;color:rgba(255,255,255,.4);font-size:12px;font-weight:700;background:rgba(255,255,255,.06);border-radius:8px;padding:4px 8px}
.roster-wrap{max-height:70vh;overflow:auto}
.roster-table{width:100%;border-collapse:separate;border-spacing:0;min-width:760px}
.roster-table thead th{position:sticky;top:0;z-index:5;background:#131d33;border-bottom:1px solid rgba(148,163,184,.2);padding:8px 6px;font-size:10.5px;line-height:1.3;min-width:150px}
.roster-th.roster-date{min-width:64px;width:64px}
.roster-th.roster-day{min-width:84px;width:84px}
.roster-th .s1{font-weight:700;color:rgba(255,255,255,.8)}
.roster-th .s2{font-weight:600;color:rgba(125,211,252,.9)}
.roster-th .s3{font-size:9px;font-weight:500;opacity:.6;color:#cbd5e1}
.roster-row td{border-bottom:1px solid rgba(148,163,184,.07)}
.roster-row:hover td{background:rgba(125,211,252,.06)}
.roster-td{padding:3px 4px}
.roster-date,.roster-day{color:#d9f3ff;font-weight:800;font-size:11.5px;white-space:nowrap;position:sticky;left:0;background:#101a2e;z-index:4;padding-left:10px !important}
.roster-day{left:64px;box-shadow:4px 0 12px -6px rgba(0,0,0,.8)}
.roster-row.is-saturday td{background:rgba(30,129,166,.16)}
.roster-row.is-sunday td{background:rgba(166,104,18,.16)}
.roster-row.is-saturday .roster-date,.roster-row.is-saturday .roster-day{color:#7dd3fc !important}
.roster-row.is-sunday .roster-date,.roster-row.is-sunday .roster-day{color:#ffd080 !important}
.roster-select{width:100%;min-height:30px;padding:4px 6px;border-radius:7px;border:1px solid rgba(125,211,252,.2);background:rgba(9,34,44,.6);color:#fff;font-size:11.5px;font-weight:600;outline:none;cursor:pointer}
.roster-select option{background:#0e1729;color:#e2e8f0}
.roster-select.is-filled{background:rgba(56,189,248,.13);border-color:rgba(56,189,248,.4)}
.roster-row.is-saturday .roster-select{border-color:rgba(56,189,248,.4);background:rgba(9,48,62,.7)}
.roster-row.is-sunday .roster-select{border-color:rgba(255,170,50,.4);background:rgba(66,46,15,.65)}
.roster-select.has-warning{border-color:rgba(245,158,11,.8) !important;box-shadow:0 0 0 2px rgba(245,158,11,.22);background:rgba(120,72,10,.45) !important}
/* ── İki sütunlu paneller ── */
.duo{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.duo .panel{padding:16px;display:flex;flex-direction:column;gap:12px}
.duo h2{color:#fff;font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px}
.duo h2 .ic{color:#a78bfa}
.duo .hint{color:rgba(255,255,255,.35);font-size:11px;line-height:1.6}
.duo .hint b{color:rgba(255,255,255,.6)}
.frow{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.fld label{display:block;color:rgba(255,255,255,.5);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.inp{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 12px;color:#fff;font-size:13px;outline:none}
.col-item{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px 12px}
.col-item .ord{color:rgba(255,255,255,.3);font-size:10px;font-weight:700;width:20px;flex:none}
.col-item .nm{flex:1;min-width:0}
.col-item .nm .a{color:#fff;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.col-item .nm .b{color:rgba(125,211,252,.8);font-size:11px}
.iconbtn{padding:6px;color:rgba(255,255,255,.4);display:inline-flex}
.list{display:flex;flex-direction:column;gap:6px;max-height:256px;overflow-y:auto;padding-right:4px}
.tpl-item{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px 12px}
.tpl-top{display:flex;align-items:center;gap:8px}
.tpl-top .nm{flex:1;min-width:0}
.tpl-top .nm .a{color:#fff;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tpl-top .nm .b{color:rgba(255,255,255,.35);font-size:10px}
.tpl-cols{color:rgba(255,255,255,.4);font-size:10px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.save-row{display:flex;gap:8px}
.save-row .inp{flex:1}
.checkline{display:flex;align-items:center;gap:8px;color:rgba(255,255,255,.55);font-size:12px}
/* ── Personel özeti ── */
.sum-head{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.1);color:#fff;font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px}
.sum-head .ic{color:#38bdf8}
.sum-table{width:100%;border-collapse:collapse;font-size:14px}
.sum-table th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.45);font-weight:700;padding:8px;text-align:center;border-bottom:1px solid rgba(255,255,255,.1)}
.sum-table th:first-child{text-align:left;padding-left:16px}
.sum-row td{padding:6px 8px;text-align:center;border-bottom:1px solid rgba(255,255,255,.05)}
.sum-name{text-align:left !important;padding-left:16px !important;color:#fff;font-weight:500}
.c-req{color:#7dd3fc}.c-wrk{color:#34d399}.c-night{color:#c4b5fd}.c-hol{color:#fcd34d}.c-dim{color:rgba(255,255,255,.5)}
.c-pos{color:#34d399}.c-neg{color:#fb7185}.b{font-weight:700}
/* ── Rozetler ── */
.preview-badge{position:fixed;right:18px;bottom:18px;z-index:60;background:#0c1220;border:1px solid rgba(245,158,11,.5);color:#fde68a;font-size:11px;font-weight:700;padding:8px 14px;border-radius:12px;box-shadow:0 12px 30px -8px rgba(0,0,0,.6);display:flex;align-items:center;gap:8px}
.preview-badge .dot{width:8px;height:8px;background:#fbbf24;animation:blink 1.6s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}
.foot-note{text-align:center;color:rgba(255,255,255,.25);font-size:11px;padding:8px}
.mobilebar{display:none}
@media (max-width:1023px){
  .sidebar{display:none}
  .mobilebar{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1);background:rgba(10,16,32,.95);position:sticky;top:0;z-index:40;color:#fff;font-weight:700;font-size:14px}
  .cards{grid-template-columns:repeat(2,1fr)}
  .duo{grid-template-columns:1fr}
  .content{padding:12px}
  .topbar{padding:14px}
}
</style>
</head>
<body>
${sprite}
<div class="preview-badge"><span class="dot"></span>STATİK ÖNİZLEME · temsilî veriler · işlem yapılamaz</div>
<div class="mobilebar"><span class="brand-logo" style="width:28px;height:28px;border-radius:8px">${ic("i-logo", 15)}</span> Nöbet Çizelgesi · ${MONTHS[MONTH]} ${YEAR}</div>
<div class="layout">
${sidebar}
<div class="main">
  <header class="topbar">
    <div><h1>Nöbet Çizelgesi</h1><div class="sub">Vardiya atamaları</div></div>
    <div class="dept-chips">${ic("i-building", 14)}
      <span class="chip on">Acil Servis</span><span class="chip">Yoğun Bakım</span><span class="chip">Dahiliye Servisi</span><span class="chip add">${ic("i-plus", 14)}</span>
    </div>
    <div class="spacer"></div>
    <div class="monthnav"><span class="mn-btn">${ic("i-chevl", 16)}</span><span class="mn-label">${MONTHS[MONTH]} ${YEAR}</span><span class="mn-btn">${ic("i-chevr", 16)}</span></div>
  </header>
  <div class="content">
    <div class="toolbar">
      <span class="t-title">${ic("i-clock", 20)} Nöbet Çizelgesi</span>
      <span class="t-sub">Acil Servis · ${MONTHS[MONTH]} ${YEAR}</span>
      <span class="spacer"></span>
      <span class="btn">${ic("i-refresh", 14)}</span>
      <span class="btn primary">${ic("i-wand", 14)} Taslak Oluştur</span>
      <span class="btn success">${ic("i-xls", 14)} Excel</span>
      <span class="btn">${ic("i-file", 14)} CSV</span>
      <span class="btn amber">${ic("i-printer", 14)} Yazdır / PDF</span>
    </div>
    <div class="cards">
      <div class="card"><div class="v" style="color:#fff">${totals.count}</div><div class="l">Atama</div></div>
      <div class="card"><div class="v" style="color:#7dd3fc">${totals.gross}</div><div class="l">Brüt Saat</div></div>
      <div class="card"><div class="v" style="color:#34d399">${totals.net}</div><div class="l">Net Saat</div></div>
      <div class="card"><div class="v" style="color:#c4b5fd">${totals.night}</div><div class="l">Gece</div></div>
      <div class="card"><div class="v" style="color:#f9a8d4">${totals.extra}</div><div class="l">Fazla (7,5 üstü)</div></div>
    </div>
    <div class="warns">
      <div class="warns-head">${ic("i-warn", 16)} Çakışma Uyarıları <small>(2) — aynı gün çift atama ve 11 saat altı dinlenme</small></div>
      <ul>
        <li><span class="dot rose"></span>SERKAN AKDOĞAN — 19.09 tarihinde başka bir vardiyayla çakışıyor (19. gün 07:00–15:00 vardiyası).</li>
        <li><span class="dot amber"></span>SERKAN AKDOĞAN — 20.09 öncesi yalnızca 8 saat dinlenme (19. gün 15:00–23:00 vardiyası).</li>
      </ul>
    </div>
    <div class="panel">
      <div class="grid-head"><h2>Aylık Çizelge</h2><p>Hücreye tıklayıp personeli seçin — boş bırakmak için “—” seçin</p><span class="count">${totals.count} atama</span></div>
      <div class="roster-wrap"><table class="roster-table">
        <thead><tr>
          <th class="roster-th roster-date" style="color:rgba(255,255,255,.45)">Tarih</th>
          <th class="roster-th roster-day" style="color:rgba(255,255,255,.45)">Gün</th>
          ${COLUMNS.map((c) => `<th class="roster-th"><div class="s1">${c.service}</div><div class="s2">${c.label}</div><div class="s3">${c.start}–${c.end}</div></th>`).join("")}
        </tr></thead>
        <tbody>${rosterRows}</tbody>
      </table></div>
    </div>
    <div class="duo">
      <div class="panel">
        <div><h2>Nöbet Sütunları</h2><div class="hint">Izgaradaki “Hizmet (Saat)” sütunlarını buradan tanımlayın.</div></div>
        <div class="frow">
          <div class="fld"><label>Hizmet</label><div class="inp">Acil Servis</div></div>
          <div class="fld"><label>Saat Etiketi (opsiyonel)</label><div class="inp" style="color:rgba(255,255,255,.25)">08:00–20:00</div></div>
          <div class="fld"><label>Başlangıç</label><div class="inp">08:00</div></div>
          <div class="fld"><label>Bitiş</label><div class="inp">20:00</div></div>
        </div>
        <div><span class="btn primary">${ic("i-plus", 14)} Sütun Ekle</span></div>
        <div class="list">
          ${COLUMNS.map((c, i) => `<div class="col-item"><span class="ord">${i + 1}.</span><span class="nm"><span class="a">${c.service}</span><br><span class="b">${c.label} · ${c.start}–${c.end}</span></span><span class="iconbtn">${ic("i-pencil", 14)}</span><span class="iconbtn">${ic("i-up", 14)}</span><span class="iconbtn">${ic("i-down", 14)}</span><span class="iconbtn">${ic("i-x", 14)}</span></div>`).join("")}
        </div>
      </div>
      <div class="panel">
        <div><h2>${ic("i-template", 16)} Vardiya Şablonları</h2><div class="hint">Mevcut sütun düzenini kaydedin; <b>Sütunları Kur</b> yalnızca düzeni kurar, <b>İşle</b> düzeni kurup ${MONTHS[MONTH]} ${YEAR} ayını taslakla doldurur.</div></div>
        <div class="save-row"><div class="inp" style="color:rgba(255,255,255,.25)">Şablon adı, örn. Standart Servis Düzeni</div><span class="btn primary">${ic("i-save", 14)} Kaydet</span></div>
        <label class="checkline"><input type="checkbox" checked disabled> Uygularken bu ayın atamalarını temizle (diğer aylar korunur)</label>
        <div class="list">
          <div class="tpl-item"><div class="tpl-top"><span class="nm"><span class="a">Standart Servis Düzeni</span><br><span class="b">3 sütun · tüm servisler</span></span><span class="btn amber">Sütunları Kur</span><span class="btn primary">${ic("i-wand", 14)} İşle</span><span class="iconbtn">${ic("i-save", 14)}</span><span class="iconbtn">${ic("i-trash", 14)}</span></div><div class="tpl-cols">Acil Servis (07:00–15:00) · Acil Servis (15:00–23:00) · Acil Servis (23:00–07:00)</div></div>
          <div class="tpl-item"><div class="tpl-top"><span class="nm"><span class="a">2'li Vardiya Düzeni (12s)</span><br><span class="b">2 sütun · tüm servisler</span></span><span class="btn amber">Sütunları Kur</span><span class="btn primary">${ic("i-wand", 14)} İşle</span><span class="iconbtn">${ic("i-save", 14)}</span><span class="iconbtn">${ic("i-trash", 14)}</span></div><div class="tpl-cols">Genel Servis (08:00–20:00) · Genel Servis (20:00–08:00)</div></div>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="sum-head">${ic("i-users", 16)} Personel Aylık Özet — Acil Servis</div>
      <div style="overflow-x:auto"><table class="sum-table">
        <thead><tr><th>Personel</th><th style="color:#7dd3fc">Gereken</th><th style="color:#34d399">Çalışılan</th><th style="color:#c4b5fd">Gece</th><th style="color:#fcd34d">Hz.Sonu/Tatil</th><th>Gün</th><th>Fark</th></tr></thead>
        <tbody>${summaryRows}</tbody>
      </table></div>
    </div>
    <div class="foot-note">Personel26 · Nöbet Çizelgesi arayüz önizlemesi · Bu dosya yalnızca görsel paylaşım amaçlıdır, veriler temsilîdir.</div>
  </div>
</div>
</div>
</body>
</html>`;

const outPath = join(root, "public", "panel-onizleme.html");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, "utf-8");
console.log(`OK: ${outPath} (${(html.length / 1024).toFixed(1)} KB, ${dim} gün x ${COLUMNS.length} sütun)`);
