"use client";
import { useCallback, useState } from "react";
import { useMarketStore } from "../../lib/market-client";
import { useBusinessResource, businessError } from "../../lib/business-client";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import { ProductCard, type ProductCardData } from "./ProductCard";
import { toast } from "../Toasts";
export function CompanyProducts({companyId,edit=false}:{companyId:string;edit?:boolean}) {
 const {store,ready}=useMarketStore();
 const load=useCallback(()=>store!.companyProducts(companyId),[store,companyId]);
 const resource=useBusinessResource<ProductCardData[]>(ready&&store?load:undefined,companyId);
 if(resource.error)return <p role="alert">{resource.error} <Button variant="ghost" onClick={resource.reload}>ხელახლა ცდა</Button></p>;
 if(!resource.data)return null;
 if(edit)return <ProductsForm key={companyId} initial={resource.data} onSaved={resource.replace}/>;
 if(!resource.data.length)return null;
 return <section className="company-detail-section"><h2>პროდუქტები</h2><div className="company-product-grid">{resource.data.map((product,i)=><ProductCard key={`${i}:${product.name}`} {...product}/>)}</div></section>;
}
function ProductsForm({initial,onSaved}:{initial:ProductCardData[];onSaved:(items:ProductCardData[])=>void}) {
 const {store}=useMarketStore();const [items,setItems]=useState(initial),[pending,setPending]=useState(false),[error,setError]=useState("");
 const gallery: string[]=store?.currentUser()?.gallery||[];
 const patch=(index:number,value:Partial<ProductCardData>)=>setItems(all=>all.map((item,i)=>i===index?{...item,...value}:item));
 return <section><h2>პროდუქტები ფოტოთი</h2><p>დაამატე მაქსიმუმ 12 პროდუქტი. ფოტო აირჩიე <Button variant="ghost" href="/account/?tab=profile">პროფილის გალერეიდან</Button>.</p>
 <form className="ma-form" onSubmit={async e=>{e.preventDefault();if(pending)return;setPending(true);setError("");try{const saved=await store!.setMyProducts(items);onSaved(saved);toast("პროდუქტები შენახულია.");}catch(err){setError(businessError(err));}finally{setPending(false);}}}>
 {items.map((item,index)=><fieldset key={index} className="ma-panel ma-stack"><legend>პროდუქტი {index+1}</legend>
 <label className="ma-field">დასახელება<input className="ma-input" required minLength={2} maxLength={80} value={item.name} disabled={pending} onChange={e=>patch(index,{name:e.target.value})}/></label>
 <label className="ma-field">ფოტო<CustomSelect className="ma-select" value={item.photoUrl||""} disabled={pending} onChange={e=>patch(index,{photoUrl:e.target.value})}><option value="">აირჩიე ფოტო</option>{gallery.map((url,i)=><option value={url} key={url}>გალერეის ფოტო {i+1}</option>)}</CustomSelect></label>
 {item.photoUrl?<ProductCard {...item}/>:null}
 <label className="ma-field">მოკლე აღწერა<input className="ma-input" maxLength={200} value={item.note||""} disabled={pending} onChange={e=>patch(index,{note:e.target.value})}/></label>
 <Button variant="danger-quiet" disabled={pending} onClick={()=>setItems(all=>all.filter((_,i)=>i!==index))}>პროდუქტის ამოღება</Button>
 </fieldset>)}
 <Button variant="secondary" disabled={pending||items.length>=12||!gallery.length} onClick={()=>setItems(all=>[...all,{name:"",photoUrl:gallery[0],note:""}])}>პროდუქტის დამატება</Button>
 {error?<p className="ma-field__error" role="alert">{error}</p>:null}
 <Button type="submit" loading={pending} disabled={items.some(item=>!item.photoUrl)}>პროდუქტების შენახვა</Button>
 </form></section>;
}
