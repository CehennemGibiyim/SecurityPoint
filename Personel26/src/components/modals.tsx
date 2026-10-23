"use client";
import { useState, useEffect } from "react";
import { UserPlus, Check, Users, Pencil, Power, FileSignature, Plus } from "lucide-react";
import { Modal, Btn, Field, TextInput, cx } from "@/components/ui-kit";
import type { Department, Personnel, PersonnelType, StaffGroup } from "@/lib/shared";
import { staffGroupMeta, listStaffGroups, suggestedGroupForTitle, makeCustomGroup, cleanCustomLabel } from "@/lib/shared";
import { personnelInDepartment, PERSONNEL_TYPE_META, PERSONNEL_TYPE_ORDER, TITLE_SUGGESTIONS, cyclePersonnelType } from "@/lib/shared";

async function api(path: string, method: string, body: unknown) {
  const res = await fetch(path, {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "İşlem başarısız");
  return data;
}

// ═════════════════════════════════════════════════════════════
// Personel Ekle Modal
// ═════════════════════════════════════════════════════════════
export function AddPersonnelModal({ departments, defaultDeptId, defaultGroup = "SAGLIK", onAdded, onClose }: {
  departments: Department[]; defaultDeptId: string; defaultGroup?: StaffGroup;
  onAdded: (p: Personnel) => void; onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [tcNo, setTcNo] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PersonnelType>(defaultGroup === "DESTEK" ? "ISCI" : "MEMUR");
  const [group, setGroup] = useState<StaffGroup>(defaultGroup);
  const [groupTouched, setGroupTouched] = useState(false);
  const [deptIds, setDeptIds] = useState<string[]>([defaultDeptId]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!name.trim() || !deptIds.length) return;
    setSaving(true); setErr("");
    try {
      const data = await api("/api/personnel", "POST", {
        name, tcNo: tcNo || null, title: title || null, personnelType: type, staffGroup: group, departmentIds: deptIds,
      });
      onAdded(data.personnel);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally { setSaving(false); }
  }

  return (
    <Modal title={<><UserPlus className="w-4 h-4 text-sky-400" /> Personel Ekle</>} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Ad Soyad">
          <TextInput
            autoFocus value={name} placeholder="AD SOYAD"
            onChange={e => setName(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleSave()}
          />
        </Field>
        <Field label="TC Kimlik No (opsiyonel)" hint="TC no, personelin şifresiz sorgu ekranında (/personel) doğrulama için kullanılır.">
          <TextInput
            value={tcNo} placeholder="11 haneli TC no" inputMode="numeric"
            onChange={e => setTcNo(e.target.value.replace(/\D/g, "").slice(0, 11))}
          />
        </Field>
        <Field label="Ünvan (opsiyonel)" hint="Listeyi açarak seçebilir veya serbest yazabilirsiniz.">
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); const g = suggestedGroupForTitle(e.target.value); if (g && !groupTouched) setGroup(g); }}
            list="add-title-suggest"
            placeholder="Hemşire, Temizlik Personeli, Aşçı, Şoför…"
            className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70 placeholder:text-white/25"
          />
          <datalist id="add-title-suggest">
            {TITLE_SUGGESTIONS.map(t => <option key={t} value={t} />)}
          </datalist>
        </Field>
        <Field label="Departman">
          <div className="grid grid-cols-2 gap-2">
            {departments.map(d => (
              <label key={d.id} className="flex items-center gap-2 text-white/80 text-xs bg-white/5 hover:bg-white/[.08] rounded-lg px-2.5 py-2 cursor-pointer transition">
                <input
                  type="checkbox" checked={deptIds.includes(d.id)} className="accent-sky-400"
                  onChange={e => setDeptIds(prev => e.target.checked ? [...new Set([...prev, d.id])] : prev.filter(id => id !== d.id))}
                />
                {d.name}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Personel Grubu *" hint="Her grubun ayrı nöbet çizelgesi ve ayrı puantajı vardır.">
          <div className="grid grid-cols-2 gap-2">
            {listStaffGroups().map(g => (
              <button
                key={g} type="button" onClick={() => { setGroup(g); setGroupTouched(true); }}
                className={cx(
                  "py-2.5 rounded-xl border text-xs font-medium transition",
                  group === g ? staffGroupMeta(g).tab : "bg-white/5 border-white/15 text-white/50 hover:border-white/30"
                )}
              >
                <div className="text-xs font-bold mb-0.5">{staffGroupMeta(g).short}</div>
                <div className="text-[10px] opacity-70">{staffGroupMeta(g).desc}</div>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Personel Sınıfı">
          <div className="grid grid-cols-2 gap-2">
            {(["MEMUR", "ISCI"] as const).map(t => (
              <button
                key={t} onClick={() => setType(t)}
                className={cx(
                  "py-3 rounded-xl border text-xs font-medium transition",
                  type === t
                    ? t === "MEMUR" ? "bg-sky-500/25 border-sky-400/70 text-sky-200" : "bg-amber-500/25 border-amber-400/70 text-amber-200"
                    : "bg-white/5 border-white/15 text-white/50 hover:border-white/30"
                )}
              >
                <div className="text-sm font-bold mb-0.5">{t === "MEMUR" ? "Memur" : "İşçi"}</div>
                <div className="text-[10px] opacity-70">{t === "MEMUR" ? "40 saat / hafta" : "45 saat / hafta"}</div>
              </button>
            ))}
          </div>
        </Field>
        {err && <p className="text-rose-300 text-xs bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={onClose}>İptal</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={!name.trim() || !deptIds.length || saving}>
            <Check className="w-4 h-4" /> {saving ? "Kaydediliyor…" : "Ekle"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════
// Personel Yönetim Modal (düzenle / pasife al)
// ═════════════════════════════════════════════════════════════
export function PersonnelManageModal({ department, personnel, onChanged, onClose }: {
  department: Department; personnel: Personnel[]; onChanged: () => void; onClose: () => void;
}) {
  const [list, setList] = useState<Personnel[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTc, setEditTc] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/personnel");
      const data = await res.json();
      setList((data.personnel ?? []).filter((p: Personnel) => personnelInDepartment(p, department.id))
        .sort((a: Personnel, b: Personnel) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, "tr")));
    }
    load();
  }, [department.id]);

  async function toggleActive(p: Personnel) {
    await api("/api/personnel", "PATCH", { id: p.id, isActive: !p.isActive });
    setList(prev => prev.map(x => x.id === p.id ? { ...x, isActive: !x.isActive } : x));
    onChanged();
  }
  async function toggleType(p: Personnel) {
    const nt = p.personnelType === "ISCI" ? "MEMUR" : "ISCI";
    await api("/api/personnel", "PATCH", { id: p.id, personnelType: nt });
    setList(prev => prev.map(x => x.id === p.id ? { ...x, personnelType: nt } : x));
    onChanged();
  }
  function startEdit(p: Personnel) {
    setEditingId(p.id);
    setEditName(p.fullName || p.name);
    setEditTc(p.tcNo || "");
    setEditTitle(p.title || "");
  }
  async function saveEdit(p: Personnel) {
    const trimmed = editName.trim().toLocaleUpperCase("tr");
    if (!trimmed) { setEditingId(null); return; }
    setSaving(true);
    await api("/api/personnel", "PATCH", {
      id: p.id, name: trimmed, fullName: trimmed,
      tcNo: editTc.replace(/\D/g, "").slice(0, 11) || null,
      title: editTitle.trim() || null,
    });
    setSaving(false);
    setList(prev => prev.map(x => x.id === p.id ? { ...x, name: trimmed, fullName: trimmed, tcNo: editTc || null, title: editTitle || null } : x));
    setEditingId(null);
    onChanged();
  }

  return (
    <Modal wide title={<><Users className="w-4 h-4 text-sky-400" /> Personel Yönetimi — {department.name}</>} onClose={onClose}>
      <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
        {list.length === 0 && <p className="text-white/40 text-xs py-6 text-center">Bu departmanda personel yok.</p>}
        {list.map(p => (
          <div key={p.id} className={cx("flex items-center gap-2 rounded-xl border px-3 py-2 transition", p.isActive ? "bg-white/[.04] border-white/10" : "bg-white/[.02] border-white/5 opacity-50")}>
            {editingId === p.id ? (
              <div className="flex-1 grid grid-cols-3 gap-2">
                <TextInput autoFocus onFocus={e => e.target.select()} value={editName} onChange={e => setEditName(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && saveEdit(p)} />
                <TextInput value={editTc} placeholder="TC No" inputMode="numeric" onChange={e => setEditTc(e.target.value.replace(/\D/g, "").slice(0, 11))} onKeyDown={e => e.key === "Enter" && saveEdit(p)} />
                <TextInput value={editTitle} placeholder="Ünvan" onChange={e => setEditTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && saveEdit(p)} />
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">{p.name}</div>
                <div className="text-white/35 text-[11px] truncate">
                  {p.title || "Ünvan yok"}{p.tcNo ? ` · TC: ${p.tcNo}` : ""}
                </div>
              </div>
            )}
            <button onClick={() => toggleType(p)} title={`${PERSONNEL_TYPE_META[p.personnelType]?.label ?? p.personnelType} (${PERSONNEL_TYPE_META[p.personnelType]?.weekly ?? ""}/hf) — tıkla değiştir`}
              className={cx("text-[10px] font-bold px-1.5 py-1 rounded shrink-0 transition hover:opacity-70 border",
                PERSONNEL_TYPE_META[p.personnelType]?.badge ?? "bg-white/10 text-white/60 border-white/15")}>
              {PERSONNEL_TYPE_META[p.personnelType]?.upper ?? p.personnelType}
            </button>
            {editingId === p.id ? (
              <Btn small variant="success" onClick={() => saveEdit(p)} disabled={saving}><Check className="w-3.5 h-3.5" /></Btn>
            ) : (
              <Btn small onClick={() => startEdit(p)} title="Düzenle"><Pencil className="w-3.5 h-3.5" /></Btn>
            )}
            <Btn small variant={p.isActive ? "danger" : "success"} onClick={() => toggleActive(p)} title={p.isActive ? "Pasife al" : "Aktifleştir"}>
              <Power className="w-3.5 h-3.5" />
            </Btn>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════
// İmza Alanları Modal
// ═════════════════════════════════════════════════════════════
export function SignatureModal({ department, onSaved, onClose }: {
  department: Department; onSaved: (d: Department) => void; onClose: () => void;
}) {
  const [f, setF] = useState({
    sorumluHemsire: department.sorumluHemsire ?? "",
    hemsireUnvan: department.hemsireUnvan ?? "Sorumlu Hemşire",
    saglikBakimMuduru: department.saglikBakimMuduru ?? "",
    saglikBakimUnvan: department.saglikBakimUnvan ?? "Sağlık Bakım Hizmetleri Müdürü",
    bashekim: department.bashekim ?? "",
    bashekimUnvan: department.bashekimUnvan ?? "Başhekim",
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const data = await api("/api/departments", "PATCH", { id: department.id, ...f });
    onSaved(data.department);
    setSaving(false);
    onClose();
  }
  const rows: [keyof typeof f, keyof typeof f, string][] = [
    ["hemsireUnvan", "sorumluHemsire", "1. İmza"],
    ["saglikBakimUnvan", "saglikBakimMuduru", "2. İmza"],
    ["bashekimUnvan", "bashekim", "3. İmza"],
  ];
  return (
    <Modal title={<><FileSignature className="w-4 h-4 text-amber-400" /> İmza Alanları — {department.name}</>} onClose={onClose}>
      <div className="space-y-4">
        {rows.map(([unvanKey, nameKey, label]) => (
          <div key={label} className="grid grid-cols-[1fr_1.2fr] gap-2 items-end">
            <Field label={`${label} Ünvan`}>
              <TextInput value={f[unvanKey]} onChange={e => setF(p => ({ ...p, [unvanKey]: e.target.value }))} />
            </Field>
            <Field label="Ad Soyad">
              <TextInput value={f[nameKey]} onChange={e => setF(p => ({ ...p, [nameKey]: e.target.value.toUpperCase() }))} />
            </Field>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>İptal</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}><Check className="w-4 h-4" /> Kaydet</Btn>
        </div>
      </div>
    </Modal>
  );
}


const GROUP_SUGGESTIONS = ["Anestezi Teknikerleri", "Laboratuvar", "Güvenlik", "Radyoloji", "Hasta Karşılama", "Sekreter"];

/** "+ Özel" düğmesiyle açılan küçük panel: elle yeni nöbet grubu ekler. */
export function CustomGroupModal({ existing, onAdd, onClose }: {
  existing: StaffGroup[]; onAdd: (id: StaffGroup) => void; onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  function submit() {
    const id = makeCustomGroup(name);
    if (!id) { setErr("Grup adı en az 2 karakter olmalıdır."); return; }
    onAdd(id);
    onClose();
  }
  const preview = cleanCustomLabel(name);
  const dup = existing.some(g => staffGroupMeta(g).label.toLocaleLowerCase("tr") === preview.toLocaleLowerCase("tr"));
  return (
    <Modal title={<><Plus className="w-4 h-4 text-rose-400" /> Özel Nöbet Grubu Ekle</>} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Grup adı">
          <TextInput
            value={name}
            autoFocus
            maxLength={30}
            placeholder="örn. Anestezi Teknikerleri"
            onChange={e => { setName(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && submit()}
          />
        </Field>
        <div>
          <div className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1.5">Hızlı seçim</div>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_SUGGESTIONS.map(t => (
              <button key={t} type="button" onClick={() => { setName(t); setErr(""); }}
                className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/[.04] text-white/60 hover:text-white hover:border-white/30 text-[11px] font-semibold transition cursor-pointer">
                {t}
              </button>
            ))}
          </div>
        </div>
        {dup && <p className="text-amber-300/90 text-[11px]">Bu adla bir grup zaten var; ekleyince o gruba geçilir.</p>}
        {err && <p className="text-rose-300 text-[11px]" role="alert">{err}</p>}
        <p className="text-white/35 text-[11px] leading-relaxed">
          Grup, sekmelerin yanında kendi nöbet çizelgesi ve puantajıyla açılır. Personeli Personel Yönetimi'nden bu gruba atarsınız.
        </p>
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>İptal</Btn>
          <Btn variant="primary" onClick={submit}><Check className="w-4 h-4" /> Ekle</Btn>
        </div>
      </div>
    </Modal>
  );
}
