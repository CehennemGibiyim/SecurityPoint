"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge, Button, Field, PageHeader, inputClass } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";
import { weekdayName } from "@/lib/time";
import type { DoorPublic, EmployeePublic } from "@/lib/types";
import { WEEKDAYS as DAYS } from "@/lib/types";

type Perm = {
  id: number;
  employeeId: number;
  doorId: number;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  isActive: boolean;
  employeeName: string;
  employeeNo: string | null;
  doorName: string;
  doorCode: string | null;
};

export default function YetkilerPage() {
  const [items, setItems] = useState<Perm[]>([]);
  const [people, setPeople] = useState<EmployeePublic[]>([]);
  const [doors, setDoors] = useState<DoorPublic[]>([]);
  const [form, setForm] = useState({
    employeeId: "",
    doorId: "",
    startTime: "07:00",
    endTime: "19:00",
    daysOfWeek: [1, 2, 3, 4, 5] as number[],
  });

  async function load() {
    const [perm, emp, door] = await Promise.all([
      jsonFetch<{ items: Perm[] }>("/api/permissions"),
      jsonFetch<{ items: EmployeePublic[] }>("/api/employees"),
      jsonFetch<{ items: DoorPublic[] }>("/api/doors"),
    ]);
    setItems(perm.items);
    setPeople(emp.items);
    setDoors(door.items);
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort(),
    }));
  }

  async function createPerm() {
    await jsonFetch("/api/permissions", {
      method: "POST",
      body: JSON.stringify({
        employeeId: Number(form.employeeId),
        doorId: Number(form.doorId),
        startTime: form.startTime,
        endTime: form.endTime,
        daysOfWeek: form.daysOfWeek,
      }),
    });
    await load();
  }

  async function remove(id: number) {
    await jsonFetch(`/api/permissions/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        kicker="Erişim matrisi"
        title="Kapı yetkileri"
        description="Hangi personel, hangi kapıdan, hangi gün ve saat aralığında geçebilir. Güvenlik amiri tüm kapılara 7/24 yetkilidir."
      />

      <section className="orion-card mb-6 rounded-3xl p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Personel">
            <select className={inputClass} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Seçin</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} · {p.employeeNo}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kapı">
            <select className={inputClass} value={form.doorId} onChange={(e) => setForm({ ...form, doorId: e.target.value })}>
              <option value="">Seçin</option>
              {doors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Başlangıç">
            <input type="time" className={inputClass} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </Field>
          <Field label="Bitiş">
            <input type="time" className={inputClass} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <button
              key={day.id}
              onClick={() => toggleDay(day.id)}
              className={`rounded-full px-3 py-1 text-xs ${form.daysOfWeek.includes(day.id) ? "bg-cyan-400 text-slate-950" : "bg-white/5 text-slate-300"}`}
            >
              {day.label}
            </button>
          ))}
        </div>
        <Button className="mt-4" onClick={() => void createPerm()}>Yetki tanımla</Button>
      </section>

      <div className="orion-card overflow-x-auto rounded-3xl p-5">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="pb-3">Personel</th>
              <th className="pb-3">Kapı</th>
              <th className="pb-3">Günler</th>
              <th className="pb-3">Saat</th>
              <th className="pb-3">Durum</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-white/5">
                <td className="py-3">
                  <div className="text-white">{item.employeeName}</div>
                  <div className="text-xs text-slate-500">{item.employeeNo}</div>
                </td>
                <td>
                  {item.doorName}
                  <div className="text-xs text-slate-500">{item.doorCode}</div>
                </td>
                <td className="text-slate-300">
                  {item.daysOfWeek.map((d) => weekdayName(d)).join(" ")}
                </td>
                <td className="font-mono text-cyan-200">
                  {item.startTime}–{item.endTime}
                </td>
                <td>
                  <Badge tone={item.isActive ? "ok" : "neutral"}>{item.isActive ? "Aktif" : "Pasif"}</Badge>
                </td>
                <td>
                  <button onClick={() => void remove(item.id)} className="text-rose-300">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
