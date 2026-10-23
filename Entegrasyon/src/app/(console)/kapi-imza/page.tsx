"use client";
import { useEffect, useState } from "react";
import { PageHeader, inputClass } from "@/components/ui";

type DoorEvent = { id:number; eventType:string; result:string; reason:string|null; createdAt:string; employeeName:string; employeeNo:string|null; doorName:string };
export default function KapiImza() {
  const [date,setDate]=useState(new Date().toLocaleDateString("en-CA"));
  const [events,setEvents]=useState<DoorEvent[]>([]);
  const [error,setError]=useState("");
  useEffect(()=>{let live=true;fetch(`/api/logs?date=${encodeURIComponent(date)}`).then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}).then(data=>{if(live)setEvents(data.items||[])}).catch(e=>{if(live)setError(String(e))});return()=>{live=false}},[date]);
  return <div className="space-y-5">
    <PageHeader kicker="KAPI SİSTEMİ" title="Kapı İmza" description="Yüz/kart doğrulama olayları. Kayıt olmaması devamsızlık veya nöbete gelmeme anlamına gelmez." actions={<input className={inputClass} type="date" value={date} onChange={e=>setDate(e.target.value)}/>}/>
    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm text-cyan-100">Bu ekran sadece Face kapı olaylarını okur. Puantaj26 hesaplamalarını, kayıtlarını ve resmî belgelerini değiştirmez. Olay kayıtları hukuki e-imza değildir.</div>
    {error&&<p role="alert">Kapı kayıtları alınamadı: {error}</p>}
    <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full text-left text-sm"><thead className="bg-white/5"><tr>{["Zaman","Personel","Kapı","Olay","Sonuç"].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{events.map(e=><tr key={e.id} className="border-t border-white/10"><td className="p-3">{new Date(e.createdAt).toLocaleString("tr-TR")}</td><td className="p-3">{e.employeeName} {e.employeeNo?`(${e.employeeNo})`:""}</td><td className="p-3">{e.doorName}</td><td className="p-3">{e.eventType}</td><td className="p-3">{e.result}</td></tr>)}</tbody></table>{events.length===0&&!error&&<p className="p-4 text-sm text-white/60">Seçilen tarihte kapı olayı bulunamadı. Bu durum işe gelinmediğini göstermez.</p>}</div>
    <p className="text-xs text-white/50">Mevcut Face olay API'sinden okunan kayıtlar; ilk 200 olay görüntülenir. Giriş/çıkış yönü, yalnızca cihaz olayı açıkça belirtiyorsa kabul edilmelidir.</p>
  </div>
}
