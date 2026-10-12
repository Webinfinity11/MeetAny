"use client";
import { useCallback, useState } from "react";
import { useMarketStore } from "../../lib/market-client";
import { useBusinessResource, businessError } from "../../lib/business-client";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import { type ProductCardData } from "./ProductCard";
import { ListSkeleton } from "./Skeletons";
import styles from "./company/CompanyProfile.module.css";
import { Icon } from "../Icon";
import { toast } from "../Toasts";
import { Modal } from "../ui/Modal";
import Image from "next/image";
import Link from "next/link";
export function CompanyProducts({companyId,edit=false,fallback=[]}:{companyId:string;edit?:boolean;fallback?:ProductCardData[]}) {
 const [selectedProduct, setSelectedProduct] = useState<ProductCardData | null>(null);
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
 return <section className="company-detail-section"><h2 className="detail-section-title">პროდუქტები და მომსახურებები</h2>
 <div className={styles.products}>{products.map((product,i)=><ProductTile key={`${i}:${product.name}`} product={product} onOpen={() => setSelectedProduct(product)}/>)}</div>
 <Modal open={!!selectedProduct} onClose={() => setSelectedProduct(null)} title={selectedProduct?.name || "პროდუქტი"} actions={<Button href={`/requests/new/?${new URLSearchParams({ title: selectedProduct?.name || "", category: store?.getCompany(companyId)?.industry || "" })}`}>ფასის მოთხოვნა</Button>}>
  {selectedProduct?.photoUrl ? <div className={styles.productPreview}><Image unoptimized src={selectedProduct.photoUrl} alt={selectedProduct.name} width={960} height={720}/></div> : null}
  <p className={styles.productDescription}>{selectedProduct?.note || "დეტალები, ფასი და მიწოდების პირობები შეთანხმებით."}</p>
 </Modal></section>;
}
function ProductTile({ product, onOpen }: { product: ProductCardData; onOpen: () => void }) {
 const [failedUrl, setFailedUrl] = useState<string | null>(null);
 return <article><button type="button" className={styles.productTile} aria-haspopup="dialog" aria-label={`${product.name} — პროდუქტის ნახვა`} onClick={onOpen}>
   <div className={styles.productPhoto}>{product.photoUrl && product.photoUrl !== failedUrl ? <img src={product.photoUrl} alt="" loading="lazy" onError={() => setFailedUrl(product.photoUrl || null)}/> : <Icon name="package"/>}</div>
   <div className={styles.productCopy}><h3>{product.name}</h3>{product.note ? <p>{product.note}</p> : null}</div>
 </button></article>;
}

function ProductsForm({initial,onSaved}:{initial:ProductCardData[];onSaved:(items:ProductCardData[])=>void}) {
 const {store}=useMarketStore();const [items,setItems]=useState(initial),[pending,setPending]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false);
 const gallery: string[]=store?.currentUser()?.gallery||[];
 const patch=(index:number,value:Partial<ProductCardData>)=>{setSaved(false);setItems(all=>all.map((item,i)=>i===index?{...item,...value}:item));};
 const changed = JSON.stringify(items) !== JSON.stringify(initial);
 return <section className={styles.productsEditor}><header className={styles.productsEditorHead}><h2>პროდუქტები</h2><span>{items.length}/12</span></header>
 {!gallery.length && !items.length && !initial.length ? <div className={styles.productsEmpty}><Icon name="image"/><p>პროდუქტის დასამატებლად ატვირთე ფოტოები გალერეაში.</p><Button variant="secondary" href="/account/?tab=profile&section=details#profile-gallery-label"><Icon name="plus"/>ფოტოების დამატება</Button></div> : <>
 <p className={styles.productsHelp}>ფოტო აირჩიე გალერეიდან. <Link className="ma-link" href="/account/?tab=profile&section=details#profile-gallery-label">ფოტოების დამატება</Link></p>
 <form className="ma-form" onChange={()=>setSaved(false)} onSubmit={async e=>{e.preventDefault();if(pending)return;setPending(true);setError("");setSaved(false);try{const saved=await store!.setMyProducts(items);onSaved(saved);setSaved(true);toast("პროდუქტები შენახულია.");}catch(err){setError(businessError(err));}finally{setPending(false);}}}>
 {items.map((item,index)=><fieldset key={index} className={styles.productEditorCard}><legend>პროდუქტი {index+1}</legend>
 <ProductPreview product={item}/>
 <div className={styles.productEditorFields}>
 <label className="ma-field">დასახელება<input className="ma-input" required minLength={2} maxLength={80} value={item.name} disabled={pending} onChange={e=>patch(index,{name:e.target.value})}/></label>
 <label className="ma-field">ფოტო<CustomSelect value={item.photoUrl||""} disabled={pending} onChange={e=>patch(index,{photoUrl:e.target.value})}><option value="">აირჩიე ფოტო</option>{gallery.map((url,i)=><option value={url} key={url}>გალერეის ფოტო {i+1}</option>)}</CustomSelect></label>
 <label className={`ma-field ${styles.productEditorNote}`}>მოკლე აღწერა<input className="ma-input" maxLength={200} value={item.note||""} disabled={pending} onChange={e=>patch(index,{note:e.target.value})}/></label>
 </div>
 <div className={styles.productEditorRemove}><Button variant="danger-quiet" disabled={pending} aria-label={`პროდუქტი ${index+1} — ამოღება`} onClick={()=>{setSaved(false);setItems(all=>all.filter((_,i)=>i!==index));}}><Icon name="trash-2"/>ამოღება</Button></div>
 </fieldset>)}
 <div className={styles.productsEditorActions}><Button variant="secondary" disabled={pending||items.length>=12||!gallery.length} onClick={()=>{setSaved(false);setItems(all=>[...all,{name:"",photoUrl:gallery[0],note:""}]);}}>პროდუქტის დამატება</Button>
 {error?<p className="ma-field__error" role="alert">{error}</p>:null}
 <Button type="submit" loading={pending} disabled={!changed||items.some(item=>!item.photoUrl)}>შენახვა</Button></div>
 {saved?<p className="account-save-feedback" role="status">პროდუქტები შენახულია.</p>:null}
 </form></>}</section>;
}

function ProductPreview({product}:{product:ProductCardData}) {
 const [loaded,setLoaded]=useState<string|null>(null),[failed,setFailed]=useState<string|null>(null);
 return <div className={styles.productEditorPreview} role="img" aria-label={product.name || "პროდუქტის ფოტო"}><Icon name="image"/>{product.photoUrl && failed!==product.photoUrl ? <img src={product.photoUrl} alt="" width={120} height={90} loading="lazy" style={{opacity:loaded===product.photoUrl?1:0}} onLoad={()=>setLoaded(product.photoUrl!)} onError={()=>setFailed(product.photoUrl!)}/> : null}</div>;
}
