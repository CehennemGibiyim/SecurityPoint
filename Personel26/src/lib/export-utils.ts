"use client";
import * as XLSX from "xlsx";

export type SheetData = { name: string; rows: (string | number)[][] };

/** Birden fazla sayfalı gerçek .xlsx dosyası indirir (kaynak projeyle aynı). */
export function downloadXlsx(sheets: SheetData[], filename: string) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    const widths = Array.from({ length: Math.max(...s.rows.map(row => row.length), 1) }, (_, columnIndex) => {
      const longest = Math.max(...s.rows.map(row => String(row[columnIndex] ?? "").length), 0);
      return { wch: Math.min(32, Math.max(10, longest + 2)) };
    });
    ws["!cols"] = widths;
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 30));
  });
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Excel uyumlu UTF-8 BOM'lu CSV çıktısı (kaynak projeyle aynı). */
export function downloadCsv(rows: (string | number)[][], filename: string) {
  const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function safeFileName(...parts: (string | number)[]) {
  return parts
    .join("_")
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .replace(/_+/g, "_");
}
