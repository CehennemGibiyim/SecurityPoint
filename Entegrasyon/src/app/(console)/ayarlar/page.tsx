"use client";
import { useCallback, useEffect, useState } from "react";
import { CreditCard, KeyRound, QrCode, RefreshCw, ShieldCheck, UtensilsCrossed, WifiOff } from "lucide-react";
import { Badge, Button, PageHeader } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";

type Emp={id:number;firstName:string;lastName:string;employeeNo:string;cardNo?:string|null;qrToken?:string|null;kvkkConsentAt?:string|null;hasFace:boolean};
type Caf={counts:{kahvalti:number;ogle:number;aksam:number};items:Array<{id:number;name:string;mealType:string}>};

const MARKET = [
  ["Yüz kaydı (çoklu poz + canlılık)", true, "Biyometrik Stüdyo — milyon kare, EAR/MAR/yaw"],
  ["Kapı kilidi + imza + istirahat", true, "Terminal + /api/recognize"],
  ["Puantaj / fazla mesai / geç kalma", true, "Raporlar + Bordro modülü (YENİ)"],
  ["İzin & devamsızlık + onay akışı", true, "İzinler modülü (YENİ)"],
  ["Ziyaretçi + süreli QR + yaka kartı", true, "Ziyaretçiler (YENİ)"],
  ["Anti-passback + doluluk + roll-call", true, "Güvenlik Merkezi (YENİ)"],
  ["Blacklist / watchlist", true, "Güvenlik + access engeli (YENİ)"],
  ["Resmi tatil takvimi", true, "2026 takvimi seed (YENİ)"],
  ["Bordro onay/kilitle/CSV export", true, "Bordro (YENİ)"],
  ["KVKK açık rıza + alternatif (kart/QR/PIN)", true, "Bu sayfa + identifyEmployee (YENİ)"],
  ["Yemekhane mükerrer öğün engeli", true, "Bu sayfa (YENİ)"],
  ["Offline kuyruk (internet kesintisi)", true, "Offline queue API (YENİ)"],
  ["ZKTeco/Hikvision cihaz entegrasyonu (ADMS)", false, "Fiziksel cihazda vendor SDK gerekir — API hazır, cihaz bağlanınca webhook eklenir"],
  ["Mobil uygulama + GPS", false, "PWA terminal responsive; native app sonraki faz"],
] as const;

