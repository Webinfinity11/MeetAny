"use client";
import { MultiCombobox } from "../ui/MultiCombobox";
import { categoryOptions, cityOptions } from "../ui/combobox-options";
import { useState } from "react";
import { useMarketStore } from "../../lib/market-client";
import { businessError } from "../../lib/business-client";
import { distributionChannels, warehouses, transports, emptyDistribution, type Distribution } from "../../lib/distribution";
import { CustomSelect } from "../ui/CustomSelect";
import styles from "./Distribution.module.css";
import { AccountSectionFooter, UnsavedSheet, useSavedTime } from "./account/AccountSection";
import { useUnsavedGuard } from "../../lib/use-unsaved-draft";
import { OnboardItems } from "./OnboardFields";
import { normalizeOnboardItems, onboardItemsError } from "../../lib/onboarding-client";
export function DistributionForm({initial,onSaved}:{initial?:Distribution|null;onSaved:()=>void}) {
 const {store}=useMarketStore();
 const [value,setValue]=useState<Distribution>(()=>({...emptyDistribution,...initial,regions:initial?.regions||store?.currentUser()?.serviceCities||[]}));
 const [pending,setPending]=useState(false),[error,setError]=useState("");
 const snapshot=JSON.stringify(value), [baseline,setBaseline]=useState(snapshot);
 const dirty=snapshot!==baseline, guard=useUnsavedGuard(dirty);
 const {savedAt,markSaved,clearSaved}=useSavedTime();
 const patch=(change:Partial<Distribution>)=>{clearSaved();setValue(v=>({...v,...change}));};
 async function save(){
  if(!store||pending)return false;if(!dirty)return true;
  if(!value.regions.length){setError("აირჩიეთ მინიმუმ ერთი ქალაქი");document.getElementById("distribution-cities")?.focus();return false;}
  if(!value.channels.length){setError("აირჩიეთ მინიმუმ ერთი არხი");document.getElementById("distribution-channels")?.focus();return false;}
  const brandsError=onboardItemsError(value.brands,{limit:20,maxLength:80});
  if(brandsError){setError(brandsError);document.querySelector<HTMLElement>("#distribution-brands textarea, #distribution-brands button")?.focus();return false;}
  const brands=normalizeOnboardItems(value.brands),savedValue={...value,brands};
  setPending(true);setError("");clearSaved();
  try {
   await store.setMyDistribution({p_regions:value.regions,p_categories:value.categories,p_channels:value.channels,p_brands:brands,p_warehouse:value.warehouse,p_transport:value.transport,p_cold_chain:value.coldChain,p_min_order:value.minOrder,p_exclusive:value.exclusive});
   setValue(savedValue);setBaseline(JSON.stringify(savedValue));markSaved();onSaved();return true;
  }catch(err){setError(businessError(err));return false;}finally{setPending(false);}
 }
 return <section className="account-section account-profile-block"><header className="account-section__heading"><h2 className="account-section__title">მიწოდების პირობები</h2></header>
 <form className={`ma-form distribution-form ${styles.form}`} onSubmit={e=>{e.preventDefault();void save();}}>
 <fieldset className={styles.selections} disabled={pending}>
 <MultiCombobox label="მომსახურების ქალაქები" options={cityOptions} exclusiveValue="georgia" id="distribution-cities" required aria-invalid={!!error&&!value.regions.length} aria-describedby={error ? "distribution-error" : undefined} value={value.regions} onChange={regions=>{setError("");patch({regions});}} disabled={pending}/>
 <MultiCombobox label="პროდუქტის კატეგორიები" options={categoryOptions} limit={6} value={value.categories} onChange={categories=>patch({categories})}/>
 <MultiCombobox id="distribution-channels" label="გაყიდვის არხები" required aria-invalid={!!error&&!value.channels.length} aria-describedby={error ? "distribution-error" : undefined} options={Object.entries(distributionChannels).map(([value,label])=>({value,label}))} value={value.channels} limit={8} onChange={channels=>{setError("");patch({channels});}}/>
 <div id="distribution-brands"><OnboardItems label="ბრენდები" values={value.brands} onChange={brands=>{setError("");patch({brands});}} limit={20} maxLength={80}/></div>
 </fieldset>
 <div className="ma-form-grid">{([['warehouse','საწყობი',warehouses],['transport','ტრანსპორტი',transports]] as const).map(([key,label,options])=><label className="ma-field" key={key}>{label}<CustomSelect className="ma-select" value={value[key]} disabled={pending} onChange={e=>patch({[key]:e.target.value})}>{Object.entries(options).map(([id,text])=><option value={id} key={id}>{text}</option>)}</CustomSelect></label>)}</div>
 <label className="ma-field">მინიმალური შეკვეთა<input className="ma-input" value={value.minOrder} maxLength={80} disabled={pending} onChange={e=>patch({minOrder:e.target.value})}/></label>
 <label className="ma-check"><input type="checkbox" checked={value.coldChain} disabled={pending} onChange={e=>patch({coldChain:e.target.checked})}/>გაცივებული / გაყინული მიწოდება</label>
 <label className="ma-check"><input type="checkbox" checked={value.exclusive} disabled={pending} onChange={e=>patch({exclusive:e.target.checked})}/>მზად ვარ ექსკლუზიური თანამშრომლობისთვის</label>
 <AccountSectionFooter dirty={dirty} pending={pending} savedAt={savedAt} error={error} errorId="distribution-error"/>
 </form><UnsavedSheet id="distribution-unsaved" guard={guard} pending={pending} error={error} save={save}/></section>;
}
