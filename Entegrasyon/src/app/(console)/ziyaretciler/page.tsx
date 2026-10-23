"use client";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, LogIn, LogOut, Plus, QrCode } from "lucide-react";
import { Badge, Button, Field, PageHeader, inputClass } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";

type V={id:number;fullName:string;company:string|null;phone:string|null;purpose:string|null;hostName:string|null;qrToken:string;validFrom:string;validTo:string;status:string};
type Emp={id:number;firstName:string;lastName:string};

export default function Page(){
  const [items,setItems]=useState<V[]>([]); const [emps,setEmps]=useState<Emp[]>([]);
  const [form,setForm]=useState({fullName:"",company:"",phone:"",purpose:"",hostEmployeeId:"",validHours:4});
  const [msg,setMsg]=useState("");
  const load=useCallback(async()=>{
    const d=await jsonFetch<{items:V[]}>("/api/visitors"); setItems(d.items);
    const e=await jsonFetch<{items:Emp[]}>("/api/employees"); setEmps(e.items);
  },[]);
  useEffect(()=>{void load();},[load]);
  async function create(){
    if(!form.fullName.trim()){setMsg("İsim zorunlu");return;}
    const r=await jsonFetch<{item:V}>("/api/visitors",{method:"POST",body:JSON.stringify({...form,hostEmployeeId:form.hostEmployeeId?Number(form.hostEmployeeId):null})});
    setMsg(`Ziyaretçi QR üretildi: ${r.item.qrToken.slice(0,8)}… (${form.validHours} saat geçerli) — yaka kartını yazdırın.`); await load();
  }
  async function act(id:number,action:string){
    try{await jsonFetch(`/api/visitors/${id}`,{method:"PUT",body:JSON.stringify({action})});}
    catch(e){setMsg(e instanceof Error?e.message:"Hata");return;}
    await load();
  }
  return <div>
    <PageHeader kicker="Piyasa Modülü" title="Ziyaretçi Yönetimi" description="Ön kayıt, süreli QR e-pass, ev sahibi bildirimi, blacklist ve yaka kartı. Ziyaretçi sadece izinli kapılardan QR ile geçer." />
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {items.map(v=>(
          <div key={v.id} className="orion-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
            <div>
              <div className="font-medium text-white">{v.fullName} {v.company?`· ${v.company}`:""}</div>
              <div className="text-xs text-slate-400">Ev sahibi: {v.hostName??"-"} · {v.purpose??""} · QR: {v.qrToken.slice(0,8)}… · Bitiş: {new Date(v.validTo).toLocaleString("tr-TR")}</div>
            </div>
            <div className="flex gap-2">
              <Badge tone={v.status==="checked_in"?"ok":v.status==="blacklisted"?"bad":"gold"}>{v.status}</Badge>
              {v.status==="expected"&&<Button onClick={()=>void act(v.id,"checkin")}><LogIn className="h-4 w-4"/> Giriş</Button>}
              {v.status==="checked_in"&&<Button tone="ghost" onClick={()=>void act(v.id,"checkout")}><LogOut className="h-4 w-4"/> Çıkış</Button>}
              <Button tone="ghost" onClick={()=>window.print()}>Yaka Kartı</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="orion-card rounded-3xl p-5 space-y-3 h-fit">
        <h3 className="font-semibold text-white flex gap-2"><QrCode className="h-5 w-5 text-cyan-300"/> Ön Kayıt + QR Üret</h3>
        <Field label="Ad Soyad *"><input className={inputClass} value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/></Field>
        <Field label="Firma"><input className={inputClass} value={form.company} onChange={e=>setForm({...form,company:e.target.value})}/></Field>
        <Field label="Amaç"><input className={inputClass} value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})}/></Field>
        <Field label="Ev Sahibi Personel"><select className={inputClass} value={form.hostEmployeeId} onChange={e=>setForm({...form,hostEmployeeId:e.target.value})}><option value="">Seçin</option>{emps.map(e=><option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select></Field>
        <Field label="Geçerlilik (saat)"><input type="number" className={inputClass} value={form.validHours} onChange={e=>setForm({...form,validHours:Number(e.target.value)})}/></Field>
        {msg&&<p className="rounded-xl bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300 flex gap-2"><BadgeCheck className="h-4 w-4 shrink-0"/>{msg}</p>}
        <Button onClick={()=>void create()} className="gap-2"><Plus className="h-4 w-4"/> Ziyaretçi Oluştur</Button>
      </div>
    </div>
  </div>;
}
