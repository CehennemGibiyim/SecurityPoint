"use client";

import { useEffect, useState } from "react";
import { Badge, Button, PageHeader, inputClass } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";
import { formatDateTimeTr, formatMinutes, todayISO } from "@/lib/time";
import { BREAK_LABELS, type BreakType } from "@/lib/types";

type BreakRow = {
  id: number;
  type: BreakType;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  liveMinutes: number;
  employeeName: string;
  employeeNo: string | null;
  photoUrl: string | null;
};

export default function IstirahatPage() {
  const [date, setDate] = useState(todayISO());
  const [items, setItems] = useState<BreakRow[]>([]);

  async function load() {
    const data = await jsonFetch<{ items: BreakRow[] }>(`/api/breaks?from=${date}&to=${date}`);
    setItems(data.items);
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [date]);

  async function endBreak(id: number) {
    await jsonFetch("/api/breaks", { method: "POST", body: JSON.stringify({ id, action: "end" }) });
    await load();
  }

  const open = items.filter((item) => !item.endedAt);
  const closed = items.filter((item) => item.endedAt);
  const total = items.reduce((sum, item) => sum + item.liveMinutes, 0);

  return (
    <div>
      <PageHeader
        kicker="Mola takibi"
        title="İstirahat dakikaları"
        description="Yemek, çay, namaz ve kısa molalar yüz terminalinden veya imza defterinden başlatılır. Açık molalar canlı sayılır."
        actions={
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        }
      />

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="orion-card rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Açık mola</p>
          <p className="mt-2 font-mono text-3xl text-amber-200">{open.length}</p>
        </div>
        <div className="orion-card rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Tamamlanan</p>
          <p className="mt-2 font-mono text-3xl text-white">{closed.length}</p>
        </div>
        <div className="orion-card rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Toplam süre</p>
          <p className="mt-2 font-mono text-3xl text-cyan-200">{formatMinutes(total)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="orion-card flex items-center gap-4 rounded-2xl p-4">
            {item.photoUrl ? (
              <img src={item.photoUrl} alt="" className="h-12 w-12 rounded-2xl object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-white">{item.employeeName}</h3>
                <Badge tone={!item.endedAt ? "warn" : "ok"}>
                  {BREAK_LABELS[item.type] ?? item.type}
                </Badge>
                {!item.endedAt ? <Badge tone="gold">Devam ediyor</Badge> : null}
              </div>
              <p className="text-xs text-slate-500">
                {item.employeeNo} · {formatDateTimeTr(item.startedAt)}
                {item.endedAt ? ` → ${formatDateTimeTr(item.endedAt)}` : ""}
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg text-cyan-200">{formatMinutes(item.liveMinutes)}</div>
              {!item.endedAt ? (
                <Button className="mt-2 px-3 py-1 text-xs" onClick={() => void endBreak(item.id)}>
                  Molayı bitir
                </Button>
              ) : null}
            </div>
          </article>
        ))}
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Bu tarihte istirahat kaydı yok.</p>
        ) : null}
      </div>
    </div>
  );
}
