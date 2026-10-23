"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, Users } from "lucide-react";
import { Badge, Button, PageHeader } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";

type Zone={doorId:number;doorName:string;zone:string;antiPassback:boolean;maxOccupancy:number|null;current:number};
type Alarm={id:number;type:string;severity:string;message:string;isResolved:boolean;createdAt:string};
type SecData={zones:Zone[];inside:Array<{id:number;name:string;zone:string}>;blacklisted:Array<{id:number;name:string;reason:string}>;alarms:Alarm[];stats:{insideCount:number;alarmCount:number;blacklistedCount:number};rollCall:unknown};

export default function Page(){
  const [d,setD]=useState<SecData|null>(null);
  const load=useCallback(async()=>{const r=await jsonFetch<SecData>("/api/security");setD(r);},[]);
  useEffect(()=>{void load(); const t=setInterval(()=>void load(),8000); return ()=>clearInterval(t);},[load]);
  async function post(p:unknown){await jsonFetch("/api/security",{method:"POST",body:JSON.stringify(p)}); await load();}
  if(!d) return <div className="text-slate-400">Yükleniyor…</div>;
  return <div>
    <PageHeader kicker="Piyasa Modülü" title="Güvenlik Merkezi" description="Anti-passback, zone doluluk, blacklist, tailgating/spoof alarmları ve anlık içeridekiler. ZKTeco/Hikvision panellerindeki standart güvenlik kuralları."/>
    <div className="grid gap-4 md:grid-cols-3 mb-6">
      <div className="orion-card rounded-2xl p-5"><div className="text-xs text-slate-400">İçeride</div><div className="text-3xl font-bold text-white flex gap-2"><Users className="text-cyan-300"/>{d.stats.insideCount}</div><div className="mt-2 text-xs text-slate-500">{d.inside.slice(0,6).map(i=>i.name).join(", ")||"Zone kaydı, geçiş yaptıkça oluşur"}</div></div>
      <div className="orion-card rounded-2xl p-5"><div className="text-xs text-slate-400">Açık Alarm</div><div className="text-3xl font-bold text-rose-300 flex gap-2"><AlertTriangle/>{d.stats.alarmCount}</div></div>
      <div className="orion-card rounded-2xl p-5"><div className="text-xs text-slate-400">Blacklist</div><div className="text-3xl font-bold text-white flex gap-2"><ShieldAlert className="text-amber-300"/>{d.stats.blacklistedCount}</div><div className="text-xs text-slate-500">{d.blacklisted.map(b=>b.name).join(", ")||"Yok"}</div></div>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="orion-card rounded-3xl p-5">
        <h3 className="font-semibold text-white mb-3">Kapı / Zone Kuralları</h3>
        <div className="space-y-2">{d.zones.map(z=>(
          <div key={z.doorId} className="flex items-center justify-between rounded-xl bg-white/3 px-3 py-2 text-xs">
            <span className="text-slate-200">{z.doorName} <span className="text-slate-500">· zone: {z.zone} · doluluk {z.current}{z.maxOccupancy?`/${z.maxOccupancy}`:""}</span></span>
            <button onClick={()=>void post({action:"toggle_antipassback",doorId:z.doorId,enabled:!z.antiPassback})} className={z.antiPassback?"rounded-full bg-cyan-400 px-3 py-1 font-bold text-slate-950":"rounded-full bg-white/10 px-3 py-1 text-slate-300"}>Anti-passback {z.antiPassback?"AÇIK":"Kapalı"}</button>
          </div>))}</div>
        <p className="mt-3 text-[11px] text-slate-500">Anti-passback açık kapıda: çıkış yapmadan aynı zone'a tekrar giriş engellenir + alarm üretilir.</p>
      </div>
      <div className="orion-card rounded-3xl p-5">
        <h3 className="font-semibold text-white mb-3">Güvenlik Alarmları</h3>
        <div className="space-y-2 max-h-[420px] overflow-auto">{d.alarms.map(a=>(
          <div key={a.id} className="flex justify-between gap-3 rounded-xl bg-white/3 px-3 py-2 text-xs">
            <div><Badge tone={a.severity==="high"?"bad":"warn"}>{a.type}</Badge><div className="mt-1 text-slate-300">{a.message}</div><div className="text-slate-500">{new Date(a.createdAt).toLocaleString("tr-TR")}</div></div>
            {!a.isResolved&&<Button tone="ghost" onClick={()=>void post({action:"resolve_alarm",alarmId:a.id})}>Kapat</Button>}
          </div>))}{!d.alarms.length&&<p className="text-slate-500 text-sm">Alarm yok</p>}</div>
      </div>
    </div>
    <div className="orion-card mt-6 rounded-3xl p-5">
      <h3 className="font-semibold text-white">Acil Durum Yoklaması (Roll-Call)</h3>
      <p className="text-xs text-slate-400 mt-1">Yangın/tahliye anında içeridekileri sayın. Kişileri güvenli işaretleyin, eksikler listelenir.</p>
      <div className="mt-3 flex gap-2">
        <Button tone="danger" onClick={()=>void post({action:"start_rollcall"})}>Yoklamayı Başlat</Button>
        <Button tone="ghost" onClick={()=>void post({action:"end_rollcall"})}>Yoklamayı Bitir</Button>
      </div>
      {d.rollCall ? <pre className="mt-3 overflow-auto rounded-xl bg-black/40 p-3 text-[11px] text-cyan-200">{JSON.stringify(d.rollCall,null,2)}</pre> : <p className="mt-2 text-xs text-slate-500">Aktif yoklama yok</p>}
    </div>
  </div>;
}
