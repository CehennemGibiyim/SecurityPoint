"use client";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, LogIn, LogOut, Plus, QrCode } from "lucide-react";
import { Badge, Button, Field, PageHeader, inputClass } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";

type V={id:number;fullName:string;company:string|null;phone:string|null;purpose:string|null;hostName:string|null;qrToken:string;validFrom:string;validTo:string;status:string};
type Emp={id:number;firstName:string;lastName:string};
const STATUS: Record<string,{label:string;tone:"ok"|"bad"|"gold"|"warn"}> = {
  expected:{label:"Bekliyor",tone:"gold"},
  checked_in:{label:"İçeride",tone:"ok"},
  checked_out:{label:"Çıkış yaptı",tone:"gold"},
  used:{label:"QR kullanıldı",tone:"bad"},
  blacklisted:{label:"Yasaklı",tone:"bad"},
};

export default function Page(){
  const [items,setItems]=useState<V[]>([]); const [emps,setEmps]=useState<Emp[]>([]);
  const [form,setForm]=useState({fullName:"",company:"",phone:"",purpose:"",hostEmployeeId:"",validHours:4});
  const [msg,setMsg]=useState("");
  const [qrMap,setQrMap]=useState<Record<number,string>>({});
  const [qrOpen,setQrOpen]=useState<V|null>(null);

  // QR görselleri istemcide üretilir (ham token gömülür — terminaldeki tarayıcı birebir okur)
  useEffect(()=>{
    let alive=true;
    void (async()=>{
      try{
        const { default: QRCode } = await import("qrcode");
        const map:Record<number,string>={};
        for(const v of items){
          try{ map[v.id]=await QRCode.toDataURL(v.qrToken,{width:260,margin:1,color:{dark:"#0b1020",light:"#ffffff"}}); }catch{ /* tek QR hatası tüm listeyi düşürmesin */ }
        }
        if(alive) setQrMap(map);
      }catch{ /* qrcode yoksa liste sorunsuz kalır */ }
    })();
    return ()=>{alive=false;};
  },[items]);

  /** Yaka kartını yeni pencerede, yalnız kartı basacak şekilde yazdırır. */
  function printBadge(v:V){
    const w=window.open("","_blank","width=460,height=680");
    if(!w) return;
    const qr=qrMap[v.id]?`<img src="${qrMap[v.id]}" style="width:230px;height:230px"/>`:"";
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Yaka Kartı — ${v.fullName}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;display:flex;justify-content:center;background:#f1f5f9;margin:0;padding:26px}
      .card{background:#fff;border-radius:18px;padding:26px;width:320px;text-align:center;box-shadow:0 12px 34px rgba(0,0,0,.18)}
      .brand{font-size:10px;letter-spacing:.2em;color:#0284c7;font-weight:800}
      h1{font-size:18px;margin:14px 0 4px;color:#0f172a}.sub{color:#475569;font-size:13px}
      .meta{font-size:12px;color:#64748b;margin-top:12px;line-height:1.7}
      .note{margin-top:14px;font-size:11px;color:#b45309;font-weight:800;letter-spacing:.04em}
      @media print{body{background:#fff;padding:0}.card{box-shadow:none}}
    </style></head><body><div class="card"><div class="brand">ORION FACEGATE × PUANTAJ26</div>${qr}
      <h1>${v.fullName}</h1><div class="sub">${v.company ?? ""}</div>
      <div class="meta">Ev sahibi: ${v.hostName ?? "-"}<br/>Amaç: ${v.purpose ?? "-"}<br/>
      Geçerlilik: ${new Date(v.validFrom).toLocaleString("tr-TR")}<br/>→ ${new Date(v.validTo).toLocaleString("tr-TR")}</div>
      <div class="note">TEK GEÇİŞLİK QR — ilk geçişte geçersizleşir</div></div>
    <\/script>window.onload=function(){window.print();};<\/body></html>`);
    w.document.close();
  }
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
    <PageHeader kicker="Piyasa Modülü" title="Ziyaretçi Yönetimi" description="Ön kayıt, süreli TEK GEÇİŞLİK QR e-pass, ev sahibi bildirimi, blacklist ve yazdırılabilir yaka kartı. Ziyaretçi yalnız izinli kapılardan geçer; ilk geçişte QR düşer." />
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {items.map(v=>(
          <div key={v.id} className="orion-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
            <button onClick={()=>setQrOpen(v)} title="QR'ı büyüt" className="shrink-0 rounded-xl bg-white p-1.5 transition hover:ring-2 hover:ring-cyan-300/60">
              {qrMap[v.id]
                ? <img src={qrMap[v.id]} alt="QR" className="h-16 w-16"/>
                : <div className="flex h-16 w-16 items-center justify-center text-[9px] text-slate-500">QR<br/>yükleniyor</div>}
            </button>
            <div>
              <div className="font-medium text-white">{v.fullName} {v.company?`· ${v.company}`:""}</div>
              <div className="text-xs text-slate-400">Ev sahibi: {v.hostName??"-"} · {v.purpose??""} · QR: {v.qrToken.slice(0,8)}… · Bitiş: {new Date(v.validTo).toLocaleString("tr-TR")}</div>
              {v.status==="used"&&<div className="text-[11px] text-rose-300">Bu QR tek geçişliktir ve kullanılmıştır — yeniden üretin.</div>}
            </div>
            <div className="flex gap-2">
              <Badge tone={(STATUS[v.status]?.tone ?? "gold")}>{STATUS[v.status]?.label ?? v.status}</Badge>
              {v.status==="expected"&&<Button onClick={()=>void act(v.id,"checkin")}><LogIn className="h-4 w-4"/> Giriş</Button>}
              {v.status==="checked_in"&&<Button tone="ghost" onClick={()=>void act(v.id,"checkout")}><LogOut className="h-4 w-4"/> Çıkış</Button>}
              <Button tone="ghost" onClick={()=>printBadge(v)}>Yaka Kartı</Button>
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
    {qrOpen&&(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6" onClick={()=>setQrOpen(null)}>
        <div className="orion-card w-full max-w-sm rounded-3xl p-6 text-center" onClick={e=>e.stopPropagation()}>
          <div className="text-[10px] font-bold tracking-[0.2em] text-cyan-300">ORION FACEGATE × PUANTAJ26</div>
          {qrMap[qrOpen.id]
            ? <img src={qrMap[qrOpen.id]} alt="QR" className="mx-auto mt-4 h-56 w-56 rounded-2xl bg-white p-2"/>
            : <div className="mx-auto mt-4 flex h-56 w-56 items-center justify-center rounded-2xl bg-white/5 text-xs text-slate-400">QR üretiliyor…</div>}
          <div className="mt-4 font-semibold text-white">{qrOpen.fullName}</div>
          <div className="text-xs text-slate-400">{qrOpen.company??""} · Ev sahibi: {qrOpen.hostName??"-"}</div>
          <div className="mt-1 text-[11px] text-slate-500">{new Date(qrOpen.validFrom).toLocaleString("tr-TR")} → {new Date(qrOpen.validTo).toLocaleString("tr-TR")}</div>
          <div className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-200">TEK GEÇİŞLİK — ilk geçişte geçersizleşir</div>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={()=>printBadge(qrOpen)}>Yaka Kartını Yazdır</Button>
            <Button tone="ghost" onClick={()=>setQrOpen(null)}>Kapat</Button>
          </div>
        </div>
      </div>
    )}
  </div>;
}
