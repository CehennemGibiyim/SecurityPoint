"use client";
import { useState } from "react";
import { Check, LockKeyhole, Search, Moon, Sun, Palette, RotateCcw, ShieldCheck, Plus, Pencil, Trash2, AlertTriangle, MonitorSmartphone } from "lucide-react";
import {
  THEMES, THEME_COLOR_KEYS, THEME_COLOR_LABELS, MAX_CUSTOM_THEMES, allThemes, setCustomThemes, applyThemeFromSettings, effectiveThemeId,
  findTheme, isHex, contrastRatio, categoryFor, newCustomThemeId, type Theme, type ThemeColorKey,
} from "@/lib/themes";
import type { AppSettings } from "@/lib/settings";
import { useSystemThemeId } from "@/lib/use-system-theme";
import { cx } from "@/components/ui-kit";

type Draft = { id: string | null; name: string } & Record<ThemeColorKey, string>;

const PREVIEW_NAV: [string, string, string][] = [
  ["Puantaj", "#0ea5e9", "#2563eb"], ["Nöbet Çizelgesi", "#8b5cf6", "#9333ea"], ["İzin Yönetimi", "#10b981", "#0d9488"],
  ["Personel Yönetimi", "#06b6d4", "#0284c7"], ["Yedekleme", "#6366f1", "#1d4ed8"],
];

