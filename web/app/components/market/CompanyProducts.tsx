"use client";
import { useCallback, useState } from "react";
import { useMarketStore } from "../../lib/market-client";
import { useBusinessResource, businessError } from "../../lib/business-client";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import { ProductCard, type ProductCardData } from "./ProductCard";
import { ListSkeleton } from "./Skeletons";
import { toast } from "../Toasts";
export function CompanyProducts({companyId,edit=false,fallback=[]}:{companyId:string;edit?:boolean;fallback?:ProductCardData[]}) {
 const {store,ready}=useMarketStore();
 const read=store?.companyProducts;
 const load=useCallback(()=>read!(companyId),[read,companyId]);
 const resource=useBusinessResource<ProductCardData[]>(ready&&store?load:undefined,companyId);
 if(resource.error && (edit || !fallback.length))return <p role="alert">{resource.error} <Button variant="ghost" onClick={resource.reload}>ხელახლა ცდა</Button></p>;
 if(!resource.data && (edit || !fallback.length))return <ListSkeleton compact kind="records" label="პროდუქტები იტვირთება…"/>;
 if(edit)return <ProductsForm key={companyId} initial={resource.data || []} onSaved={resource.replace}/>;
 const loaded = resource.data || [];
 const products = [...loaded, ...fallback.filter(item => !loaded.some(product => product.name === item.name))];
 if(!products.length)return null;
 return <section className="company-detail-section"><h2>პროდუქტები და მომსახურება</h2><div className="company-product-grid">{products.map((product,i)=><ProductCard key={`${i}:${product.name}`} {...product}/>)}</div></section>;
}
function ProductsForm({initial,onSaved}:{initial:ProductCardData[];onSaved:(items:ProductCardData[])=>void}) {
 const {store}=useMarketStore();const [items,setItems]=useState(initial),[pending,setPending]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false);
 const gallery: string[]=store?.currentUser()?.gallery||[];
 const patch=(index:number,value:Partial<ProductCardData>)=>{setSaved(false);setItems(all=>all.map((item,i)=>i===index?{...item,...value}:item));};
 return <section><h2>პროდუქტები ფოტოთი</h2><p>დაამატე მაქსიმუმ 12 პროდუქტი. ფოტო აირჩიე <Button variant="ghost" href="/account/?tab=profile">პროფილის გალერეიდან</Button>.</p>
 <form className="ma-form" onChange={()=>setSaved(false)} onSubmit={async e=>{e.preventDefault();if(pending)return;setPending(true);setError("");setSaved(false);try{const saved=await store!.setMyProducts(items);onSaved(saved);setSaved(true);toast("პროდუქტები შენახულია.");}catch(err){setError(businessError(err));}finally{setPending(false);}}}>
 {items.map((item,index)=><fieldset key={index} className="ma-panel ma-stack"><legend>პროდუქტი {index+1}</legend>
 <label className="ma-field">დასახელება<input className="ma-input" required minLength={2} maxLength={80} value={item.name} disabled={pending} onChange={e=>patch(index,{name:e.target.value})}/></label>
 <label className="ma-field">ფოტო<CustomSelect className="ma-select" value={item.photoUrl||""} disabled={pending} onChange={e=>patch(index,{photoUrl:e.target.value})}><option value="">აირჩიე ფოტო</option>{gallery.map((url,i)=><option value={url} key={url}>გალერეის ფოტო {i+1}</option>)}</CustomSelect></label>
 {item.photoUrl?<ProductCard {...item} preview/>:null}
 <label className="ma-field">მოკლე აღწერა<input className="ma-input" maxLength={200} value={item.note||""} disabled={pending} onChange={e=>patch(index,{note:e.target.value})}/></label>
 <Button variant="danger-quiet" disabled={pending} onClick={()=>{setSaved(false);setItems(all=>all.filter((_,i)=>i!==index));}}>პროდუქტის ამოღება</Button>
 </fieldset>)}
 <Button variant="secondary" disabled={pending||items.length>=12||!gallery.length} onClick={()=>{setSaved(false);setItems(all=>[...all,{name:"",photoUrl:gallery[0],note:""}]);}}>პროდუქტის დამატება</Button>
 {error?<p className="ma-field__error" role="alert">{error}</p>:null}
 <Button type="submit" loading={pending} disabled={items.some(item=>!item.photoUrl)}>პროდუქტების შენახვა</Button>
 {saved?<p className="account-save-feedback" role="status">პროდუქტები შენახულია.</p>:null}
 </form></section>;
}
