import { IMPORT_FIELDS, normalizeImportValue as norm, validTc, type ImportInput, type ImportPreview, type ImportPreviewRow, type ImportRecord, type ImportField } from "@/lib/personnel-import";
export function parseImportInput(value: unknown): ImportInput {
  if (!value || typeof value !== "object") throw new Error("Geçersiz aktarım isteği.");
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 2000) throw new Error("Bir aktarımda 1–2.000 satır olmalıdır.");
  const rows = body.rows.map(row => {
    if (!Array.isArray(row) || row.length > 40) throw new Error("En fazla 40 sütun desteklenir.");
    return row.map(cell => {
      if (typeof cell !== "string" || cell.length > 1000) throw new Error("Geçersiz veya çok uzun hücre değeri.");
      return cell.trim();
    });
  });
  const source = body.mapping as Record<string, unknown> | undefined;
  const mapping: Partial<Record<ImportField, number>> = {};
  for (const field of IMPORT_FIELDS) {
    const index = source?.[field.key];
    if (index !== undefined && index !== -1) {
      if (!Number.isInteger(index) || Number(index) < 0 || Number(index) > 39) throw new Error("Sütun eşleştirmesi geçersiz.");
      mapping[field.key] = Number(index);
    }
  }
  if (mapping.name === undefined) throw new Error("Ad Soyad sütununu eşleştirin.");
  const indices = Object.values(mapping);
  if (new Set(indices).size !== indices.length) throw new Error("Aynı sütun birden fazla alana eşleştirilemez.");
  const defaults = body.defaults as Record<string, unknown> | undefined;
  const ids = defaults?.departmentIds;
  if (!Array.isArray(ids) || ids.length > 50 || !ids.every(id => typeof id === "string")) throw new Error("Varsayılan servisleri kontrol edin.");
  const startRow = Number(body.startRow ?? 2);
  if (!Number.isInteger(startRow) || startRow < 1 || startRow > 100) throw new Error("Başlangıç satırı geçersiz.");
  return { rows, mapping, defaults: { personnelType: String(defaults?.personnelType ?? "MEMUR"), staffGroup: String(defaults?.staffGroup ?? "SAGLIK"), departmentIds: [...new Set(ids as string[])] }, fileName: String(body.fileName ?? "personel.xlsx").slice(0, 180), startRow, skipInvalid: body.skipInvalid === true, acceptNames: body.acceptNames === true, confirmed: body.confirmed === true, mode: body.mode === "commit" ? "commit" : "preview" };
}
function parseDate(text: string) {
  if (!text) return null;
  const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  const iso = match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const date = new Date(iso + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : undefined;
}
export function previewImport(input: ImportInput, departments: { id: string; name: string }[], people: { name: string; tcNo: string | null }[]): ImportPreview {
  const existingTc = new Set(people.map(p => p.tcNo?.trim()).filter(Boolean));
  const existingNames = new Set(people.map(p => norm(p.name)));
  const seenTc = new Set<string>();
  const seenNames = new Set<string>();
  const typeMap: Record<string, string> = { isci: "ISCI", memur: "MEMUR", hemsire: "HEMSIRE" };
  const groupMap: Record<string, string> = { saglik: "SAGLIK", hemsire: "SAGLIK", "hemsire saglik": "SAGLIK", destek: "DESTEK", temizlik: "DESTEK", "temizlik destek": "DESTEK", teknisyen: "TEKNISYEN", "teknisyen personeli": "TEKNISYEN" };
  const rows: ImportPreviewRow[] = input.rows.map((cells, index) => {
    const get = (key: ImportField) => input.mapping[key] === undefined ? "" : cells[input.mapping[key]!] ?? "";
    const errors: string[] = [], warnings: string[] = [];
    let duplicate = false;
    const name = get("name").replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
    const tcNo = get("tcNo").replace(/\s+/g, "") || null;
    if (name.length < 3 || name.length > 150) errors.push("Ad Soyad 3–150 karakter olmalıdır.");
    if (tcNo && !validTc(tcNo)) errors.push("TC kimlik numarası 11 haneli ve kontrol basamakları geçerli olmalıdır.");
    if (tcNo && (existingTc.has(tcNo) || seenTc.has(tcNo))) { errors.push(existingTc.has(tcNo) ? "Bu TC numarası veritabanında zaten kayıtlı." : "Bu TC numarası dosyada tekrar ediyor."); duplicate = true; }
    if (name && (existingNames.has(norm(name)) || seenNames.has(norm(name)))) warnings.push("Aynı isimle kayıt var. Farklı bir kişi olduğundan emin olun.");
    if (tcNo) seenTc.add(tcNo);
    if (name) seenNames.add(norm(name));
    const personnelType = typeMap[norm(get("personnelType") || input.defaults.personnelType)];
    const staffGroup = groupMap[norm(get("staffGroup") || input.defaults.staffGroup)];
    if (!personnelType) errors.push("Personel sınıfı İşçi, Memur veya Hemşire olmalıdır.");
    if (!staffGroup) errors.push("Personel grubu Hemşire/Sağlık veya Temizlik/Destek olmalıdır.");
    const serviceText = get("departments");
    const departmentIds: string[] = [];
    if (serviceText) {
      for (const service of serviceText.split(/[;,|]/).map(s => s.trim()).filter(Boolean)) {
        const found = departments.find(d => d.id === service || norm(d.name) === norm(service));
        if (found) departmentIds.push(found.id); else errors.push(`Servis bulunamadı: ${service}`);
      }
    } else departmentIds.push(...input.defaults.departmentIds);
    const uniqueIds = [...new Set(departmentIds)];
    if (!uniqueIds.length) errors.push("En az bir servis ataması gereklidir.");
    if (uniqueIds.some(id => !departments.some(d => d.id === id))) errors.push("Varsayılan servis artık mevcut değil.");
    const email = get("email") || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("E-posta adresi geçersiz.");
    const date = parseDate(get("startDate"));
    if (date === undefined) errors.push("İşe başlama tarihi GG.AA.YYYY veya YYYY-AA-GG olmalıdır.");
    const balanceText = get("annualLeaveBalance");
    const balance = balanceText ? Number(balanceText.replace(",", ".")) : personnelType === "ISCI" ? 14 : 20;
    if (!Number.isFinite(balance) || balance < 0 || balance > 365) errors.push("İzin bakiyesi 0–365 arasında bir sayı olmalıdır.");
    const record: ImportRecord = { name, tcNo, personnelType: personnelType ?? "MEMUR", staffGroup: staffGroup ?? "SAGLIK", title: get("title") || null, phone: get("phone") || null, email, startDate: date ?? null, annualLeaveBalance: balance, departmentIds: uniqueIds };
    return { row: index + input.startRow, status: duplicate ? "duplicate" : errors.length ? "error" : warnings.length ? "warning" : "valid", errors, warnings, record, departmentNames: uniqueIds.map(id => departments.find(d => d.id === id)?.name ?? id) };
  });
  const summary = { total: rows.length, valid: 0, warning: 0, duplicate: 0, error: 0 };
  rows.forEach(row => summary[row.status]++);
  return { rows, summary };
}
