"use client";
import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, Download, ArrowRight, ArrowLeft, Check, CheckCircle2, AlertTriangle, X, Files, ShieldCheck, Columns3, Loader2, RotateCcw, Users } from "lucide-react";
import { IMPORT_FIELDS, suggestMapping, type ImportField, type ImportPreview } from "@/lib/personnel-import";
import type { Department } from "@/lib/shared";
import { cx } from "@/components/ui-kit";
import * as XLSX from "xlsx";
function saveBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export default function PersonnelImport({ departments, onDone }: { departments: Department[]; onDone?: () => void | Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheet, setSheet] = useState("");
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, number>>>({});
  const [defaults, setDefaults] = useState({ personnelType: "MEMUR", staffGroup: "SAGLIK", departmentIds: [] as string[] });
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [acceptNames, setAcceptNames] = useState(false);
  const [filter, setFilter] = useState("all");
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const headers = matrix[headerRow] ?? [];
  const rows = matrix.slice(headerRow + 1);
  function selectSheet(wb: XLSX.WorkBook, name: string) {
    const data = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, raw: false, defval: "", blankrows: true }).map(row => row.map(cell => String(cell ?? "")));
    if (data.length < 2) throw new Error("Dosyada başlık ve en az bir personel satırı olmalıdır.");
    if (data.length > 2001) throw new Error("Bir dosyada en fazla 2.000 personel satırı olabilir.");
    if (data.some(row => row.length > 40)) throw new Error("Dosyada en fazla 40 sütun olabilir.");
    setMatrix(data); setSheet(name); setHeaderRow(0); setMapping(suggestMapping(data[0]));
  }
  async function readFile(file: File) {
    setError(""); setBusy(true);
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error("Lütfen Excel (.xlsx, .xls) veya CSV dosyası seçin.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Dosya boyutu en fazla 5 MB olabilir.");
      const data = await file.arrayBuffer();
      let wb: XLSX.WorkBook;
      if (/\.csv$/i.test(file.name)) {
        let text = new TextDecoder("utf-8").decode(data);
        if (text.includes("�")) text = new TextDecoder("windows-1254").decode(data);
        wb = XLSX.read(text, { type: "string", raw: true, sheetRows: 2002 });
      } else wb = XLSX.read(data, { type: "array", sheetRows: 2002, dateNF: "yyyy-mm-dd" });
      selectSheet(wb, wb.SheetNames[0]); setWorkbook(wb); setFileName(file.name); setStep(1); setPreview(null); setSkipInvalid(false); setAcceptNames(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Dosya okunamadı."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  function template() {
    const wb = XLSX.utils.book_new();
    const data = [IMPORT_FIELDS.map(f => f.label), ["ÖRNEK PERSONEL", "", "Hemşire", "Hemşire/Sağlık", departments[0]?.name ?? "", "Hemşire", "", "", "2026-01-01", "20"]];
    const ws = XLSX.utils.aoa_to_sheet(data); ws["!cols"] = IMPORT_FIELDS.map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(wb, ws, "Personeller");
    saveBlob(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "personel_aktarim_sablonu.xlsx");
  }
  async function requestPreview() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/personnel/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, mapping, defaults, fileName, startRow: headerRow + 2, mode: "preview" }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setPreview(data); setStep(2); setFilter("all");
    } catch (e) { setError(e instanceof Error ? e.message : "Önizleme alınamadı."); }
    finally { setBusy(false); }
  }
  async function commit() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/personnel/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, mapping, defaults, fileName, startRow: headerRow + 2, mode: "commit", skipInvalid, acceptNames, confirmed: true }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setResult(data); setStep(3); await onDone?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Aktarım başarısız."); }
    finally { setBusy(false); }
  }
  function report() {
    if (!preview) return;
    const data = [["Excel Satırı", "Ad Soyad", "TC", "Durum", "Açıklama"], ...preview.rows.map(row => [String(row.row), row.record.name, row.record.tcNo ?? "", row.status, [...row.errors, ...row.warnings].join(" | ")])];
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(data.map(row => row.map(value => /^\s*[=+\-@]/.test(String(value)) ? "'" + value : value))), { FS: ";" });
    saveBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), "personel_aktarim_raporu.csv");
  }
  const importCount = (preview?.summary.valid ?? 0) + (acceptNames ? preview?.summary.warning ?? 0 : 0);
  const hasErrors = Boolean(preview && (preview.summary.error || preview.summary.duplicate));
  return <div className="import-wizard">
    <div className="import-heading"><div><h3>Personelleri toplu aktarın</h3><p>Tek tek form doldurmayın. Dosyanızı yükleyin, kontrol edin ve güvenle aktarın.</p></div><button className="settings-btn" onClick={template}><Download size={15} /> Şablonu indir</button></div>
    <div className="import-steps">{["Dosya yükle", "Sütunları eşleştir", "Kontrol & önizleme", "Aktarım tamamlandı"].map((label, i) => <div className={cx("import-step", i === step && "active", i < step && "complete")} key={label}><span>{i < step ? <Check size={14} /> : i + 1}</span><b>{label}</b>{i !== 3 && <i />}</div>)}</div>
    {error && <div className="settings-alert error" role="alert"><AlertTriangle size={17} />{error}<button aria-label="Uyarıyı kapat" onClick={() => setError("")}><X size={15} /></button></div>}
    <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void readFile(file); }} />
    {step === 0 && <>
      <div role="button" tabIndex={0} className={cx("import-drop", dragging && "dragging")} onClick={() => inputRef.current?.click()} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) void readFile(file); }}>
        <div className="import-upload-icon">{busy ? <Loader2 size={30} className="animate-spin" /> : <UploadCloud size={30} />}</div><h4>Excel veya CSV dosyanızı buraya bırakın</h4><p>ya da bilgisayarınızdan bir dosya seçin</p><span className="settings-btn primary"><Files size={15} /> Dosya seç</span><div className="import-formats"><span>XLSX</span><span>XLS</span><span>CSV</span><small>En fazla 5 MB · 2.000 satır</small></div>
      </div>
      <div className="import-benefits">{[{ icon: Columns3, title: "Esnek sütun eşleştirme", text: "Dosyanızın düzenini değiştirmeniz gerekmez." }, { icon: ShieldCheck, title: "Önce kontrol, sonra kayıt", text: "TC, mükerrer kayıt ve hatalar önceden görülür." }, { icon: Users, title: "Çoklu servis ataması", text: "Bir personeli birden fazla servise atayın." }].map(item => <div key={item.title}><item.icon size={21} /><h5>{item.title}</h5><p>{item.text}</p></div>)}</div>
      <div className="settings-note"><FileSpreadsheet size={18} /><p><b>İlk kez mi aktarıyorsunuz?</b> Şablonu indirin ve örnek satırı kendi personel bilgilerinizle değiştirin. Çoklu servisleri noktalı virgülle ayırın.</p></div>
    </>}
    {step === 1 && <div className="import-mapping">
      <div className="import-file"><FileSpreadsheet size={23} /><div><b>{fileName}</b><span>{rows.length} satır · {headers.length} sütun</span></div><button className="settings-btn" onClick={() => inputRef.current?.click()}>Dosyayı değiştir</button></div>
      <div className="settings-form-grid"><label>Çalışma sayfası<select className="settings-input" value={sheet} onChange={e => { if (workbook) { try { selectSheet(workbook, e.target.value); } catch (err) { setError(String(err)); } } }}>{workbook?.SheetNames.map(name => <option key={name}>{name}</option>)}</select></label><label>Başlık satırı<select className="settings-input" value={headerRow} onChange={e => { const value = Number(e.target.value); setHeaderRow(value); setMapping(suggestMapping(matrix[value] ?? [])); }}>{matrix.slice(0, 10).map((_, i) => <option value={i} key={i}>{i + 1}. satır</option>)}</select></label></div>
      <div className="mapping-table"><div className="mapping-table-head"><span>PANEL ALANI</span><span>DOSYANIZDAKİ SÜTUN</span><span>ÖRNEK DEĞER</span></div>{IMPORT_FIELDS.map(field => <div className="mapping-row" key={field.key}><span>{field.label}{"required" in field && <em> *</em>}</span><select aria-label={`${field.label} sütunu`} className="settings-input" value={mapping[field.key] ?? -1} onChange={e => setMapping(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}><option value={-1}>Eşleştirme / varsayılanı kullan</option>{headers.map((header, i) => <option value={i} key={i}>{XLSX.utils.encode_col(i)} · {header || "Başlıksız"}</option>)}</select><small>{mapping[field.key] !== undefined && mapping[field.key] !== -1 ? rows[0]?.[mapping[field.key]!] || "—" : "—"}</small></div>)}</div>
      <h4 className="import-section-title">Dosyada belirtilmeyen alanlar için varsayılanlar</h4><div className="settings-form-grid"><label>Personel sınıfı<select className="settings-input" value={defaults.personnelType} onChange={e => setDefaults({ ...defaults, personnelType: e.target.value })}><option value="MEMUR">Memur</option><option value="ISCI">İşçi</option><option value="HEMSIRE">Hemşire</option></select></label><label>Personel grubu<select className="settings-input" value={defaults.staffGroup} onChange={e => setDefaults({ ...defaults, staffGroup: e.target.value })}><option value="SAGLIK">Hemşire / Sağlık</option><option value="DESTEK">Temizlik / Destek</option></select></label></div><div className="service-checks">{departments.map(dept => <label key={dept.id}><input type="checkbox" checked={defaults.departmentIds.includes(dept.id)} onChange={e => setDefaults({ ...defaults, departmentIds: e.target.checked ? [...defaults.departmentIds, dept.id] : defaults.departmentIds.filter(id => id !== dept.id) })} />{dept.name}</label>)}</div>
      <div className="import-actions"><button className="settings-btn" onClick={() => setStep(0)}><ArrowLeft size={15} /> Geri</button><button className="settings-btn primary" disabled={busy} onClick={requestPreview}>{busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} Kontrol et ve önizle</button></div>
    </div>}
    {step === 2 && preview && <>
      <div className="import-summary">{[["Toplam satır", preview.summary.total, ""], ["Geçerli", preview.summary.valid, "green"], ["İsim uyarısı", preview.summary.warning, "amber"], ["Mükerrer TC", preview.summary.duplicate, "amber"], ["Hatalı", preview.summary.error, "red"]].map(([label, value, color]) => <div className={String(color)} key={String(label)}><strong>{value}</strong><span>{label}</span></div>)}</div>
      <div className="import-preview-toolbar"><select aria-label="Satırları filtrele" className="settings-input" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tüm satırlar</option><option value="error">Hatalı / mükerrer satırlar</option><option value="warning">İsim uyarıları</option><option value="valid">Geçerli satırlar</option></select><button className="settings-btn" onClick={report}><Download size={15} /> Açıklamalı raporu indir</button></div>
      <div className="import-preview-scroll"><table className="settings-table"><thead><tr><th>Satır</th><th>Personel / TC</th><th>Sınıf / Grup</th><th>Servisler</th><th>Durum / Açıklama</th></tr></thead><tbody>{preview.rows.filter(row => filter === "all" || (filter === "error" ? row.status === "error" || row.status === "duplicate" : row.status === filter)).slice(0, 200).map(row => <tr key={row.row}><td>{row.row}</td><td><b>{row.record.name || "—"}</b><small>{row.record.tcNo ?? "TC belirtilmedi"}</small></td><td>{({ MEMUR: "Memur", ISCI: "İşçi", HEMSIRE: "Hemşire" } as Record<string, string>)[row.record.personnelType]}<small>{row.record.staffGroup === "SAGLIK" ? "Hemşire / Sağlık" : "Temizlik / Destek"}</small></td><td>{row.departmentNames.join(", ") || "—"}</td><td><span className={cx("row-status", row.status)}>{row.status === "valid" ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{({ valid: "Hazır", warning: "İsim uyarısı", duplicate: "Mükerrer", error: "Hatalı" })[row.status]}</span>{[...row.errors, ...row.warnings].map(text => <small key={text}>{text}</small>)}</td></tr>)}</tbody></table></div>
      {preview.rows.length > 200 && <p className="settings-muted">Ekranda ilk 200 satır gösterilir. İndirilen rapor tüm satırları içerir.</p>}
      <div className="import-confirm">{hasErrors && <label><input type="checkbox" checked={skipInvalid} onChange={e => setSkipInvalid(e.target.checked)} />Hatalı ve mükerrer TC satırlarını atla, yalnızca geçerli satırları aktar.</label>}{preview.summary.warning > 0 && <label><input type="checkbox" checked={acceptNames} onChange={e => setAcceptNames(e.target.checked)} />Aynı isim uyarılarını inceledim; bu kişilerin farklı olduğunu onaylıyorum.</label>}<p><ShieldCheck size={14} /> Mevcut personel kayıtları değiştirilmez. Aktarım öncesi son kontrol tekrar yapılır.</p></div>
      <div className="import-actions"><button className="settings-btn" disabled={busy} onClick={() => setStep(1)}><ArrowLeft size={15} /> Eşleştirmeye dön</button><button className="settings-btn primary" disabled={busy || !importCount || (hasErrors && !skipInvalid)} onClick={commit}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{importCount} personeli aktar</button></div>
    </>}
    {step === 3 && result && <div className="import-success"><span><CheckCircle2 size={40} /></span><h3>Aktarım başarıyla tamamlandı</h3><p><b>{result.imported} personel</b> servislere atandı. {result.skipped > 0 && `${result.skipped} satır atlandı.`}</p><p>Yeni kayıtlar Personel Yönetimi ekranında hazır.</p><div><button className="settings-btn" onClick={report}><Download size={15} /> Raporu indir</button><button className="settings-btn primary" onClick={() => { setStep(0); setFileName(""); setResult(null); }}><RotateCcw size={15} /> Yeni dosya aktar</button></div></div>}
  </div>;
}
