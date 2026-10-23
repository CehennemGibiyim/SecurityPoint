"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Camera, LogOut, ShieldAlert, Siren, Users, X } from "lucide-react";
import { Badge, Button, PageHeader, inputClass } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";

type Zone={doorId:number;doorName:string;zone:string;antiPassback:boolean;maxOccupancy:number|null;current:number};
type Alarm={id:number;type:string;severity:string;message:string;isResolved:boolean;createdAt:string};
type Inside={id:number;name:string;zone:string;employeeNo:string;sinceHours:number|null;lastEventAt:string|null};
type Rejected={id:number;createdAt:string;eventType:string;reason:string|null;livenessScore:number|null;snapshot:string|null;employeeName:string|null;doorName:string|null};
type Emergency={doorIds:number[]|"all";until:string;by:string}|null;
type SecData={
  zones:Zone[];
  inside:Inside[];
  ghosts:Inside[];
  rejected:Rejected[];
  emergency:Emergency;
  blacklisted:Array<{id:number;name:string;reason:string}>;
  alarms:Alarm[];
  stats:{insideCount:number;alarmCount:number;blacklistedCount:number};
  rollCall:unknown;
};

export default function Page(){
  const [d,setD]=useState<SecData|null>(null);
  const [emForm,setEmForm]=useState({by:"",minutes:"60"});
  const [zoom,setZoom]=useState<Rejected|null>(null);
  const load=useCallback(async()=>{const r=await jsonFetch<SecData>("/api/security");setD(r);},[]);
  useEffect(()=>{void load(); const t=setInterval(()=>void load(),8000); return ()=>clearInterval(t);},[load]);
  async function post(p:unknown){await jsonFetch("/api/security",{method:"POST",body:JSON.stringify(p)}); await load();}
  if(!d) return <div className="text-slate-400">Yükleniyor…</div>;

  const ghostIds=new Set(d.ghosts.map(g=>g.id));

  return <div>
    <PageHeader kicker="Piyasa Modülü" title="Güvenlik Merkezi" description="Anti-passback, zone doluluk, blacklist, hayalet tespiti, acil durum kilit açma, spoof/red galerisi ve anlık içeridekiler. ZKTeco/Hikvision panellerindeki standart güvenlik kuralları."/>

    {d.emergency ? (
      <div className="orion-card mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-rose-400/40 bg-rose-500/10 p-5">
        <div>
          <div className="flex items-center gap-2 font-semibold text-rose-200"><Siren className="h-5 w-5 animate-pulse text-rose-300"/> ACİL DURUM PROTOKOLÜ AKTİF</div>
          <p className="mt-1 text-xs text-rose-100/80">
            Başlatan: <b>{d.emergency.by}</b> · Bitiş: {new Date(d.emergency.until).toLocaleString("tr-TR")} ·
            Kapılar: {d.emergency.doorIds==="all"?"tümü":`${d.emergency.doorIds.length} kapı`} — süre boyunca yetki aranmaz, her geçiş imza defterine kaydedilir.
          </p>
        </div>
        <Button tone="danger" onClick={()=>void post({action:"emergency_end",by:emForm.by||"Yönetici"})}>Protokolü Bitir</Button>
      </div>
    ) : (
      <section className="orion-card mb-6 rounded-3xl border border-amber-300/25 p-5">
        <h3 className="flex items-center gap-2 font-semibold text-white"><Siren className="h-5 w-5 text-amber-300"/> Acil Durum Kilit Açma</h3>
        <p className="mt-1 text-xs text-slate-400">Yangın/alarmda tüm kapılar süre boyunca serbest açılır; işlem + sorumlu adı <b>imza defterine</b> (Kapı İmza ekranı) düşer, alarm üretilir.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input className={inputClass} placeholder="Sorumlu adı (imza defterine yazılır)" value={emForm.by} onChange={e=>setEmForm({...emForm,by:e.target.value})}/>
          <input className={inputClass} type="number" min={1} max={600} value={emForm.minutes} onChange={e=>setEmForm({...emForm,minutes:e.target.value})} title="Süre (dakika)"/>
          <Button tone="danger" onClick={()=>void post({action:"emergency_unlock",by:emForm.by||"Yönetici",minutes:Number(emForm.minutes)||60})}>Kapıları Acil Aç</Button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Süre dolunca protokol kendiliğinden kapanır; erken kapatmak için üstteki “Protokolü Bitir”.</p>
      </section>
    )}

    <div className="grid gap-4 md:grid-cols-3 mb-6">
      <div className="orion-card rounded-2xl p-5"><div className="text-xs text-slate-400">İçeride</div><div className="text-3xl font-bold text-white flex gap-2"><Users className="text-cyan-300"/>{d.stats.insideCount}</div><div className="mt-2 text-xs text-slate-500">{d.inside.slice(0,6).map(i=>i.name).join(", ")||"Zone kaydı, geçiş yaptıkça oluşur"}</div></div>
      <div className="orion-card rounded-2xl p-5"><div className="text-xs text-slate-400">Açık Alarm</div><div className="text-3xl font-bold text-rose-300 flex gap-2"><AlertTriangle/>{d.stats.alarmCount}</div></div>
      <div className="orion-card rounded-2xl p-5"><div className="text-xs text-slate-400">Blacklist</div><div className="text-3xl font-bold text-white flex gap-2"><ShieldAlert className="text-amber-300"/>{d.stats.blacklistedCount}</div><div className="text-xs text-slate-500">{d.blacklisted.map(b=>b.name).join(", ")||"Yok"}</div></div>
    </div>

    <div className="orion-card mb-6 rounded-3xl p-5">
      <h3 className="font-semibold text-white mb-1">İçeridekiler ve Hayalet Tespiti</h3>
      <p className="text-[11px] text-slate-500 mb-3">Son geçiş olayı12 saatten eski (veya hiç olayı olmayan) “içeride” kayıtları hayalet şüphelisidir — içeride kalma süresiyle birlikte listelenir.</p>
      <div className="space-y-2">{d.inside.map(i=>(
        <div key={i.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs ${ghostIds.has(i.id)?"bg-amber-400/10 ring-1 ring-amber-300/30":"bg-white/3"}`}>
          <div>
            <span className="text-slate-200">{i.name}</span>
            <span className="text-slate-500"> · {i.employeeNo} · zone: {i.zone}</span>
            <div className="text-slate-500">İçeride geçen: <b className={ghostIds.has(i.id)?"text-amber-300":"text-cyan-300"}>{i.sinceHours===null?"bilinmiyor":`${i.sinceHours} saat`}</b>{i.lastEventAt?` · son olay: ${new Date(i.lastEventAt).toLocaleString("tr-TR")}`:" · olay yok"}</div>
          </div>
          <div className="flex items-center gap-2">
            {ghostIds.has(i.id)&&<Badge tone="warn">HAYELET</Badge>}
            <Button tone="ghost" onClick={()=>void post({action:"clear_zone",employeeId:i.id})}><LogOut className="h-3.5 w-3.5"/> Dışarı işaretle</Button>
          </div>
        </div>))}
        {!d.inside.length&&<p className="text-sm text-slate-500">İçeride kimse yok — zone kaydı geçiş yaptıkça oluşur.</p>}
        {!!d.ghosts.length&&<p className="text-[11px] text-amber-300">{d.ghosts.length} hayalet şüphelisi: kontrol edin veya “Dışarı işaretle” ile kaydı sıfırlayın.</p>}
      </div>
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
      <h3 className="flex items-center gap-2 font-semibold text-white"><Camera className="h-5 w-5 text-cyan-300"/> Reddedilen Denemeler / Spoof Geçmişi</h3>
      <p className="text-[11px] text-slate-500 mt-1 mb-3">Panelde reddedilen yüz/kart/QR denemelerinin kareleri ve nedenleri. Tarama karesi varsa büyütülerek görüntülenir.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {d.rejected.map(r=>(
          <button key={r.id} onClick={()=>r.snapshot&&setZoom(r)} className="rounded-xl bg-white/3 p-2 text-left transition hover:bg-white/6">
            {r.snapshot
              ? <img src={r.snapshot} alt="" className="h-20 w-full rounded-lg object-cover"/>
              : <div className="flex h-20 w-full items-center justify-center rounded-lg bg-black/40 text-[10px] text-slate-500">kare yok</div>}
            <div className="mt-1 truncate text-[10px] text-slate-300">{r.employeeName??"Bilinmeyen"}</div>
            <div className="truncate text-[10px] text-slate-500">{r.doorName??"-"} · {r.reason??"-"}</div>
            <div className="text-[10px] text-slate-600">{new Date(r.createdAt).toLocaleString("tr-TR",{dateStyle:"short",timeStyle:"short"})}{r.livenessScore!=null?` · canlılık %${Math.round(r.livenessScore)}`:""}</div>
          </button>
        ))}
        {!d.rejected.length&&<p className="col-span-full text-sm text-slate-500">Henüz reddedilen deneme yok.</p>}
      </div>
      {zoom&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6" onClick={()=>setZoom(null)}>
          <div className="orion-card max-w-3xl rounded-3xl p-4" onClick={e=>e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <div className="text-sm text-white">{zoom.employeeName??"Bilinmeyen"} · {zoom.doorName??"-"}{zoom.eventType?` · ${zoom.eventType}`:""}</div>
              <button onClick={()=>setZoom(null)} className="rounded-full bg-white/10 p-1.5 text-slate-300 hover:bg-white/20"><X className="h-4 w-4"/></button>
            </div>
            {zoom.snapshot&&<img src={zoom.snapshot} alt="" className="max-h-[65vh] w-full rounded-2xl object-contain bg-black/50"/>}
            <div className="mt-2 text-xs text-slate-400">{zoom.reason??"-"}</div>
            <div className="text-[11px] text-slate-500">{new Date(zoom.createdAt).toLocaleString("tr-TR")}{zoom.livenessScore!=null?` · canlılık %${Math.round(zoom.livenessScore)}`:""}</div>
          </div>
        </div>
      )}
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
