"use client";
import { useState } from "react";
import { useMarketStore } from "../../lib/market-client";
import { useBusinessResource, businessError } from "../../lib/business-client";
import { categories, cities } from "../../lib/categories";
import { distributionChannels, warehouses, transports, emptyDistribution, type Distribution } from "../../lib/distribution";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import { toast } from "../Toasts";
export function DistributionForm({initial,onSaved}:{initial?:Distribution|null;onSaved:()=>void}) {
 const {store}=useMarketStore();
 const [value,setValue]=useState<Distribution>(()=>({...emptyDistribution,...initial,regions:initial?.regions||store?.currentUser()?.serviceCities||[]}));
 const [brands,setBrands]=useState(value.brands.join(", "));
 const [pending,setPending]=useState(false),[error,setError]=useState("");
 const patch=(change:Partial<Distribution>)=>setValue(v=>({...v,...change}));
 function choices(key:"regions"|"categories"|"channels",label:string,options:Record<string,string>,max:number) {
  return <fieldset className="distribution-choices"><legend>{label}</legend>{Object.entries(options).map(([id,text])=><label className="ma-check" key={id}><input type="checkbox" checked={value[key].includes(id)} disabled={pending||(!value[key].includes(id)&&value[key].length>=max)} onChange={e=>patch({[key]:e.target.checked?[...value[key],id]:value[key].filter(v=>v!==id)})}/>{text}</label>)}</fieldset>;
 }
 return <form className="ma-form distribution-form" onSubmit={async e=>{e.preventDefault();if(pending)return;setPending(true);setError("");try {
  await store!.setMyDistribution({p_regions:value.regions,p_categories:value.categories,p_channels:value.channels,p_brands:brands.split(/[,\n]/).map(s=>s.trim()).filter(Boolean),p_warehouse:value.warehouse,p_transport:value.transport,p_cold_chain:value.coldChain,p_min_order:value.minOrder,p_exclusive:value.exclusive});
  toast("დისტრიბუციის პროფილი შენახულია.");onSaved();
 }catch(err){setError(businessError(err));}finally{setPending(false);}}}>
 <h3>დისტრიბუციის პროფილი</h3>
 {choices("regions","მომსახურების რეგიონები · აირჩიე მინიმუმ ერთი",cities,40)}
 {choices("categories","პროდუქტის კატეგორიები · მაქსიმუმ 6",categories,6)}
 {choices("channels","გაყიდვის არხები · აირჩიე მინიმუმ ერთი",distributionChannels,8)}
 <label className="ma-field">ბრენდები<textarea className="ma-textarea" value={brands} maxLength={1620} disabled={pending} onChange={e=>setBrands(e.target.value)}/><small>გამოყავი მძიმით. მაქსიმუმ 20 ბრენდი, თითო 80 სიმბოლო.</small></label>
 <div className="ma-form-grid">{([['warehouse','საწყობი',warehouses],['transport','ტრანსპორტი',transports]] as const).map(([key,label,options])=><label className="ma-field" key={key}>{label}<CustomSelect className="ma-select" value={value[key]} disabled={pending} onChange={e=>patch({[key]:e.target.value})}>{Object.entries(options).map(([id,text])=><option value={id} key={id}>{text}</option>)}</CustomSelect></label>)}</div>
 <label className="ma-field">მინიმალური შეკვეთა<input className="ma-input" value={value.minOrder} maxLength={80} disabled={pending} onChange={e=>patch({minOrder:e.target.value})}/></label>
 <label className="ma-check"><input type="checkbox" checked={value.coldChain} disabled={pending} onChange={e=>patch({coldChain:e.target.checked})}/>გაცივებული / გაყინული მიწოდება</label>
 <label className="ma-check"><input type="checkbox" checked={value.exclusive} disabled={pending} onChange={e=>patch({exclusive:e.target.checked})}/>მზად ვარ ექსკლუზიური თანამშრომლობისთვის</label>
 {error?<p className="ma-field__error" role="alert">{error}</p>:null}
 <Button type="submit" loading={pending} disabled={!value.regions.length||!value.channels.length}>პროფილის შენახვა</Button>
 </form>;
}
export function DistributionProfile({companyId}:{companyId:string}) {
 const {store,ready}=useMarketStore();
 const resource=useBusinessResource<Distribution[]>(ready?store?.companyDistributionProfiles:undefined,"distribution");
 const d=resource.data?.find(p=>p.id===companyId);
 if(!d)return null;
 return <section className="company-detail-section" id="distribution"><h2>დისტრიბუცია</h2><dl className="distribution-facts">
 {[["რეგიონები",d.regions.map(x=>cities[x]||x).join(", ")],["პროდუქტები",d.categories.map(x=>categories[x]||x).join(", ")],["არხები",d.channels.map(x=>distributionChannels[x]||x).join(", ")],["ბრენდები",d.brands.join(", ")],["საწყობი",d.warehouse==='none'?'':warehouses[d.warehouse]],["ტრანსპორტი",d.transport==='none'?'':transports[d.transport]],["მინიმალური შეკვეთა",d.minOrder],["მიწოდება",d.coldChain?'გაცივებული / გაყინული':''],["თანამშრომლობა",d.exclusive?'ექსკლუზივიც შესაძლებელია':'']].filter(([,text])=>text).map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}
 </dl>{d.brands.length?<p className="business-fineprint">ბრენდები მითითებულია კომპანიის მიერ; ოფიციალურ წარმომადგენლობას არ ადასტურებს.</p>:null}</section>;
}
