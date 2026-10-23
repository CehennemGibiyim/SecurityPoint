"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FaceEnroll } from "@/components/face-enroll";
import { Avatar, Badge, Button, Field, PageHeader, inputClass } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";
import { formatDateTr, formatMinutes, formatTimeTr } from "@/lib/time";
import type { EmployeePublic } from "@/lib/types";

type Attendance = {
  id: number;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  workMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
};

export function PersonelDetailClient({ employeeId }: { employeeId: string }) {
  const [person, setPerson] = useState<EmployeePublic | null>(null);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [shifts, setShifts] = useState<Array<{ id: number; name: string }>>([]);
  const [savedNotice, setSavedNotice] = useState(false);

  async function load() {
    if (!employeeId) return;
    const [emp, att, dep, sh] = await Promise.all([
      jsonFetch<{ item: EmployeePublic }>(`/api/employees/${employeeId}`),
      jsonFetch<{ items: Attendance[] }>(
        `/api/attendance?from=2020-01-01&to=2099-01-01&employeeId=${employeeId}`,
      ),
      jsonFetch<{ items: Array<{ id: number; name: string }> }>("/api/face/departments"),
      jsonFetch<{ items: Array<{ id: number; name: string }> }>("/api/shifts"),
    ]);
    setPerson(emp.item);
    setRecords(att.items.slice(0, 12));
    setDepartments(dep.items);
    setShifts(sh.items);
  }

  useEffect(() => {
    void load();
  }, [employeeId]);

  async function save() {
    if (!person) return;
    const data = await jsonFetch<{ item: EmployeePublic }>(`/api/employees/${person.id}`, {
      method: "PATCH",
      body: JSON.stringify(person),
    });
    setPerson(data.item);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  }

  if (!person) return <p className="text-slate-400">Kart açılıyor…</p>;

  return (
    <div>
      <PageHeader
        kicker={person.employeeNo}
        title={`${person.firstName} ${person.lastName}`}
        description={`${person.title ?? "Unvan yok"} · ${person.departmentName ?? "Birim yok"} · ${person.shiftName ?? "Vardiya yok"}`}
        actions={
          <Link href="/personel" className="text-sm text-cyan-300">
            ← Kadroya dön
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="orion-card rounded-3xl p-5">
            <div className="mb-5 flex items-center gap-4">
              <Avatar
                src={person.photoUrl}
                name={`${person.firstName} ${person.lastName}`}
                size="xl"
              />
              <div>
                <Badge tone={person.status === "active" ? "ok" : "bad"}>
                  {person.status === "active" ? "Aktif" : "Pasif"}
                </Badge>
                <p className="mt-2 text-sm text-slate-400">{person.email}</p>
                <p className="text-sm text-slate-400">{person.phone}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Ad">
                <input
                  className={inputClass}
                  value={person.firstName}
                  onChange={(e) => setPerson({ ...person, firstName: e.target.value })}
                />
              </Field>
              <Field label="Soyad">
                <input
                  className={inputClass}
                  value={person.lastName}
                  onChange={(e) => setPerson({ ...person, lastName: e.target.value })}
                />
              </Field>
              <Field label="Unvan">
                <input
                  className={inputClass}
                  value={person.title ?? ""}
                  onChange={(e) => setPerson({ ...person, title: e.target.value })}
                />
              </Field>
              <Field label="Sicil">
                <input
                  className={inputClass}
                  value={person.employeeNo}
                  onChange={(e) => setPerson({ ...person, employeeNo: e.target.value })}
                />
              </Field>
              <Field label="Birim">
                <select
                  className={inputClass}
                  value={person.departmentId ?? ""}
                  onChange={(e) =>
                    setPerson({
                      ...person,
                      departmentId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">Seçin</option>
                  {departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vardiya">
                <select
                  className={inputClass}
                  value={person.shiftId ?? ""}
                  onChange={(e) =>
                    setPerson({
                      ...person,
                      shiftId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">Seçin</option>
                  {shifts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Durum">
                <select
                  className={inputClass}
                  value={person.status}
                  onChange={(e) => setPerson({ ...person, status: e.target.value })}
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Pasif</option>
                </select>
              </Field>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={() => void save()}>Kartı güncelle</Button>
              {savedNotice ? (
                <span className="text-xs text-emerald-300">Kaydedildi ve Puantaj26 ile eşitlendi.</span>
              ) : null}
            </div>
          </div>
          <FaceEnroll employee={person} onUpdated={setPerson} />
        </div>

        <section className="orion-card rounded-3xl p-5">
          <h3 className="mb-4 text-lg font-semibold text-white">İmza geçmişi</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="pb-3">Tarih</th>
                  <th className="pb-3">Giriş</th>
                  <th className="pb-3">Çıkış</th>
                  <th className="pb-3">Çalışma</th>
                  <th className="pb-3">Mola</th>
                  <th className="pb-3">Durum</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="py-3 text-slate-200">{formatDateTr(row.workDate)}</td>
                    <td className="font-mono text-cyan-200">{formatTimeTr(row.clockIn)}</td>
                    <td className="font-mono text-cyan-200">{formatTimeTr(row.clockOut)}</td>
                    <td>{formatMinutes(row.workMinutes)}</td>
                    <td>{row.breakMinutes} dk</td>
                    <td>
                      <Badge
                        tone={
                          row.status === "absent" ? "bad" : row.lateMinutes > 0 ? "warn" : "ok"
                        }
                      >
                        {row.status === "absent"
                          ? "Yok"
                          : row.lateMinutes > 0
                            ? `Geç ${row.lateMinutes} dk`
                            : "Normal"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
