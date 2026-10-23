"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Users, Search, Plus, Pencil, Power, Trash2, Phone, Mail,
  FileSpreadsheet, RefreshCw, UserRound, CalendarDays, AlertCircle,
  FileText, Building2, Check, X, Camera, Upload, ImageOff,
} from "lucide-react";
import {
  type Department, type Personnel, type PersonnelType,
  PERSONNEL_TYPE_META, PERSONNEL_TYPE_ORDER, TITLE_SUGGESTIONS, cyclePersonnelType, fmtTr,
} from "@/lib/shared";
import { staffGroupMeta, listStaffGroups, staffGroupOf, suggestedGroupForTitle, type StaffGroup } from "@/lib/shared";
import { Btn, Modal, Field, TextInput, SelectInput, TextArea, Badge, Spinner, EmptyState, Avatar, cx } from "@/components/ui-kit";
import { downloadFromApi } from "@/lib/download";
import { useAvatarSrc } from "@/components/avatar-src";

import PersonnelImport from "@/components/PersonnelImport";
import type { AppSettings } from "@/lib/settings";
import { fileToSquareDataUrl } from "@/lib/image-resize";

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "İşlem başarısız");
  return data;
}





export default function PersonnelPage({
  departments, selectedDept, onPersonnelChanged,
}: {
  departments: Department[]; selectedDept: string;
  onPersonnelChanged: () => Promise<void> | void;
}) {
  const [list, setList] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [maskTc, setMaskTc] = useState(true);
  useEffect(() => {
    try { const stored = localStorage.getItem("p26-settings"); if (stored) setMaskTc(JSON.parse(stored).maskTc !== false); } catch {}
    const listener = (event: Event) => setMaskTc((event as CustomEvent<AppSettings>).detail.maskTc);
    window.addEventListener("p26-settings", listener);
    return () => window.removeEventListener("p26-settings", listener);
  }, []);
  const [editing, setEditing] = useState<Personnel | null>(null);
  const [detail, setDetail] = useState<Personnel | null>(null);
  const [err, setErr] = useState("");

  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/personnel", { cache: "no-store" });
      const data = await res.json();
      setList((data.personnel ?? []).sort((a: Personnel, b: Personnel) =>
        Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, "tr")));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yüklenemedi");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function refreshAll() {
    await load();
    await onPersonnelChanged();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return list.filter(p => {
      if (deptFilter !== "ALL" && !(p.departmentId === deptFilter || p.departmentIds.includes(deptFilter))) return false;
      if (typeFilter !== "ALL" && p.personnelType !== typeFilter) return false;
      if (groupFilter !== "ALL" && staffGroupOf(p) !== groupFilter) return false;
      if (statusFilter === "ACTIVE" && !p.isActive) return false;
      if (statusFilter === "PASSIVE" && p.isActive) return false;
      if (q && !(p.name.toLocaleLowerCase("tr").includes(q) || (p.title ?? "").toLocaleLowerCase("tr").includes(q) || (p.tcNo ?? "").includes(q))) return false;
      return true;
    });
  }, [list, query, deptFilter, typeFilter, groupFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = list.filter(p => p.isActive);
    const byType: Record<string, number> = { MEMUR: 0, ISCI: 0, HEMSIRE: 0 };
    active.forEach(p => { byType[p.personnelType] = (byType[p.personnelType] ?? 0) + 1; });
    return { total: list.length, active: active.length, passive: list.length - active.length, byType };
    // (grup sayıları listede rozetlerle görünür)
  }, [list]);

  async function toggleActive(p: Personnel) {
    await api("/api/personnel", "PATCH", { id: p.id, isActive: !p.isActive });
    await refreshAll();
  }
  async function toggleGroup(p: Personnel) {
    // Gruplar arasında sırayla geçer: Hemşire → Temizlik → Teknisyen → (özel gruplar) → Hemşire
    const groups = listStaffGroups(list);
    const next: StaffGroup = groups[(Math.max(0, groups.indexOf(staffGroupOf(p))) + 1) % groups.length];
    if (!confirm(`"${p.name}" ${staffGroupMeta(next).label} grubuna taşınsın mı?\n\nBundan sonra bu grubun nöbet çizelgesi ve puantajında yer alır.`)) return;
    await api("/api/personnel", "PATCH", { id: p.id, staffGroup: next });
    await refreshAll();
  }
  async function cycleType(p: Personnel) {
    const nt = cyclePersonnelType(p.personnelType);
    await api("/api/personnel", "PATCH", { id: p.id, personnelType: nt });
    await refreshAll();
  }
  async function hardDelete(p: Personnel) {
    if (!confirm(`"${p.name}" kalıcı olarak silinsin mi?\n\nBu işlem geri alınamaz; personelin nöbet, puantaj ve izin kayıtları da silinir.\n\nGeçmişi korumak için bunun yerine "Pasife al" kullanmanız önerilir.`)) return;
    await api("/api/personnel", "DELETE", { id: p.id, hard: true });
    await refreshAll();
  }

  function exportExcel() {
    const params = new URLSearchParams({ dept: deptFilter, type: typeFilter, status: statusFilter, q: query.trim() });
    // Statik (GitHub Pages) sürümde de çalışması için fetch + blob ile indirilir.
    void downloadFromApi(`/api/export/personel?${params.toString()}`, "personel_listesi.xlsx")
      .catch(e => alert(e instanceof Error ? e.message : "İndirme başarısız"));
  }

  const hasFilter = query.trim() !== "" || deptFilter !== "ALL" || typeFilter !== "ALL" || groupFilter !== "ALL" || statusFilter !== "ALL";
  function clearFilters() {
    setQuery(""); setDeptFilter("ALL"); setTypeFilter("ALL"); setGroupFilter("ALL"); setStatusFilter("ALL");
  }

  return (
    <div className="space-y-3">
      {showImport && <Modal wide title="Excel / CSV’den toplu personel aktarımı" icon={<Upload className="w-4 h-4" />} onClose={() => setShowImport(false)}><PersonnelImport departments={departments} onDone={refreshAll} /></Modal>}
      {/* Başlık */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-grotesk)" }}>
          <Users className="w-4 h-4 text-sky-400" /> Personel Yönetim Sistemi
        </h2>
        <div className="flex-1" />
        <Btn small onClick={() => load()} title="Yenile"><RefreshCw className="w-3.5 h-3.5" /></Btn>
        <Btn small variant="success" onClick={exportExcel} title="Listelenen personeli Excel olarak indir"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</Btn>
        <Btn small onClick={() => setShowImport(true)}><Upload className="w-3.5 h-3.5" /> Excel / CSV Aktar</Btn>
        <Btn small variant="primary" onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5" /> Yeni Personel</Btn>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          ["Toplam", String(stats.total), "text-white"],
          ["Aktif", String(stats.active), "text-emerald-300"],
          ["Pasif", String(stats.passive), "text-white/40"],
          ["Memur", String(stats.byType.MEMUR ?? 0), "text-sky-300"],
          ["İşçi", String(stats.byType.ISCI ?? 0), "text-amber-300"],
          ["Hemşire", String(stats.byType.HEMSIRE ?? 0), "text-emerald-300"],
        ].map(([label, val, cls]) => (
          <div key={label} className="panel !rounded-xl px-3 py-2 text-center">
            <div className={cx("text-base font-black", cls)} style={{ fontFamily: "var(--font-grotesk)" }}>{val}</div>
            <div className="text-white/35 text-[10px] uppercase tracking-wider font-bold">{label}</div>
          </div>
        ))}
      </div>

      {/* Filtreler */}
      <div className="panel p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="İsim, ünvan veya TC ara…"
            className="w-full bg-white/[.06] border border-white/12 rounded-lg pl-8 pr-3 py-2 text-white text-xs outline-none focus:border-sky-400/60 placeholder:text-white/25"
          />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="bg-white/[.06] border border-white/12 rounded-lg px-2.5 py-2 text-white text-xs font-semibold outline-none focus:border-sky-400/60 [&>option]:bg-slate-900">
          <option value="ALL">Tüm Departmanlar</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-white/[.06] border border-white/12 rounded-lg px-2.5 py-2 text-white text-xs font-semibold outline-none focus:border-sky-400/60 [&>option]:bg-slate-900">
          <option value="ALL">Tüm Sınıflar</option>
          {PERSONNEL_TYPE_ORDER.map(t => <option key={t} value={t}>{PERSONNEL_TYPE_META[t].label}</option>)}
        </select>
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
          className="bg-white/[.06] border border-white/12 rounded-lg px-2.5 py-2 text-white text-xs font-semibold outline-none focus:border-sky-400/60 [&>option]:bg-slate-900">
          <option value="ALL">Tüm Gruplar</option>
          {listStaffGroups(list).map(g => <option key={g} value={g}>{staffGroupMeta(g).label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-white/[.06] border border-white/12 rounded-lg px-2.5 py-2 text-white text-xs font-semibold outline-none focus:border-sky-400/60 [&>option]:bg-slate-900">
          <option value="ALL">Aktif + Pasif</option>
          <option value="ACTIVE">Yalnızca Aktif</option>
          <option value="PASSIVE">Yalnızca Pasif</option>
        </select>
        {hasFilter && (
          <button onClick={clearFilters} className="text-white/40 hover:text-white text-xs font-semibold transition flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Temizle
          </button>
        )}
        <span className="text-white/35 text-xs ml-auto">{filtered.length} / {list.length} personel</span>
      </div>

      {err && <div className="bg-rose-500/10 border border-rose-500/40 text-rose-200 text-xs rounded-xl px-4 py-2.5">{err}</div>}

      {/* Liste */}
      {loading ? <Spinner label="Personel yükleniyor…" /> : filtered.length === 0 ? (
        <EmptyState icon={<Users className="w-8 h-8" />} title="Personel bulunamadı" desc={hasFilter ? "Filtrelere uyan kayıt yok." : "Henüz personel eklenmemiş."} />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-white/10 text-white/45 text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Personel</th>
                  <th className="text-left px-2 py-2.5">Sınıf</th>
                  <th className="text-left px-2 py-2.5">Departmanlar</th>
                  <th className="text-left px-2 py-2.5">İletişim</th>
                  <th className="text-center px-2 py-2.5">Yıllık / Rapor</th>
                  <th className="text-center px-2 py-2.5">Durum</th>
                  <th className="text-right px-4 py-2.5">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const meta = PERSONNEL_TYPE_META[p.personnelType] ?? PERSONNEL_TYPE_META.MEMUR;
                  return (
                    <tr key={p.id} className={cx("border-b border-white/5 hover:bg-white/[.03] transition", !p.isActive && "opacity-45")}>
                      <td className="px-4 py-2">
                        <button onClick={() => setDetail(p)} className="flex items-center gap-2.5 text-left group">
                          <Avatar person={p} size={36} className="group-hover:ring-2 group-hover:ring-sky-400/40 transition" />
                          <span className="min-w-0">
                            <span className="block text-white font-bold text-xs truncate group-hover:text-sky-300 transition">{p.name}</span>
                            <span className="block text-white/35 text-[11px] truncate">{p.title ?? "—"}{p.tcNo ? ` · ${maskTc ? "•••••••" + p.tcNo.slice(-4) : p.tcNo}` : ""}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => cycleType(p)} title={`${meta.label} (${meta.weekly}/hf) — tıkla değiştir: ${PERSONNEL_TYPE_META[cyclePersonnelType(p.personnelType)].label}`}>
                          <Badge className={cx(meta.badge, "hover:brightness-125 transition cursor-pointer")}>{meta.upper}</Badge>
                        </button>
                        <button onClick={() => toggleGroup(p)} title={`${staffGroupMeta(staffGroupOf(p)).label} — tıkla: sıradaki gruba taşı`} className="block mt-1">
                          <Badge className={cx(staffGroupMeta(staffGroupOf(p)).badge, "hover:brightness-125 transition cursor-pointer")}>{staffGroupMeta(staffGroupOf(p)).short.replace(" ", "")}</Badge>
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {p.departmentIds.map(id => (
                            <span key={id} className={cx(
                              "text-[10px] font-semibold rounded-md px-1.5 py-0.5 border whitespace-nowrap",
                              id === p.departmentId
                                ? "bg-sky-500/15 text-sky-200 border-sky-500/40"
                                : "bg-white/[.05] text-white/55 border-white/10"
                            )} title={id === p.departmentId ? "Ana departman" : "Görevli departman"}>
                              {id === p.departmentId ? "★ " : ""}{deptMap.get(id) ?? "?"}
                            </span>
                          ))}
                          {p.departmentIds.length === 0 && <span className="text-white/25 text-[11px]">—</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="text-[11px] text-white/60 space-y-0.5">
                          {p.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-white/25" />{p.phone}</div>}
                          {p.email && <div className="flex items-center gap-1.5 truncate max-w-[180px]"><Mail className="w-3 h-3 text-white/25" />{p.email}</div>}
                          {!p.phone && !p.email && <span className="text-white/25">—</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center text-xs font-bold whitespace-nowrap">
                        <span className="text-emerald-300">{p.annualLeaveBalance ?? "—"}</span>
                        <span className="text-white/25 mx-1">/</span>
                        <span className="text-rose-300">{p.sickLeaveBalance ?? "—"}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Badge className={p.isActive ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-white/[.06] text-white/40 border-white/15"}>
                          {p.isActive ? "Aktif" : "Pasif"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <Btn small onClick={() => setEditing(p)} title="Düzenle"><Pencil className="w-3.5 h-3.5" /></Btn>
                          <Btn small variant={p.isActive ? "amber" : "success"} onClick={() => toggleActive(p)} title={p.isActive ? "Pasife al (geçmiş korunur)" : "Aktifleştir"}>
                            <Power className="w-3.5 h-3.5" />
                          </Btn>
                          <Btn small variant="danger" onClick={() => hardDelete(p)} title="Kalıcı sil"><Trash2 className="w-3.5 h-3.5" /></Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-white/30 text-[11px] flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" />
        Sınıf rozetine tıklayarak Memur → İşçi → Hemşire arasında hızlı geçiş yapabilirsiniz.
        ★ işaretli departman ana departmandır. Pasife alınan personel listelerden gizlenir ancak geçmiş kayıtları korunur.
      </p>

      {/* Ekle / Düzenle */}
      {showAdd && (
        <PersonnelFormModal
          departments={departments}
          defaultDeptId={selectedDept}
          initial={null}
          onClose={() => setShowAdd(false)}
          onSaved={async () => { setShowAdd(false); await refreshAll(); }}
        />
      )}
      {editing && (
        <PersonnelFormModal
          departments={departments}
          defaultDeptId={selectedDept}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refreshAll(); }}
        />
      )}

      {/* Detay */}
      {detail && (
        <Modal title={<><UserRound className="w-4 h-4 text-sky-400" /> {detail.name}</>} onClose={() => setDetail(null)}>
          <div className="space-y-3 text-xs">
            <div className="flex justify-center pb-1">
              <Avatar person={detail} size={104} className="!rounded-2xl" ring />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={(PERSONNEL_TYPE_META[detail.personnelType] ?? PERSONNEL_TYPE_META.MEMUR).badge}>
                {(PERSONNEL_TYPE_META[detail.personnelType] ?? PERSONNEL_TYPE_META.MEMUR).label}
              </Badge>
              <Badge className={detail.isActive ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-white/[.06] text-white/40 border-white/15"}>
                {detail.isActive ? "Aktif" : "Pasif"}
              </Badge>
            </div>
            <InfoRow icon={<UserRound className="w-3.5 h-3.5" />} label="Ünvan" value={detail.title ?? "—"} />
            <InfoRow icon={<FileText className="w-3.5 h-3.5" />} label="TC Kimlik No" value={detail.tcNo ?? "—"} />
            <InfoRow icon={<Building2 className="w-3.5 h-3.5" />} label="Departmanlar" value={
              detail.departmentIds.length
                ? detail.departmentIds.map(id => `${id === detail.departmentId ? "★ " : ""}${deptMap.get(id) ?? "?"}`).join(", ")
                : "—"
            } />
            <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Telefon" value={detail.phone ?? "—"} />
            <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="E-posta" value={detail.email ?? "—"} />
            <InfoRow icon={<AlertCircle className="w-3.5 h-3.5" />} label="Acil Durum" value={detail.emergencyContact ?? "—"} />
            <InfoRow icon={<CalendarDays className="w-3.5 h-3.5" />} label="İşe Başlama" value={detail.startDate ? fmtTr(detail.startDate) : "—"} />
            {detail.address && <InfoRow icon={<FileText className="w-3.5 h-3.5" />} label="Adres" value={detail.address} />}
            {detail.notes && <InfoRow icon={<FileText className="w-3.5 h-3.5" />} label="Notlar" value={detail.notes} />}
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[
                ["Yıllık İzin", detail.annualLeaveBalance, "text-emerald-300"],
                ["Rapor Hakkı", detail.sickLeaveBalance, "text-rose-300"],
                ["Ücretsiz", detail.unpaidLeaveBalance, "text-amber-300"],
              ].map(([label, val, cls]) => (
                <div key={label as string} className="bg-white/[.04] border border-white/10 rounded-lg py-2 text-center">
                  <div className={cx("text-sm font-bold", cls as string)}>{val ?? "—"}</div>
                  <div className="text-[9.5px] text-white/35">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setDetail(null)}>Kapat</Btn>
              <Btn variant="primary" onClick={() => { setEditing(detail); setDetail(null); }}><Pencil className="w-3.5 h-3.5" /> Düzenle</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-white/30 mt-0.5">{icon}</span>
      <span className="text-white/45 text-xs w-28 shrink-0">{label}</span>
      <span className="text-white/85">{value}</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Personel Ekle / Düzenle Formu
// ═════════════════════════════════════════════════════════════
function PersonnelFormModal({ departments, defaultDeptId, initial, onClose, onSaved }: {
  departments: Department[]; defaultDeptId: string;
  initial: Personnel | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.fullName || initial?.name || "");
  const [tcNo, setTcNo] = useState(initial?.tcNo || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [group, setGroup] = useState<StaffGroup>(initial ? staffGroupOf(initial) : "SAGLIK");
  const [groupTouched, setGroupTouched] = useState(Boolean(initial));
  const [type, setType] = useState<PersonnelType>(
    initial && (initial.personnelType === "ISCI" || initial.personnelType === "MEMUR" || initial.personnelType === "HEMSIRE")
      ? initial.personnelType : "MEMUR"
  );
  const [deptIds, setDeptIds] = useState<string[]>(
    initial && initial.departmentIds.length ? initial.departmentIds : (defaultDeptId ? [defaultDeptId] : [])
  );
  const [primaryDept, setPrimaryDept] = useState<string>(
    initial?.departmentId || defaultDeptId || ""
  );
  const [phone, setPhone] = useState(initial?.phone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [emergency, setEmergency] = useState(initial?.emergencyContact || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [startDate, setStartDate] = useState(initial?.startDate || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [annual, setAnnual] = useState(initial?.annualLeaveBalance ?? "");
  const [sick, setSick] = useState(initial?.sickLeaveBalance ?? "");
  const [unpaid, setUnpaid] = useState(initial?.unpaidLeaveBalance ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // Profil fotoğrafı: undefined = değişiklik yok, null = kaldır, string = yeni data URL
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Sunuculu sürümde API adresi, statik sürümde tarayıcı veritabanından blob adresi.
  const existingSrc = useAvatarSrc(initial ?? { id: "new" });
  const previewSrc = avatar === undefined ? existingSrc : avatar;

  async function pickAvatar(file: File | undefined) {
    if (!file) return;
    setAvatarBusy(true); setErr("");
    try {
      setAvatar(await fileToSquareDataUrl(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fotoğraf yüklenemedi");
    } finally { setAvatarBusy(false); }
  }

  function toggleDept(id: string, checked: boolean) {
    setDeptIds(prev => {
      const next = checked ? [...new Set([...prev, id])] : prev.filter(x => x !== id);
      if (!next.includes(primaryDept)) setPrimaryDept(next[0] || "");
      return next;
    });
  }

  async function save() {
    if (!name.trim()) { setErr("Ad Soyad gerekli."); return; }
    if (!deptIds.length) { setErr("En az bir departman seçin."); return; }
    if (tcNo && tcNo.length !== 11) { setErr("TC Kimlik No 11 haneli olmalıdır (veya boş bırakın)."); return; }
    setSaving(true); setErr("");
    const numOrNull = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));
    try {
      if (initial) {
        await api("/api/personnel", "PATCH", {
          id: initial.id,
          name: name.trim(), fullName: name.trim(),
          tcNo: tcNo || null, title: title.trim() || null, personnelType: type, staffGroup: group,
          departmentIds: deptIds, departmentId: primaryDept || deptIds[0],
          phone: phone.trim() || null, email: email.trim() || null,
          emergencyContact: emergency.trim() || null, address: address.trim() || null,
          startDate: startDate || null, notes: notes.trim() || null,
          annualLeaveBalance: numOrNull(annual), sickLeaveBalance: numOrNull(sick),
          unpaidLeaveBalance: numOrNull(unpaid), isActive,
          ...(avatar === undefined ? {} : { avatar }),
        });
      } else {
        await api("/api/personnel", "POST", {
          name: name.trim(), tcNo: tcNo || null, title: title.trim() || null, personnelType: type, staffGroup: group,
          departmentIds: deptIds, departmentId: primaryDept || deptIds[0],
          phone: phone.trim() || null, email: email.trim() || null,
          emergencyContact: emergency.trim() || null, address: address.trim() || null,
          startDate: startDate || null, notes: notes.trim() || null,
          annualLeaveBalance: annual === "" ? undefined : Number(annual),
          sickLeaveBalance: sick === "" ? undefined : Number(sick),
          unpaidLeaveBalance: unpaid === "" ? undefined : Number(unpaid),
          ...(avatar ? { avatar } : {}),
        });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kaydedilemedi");
      setSaving(false);
    }
  }

  return (
    <Modal wide title={<><UserRound className="w-4 h-4 text-sky-400" /> {initial ? "Personel Düzenle" : "Yeni Personel"}</>} onClose={onClose}>
      <div className="space-y-4">
        {/* Profil fotoğrafı */}
        <div className="flex items-center gap-4 bg-white/[.03] border border-white/10 rounded-xl p-3">
          <span className="relative shrink-0">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc} alt="Profil fotoğrafı" width={80} height={80}
                className="w-20 h-20 rounded-2xl object-cover border border-white/15" />
            ) : (
              <span className="w-20 h-20 rounded-2xl border border-white/15 bg-gradient-to-br from-sky-500/25 to-violet-500/25 flex items-center justify-center text-white font-bold text-base">
                {name ? name.split(/\s+/).filter(Boolean).map(x => x[0]).join("").slice(0, 2) : <Camera className="w-6 h-6 opacity-60" />}
              </span>
            )}
            {avatarBusy && <span className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center text-[10px] text-white">İşleniyor…</span>}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-white text-xs font-semibold mb-1">Profil Fotoğrafı</div>
            <p className="text-white/35 text-[11px] mb-2">JPG, PNG veya WEBP. Otomatik olarak kare kırpılıp 256px&apos;e küçültülür.</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-400/30 bg-sky-500/15 text-sky-200 text-xs font-semibold cursor-pointer hover:bg-sky-500/25 transition">
                <Upload className="w-3.5 h-3.5" /> {previewSrc ? "Değiştir" : "Fotoğraf Seç"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => { pickAvatar(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {previewSrc && (
                <button type="button" onClick={() => setAvatar(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 bg-white/5 text-white/60 hover:text-rose-300 text-xs font-semibold transition">
                  <ImageOff className="w-3.5 h-3.5" /> Kaldır
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Ad Soyad *">
            <TextInput autoFocus value={name} placeholder="AD SOYAD"
              onChange={e => setName(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && save()} />
          </Field>
          <Field label="TC Kimlik No" hint="/personel sorgu ekranında doğrulama için kullanılır.">
            <TextInput value={tcNo} placeholder="11 haneli (opsiyonel)" inputMode="numeric"
              onChange={e => setTcNo(e.target.value.replace(/\D/g, "").slice(0, 11))} />
          </Field>
        </div>

        <Field label="Ünvan">
          <input
            value={title} onChange={e => { setTitle(e.target.value); const g = suggestedGroupForTitle(e.target.value); if (g && !groupTouched) setGroup(g); }} list="title-suggest" placeholder="Hemşire, Temizlik Personeli, Aşçı, Şoför…"
            className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70 placeholder:text-white/25"
          />
          <datalist id="title-suggest">
            {TITLE_SUGGESTIONS.map(t => <option key={t} value={t} />)}
          </datalist>
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
        <Field label="Personel Sınıfı *" hint="İşçi: 45s/hf + mola düşümü · Memur/Hemşire: 40s/hf. Puantaj ve limit hesapları bu seçime göre yapılır.">
          <div className="grid grid-cols-3 gap-2">
            {PERSONNEL_TYPE_ORDER.map(t => (
              <button
                key={t} onClick={() => setType(t)}
                className={cx(
                  "py-2.5 rounded-xl border text-xs font-medium transition",
                  type === t ? PERSONNEL_TYPE_META[t].card : "bg-white/5 border-white/15 text-white/50 hover:border-white/30"
                )}
              >
                <div className="text-xs font-bold mb-0.5">{PERSONNEL_TYPE_META[t].label}</div>
                <div className="text-[10px] opacity-70">{PERSONNEL_TYPE_META[t].desc}</div>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Departmanlar *" hint="Birden fazla departmana atanabilir. Yıldızlı (★) departman ana departmandır.">
          <div className="grid sm:grid-cols-2 gap-2">
            {departments.map(d => (
              <label key={d.id} className={cx(
                "flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 cursor-pointer transition border",
                deptIds.includes(d.id)
                  ? "bg-sky-500/10 border-sky-500/40 text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:border-white/25"
              )}>
                <input type="checkbox" checked={deptIds.includes(d.id)} className="accent-sky-400"
                  onChange={e => toggleDept(d.id, e.target.checked)} />
                <span className="flex-1">{d.name}</span>
                {deptIds.includes(d.id) && (
                  <button
                    type="button" title="Ana departman yap"
                    onClick={e => { e.preventDefault(); setPrimaryDept(d.id); }}
                    className={cx("text-xs transition", primaryDept === d.id ? "text-amber-300" : "text-white/20 hover:text-amber-200")}
                  >★</button>
                )}
              </label>
            ))}
          </div>
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Telefon">
            <TextInput value={phone} placeholder="05__ ___ __ __" onChange={e => setPhone(e.target.value)} />
          </Field>
          <Field label="E-posta">
            <TextInput value={email} placeholder="ornek@hastane.gov.tr" onChange={e => setEmail(e.target.value)} />
          </Field>
          <Field label="Acil Durum Kişisi">
            <TextInput value={emergency} placeholder="Ad Soyad — Telefon" onChange={e => setEmergency(e.target.value)} />
          </Field>
          <Field label="İşe Başlama Tarihi">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70" />
          </Field>
        </div>

        <Field label="Adres">
          <TextInput value={address} placeholder="Açık adres (opsiyonel)" onChange={e => setAddress(e.target.value)} />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Yıllık İzin Hakkı">
            <input type="number" min={0} value={annual} placeholder={type === "ISCI" ? "14" : "20"}
              onChange={e => setAnnual(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70" />
          </Field>
          <Field label="Rapor Hakkı">
            <input type="number" min={0} value={sick} placeholder="30"
              onChange={e => setSick(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70" />
          </Field>
          <Field label="Ücretsiz İzin">
            <input type="number" min={0} value={unpaid} placeholder="0"
              onChange={e => setUnpaid(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70" />
          </Field>
        </div>

        <Field label="Notlar">
          <TextArea value={notes} placeholder="Opsiyonel notlar…" onChange={e => setNotes(e.target.value)} />
        </Field>

        {initial && (
          <Field label="Durum">
            <label className="flex items-center gap-2 text-white/75 text-xs bg-white/5 rounded-lg px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-emerald-400" />
              Aktif {isActive ? "" : "(pasif personel listelerden gizlenir, geçmiş korunur)"}
            </label>
          </Field>
        )}

        {err && <p className="text-rose-300 text-xs bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>İptal</Btn>
          <Btn variant="primary" onClick={save} disabled={!name.trim() || !deptIds.length || saving}>
            <Check className="w-4 h-4" /> {saving ? "Kaydediliyor…" : initial ? "Güncelle" : "Ekle"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
