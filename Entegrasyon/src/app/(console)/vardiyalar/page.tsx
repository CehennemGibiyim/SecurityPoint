"use client";

import { useEffect, useState } from "react";
import { Button, Field, PageHeader, inputClass } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";

type Shift = {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  breakAllowanceMinutes: number;
  lateToleranceMinutes: number;
  color: string;
};

export default function VardiyalarPage() {
  const [items, setItems] = useState<Shift[]>([]);
  const [form, setForm] = useState({
    name: "",
    startTime: "08:00",
    endTime: "17:00",
    breakAllowanceMinutes: 45,
    lateToleranceMinutes: 10,
  });

  async function load() {
    const data = await jsonFetch<{ items: Shift[] }>("/api/shifts");
    setItems(data.items);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createShift() {
    await jsonFetch("/api/shifts", { method: "POST", body: JSON.stringify(form) });
    setForm({
      name: "",
      startTime: "08:00",
      endTime: "17:00",
      breakAllowanceMinutes: 45,
      lateToleranceMinutes: 10,
    });
    await load();
  }

  return (
    <div>
      <PageHeader
        kicker="Mesai planı"
        title="Vardiyalar"
        description="Geç kalma toleransı ve mola hakkı vardiyaya bağlıdır. Yüz terminali giriş saatini bu plana göre değerlendirir."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {items.map((shift) => (
          <article key={shift.id} className="orion-card rounded-3xl p-5">
            <div className="mb-4 h-1.5 rounded-full" style={{ background: shift.color }} />
            <h3 className="text-lg font-semibold text-white">{shift.name}</h3>
            <p className="mt-2 font-mono text-2xl text-cyan-200">
              {shift.startTime}–{shift.endTime}
            </p>
            <p className="mt-3 text-sm text-slate-400">
              Mola hakkı {shift.breakAllowanceMinutes} dk · geç toleransı {shift.lateToleranceMinutes} dk
            </p>
          </article>
        ))}
      </div>

      <section className="orion-card rounded-3xl p-5">
        <h3 className="mb-4 text-lg font-semibold text-white">Yeni vardiya</h3>
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="Ad">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Başlangıç">
            <input type="time" className={inputClass} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </Field>
          <Field label="Bitiş">
            <input type="time" className={inputClass} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </Field>
          <Field label="Mola (dk)">
            <input
              type="number"
              className={inputClass}
              value={form.breakAllowanceMinutes}
              onChange={(e) => setForm({ ...form, breakAllowanceMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Geç tolerans (dk)">
            <input
              type="number"
              className={inputClass}
              value={form.lateToleranceMinutes}
              onChange={(e) => setForm({ ...form, lateToleranceMinutes: Number(e.target.value) })}
            />
          </Field>
        </div>
        <Button className="mt-4" onClick={() => void createShift()}>Vardiya ekle</Button>
      </section>
    </div>
  );
}
