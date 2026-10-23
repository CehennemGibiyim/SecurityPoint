"use client";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Modal, Btn, TextArea } from "@/components/ui-kit";

export type PrintSection = { key: string; label: string; desc: string };

/**
 * Yazdırma öncesi seçim penceresi:
 * çıktıya girecek bölümler + isteğe bağlı dipnot.
 * Seçimler ve dipnot, birim+ay bazında hatırlanır (localStorage).
 */
export default function PrintOptionsModal({
  title = "Yazdırma öncesi seçim",
  sections,
  storageKey,
  notePlaceholder = "Bu aya ait açıklama veya dipnot yazın…",
  noteHint,
  onConfirm,
  onClose,
}: {
  title?: string;
  sections: PrintSection[];
  storageKey: string;
  notePlaceholder?: string;
  noteHint?: string;
  onConfirm: (values: Record<string, boolean>, note: string) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, boolean>>(
    () => Object.fromEntries(sections.map(s => [s.key, true]))
  );
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const p = JSON.parse(saved);
        if (p && typeof p === "object") {
          if (p.values && typeof p.values === "object") {
            setValues(v => ({ ...v, ...p.values }));
          }
          if (typeof p.note === "string") setNote(p.note);
        }
      }
    } catch { /* yok say */ }
  }, [storageKey]);

  function confirm() {
    try { localStorage.setItem(storageKey, JSON.stringify({ values, note })); } catch { /* yok say */ }
    onConfirm(values, note);
  }

  return (
    <Modal title={<><Printer className="w-4 h-4 text-amber-400" /> {title}</>} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-white/40 text-xs -mt-1">Çıktıda görmek istediğiniz bölümleri seçin.</p>

        {sections.map(s => (
          <label
            key={s.key}
            className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 cursor-pointer transition ${
              values[s.key]
                ? "bg-sky-500/[.08] border-sky-400/40"
                : "bg-white/[.04] border-white/10 hover:border-white/25"
            }`}
          >
            <input
              type="checkbox"
              checked={values[s.key] ?? true}
              onChange={e => setValues(v => ({ ...v, [s.key]: e.target.checked }))}
              className="accent-sky-400 mt-0.5"
            />
            <span>
              <span className="block text-white text-xs font-bold">{s.label}</span>
              <span className="block text-white/40 text-[11px]">{s.desc}</span>
            </span>
          </label>
        ))}

        <div>
          <div className="text-white/50 text-[11px] font-medium uppercase tracking-wider mb-1.5">Dipnot</div>
          <TextArea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={notePlaceholder}
            className="min-h-[84px]"
          />
          {noteHint && <p className="text-white/30 text-[10px] mt-1">{noteHint}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={onClose}>İptal</Btn>
          <Btn variant="primary" onClick={confirm}><Printer className="w-4 h-4" /> Önizlemeyi aç</Btn>
        </div>
      </div>
    </Modal>
  );
}