/** Seçilen renklerle panelin nasıl görüneceğini gösteren küçük sayfa taslağı (yalnızca önizleme, uygulamayı değiştirmez). */
function ThemePreview({ t }: { t: Pick<Theme, ThemeColorKey> }) {
  const line = `${t.text}26`;
  return (
    <div className="theme-preview" role="img" aria-label="Seçilen renklerle sayfa önizlemesi" style={{ background: t.bg, color: t.text, borderColor: line }}>
      <div className="tp-side" style={{ background: t.sidebar, borderColor: line }}>
        <div className="tp-brand"><span style={{ background: `linear-gradient(135deg,#0ea5e9,#8b5cf6)` }} /><b>Personel26</b></div>
        {PREVIEW_NAV.map(([label, a, b], i) => (
          <div key={label} className="tp-nav" style={i === 1 ? { background: `${t.accent}26`, borderColor: `${t.accent}55` } : undefined}>
            <span style={{ background: `linear-gradient(135deg,${a},${b})` }} /><em style={{ color: i === 1 ? t.text : t.muted }}>{label}</em>
          </div>
        ))}
        <div className="tp-user" style={{ background: t.panel, borderColor: line }}><span style={{ background: t.accent, color: t.bg }}>YK</span><div><b>Yönetici</b><small style={{ color: t.muted }}>Kurum yönetimi</small></div></div>
      </div>
      <div className="tp-main">
        <div className="tp-head" style={{ borderColor: line }}>
          <div><b>Nöbet Çizelgesi</b><small style={{ color: t.muted }}>Vardiya atamaları · Acil Servis</small></div>
          <span className="tp-btn" style={{ background: t.accent, color: t.bg }}>Kaydet</span>
        </div>
        <div className="tp-stats">
          {[["Atama", "128"], ["Net saat", "1.536"], ["Gece", "64"]].map(([l, v]) => (
            <div key={l} style={{ background: t.panel, borderColor: line }}><small style={{ color: t.muted }}>{l}</small><b style={{ color: t.accent }}>{v}</b></div>
          ))}
        </div>
        <div className="tp-table" style={{ background: t.panel, borderColor: line }}>
          <div className="tp-row tp-th" style={{ color: t.muted, borderColor: line }}><span>Tarih</span><span>08:00–20:00</span><span>20:00–08:00</span></div>
          {[["1.10", "Ayşe Çelik", "Mehmet Şahin"], ["2.10", "Elif Kaya", "Ali Demir"], ["3.10", "Fatma Yıldız", "Can Aydın"]].map(r => (
            <div key={r[0]} className="tp-row" style={{ borderColor: line }}><span style={{ color: t.muted }}>{r[0]}</span><span>{r[1]}</span><span>{r[2]}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemeCard({ theme, selected, active, onChoose, children }: { theme: Theme; selected: boolean; active: boolean; onChoose: () => void; children?: React.ReactNode }) {
  return (
    <div
      className={cx("theme-card", selected && "selected")}
      role="button" tabIndex={0} aria-pressed={selected}
      onClick={onChoose}
      onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onChoose(); } }}
    >
      <div className="theme-card-main">
        <div className="theme-mini" style={{ background: theme.bg, color: theme.text }}>
          <div className="mini-sidebar" style={{ background: theme.sidebar }}><span style={{ background: theme.accent }} /><i /><i /><i /><i /><i /></div>
          <div className="mini-content">
            <div className="mini-top"><span /><i style={{ background: theme.accent }} /></div>
            <div className="mini-title" />
            <div className="mini-stats">{[1, 2, 3].map(i => <div key={i} style={{ background: theme.panel }}><i style={{ background: theme.accent }} /><span /></div>)}</div>
            <div className="mini-panel" style={{ background: theme.panel }}><span /><div className="mini-chart">{[32, 48, 29, 63, 44, 75, 55, 88, 67].map((h, i) => <i key={i} style={{ height: `${h}%`, background: theme.accent, opacity: .35 + i * .065 }} />)}</div></div>
          </div>
          {selected && <span className="theme-check" style={{ background: theme.accent }}><Check size={13} /></span>}
          {theme.id === "original" && <span className="theme-original"><LockKeyhole size={9} /> ANA TEMA</span>}
          {theme.custom && <span className="theme-original theme-custom-tag">ÖZEL</span>}
        </div>
        <div className="theme-card-label"><b>{theme.name}</b><span>{active ? "Etkin" : theme.category === "dark" ? "Koyu tema" : "Açık tema"}</span></div>
      </div>
      {children}
    </div>
  );
}

export default function ThemeSettings({ settings, setSettings, savedTheme, savedSettings }: {
  settings: AppSettings; setSettings: (value: AppSettings) => void; savedTheme: string; savedSettings?: AppSettings;
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const sysId = useSystemThemeId();
  const customs = settings.customThemes ?? [];
  const effectiveId = effectiveThemeId(settings, sysId);
  const unsaved = settings.theme !== savedTheme || settings.themeAuto !== (savedSettings?.themeAuto ?? settings.themeAuto)
    || JSON.stringify(customs) !== JSON.stringify(savedSettings?.customThemes ?? customs);

  function commit(next: AppSettings) { setSettings(next); applyThemeFromSettings(next); }
  function choose(id: string) { commit({ ...settings, theme: id, themeAuto: false }); }
  function toggleAuto() { commit({ ...settings, themeAuto: !settings.themeAuto }); }

  function startDraft(base: Theme, editId: string | null) {
    setDraft({ id: editId, name: editId ? base.name : `${base.name} (özel)`.slice(0, 30), bg: base.bg, panel: base.panel, sidebar: base.sidebar, accent: base.accent, text: base.text, muted: base.muted });
  }
  function setColor(key: ThemeColorKey, value: string) { if (draft) setDraft({ ...draft, [key]: value.startsWith("#") ? value : `#${value}` }); }

  const colorsOk = draft ? THEME_COLOR_KEYS.every(k => isHex(draft[k])) : false;
  const nameOk = draft ? draft.name.trim().length >= 2 : false;
  const limitReached = !!draft && !draft.id && customs.length >= MAX_CUSTOM_THEMES;
  const warnings: string[] = [];
  if (draft && colorsOk) {
    const r = (a: string, b: string) => contrastRatio(draft[a as ThemeColorKey], draft[b as ThemeColorKey]);
    if (r("text", "bg") < 4.5) warnings.push(`Yazı rengi sayfa zemininde zor okunur (${r("text", "bg").toFixed(1)}:1; en az 4.5 önerilir).`);
    if (r("text", "panel") < 4.5) warnings.push(`Yazı rengi kart zemininde zor okunur (${r("text", "panel").toFixed(1)}:1).`);
    if (r("muted", "panel") < 3) warnings.push(`Soluk yazı kart zemininde çok silik (${r("muted", "panel").toFixed(1)}:1).`);
    if (r("accent", "bg") < 3) warnings.push(`Vurgu rengi zeminden yeterince ayrışmıyor (${r("accent", "bg").toFixed(1)}:1).`);
  }

  function saveDraft() {
    if (!draft || !colorsOk || !nameOk || limitReached) return;
    const id = draft.id ?? newCustomThemeId();
    const colors = Object.fromEntries(THEME_COLOR_KEYS.map(k => [k, draft[k].toLowerCase()])) as Record<ThemeColorKey, string>;
    const theme: Theme = { id, name: draft.name.trim().slice(0, 30), category: categoryFor(colors.bg), ...colors, custom: true };
    const list = draft.id ? customs.map(t => (t.id === id ? theme : t)) : [...customs, theme];
    setCustomThemes(list);
    commit({ ...settings, customThemes: list, theme: id, themeAuto: false });
    setDraft(null);
  }
  function removeCustom(id: string) {
    const list = customs.filter(t => t.id !== id);
    setCustomThemes(list);
    commit({ ...settings, customThemes: list, theme: settings.theme === id ? "original" : settings.theme });
    setConfirmDel(null);
  }

  const q = query.toLocaleLowerCase("tr");
  const list = allThemes().filter(theme => (filter === "all" || theme.category === filter) && theme.name.toLocaleLowerCase("tr").includes(q));

  return <div className="theme-settings">
    <div className="theme-protection"><div className="theme-protection-icon"><ShieldCheck size={26} /></div><div><h3>Ana temanız her zaman güvende.</h3><p>Personel26’nın orijinal teması değiştirilemez. Diğer temaları deneyebilir, istediğiniz an ana temaya dönebilirsiniz. Bir tema silinir veya bozulursa panel kendiliğinden ana temaya döner.</p></div><span><LockKeyhole size={12} /> KORUMA ALTINDA</span></div>

    <div className="settings-toggle-row theme-auto-row">
      <MonitorSmartphone size={19} />
      <div><h3>Sistem temasını otomatik izle <span className="recommended-badge">ÖNERİLEN</span></h3><p>Açıkken panel, bilgisayarınızın açık/koyu tercihine uyar: koyu → ana tema, açık → Bulut teması. Şu an sistem: <b>{sysId === "cloud" ? "açık" : "koyu"}</b>. Bir tema seçtiğinizde otomatik izleme kapanır.</p></div>
      <button type="button" className={cx("settings-switch", settings.themeAuto && "on")} role="switch" aria-checked={settings.themeAuto} aria-label="Sistem temasını otomatik izle" onClick={toggleAuto}><span /></button>
    </div>

    <div className="theme-toolbar"><div className="theme-filter">{[{ id: "all", label: "Tüm temalar", icon: Palette }, { id: "dark", label: "Koyu", icon: Moon }, { id: "light", label: "Açık", icon: Sun }].map(item => <button key={item.id} className={cx(filter === item.id && "active")} onClick={() => setFilter(item.id)}><item.icon size={14} />{item.label}</button>)}</div><div className="theme-search"><Search size={14} /><input aria-label="Tema ara" placeholder="Tema ara…" value={query} onChange={e => setQuery(e.target.value)} /></div><button className="settings-btn primary" onClick={() => startDraft(findTheme(effectiveId), null)} disabled={customs.length >= MAX_CUSTOM_THEMES} title={customs.length >= MAX_CUSTOM_THEMES ? `En çok ${MAX_CUSTOM_THEMES} özel tema` : "Yeni özel tema oluştur"}><Plus size={14} /> Özel tema oluştur</button></div>

    {draft && <section className="settings-card theme-editor-card" aria-label="Özel tema oluşturucu">
      <div className="section-heading"><span className="settings-icon violet"><Palette size={19} /></span><div><h2>{draft.id ? "Özel temayı düzenle" : "Özel tema oluştur"}</h2><p>Renkleri seçin; sağdaki önizleme sayfanın nasıl görüneceğini anında gösterir.</p></div></div>
      <div className="theme-editor">
        <div className="theme-editor-form">
          <label className="theme-editor-field"><span>Tema adı</span><input className="settings-input" value={draft.name} maxLength={30} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="örn. Hastane yeşili" /></label>
          <label className="theme-editor-field"><span>Başlangıç teması</span>
            <select className="settings-input" value="" onChange={e => { const b = allThemes().find(t => t.id === e.target.value); if (b) setDraft({ ...draft, bg: b.bg, panel: b.panel, sidebar: b.sidebar, accent: b.accent, text: b.text, muted: b.muted }); }}>
              <option value="">Renkleri bir temadan kopyala…</option>
              {allThemes().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          {THEME_COLOR_KEYS.map(k => <div key={k} className="theme-color-row">
            <label htmlFor={`tc-${k}`}>{THEME_COLOR_LABELS[k]}</label>
            <input id={`tc-${k}`} type="color" value={isHex(draft[k]) ? draft[k] : "#000000"} onChange={e => setColor(k, e.target.value)} aria-label={`${THEME_COLOR_LABELS[k]} renk seçici`} />
            <input className={cx("settings-input", !isHex(draft[k]) && "invalid")} value={draft[k]} maxLength={7} spellCheck={false} onChange={e => setColor(k, e.target.value.trim())} aria-label={`${THEME_COLOR_LABELS[k]} onaltılık kod`} />
          </div>)}
          {!colorsOk && <p className="theme-editor-error"><AlertTriangle size={13} /> Renk kodları #rrggbb biçiminde olmalı (örn. #1e293b).</p>}
          {warnings.map(w => <p key={w} className="theme-editor-warn"><AlertTriangle size={13} /> {w}</p>)}
          {limitReached && <p className="theme-editor-error"><AlertTriangle size={13} /> En çok {MAX_CUSTOM_THEMES} özel tema oluşturabilirsiniz. Önce birini silin.</p>}
          <div className="theme-editor-actions">
            <button className="settings-btn" onClick={() => setDraft(null)}>Vazgeç</button>
            <button className="settings-btn primary" onClick={saveDraft} disabled={!colorsOk || !nameOk || limitReached}><Check size={14} /> Kaydet ve seç</button>
          </div>
        </div>
        <div className="theme-editor-preview">
          <div className="theme-preview-label">Önizleme · {categoryFor(isHex(draft.bg) ? draft.bg : "#000000") === "light" ? "açık tema" : "koyu tema"}</div>
          {colorsOk ? <ThemePreview t={draft} /> : <div className="settings-empty">Önizleme için geçerli renk kodları girin.</div>}
          <p className="settings-muted">Önizleme yalnızca taslaktır. “Kaydet ve seç”ten sonra tema paneline uygulanır; kalıcı olması için sayfa altındaki “Değişiklikleri kaydet”e basın.</p>
        </div>
      </div>
    </section>}

    {unsaved && <div className="settings-alert info"><Palette size={16} /><span><b>Önizleme modu.</b> Bu görünümü kalıcı kullanmak için değişiklikleri kaydedin.</span></div>}

    <div className="themes-grid">{list.map(theme => <ThemeCard key={theme.id} theme={theme} selected={effectiveId === theme.id} active={theme.id === (effectiveThemeId({ theme: savedTheme, themeAuto: savedSettings?.themeAuto ?? false }, sysId))} onChoose={() => choose(theme.id)}>
      {theme.custom && <div className="theme-card-tools" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        {confirmDel === theme.id
          ? <><span>Silinsin mi?</span><button className="danger" onClick={() => removeCustom(theme.id)}>Sil</button><button onClick={() => setConfirmDel(null)}>Vazgeç</button></>
          : <><button onClick={() => startDraft(theme, theme.id)}><Pencil size={12} /> Düzenle</button><button onClick={() => setConfirmDel(theme.id)}><Trash2 size={12} /> Sil</button></>}
      </div>}
    </ThemeCard>)}</div>
    {!list.length && <div className="settings-empty">Aramanıza uygun tema bulunamadı.</div>}
    <div className="theme-bottom"><p><Check size={14} /> Tema tercihi puantaj, nöbet ve personel verilerinizi etkilemez. {THEMES.length} hazır tema{customs.length ? ` + ${customs.length} özel tema` : ""}.</p><button className="settings-btn" onClick={() => choose("original")}><RotateCcw size={14} /> Ana temaya dön</button></div>
  </div>;
}
