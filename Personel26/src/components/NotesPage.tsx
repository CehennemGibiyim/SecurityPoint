"use client";
import { useEffect, useState } from "react";
import { Megaphone, Plus, Trash2, Info, AlertTriangle, Siren } from "lucide-react";
import type { Announcement, Department } from "@/lib/shared";
import { Btn, Modal, Field, TextInput, TextArea, Badge, Spinner, EmptyState, SelectInput, cx } from "@/components/ui-kit";

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "İşlem başarısız");
  return data;
}

const KIND_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  INFO: { label: "Bilgi", icon: <Info className="w-3.5 h-3.5" />, cls: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  WARNING: { label: "Önemli", icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  URGENT: { label: "Acil", icon: <Siren className="w-3.5 h-3.5" />, cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
};

export default function NotesPage({ departments, selectedDept }: {
  departments: Department[]; selectedDept: string;
}) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/announcements");
    const data = await res.json();
    setItems(data.announcements ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Duyuru silinsin mi?")) return;
    await api("/api/announcements", "DELETE", { id });
    await load();
  }

  const visible = items.filter(a => !a.departmentId || a.departmentId === selectedDept);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-grotesk)" }}>
          <Megaphone className="w-4 h-4 text-fuchsia-400" /> Duyurular
        </h2>
        <div className="flex-1" />
        <Btn small variant="primary" onClick={() => setShowModal(true)}><Plus className="w-3.5 h-3.5" /> Yeni Duyuru</Btn>
      </div>

      {loading ? <Spinner /> : visible.length === 0 ? (
        <EmptyState icon={<Megaphone className="w-8 h-8" />} title="Duyuru yok" desc="Servis genelinde veya kurum genelinde duyurular burada listelenir." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {visible.map((a, i) => {
            const km = KIND_META[a.kind] ?? KIND_META.INFO;
            const deptName = a.departmentId ? departments.find(d => d.id === a.departmentId)?.name : null;
            return (
              <div key={a.id} className="panel p-4 anim-slide" style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}>
                <div className="flex items-start gap-2.5">
                  <div className={cx("w-8 h-8 rounded-xl border flex items-center justify-center shrink-0", km.cls)}>{km.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-white font-bold text-xs">{a.title}</div>
                      <Badge className={km.cls}>{km.label}</Badge>
                      <Badge className="bg-white/[.05] text-white/50 border-white/10">{deptName ?? "Kurum geneli"}</Badge>
                    </div>
                    <p className="text-white/60 text-xs mt-1.5 leading-relaxed whitespace-pre-wrap">{a.body}</p>
                    <div className="text-white/25 text-[10px] mt-2">
                      {a.createdBy ? `${a.createdBy} · ` : ""}{new Date(a.createdAt).toLocaleString("tr-TR")}
                    </div>
                  </div>
                  <button onClick={() => remove(a.id)} className="text-white/25 hover:text-rose-300 transition p-1" title="Sil">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <NewAnnouncementModal departments={departments} selectedDept={selectedDept} onClose={() => setShowModal(false)} onCreated={() => { load(); setShowModal(false); }} />
      )}
    </div>
  );
}

function NewAnnouncementModal({ departments, selectedDept, onCreated, onClose }: {
  departments: Department[]; selectedDept: string; onCreated: () => void; onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("INFO");
  const [deptId, setDeptId] = useState<string>(selectedDept);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    await api("/api/announcements", "POST", { title, body, kind, departmentId: deptId || null, createdBy: "Yönetici" });
    setSaving(false);
    onCreated();
  }

  return (
    <Modal title={<><Megaphone className="w-4 h-4 text-fuchsia-400" /> Yeni Duyuru</>} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Başlık">
          <TextInput autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Duyuru başlığı" />
        </Field>
        <Field label="İçerik">
          <TextArea value={body} onChange={e => setBody(e.target.value)} placeholder="Duyuru metni…" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Önem Derecesi">
            <SelectInput value={kind} onChange={e => setKind(e.target.value)}>
              <option value="INFO">Bilgi</option>
              <option value="WARNING">Önemli</option>
              <option value="URGENT">Acil</option>
            </SelectInput>
          </Field>
          <Field label="Kapsam">
            <SelectInput value={deptId} onChange={e => setDeptId(e.target.value)}>
              <option value="">Kurum geneli</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </SelectInput>
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>İptal</Btn>
          <Btn variant="primary" onClick={save} disabled={!title.trim() || !body.trim() || saving}>Yayınla</Btn>
        </div>
      </div>
    </Modal>
  );
}
