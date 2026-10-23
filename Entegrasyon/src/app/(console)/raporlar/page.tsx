"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Badge, Button, PageHeader, inputClass } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";
import { addDaysISO, formatMinutes, todayISO } from "@/lib/time";

type ReportItem = {
  employeeId: number;
  employeeNo: string;
  name: string;
  departmentName: string;
  photoUrl: string | null;
  days: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  workMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
};

type Report = {
  from: string;
  to: string;
  items: ReportItem[];
  summary: {
    workMinutes: number;
    breakMinutes: number;
    overtimeMinutes: number;
    lateMinutes: number;
    absentDays: number;
    lateDays: number;
  };
};

export default function RaporlarPage() {
  const [to, setTo] = useState(todayISO());
  const [from, setFrom] = useState(addDaysISO(todayISO(), -6));
  const [data, setData] = useState<Report | null>(null);

  async function load() {
    const json = await jsonFetch<Report>(`/api/reports?from=${from}&to=${to}`);
    setData(json);
  }

  useEffect(() => {
    void load();
  }, [from, to]);

  function exportCsv() {
    if (!data) return;
    const header = [
      "Sicil",
      "Ad",
      "Birim",
      "Gün",
      "Geldi",
      "Geç",
      "Yok",
      "Çalışma dk",
      "İstirahat dk",
      "Mesai dk",
    ];
    const lines = data.items.map((item) =>
      [
        item.employeeNo,
        item.name,
        item.departmentName,
        item.days,
        item.presentDays,
        item.lateDays,
        item.absentDays,
        item.workMinutes,
        item.breakMinutes,
        item.overtimeMinutes,
      ].join(";"),
    );
    const blob = new Blob(["\uFEFF" + [header.join(";"), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orion-pdks-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        kicker="İK raporları"
        title="Devam ve mola özeti"
        description="Seçilen aralıkta çalışma süresi, istirahat, geç kalma ve devamsızlık. Bordro öncesi CSV dışa aktarılabilir."
        actions={
          <Button tone="gold" onClick={exportCsv} disabled={!data}>
            <Download className="h-4 w-4" />
            CSV indir
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {data ? (
        <>
          <div className="mb-6 grid gap-3 md:grid-cols-4">
            <div className="orion-card rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Toplam çalışma</p>
              <p className="mt-2 font-mono text-2xl text-white">{formatMinutes(data.summary.workMinutes)}</p>
            </div>
            <div className="orion-card rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">İstirahat</p>
              <p className="mt-2 font-mono text-2xl text-amber-200">{formatMinutes(data.summary.breakMinutes)}</p>
            </div>
            <div className="orion-card rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Geç kalma</p>
              <p className="mt-2 font-mono text-2xl text-rose-200">{formatMinutes(data.summary.lateMinutes)}</p>
            </div>
            <div className="orion-card rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Yok günü</p>
              <p className="mt-2 font-mono text-2xl text-cyan-200">{data.summary.absentDays}</p>
            </div>
          </div>

          <div className="orion-card overflow-x-auto rounded-3xl p-5">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="pb-3">Personel</th>
                  <th className="pb-3">Geldi</th>
                  <th className="pb-3">Geç</th>
                  <th className="pb-3">Yok</th>
                  <th className="pb-3">Çalışma</th>
                  <th className="pb-3">İstirahat</th>
                  <th className="pb-3">Fazla mesai</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.employeeId} className="border-t border-white/5">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {item.photoUrl ? (
                          <img src={item.photoUrl} alt="" className="h-9 w-9 rounded-xl object-cover" />
                        ) : null}
                        <div>
                          <div className="text-white">{item.name}</div>
                          <div className="text-xs text-slate-500">
                            {item.employeeNo} · {item.departmentName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{item.presentDays}</td>
                    <td>
                      {item.lateDays ? <Badge tone="warn">{item.lateDays}</Badge> : "0"}
                    </td>
                    <td>
                      {item.absentDays ? <Badge tone="bad">{item.absentDays}</Badge> : "0"}
                    </td>
                    <td className="font-mono text-cyan-200">{formatMinutes(item.workMinutes)}</td>
                    <td>{formatMinutes(item.breakMinutes)}</td>
                    <td>{formatMinutes(item.overtimeMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-slate-400">Rapor hazırlanıyor…</p>
      )}
    </div>
  );
}
