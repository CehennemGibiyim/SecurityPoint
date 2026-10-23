"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, Plus, X } from "lucide-react";
import { Badge, Button, Field, PageHeader, inputClass } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";

type Leave = { id:number; employeeId:number; employeeName:string; employeeNo:string; type:string; startDate:string; endDate:string; days:number; reason:string|null; status:string };
type Emp = { id:number; firstName:string; lastName:string; employeeNo:string; annualLeaveQuota?:number };
const TYPES: Record<string,string> = { yillik:"Yıllık İzin", mazeret:"Mazeret", rapor:"Sağlık Raporu", ucretsiz:"Ücretsiz", dogum:"Doğum", evlilik:"Evlilik", olum:"Ölüm / Yakın" };

export default function Page(){
  const [items,setItems]=useState<Leave[]>([]);
  const [emps,setEmps]=useState<Emp[]>([]);
  const [balances,setBalances]=useState<Array<{employeeId:number;used:number;remaining:number}>>([]);
  const [form,setForm]=useState({employeeId:"",type:"yillik",startDate:"",endDate:"",reason:""});
  const [msg,setMsg]=useState("");
  const load=useCallback(async()=>{
    const d=await jsonFetch<{items:Leave[];balances:Array<{employeeId:number;used:number;remaining:number}>}>("/api/face/leaves");
    setItems(d.items); setBalances(d.balances);
    const e=await jsonFetch<{items:Emp[]}>("/api/employees"); setEmps(e.items);
  },[]);
  useEffect(()=>{void load();},[load]);
  async function create(){
    if(!form.employeeId||!form.startDate||!form.endDate){setMsg("Personel ve tarihler zorunlu.");return;}
    await jsonFetch("/api/face/leaves",{method:"POST",body:JSON.stringify({...form,employeeId:Number(form.employeeId)})});
    setMsg("İzin talebi oluşturuldu (pending)."); await load();
  }
  async function decide(id:number,status:string){
    await jsonFetch(`/api/face/leaves/${id}`,{method:"PUT",body:JSON.stringify({status,approvedBy:"İK Yöneticisi"})});
    await load();
  }
  return <div>
    <PageHeader kicker="Piyasa Modülü" title="İzin & Devamsızlık" description="Yıllık/mazeret/rapor izinleri, onay akışı ve bakiye. Onaylı izin günü terminalde mesai başlatmayı engeller." />
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {items.map(i=>(
          <div key={i.id} className="orion-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
            <div>
              <div className="font-medium text-white">{i.employeeName} <span className="text-xs text-slate-500">{i.employeeNo}</span></div>
              <div className="text-xs text-slate-400"><CalendarDays className="mr-1 inline h-3 w-3"/>{TYPES[i.type]??i.type} · {i.startDate} → {i.endDate} ({i.days} gün) {i.reason?`· ${i.reason}`:""}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={i.status==="approved"?"ok":i.status==="rejected"?"bad":"warn"}>{i.status}</Badge>
              {i.status==="pending"&&<><Button onClick={()=>void decide(i.id,"approved")}><Check className="h-4 w-4"/></Button><Button tone="ghost" onClick={()=>void decide(i.id,"rejected")}><X className="h-4 w-4"/></Button></>}
            </div>
          </div>
        ))}
        {!items.length&&<p className="text-sm text-slate-500">İzin yok</p>}
      </div>
      <div className="space-y-4">
        <div className="orion-card rounded-3xl p-5 space-y-3">
          <h3 className="font-semibold text-white">Yeni İzin Talebi</h3>
          <Field label="Personel"><select className={inputClass} value={form.employeeId} onChange={e=>setForm({...form,employeeId:e.target.value})}><option value="">Seçin</option>{emps.map(e=><option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select></Field>
          <Field label="Tip"><select className={inputClass} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{Object.entries(TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-2"><Field label="Başlangıç"><input type="date" className={inputClass} value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></Field><Field label="Bitiş"><input type="date" className={inputClass} value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></Field></div>
          <Field label="Gerekçe"><input className={inputClass} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
          {msg&&<p className="text-xs text-cyan-300">{msg}</p>}
          <Button onClick={()=>void create()} className="gap-2"><Plus className="h-4 w-4"/> Talep Oluştur</Button>
        </div>
        <div className="orion-card rounded-3xl p-5">
          <h3 className="font-semibold text-white">Yıllık İzin Bakiyeleri</h3>
          <div className="mt-3 space-y-2 text-xs">{balances.map(b=>{const e=emps.find(x=>x.id===b.employeeId);return <div key={b.employeeId} className="flex justify-between"><span className="text-slate-300">{e?`${e.firstName} ${e.lastName}`:`#${b.employeeId}`}</span><span className="text-slate-400">Kullanılan {b.used} · Kalan <b className="text-cyan-300">{b.remaining}</b></span></div>;})}{!balances.length&&<p className="text-slate-500">Henüz onaylı yıllık izin yok</p>}</div>
        </div>
      </div>
    </div>
  </div>;
}
