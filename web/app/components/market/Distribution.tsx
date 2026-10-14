"use client";
import { MultiCombobox } from "../ui/MultiCombobox";
import { categoryOptions, cityOptions } from "../ui/combobox-options";
import { useState } from "react";
import { useMarketStore } from "../../lib/market-client";
import { businessError } from "../../lib/business-client";
import { distributionChannels, warehouses, transports, emptyDistribution, type Distribution } from "../../lib/distribution";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import styles from "./Distribution.module.css";
import { toast } from "../Toasts";
export function DistributionForm({initial,onSaved}:{initial?:Distribution|null;onSaved:()=>void}) {
 const {store}=useMarketStore();
 const [value,setValue]=useState<Distribution>(()=>({...emptyDistribution,...initial,regions:initial?.regions||store?.currentUser()?.serviceCities||[]}));
 const [pending,setPending]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false);
 const patch=(change:Partial<Distribution>)=>{setSaved(false);setValue(v=>({...v,...change}));};
 return <form className={`ma-form distribution-form ${styles.form}`} onChange={()=>setSaved(false)} onSubmit={async e=>{e.preventDefault();if(pending)return;if(!value.channels.length){setError("აირჩიეთ მინიმუმ ერთი არხი");document.getElementById("distribution-channels")?.focus();return;}if(!value.regions.length){setError("აირჩიეთ მინიმუმ ერთი ქალაქი");return;}setPending(true);setError("");setSaved(false);try {
  await store!.setMyDistribution({p_regions:value.regions,p_categories:value.categories,p_channels:value.channels,p_brands:value.brands,p_warehouse:value.warehouse,p_transport:value.transport,p_cold_chain:value.coldChain,p_min_order:value.minOrder,p_exclusive:value.exclusive});
  toast("დისტრიბუციის პროფილი შენახულია.");setSaved(true);onSaved();
 }catch(err){setError(businessError(err));}finally{setPending(false);}}}>
 <h3>მიწოდების პირობები</h3>
 <fieldset className={styles.selections} disabled={pending}>
 <MultiCombobox label="მომსახურების ქალაქები" options={cityOptions} exclusiveValue="georgia" id="distribution-cities" value={value.regions} onChange={regions=>patch({regions})} disabled={pending}/>
 <MultiCombobox label="პროდუქტის კატეგორიები" options={categoryOptions} limit={6} value={value.categories} onChange={categories=>patch({categories})}/>
 <MultiCombobox id="distribution-channels" label="გაყიდვის არხები" hint="აირჩიეთ მინიმუმ ერთი" required aria-describedby={error ? "distribution-error" : undefined} options={Object.entries(distributionChannels).map(([value,label])=>({value,label}))} value={value.channels} limit={8} onChange={channels=>{setError("");patch({channels});}}/>
 <MultiCombobox creatable limit={20} options={[]} id="distribution-brands" label="ბრენდები" value={value.brands} onChange={brands=>patch({brands})} maxLength={80} disabled={pending}/>
 </fieldset>
 <div className="ma-form-grid">{([['warehouse','საწყობი',warehouses],['transport','ტრანსპორტი',transports]] as const).map(([key,label,options])=><label className="ma-field" key={key}>{label}<CustomSelect className="ma-select" value={value[key]} disabled={pending} onChange={e=>patch({[key]:e.target.value})}>{Object.entries(options).map(([id,text])=><option value={id} key={id}>{text}</option>)}</CustomSelect></label>)}</div>
 <label className="ma-field">მინიმალური შეკვეთა<input className="ma-input" value={value.minOrder} maxLength={80} disabled={pending} onChange={e=>patch({minOrder:e.target.value})}/></label>
 <label className="ma-check"><input type="checkbox" checked={value.coldChain} disabled={pending} onChange={e=>patch({coldChain:e.target.checked})}/>გაცივებული / გაყინული მიწოდება</label>
 <label className="ma-check"><input type="checkbox" checked={value.exclusive} disabled={pending} onChange={e=>patch({exclusive:e.target.checked})}/>მზად ვარ ექსკლუზიური თანამშრომლობისთვის</label>
 {error?<p id="distribution-error" className="ma-field__error" role="alert">{error}</p>:null}
 <Button type="submit" loading={pending}>შეინახეთ</Button>
 {saved?<p className="account-save-feedback" role="status">დისტრიბუციის პროფილი შენახულია.</p>:null}
 </form>;
}
