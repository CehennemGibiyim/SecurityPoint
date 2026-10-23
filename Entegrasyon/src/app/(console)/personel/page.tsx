"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  ScanFace,
  Search,
  Sparkles,
} from "lucide-react";
import { BiometricStudioModal } from "@/components/biometric-studio";
import { CameraField } from "@/components/camera-field";
import { Avatar, Badge, Button, Field, PageHeader, cn, inputClass } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";
import type { EmployeePublic } from "@/lib/types";

type Dept = { id: number; name: string; color: string };
type Shift = { id: number; name: string };

export default function PersonelPage() {
  const [people, setPeople] = useState<EmployeePublic[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<number | "all">("all");
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [activeStudioEmployee, setActiveStudioEmployee] = useState<EmployeePublic | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const [form, setForm] = useState({
    employeeNo: "",
    firstName: "",
    lastName: "",
    tcNo: "",
    title: "",
    email: "",
    phone: "",
    departmentId: "",
    shiftId: "",
    personnelType: "MEMUR",
    staffGroup: "SAGLIK",
  });

  async function load() {
    const [emp, dep, sh] = await Promise.all([
      jsonFetch<{ items: EmployeePublic[] }>("/api/employees"),
      jsonFetch<{ items: Dept[] }>("/api/face/departments"),
      jsonFetch<{ items: Shift[] }>("/api/shifts"),
    ]);
    setPeople(emp.items);
    setDepartments(dep.items);
    setShifts(sh.items);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    return people.filter((person) => {
      const blob = `${person.firstName} ${person.lastName} ${person.employeeNo} ${person.title}`.toLowerCase();
      const okQ = blob.includes(q.toLowerCase());
      const okD = dept === "all" || person.departmentId === dept;
      return okQ && okD;
    });
  }, [people, q, dept]);

  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSyncBothWays() {
    setSyncing(true);
    setSyncNotice(null);
    try {
      const res = await jsonFetch<{ faceCount: number; p26Count: number }>("/api/sync-personnel", {
        method: "POST",
      });
      await load();
      setSyncNotice(
        `Kadro eşitlendi (${res.faceCount} Face kartı · ${res.p26Count} Puantaj26 personeli).`,
      );
      setTimeout(() => setSyncNotice(null), 5000);
    } finally {
      setSyncing(false);
    }
  }

  async function createEmployee(openStudioImmediately = false) {
    setFormError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError("Ad ve soyad zorunludur.");
      return;
    }
    let sicil = form.employeeNo.trim();
    if (!sicil) {
      const maxNum = people.reduce((m, p) => {
        const n = Number(p.employeeNo.replace(/\D/g, ""));
        return Number.isFinite(n) ? Math.max(m, n) : m;
      }, 1000);
      sicil = `ORN-${maxNum + 1}`;
    }
    setSaving(true);
    try {
      const payload = {
        employeeNo: sicil,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        tcNo: form.tcNo.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        title: form.title.trim() || undefined,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        shiftId: form.shiftId ? Number(form.shiftId) : null,
        personnelType: form.personnelType,
        staffGroup: form.staffGroup,
        photoUrl: photo ?? undefined,
      };
      const res = await jsonFetch<{ item: EmployeePublic & { id: number } }>("/api/employees", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const detailed = await jsonFetch<{ item: EmployeePublic }>(`/api/employees/${res.item.id}`);
      const emp = detailed.item ?? (res.item as unknown as EmployeePublic);
      setOpen(false);
      setForm({
        employeeNo: "",
        firstName: "",
        lastName: "",
        tcNo: "",
        title: "",
        email: "",
        phone: "",
        departmentId: "",
        shiftId: "",
        personnelType: "MEMUR",
        staffGroup: "SAGLIK",
      });
      setPhoto(null);
      await load();
      if (openStudioImmediately) {
        setActiveStudioEmployee(emp);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Kadro & Biyometri"
        title="Personel kartları"
        description="Sicil, birim, vardiya ve yüksek yoğunluklu yüz şablonu. Oluşturulan her personel kartı otomatik olarak resmi Puantaj26 sistemine de aktarılır."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button tone="ghost" onClick={() => void handleSyncBothWays()} disabled={syncing}>
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "Eşitleniyor…" : "Puantaj26 Kadro Eşitle"}
            </Button>
            <Button onClick={() => setOpen((v) => !v)}>
              <Plus className="h-4 w-4" />
              Yeni personel
            </Button>
          </div>
        }
      />

      {syncNotice ? (
        <div className="mb-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
          {syncNotice}
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            className={cn(inputClass, "pl-9")}
            placeholder="Ad, sicil veya unvan ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className={cn(inputClass, "md:w-60")}
          value={dept}
          onChange={(e) => setDept(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="all">Tüm birimler</option>
          {departments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {open ? (
        <div className="orion-card mb-6 grid gap-3 rounded-3xl p-5 md:grid-cols-4">
          <div className="md:col-span-4 mb-2 flex items-center justify-between border-b border-white/8 pb-3">
            <div>
              <h3 className="font-semibold text-white">Yeni Personel Kartı Aç (Face + Puantaj26 Ortak Kayıt)</h3>
              <p className="text-xs text-slate-400">
                Temel bilgileri girin, ardından doğrudan Biyometrik Stüdyo ile canlılık taramasını başlatın. Kayıt otomatik olarak Puantaj26 cetvellerine de işlenir.
              </p>
            </div>
          </div>
          <Field label="Sicil (boşsa otomatik)">
            <input
              className={inputClass}
              value={form.employeeNo}
              onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
              placeholder="ORN-1013"
            />
          </Field>
          <Field label="Ad *">
            <input
              className={inputClass}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Örn. Ayşe"
            />
          </Field>
          <Field label="Soyad *">
            <input
              className={inputClass}
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Örn. Yılmaz"
            />
          </Field>
          <Field label="TC Kimlik No (Sorgu & Bordro)">
            <input
              className={inputClass}
              maxLength={11}
              value={form.tcNo}
              onChange={(e) => setForm({ ...form, tcNo: e.target.value.replace(/\D/g, "") })}
              placeholder="11 haneli TC No"
            />
          </Field>
          <Field label="Unvan">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Örn. Hemşire / Teknisyen"
            />
          </Field>
          <Field label="E-posta">
            <input
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ayse@orion.tr"
            />
          </Field>
          <Field label="Telefon">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="05xx ..."
            />
          </Field>
          <Field label="Birim / Servis">
            <select
              className={inputClass}
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">Seçin</option>
              {departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="PDKS Vardiyası">
            <select
              className={inputClass}
              value={form.shiftId}
              onChange={(e) => setForm({ ...form, shiftId: e.target.value })}
            >
              <option value="">Seçin</option>
              {shifts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Puantaj26 Statüsü">
            <select
              className={inputClass}
              value={form.personnelType}
              onChange={(e) => setForm({ ...form, personnelType: e.target.value })}
            >
              <option value="MEMUR">Memur (657 / 4B)</option>
              <option value="HEMSIRE">Hemşire</option>
              <option value="ISCI">Sürekli İşçi (4D)</option>
            </select>
          </Field>
          <Field label="Puantaj26 Nöbet Grubu">
            <select
              className={inputClass}
              value={form.staffGroup}
              onChange={(e) => setForm({ ...form, staffGroup: e.target.value })}
            >
              <option value="SAGLIK">Hemşire / Sağlık Ekibi</option>
              <option value="DESTEK">Temizlik / Destek Ekibi</option>
              <option value="TEKNISYEN">Teknisyen / Teknik Ekip</option>
            </select>
          </Field>
          <Field label="Personel Fotoğrafı (Biyometrik Kamera)">
            <CameraField value={photo} onChange={setPhoto} />
          </Field>
          {formError ? (
            <div className="md:col-span-4 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/20">
              {formError}
            </div>
          ) : null}
          <div className="md:col-span-4 flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              onClick={() => void createEmployee(true)}
              disabled={saving}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {saving ? "Kaydediliyor…" : "Kaydet ve Biyometrik Stüdyoyu Aç"}
            </Button>
            <Button
              type="button"
              tone="ghost"
              onClick={() => void createEmployee(false)}
              disabled={saving}
            >
              Yalnızca Kartı Kaydet
            </Button>
            <Button
              type="button"
              tone="ghost"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              İptal
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((person) => {
          const meta = person.faceEnrollmentMetadata;
          const detailHref = `/personel/detay?id=${person.id}`;
          return (
            <div
              key={person.id}
              className="orion-card orion-card-hover rounded-3xl p-4 transition flex flex-col justify-between"
            >
              <Link href={detailHref} className="flex items-start gap-4">
                <Avatar
                  src={person.photoUrl}
                  name={`${person.firstName} ${person.lastName}`}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white truncate">
                    {person.firstName} {person.lastName}
                  </div>
                  <div className="text-xs text-slate-500">{person.employeeNo}</div>
                  <div className="mt-1 text-sm text-slate-300 truncate">{person.title}</div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Badge tone="gold">{person.departmentName ?? "Birimsiz"}</Badge>
                    <Badge tone={person.hasFace ? "ok" : "warn"}>
                      <ScanFace className="mr-1 inline h-3 w-3" />
                      {person.hasFace ? (
                        <span>
                          Canlılık %{meta?.livenessScore ? Math.round(meta.livenessScore) : 99}
                        </span>
                      ) : (
                        "Yüz Yok"
                      )}
                    </Badge>
                  </div>
                </div>
              </Link>

              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveStudioEmployee(person);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-400/20 transition hover:bg-cyan-400 hover:text-slate-950"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{person.hasFace ? "Canlılığı Yenile" : "Biyometrik Stüdyoyu Aç"}</span>
                </button>
                <Link
                  href={detailHref}
                  className="text-xs text-slate-400 hover:text-white transition"
                >
                  Karta Git →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {activeStudioEmployee ? (
        <BiometricStudioModal
          employee={activeStudioEmployee}
          onClose={() => setActiveStudioEmployee(null)}
          onSuccess={() => {
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
