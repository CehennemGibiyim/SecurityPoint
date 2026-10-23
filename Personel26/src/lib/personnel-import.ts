export const IMPORT_FIELDS = [
  { key: "name", label: "Ad Soyad", required: true, aliases: ["ad soyad", "adsoyad", "isim", "name", "personel", "personel adi"] },
  { key: "tcNo", label: "TC Kimlik No", aliases: ["tc", "tc no", "tc kimlik no", "tckn", "tcno", "kimlik no"] },
  { key: "personnelType", label: "Personel sınıfı", aliases: ["sinif", "personel sinifi", "personel tipi", "personneltype", "statu"] },
  { key: "staffGroup", label: "Personel grubu", aliases: ["grup", "personel grubu", "staffgroup"] },
  { key: "departments", label: "Servis / Departman", aliases: ["servis", "servisler", "servis departman", "departman", "departmanlar", "birim", "departments"] },
  { key: "title", label: "Ünvan", aliases: ["unvan", "gorev", "title"] },
  { key: "phone", label: "Telefon", aliases: ["telefon", "tel", "phone"] },
  { key: "email", label: "E-posta", aliases: ["e posta", "eposta", "email", "e-mail"] },
  { key: "startDate", label: "İşe başlama tarihi", aliases: ["ise baslama tarihi", "baslama tarihi", "startdate"] },
  { key: "annualLeaveBalance", label: "Yıllık izin bakiyesi", aliases: ["yillik izin bakiyesi", "izin bakiyesi", "annualleavebalance"] },
] as const;
export type ImportField = typeof IMPORT_FIELDS[number]["key"];
export type ImportInput = { rows: string[][]; mapping: Partial<Record<ImportField, number>>; defaults: { personnelType: string; staffGroup: string; departmentIds: string[] }; fileName: string; startRow: number; skipInvalid: boolean; acceptNames: boolean; confirmed: boolean; mode: "preview" | "commit" };
export type ImportRecord = { name: string; tcNo: string | null; personnelType: string; staffGroup: string; title: string | null; phone: string | null; email: string | null; startDate: string | null; annualLeaveBalance: number; departmentIds: string[] };
export type ImportPreviewRow = { row: number; status: "valid" | "warning" | "duplicate" | "error"; errors: string[]; warnings: string[]; record: ImportRecord; departmentNames: string[] };
export type ImportPreview = { rows: ImportPreviewRow[]; summary: { total: number; valid: number; warning: number; duplicate: number; error: number } };
export function normalizeImportValue(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, " ").trim();
}
export function suggestMapping(headers: string[]) {
  const mapping: Partial<Record<ImportField, number>> = {};
  for (const field of IMPORT_FIELDS) {
    const index = headers.findIndex(header => field.aliases.some(alias => normalizeImportValue(alias) === normalizeImportValue(header)));
    if (index >= 0) mapping[field.key] = index;
  }
  return mapping;
}
export function validTc(value: string) {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = value.split("").map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  return ((odd * 7 - even) % 10 + 10) % 10 === d[9] && d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}
