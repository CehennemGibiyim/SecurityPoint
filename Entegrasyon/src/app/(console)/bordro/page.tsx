"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, Lock, Wallet } from "lucide-react";
import { Badge, Button, PageHeader } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";

type Item={employeeId:number;employeeNo:string;name:string;presentDays:number;absentDays:number;workMinutes:number;overtimeMinutes:number;lateMinutes:number;grossPay:number;status:string};
type Data={period:string;items:Item[];totals:{gross:number;overtimeMinutes:number}};

export default function Page(){
  const [period,setPeriod]=useState(new Date().toISOString().slice(0,7));
  const [d,setD]=useState<Data|null>(null);
  const [hols,setHols]=useState<Array<{id:number;date:string;name:string}>>([]);
  const load=useCallback(async()=>{
    const r=await jsonFetch<Data>(`/api/payroll?period=${period}`); setD(r);
    const h=await jsonFetch<{items:Array<{id:number;date:string;name:string}>}>("/api/holidays"); setHols(h.items);
  },[period]);
  useEffect(()=>{void load();},[load]);
  async function post(p:unknown){await jsonFetch("/api/payroll",{method:"POST",body:JSON.stringify(p)}); await load();}
  return <div>
    <PageHeader kicker="Piyasa Modülü" title="Puantaj & Bordro" description="PDKS'nin en kritik çıktısı: aylık puantajdan bordro hakedişine. Fazla mesai %50, resmi tatil çalışması ayrıca hesaplanır. Onay → kilitle → CSV (Logo/Paraşüt/Mikro formatına uygun)."
      actions={<div className="flex gap-2"><input type="month" value={period} onChange={e=>setPeriod(e.target.value)} className="rounded-xl bg-black/30 px-3 py-2 text-sm text-white ring-1 ring-white/15"/><a href={`/api/payroll?period=${period}&format=csv`}><Button><Download className="h-4 w-4"/> CSV Bordro</Button></a><Button tone="ok" onClick={()=>void post({period,action:"approve_all"})}>Toplu Onayla</Button></div>}/>
    {d&&<div className="mb-5 grid gap-4 md:grid-cols-3">
      <div className="orion-card rounded-2xl p-5"><div className="text-xs text-slate-400">Toplam Brüt Hakediş</div><div className="text-2xl font-bold text-emerald-300 flex gap-2"><Wallet/> ₺{d.totals.gross.toLocaleString("tr-TR")}</div></div>
      <div className="orion-card rounded-2xl p-5"><div className="text-xs text-slate-400">Toplam Fazla Mesai</div><div className="text-2xl font-bold text-white">{Math.round(d.totals.overtimeMinutes/60)} saat</div></div>
      <div className="orion-card rounded-2xl p-5"><div className="text-xs text-slate-400">Resmi Tatil (2026)</div><div className="text-2xl font-bold text-white">{hols.length} gün</div><div className="text-[11px] text-slate-500 max-h-16 overflow-auto">{hols.map(h=>`${h.date} ${h.name}`).join(" · ")}</div></div>
    </div>}
    <div className="orion-card overflow-x-auto rounded-3xl">
      <table className="w-full min-w-[860px] text-sm">
        <thead><tr className="border-b border-white/8 text-left text-xs text-slate-400"><th className="px-4 py-3">Personel</th><th>Gelinen</th><th>Devamsız</th><th>Çalışma</th><th>F.Mesai</th><th>Geç</th><th>Hakediş</th><th>Durum</th><th/></tr></thead>
        <tbody>{d?.items.map(i=>(
          <tr key={i.employeeId} className="border-b border-white/5 text-slate-200">
            <td className="px-4 py-2.5"><b>{i.name}</b> <span className="text-xs text-slate-500">{i.employeeNo}</span></td>
            <td>{i.presentDays} gün</td><td>{i.absentDays}</td><td>{Math.round(i.workMinutes/60)} sa</td><td>{i.overtimeMinutes} dk</td><td>{i.lateMinutes} dk</td>
            <td className="font-bold text-emerald-300">₺{i.grossPay.toLocaleString("tr-TR")}</td>
            <td><Badge tone={i.status==="locked"?"bad":i.status==="approved"?"ok":"gold"}>{i.status}</Badge></td>
            <td><Button tone="ghost" onClick={()=>void post({period,action:"lock",employeeId:i.employeeId})}><Lock className="h-4 w-4"/></Button></td>
          </tr>))}</tbody>
      </table>
    </div>
  </div>;
}