export default function Page(){
  const [emps,setEmps]=useState<Emp[]>([]);
  const [caf,setCaf]=useState<Caf|null>(null);
  const [offline,setOffline]=useState<{pending:number;items:unknown[]}|null>(null);
  const [msg,setMsg]=useState("");
  const load=useCallback(async()=>{
    const e=await jsonFetch<{items:Emp[]}>("/api/employees"); setEmps(e.items);
    const c=await jsonFetch<Caf>("/api/cafeteria"); setCaf(c);
    const o=await jsonFetch<{pending:number;items:unknown[]}>("/api/offline-queue"); setOffline(o);
  },[]);
  useEffect(()=>{void load();},[load]);
  async function patch(id:number,body:unknown){
    await jsonFetch(`/api/employees/${id}`,{method:"PATCH",body:JSON.stringify(body)});
    setMsg("Güncellendi."); await load();
  }
  async function meal(id:number){
    try{ await jsonFetch("/api/cafeteria",{method:"POST",body:JSON.stringify({employeeId:id,mealType:"ogle"})}); setMsg("Öğle yemeği hakkı kullanıldı."); }
    catch(e){ setMsg(e instanceof Error?e.message:"Hata"); }
    await load();
  }
  return <div>
    <PageHeader kicker="Piyasa Modülü" title="Sistem & KVKK Ayarları" description="Piyasada olup bizde eksik kalanların kontrol listesi, alternatif kimlikler (KVKK), yemekhane ve offline dayanıklılık."/>
    <div className="orion-card rounded-3xl p-5 mb-6">
      <h3 className="font-semibold text-white mb-3">Piyasa Karşılaştırma — Eksik Listesi</h3>
      <div className="space-y-1.5">{MARKET.map(([name,ok,note])=>(
        <div key={name} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/3 px-3 py-2 text-xs">
          <span className="text-slate-200">{ok?"✅":"⏳"} {name}</span><span className="text-slate-500">{note}</span>
          <Badge tone={ok?"ok":"warn"}>{ok?"Var":"Sonraki faz"}</Badge>
        </div>))}</div>
    </div>
    {msg&&<p className="mb-4 rounded-xl bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300">{msg}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="orion-card rounded-3xl p-5">
        <h3 className="font-semibold text-white flex gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300"/> KVKK & Alternatif Kimlikler</h3>
        <p className="mt-1 text-[11px] text-slate-500">Biyometrik vermek istemeyen personele kart/QR/PIN verilir. Açık rıza tarihi saklanır, rıza geri alınınca yüz devre dışı bırakılabilir.</p>
        <div className="mt-3 space-y-2 max-h-[460px] overflow-auto">{emps.map(e=>(
          <div key={e.id} className="rounded-xl bg-white/3 px-3 py-2 text-xs">
            <div className="flex justify-between"><span className="font-medium text-white">{e.firstName} {e.lastName}</span><Badge tone={e.kvkkConsentAt?"ok":"warn"}>{e.kvkkConsentAt?"Rıza var":"Rıza yok"}</Badge></div>
            <div className="mt-1 text-slate-500">Yüz: {e.hasFace?"✓":"-"} · Kart: {e.cardNo??"-"} · QR: {e.qrToken??"-"}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button tone="ghost" onClick={()=>void patch(e.id,{kvkkConsent:!e.kvkkConsentAt})}>{e.kvkkConsentAt?"Rızayı Geri Al":"Rıza Ver"}</Button>
              <Button tone="ghost" onClick={()=>void patch(e.id,{generateCard:true})}><CreditCard className="h-3 w-3"/> Kart</Button>
              <Button tone="ghost" onClick={()=>void patch(e.id,{generateQr:true})}><QrCode className="h-3 w-3"/> QR</Button>
              <Button tone="ghost" onClick={()=>void patch(e.id,{generatePin:true})}><KeyRound className="h-3 w-3"/> PIN</Button>
              <Button tone="ghost" onClick={()=>void meal(e.id)}><UtensilsCrossed className="h-3 w-3"/> Öğle Yemeği</Button>
            </div>
          </div>))}</div>
      </div>
      <div className="space-y-4">
        <div className="orion-card rounded-3xl p-5">
          <h3 className="font-semibold text-white">Yemekhane (Bugün)</h3>
          <div className="mt-2 text-sm text-slate-300">Kahvaltı {caf?.counts.kahvalti??0} · Öğle {caf?.counts.ogle??0} · Akşam {caf?.counts.aksam??0}</div>
          <div className="mt-2 space-y-1 text-xs text-slate-400">{caf?.items.map(i=><div key={i.id}>{i.name} — {i.mealType}</div>)}</div>
        </div>
        <div className="orion-card rounded-3xl p-5">
          <h3 className="font-semibold text-white flex gap-2"><WifiOff className="h-5 w-5 text-amber-300"/> Offline Dayanıklılık</h3>
          <p className="mt-1 text-xs text-slate-400">Bekleyen olay: <b className="text-white">{offline?.pending??0}</b>. İnternet kesilirse terminal olayları kuyruğa alır, bağlantı gelince senkron olur.</p>
          <div className="mt-3 flex gap-2">
            <Button tone="ghost" onClick={async()=>{await jsonFetch("/api/offline-queue",{method:"POST",body:JSON.stringify({doorId:1,payload:{demo:true,at:new Date().toISOString()}})}); await load();}}>Test Olayı Ekle</Button>
            <Button onClick={async()=>{await jsonFetch("/api/offline-queue",{method:"POST",body:JSON.stringify({action:"sync_all"})}); await load();}}><RefreshCw className="h-4 w-4"/> Senkron Et</Button>
          </div>
        </div>
      </div>
    </div>
  </div>;
}
