"use client";
import { productPresentation } from "../../lib/product-presentation";
import { optimizable } from "../../lib/image";
import { useCallback, useState } from "react";
import { ProductsImport } from "./ProductsImport";
import { productKey, PRODUCT_UNITS, type ProductUnit } from "../../lib/products-import";
import { useFieldErrors, type FieldErrors } from "./fieldErrors";
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
/** Product notes seeded for the demo start with a technical marker that is not for visitors. */
export const publicNote = (note?: string | null) => String(note || "").replace(/^(სადემო(?: პროდუქტი)?\s*·\s*)?(ფოტო საილუსტრაციოა[;.]?\s*)?/, "").trim() || undefined;
type PresentedProduct = ProductCardData & { illustrative?: boolean; photoPosition?: string };
export function CompanyProducts({companyId,edit=false,fallback=[],initial}:{companyId:string;edit?:boolean;fallback?:ProductCardData[];initial?:ProductCardData[]}) {
 const [selectedProduct, setSelectedProduct] = useState<PresentedProduct | null>(null);
 const {store,ready}=useMarketStore();
 const read=store?.companyProducts;
 const load=useCallback(()=>read!(companyId),[read,companyId]);
 const resource=useBusinessResource<ProductCardData[]>(ready&&store?load:undefined,companyId,undefined,initial);
 if(resource.error && (edit || !fallback.length))return <p role="alert">{resource.error} <Button variant="ghost" onClick={resource.reload}>ხელახლა ცდა</Button></p>;
 if(!resource.data && (edit || !fallback.length))return <ListSkeleton compact kind="records" label="პროდუქტები იტვირთება…"/>;
 if(edit)return <ProductsForm key={companyId} initial={resource.data || []} onSaved={resource.replace}/>;
 // Pictured products are tiles; unpictured products remain chips that open the same details dialog.
 const loaded = (resource.data || []).map(product => ({ ...productPresentation(product, companyId), note: publicNote(product.note) }));
 const products = loaded.filter(product => product.photoUrl);
 const chips = loaded.filter(product => !product.photoUrl);
 if(!products.length && !chips.length)return null;
 return <section className="company-detail-section"><h2 className="detail-section-title">პროდუქტები და მომსახურებები</h2>
 {products.length ? <div className={styles.products}>{products.map((product,i)=><ProductTile key={`${i}:${product.name}`} product={product} onOpen={() => setSelectedProduct(product)}/>)}</div> : null}
 {chips.length ? <div className={styles.chips}>{chips.map((product,i)=><Button variant="ghost" key={`${i}:${product.name}`} onClick={() => setSelectedProduct(product)}>{product.name}</Button>)}</div> : null}
 <Modal open={!!selectedProduct} onClose={() => setSelectedProduct(null)} title={selectedProduct?.name || "პროდუქტი"} actions={<Button href={`/requests/new/?${new URLSearchParams({ title: selectedProduct?.name || "", category: store?.getCompany(companyId)?.industry || "" })}`}>ფასის მოთხოვნა</Button>}>
  {selectedProduct?.photoUrl ? <div className={styles.productPreview}><Image unoptimized={!optimizable(selectedProduct.photoUrl)} src={selectedProduct.photoUrl} alt={selectedProduct.name} width={960} height={720}/></div> : null}
  {selectedProduct?.illustrative && <p className={styles.photoCaption}>საილუსტრაციო ფოტო · სადემო პროდუქტი</p>}
  {selectedProduct && (selectedProduct.code || selectedProduct.unit || selectedProduct.price !== undefined) ? <dl className={styles.productDetails}>{selectedProduct.code ? <div><dt>კოდი</dt><dd>{selectedProduct.code}</dd></div> : null}{selectedProduct.unit ? <div><dt>ერთეული</dt><dd>{PRODUCT_UNITS[selectedProduct.unit]}</dd></div> : null}{selectedProduct.price !== undefined ? <div><dt>საორიენტაციო ფასი / ერთეული</dt><dd>{selectedProduct.price.toLocaleString("ka-GE")} ₾</dd></div> : null}</dl> : null}
  <p className={styles.productDescription}>{selectedProduct?.note || "დეტალები, ფასი და მიწოდების პირობები შეთანხმებით."}</p>
 </Modal></section>;
}
function ProductTile({ product, onOpen }: { product: PresentedProduct; onOpen: () => void }) {
 const [failedUrl, setFailedUrl] = useState<string | null>(null);
 return <article><button type="button" className={styles.productTile} aria-haspopup="dialog" aria-label={`${product.name} — პროდუქტის ნახვა`} onClick={onOpen}>
   <div className={styles.productPhoto}>{product.photoUrl && product.photoUrl !== failedUrl ? <Image src={product.photoUrl} alt="" width={360} height={240} style={{objectPosition: product.photoPosition}} sizes="(max-width: 479px) 100vw, (max-width: 1023px) 50vw, 400px" unoptimized={!optimizable(product.photoUrl)} loading="lazy" onError={() => setFailedUrl(product.photoUrl || null)}/> : <Icon name="package"/>}</div>
   <div className={styles.productCopy}>{product.illustrative && <span className={styles.photoCaption}>საილუსტრაციო ფოტო</span>}<h3>{product.name}</h3>{product.note ? <p>{product.note}</p> : null}</div>
 </button></article>;
}

type ProductDraft = ProductCardData & { priceInput: string };
const draftProducts = (products: ProductCardData[]): ProductDraft[] => products.map(product => ({ ...product, priceInput: product.price === undefined ? "" : String(product.price) }));
const cleanProduct = ({ priceInput, ...product }: ProductDraft): ProductCardData => {
 const result = { ...product, name: product.name.trim(), note: product.note?.trim() || "" };
 delete result.price;
 if (priceInput.trim()) result.price = Number(priceInput.trim().replace(",", "."));
 if (!result.code) delete result.code;
 if (!result.unit) delete result.unit;
 return result;
};
function ProductsForm({initial,onSaved}:{initial:ProductCardData[];onSaved:(items:ProductCardData[])=>void}) {
 const {store}=useMarketStore();
 const [items,setItems]=useState(() => draftProducts(initial)),[pending,setPending]=useState(false),[error,setError]=useState(""),[feedback,setFeedback]=useState("");
 const [search,setSearch]=useState(""),[page,setPage]=useState(0);
 const [photoIndex,setPhotoIndex]=useState<number|null>(null);
 const fields = useFieldErrors();
 const gallery: string[]=store?.currentUser()?.gallery||[];
 const patch=(index:number,value:Partial<ProductDraft>)=>{setFeedback("");setItems(all=>all.map((item,i)=>i===index?{...item,...value}:item));Object.keys(value).forEach(key=>fields.clear(`product-${index}-${key}`));};
 const products = items.map(cleanProduct);
 const changed = JSON.stringify(products) !== JSON.stringify(draftProducts(initial).map(cleanProduct));
 const filtered = items.map((item,index)=>({item,index})).filter(({item})=>`${item.name} ${item.code || ""}`.toLocaleLowerCase("ka").includes(search.toLocaleLowerCase("ka")));
 const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length/20)-1));
 function validate(drafts = items) {
  if (drafts.length > 15) { setError("დასაშვებია მაქსიმუმ 15 პროდუქტი. შეამცირეთ სია და შეინახეთ."); return false; }
  const errors: FieldErrors = {};
  drafts.forEach((item,index)=>{
   const key = `product-${index}-`;
   if (!item.name.trim()) errors[key+"name"]="მიუთითეთ დასახელება";
   else if ([...item.name.trim()].length<2 || [...item.name.trim()].length>80) errors[key+"name"]="დასახელება უნდა შეიცავდეს 2–80 სიმბოლოს";
   if (item.name.trim() && drafts.some((other, i) => i !== index && other.name.trim() && productKey(other) === productKey(item))) errors[key+(item.code?.trim() ? "code" : "name")]="კოდი მეორდება ან უკოდო პროდუქტი ამ სახელით უკვე დამატებულია";
   if ([...(item.code || "")].length>40) errors[key+"code"]="კოდი უნდა შეიცავდეს მაქსიმუმ 40 სიმბოლოს";
   if ([...(item.note || "")].length>200) errors[key+"note"]="აღწერა უნდა შეიცავდეს მაქსიმუმ 200 სიმბოლოს";
   if (item.priceInput.trim() && (!/^\d+(?:[.,]\d+)?(?:e[+-]?\d+)?$/i.test(item.priceInput.trim()) || Number(item.priceInput.trim().replace(",", "."))>1e9)) errors[key+"priceInput"]="მიუთითეთ ფასი 0-დან 1 000 000 000-მდე";
   if (item.photoUrl && !gallery.includes(item.photoUrl)) errors[key+"photoUrl"]="აირჩიეთ ფოტო თქვენი გალერეიდან ან წაშალეთ არჩევანი";
  });
  const first=Object.keys(errors)[0];
  if (first) { setSearch(""); setPage(Math.floor(Number(first.split("-")[1])/20)); requestAnimationFrame(()=>document.getElementById(first)?.focus()); }
  return fields.check(errors,Object.keys(errors));
 }
 async function persist(next: ProductCardData[]) {
  setPending(true); setError(""); setFeedback("");
  try { const saved: ProductCardData[]=await store!.setMyProducts(next); onSaved(saved);setItems(draftProducts(saved));setFeedback("პროდუქტები შენახულია."); }
  finally { setPending(false); }
 }
 return <section className={styles.productsEditor}>
 <header className={styles.productsEditorHead}><h2>პროდუქტები</h2></header>
 <ProductsImport existing={products} gallery={gallery} disabled={pending} onConfirm={async imported=>{
  if (!validate()) throw { userMessage: "ჯერ გაასწორეთ პროდუქტების ფორმის შეცდომები." };
  await persist(imported);setSearch("");setPage(0);
 }}/>
 <p className={styles.productsHelp}>ფოტო აირჩიეთ გალერეიდან. <Link className="ma-link" href="/account/?tab=profile&section=details#profile-gallery-label">ფოტოების დამატება</Link></p>
 <form className="ma-form" noValidate onSubmit={async e=>{
  e.preventDefault();if(pending)return;setError("");setFeedback("");
  if (!validate()) return;
  if (!changed) {setFeedback("ცვლილებები არ არის");toast("ცვლილებები არ არის");return;}
  try {await persist(products);toast("პროდუქტები შენახულია.");} catch(err) {setError(businessError(err));}
 }}>
 {Object.keys(fields.errors).length ? <div className={styles.productErrorSummary} role="alert"><p>გადაამოწმეთ პროდუქტების ველები:</p><ul>{Object.entries(fields.errors).map(([id,message])=><li key={id}><a href={`#${id}`} onClick={e=>{e.preventDefault();setSearch("");setPage(Math.floor(Number(id.split("-")[1])/20));requestAnimationFrame(()=>document.getElementById(id)?.focus());}}>პროდუქტი {Number(id.split("-")[1])+1}: {message}</a></li>)}</ul></div> : null}
 {items.length>10 ? <label className="ma-field">ძიება სახელით ან კოდით<input type="search" className="ma-input" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label> : null}
 {!items.length ? <p className={styles.productsHelp}>პროდუქტები ჯერ არ დაგიმატებიათ.</p> : null}
 {filtered.slice(currentPage*20,currentPage*20+20).map(({item,index})=>{
 const id = (field:string)=>`product-${index}-${field}`;
 return <fieldset key={index} className={styles.productEditorCard}><legend>პროდუქტი {index+1}</legend>
 <div className={styles.productEditorPhoto}><Button variant="ghost" {...fields.control(id("photoUrl"))} disabled={pending} aria-label={`პროდუქტი ${index+1} — ფოტოს არჩევა`} onClick={()=>setPhotoIndex(index)}><ProductPreview product={item} companyId={store?.currentUser()?.id || ""}/></Button>{fields.message(id("photoUrl"))}</div>
 <div className={styles.productEditorFields}>
 <label className="ma-field">დასახელება *<input className="ma-input" {...fields.control(id("name"))} required maxLength={80} value={item.name} disabled={pending} onChange={e=>patch(index,{name:e.target.value})}/>{fields.message(id("name"))}</label>
 <label className="ma-field">კოდი<input className="ma-input" {...fields.control(id("code"))} maxLength={40} value={item.code||""} disabled={pending} onChange={e=>patch(index,{code:e.target.value})}/>{fields.message(id("code"))}</label>
 <label className="ma-field">ერთეული<CustomSelect value={item.unit||""} disabled={pending} onChange={e=>patch(index,{unit:(e.target.value || undefined) as ProductUnit|undefined})}><option value="">—</option>{Object.entries(PRODUCT_UNITS).map(([key,label])=><option value={key} key={key}>{label}</option>)}</CustomSelect></label>
 <label className="ma-field">ფასი (₾)<input className="ma-input" {...fields.control(id("priceInput"))} inputMode="decimal" value={item.priceInput} disabled={pending} onChange={e=>patch(index,{priceInput:e.target.value})}/>{fields.message(id("priceInput"))}</label>
 <label className={`ma-field ${styles.productEditorNote}`}>მოკლე აღწერა<input className="ma-input" {...fields.control(id("note"))} maxLength={200} value={item.note||""} disabled={pending} onChange={e=>patch(index,{note:e.target.value})}/>{fields.message(id("note"))}</label>
 </div>
 <div className={styles.productEditorRemove}><Button variant="danger-quiet" disabled={pending} aria-label={`პროდუქტი ${index+1} — ამოღება`} onClick={()=>{setFeedback("");fields.check({},[]);setItems(all=>all.filter((_,i)=>i!==index));}}><Icon name="trash-2"/></Button></div>
 </fieldset>;
 })}
 {search && !filtered.length ? <p role="status">პროდუქტი ვერ მოიძებნა.</p> : null}
 {filtered.length>20 ? <nav className={styles.productsEditorActions} aria-label="პროდუქტების გვერდები"><Button variant="secondary" onClick={()=>setPage(Math.max(0,currentPage-1))}>წინა</Button><span>{currentPage+1} / {Math.ceil(filtered.length/20)}</span><Button variant="secondary" onClick={()=>setPage(Math.min(Math.ceil(filtered.length/20)-1,currentPage+1))}>შემდეგი</Button></nav> : null}
 <div className={styles.productsEditorActions}><Button variant="secondary" disabled={pending} onClick={()=>{
  if(items.length>=15){setError("დასაშვებია მაქსიმუმ 15 პროდუქტი.");return;}
  setFeedback("");setSearch("");setPage(Math.floor(items.length/20));setItems(all=>[...all,{name:"",photoUrl:null,note:"",priceInput:""}]);
 }}>პროდუქტის დამატება</Button></div>
 {error?<p className="ma-field__error" role="alert">{error}</p>:null}
 <div className={`ma-form-bar ${styles.productsSaveBar}`}><span role="status">{feedback || (changed ? "შეუნახავი ცვლილებები" : "")}</span><Button variant={changed ? "primary" : "secondary"} type="submit" disabled={!changed || pending} loading={pending}>შენახვა</Button></div>
 </form>
 <Modal open={photoIndex!==null} onClose={()=>setPhotoIndex(null)} title="პროდუქტის ფოტო" actions={<Button onClick={()=>setPhotoIndex(null)}>მზადაა</Button>}>
 {photoIndex!==null && items[photoIndex] ? <label className="ma-field">ფოტო გალერეიდან<CustomSelect value={items[photoIndex].photoUrl||""} onChange={e=>patch(photoIndex,{photoUrl:e.target.value||null})}><option value="">ფოტოს გარეშე</option>{gallery.map((url,i)=><option key={url} value={url}>გალერეის ფოტო {i+1}</option>)}</CustomSelect><ProductPreview product={items[photoIndex]} companyId={store?.currentUser()?.id || ""}/></label> : null}
 {!gallery.length ? <p>გალერეა ცარიელია. პროდუქტის შენახვა ფოტოს გარეშეც შეგიძლიათ.</p> : null}
 </Modal></section>;
}

function ProductPreview({product: original,companyId}:{product:ProductCardData;companyId:string}) {
 const product = productPresentation(original, companyId);
 const [loaded,setLoaded]=useState<string|null>(null),[failed,setFailed]=useState<string|null>(null);
 return <div className={styles.productEditorPreview} role="img" aria-label={product.name || "პროდუქტის ფოტო"}><Icon name="image"/>{product.photoUrl && failed!==product.photoUrl ? <Image src={product.photoUrl} unoptimized={!optimizable(product.photoUrl)} alt="" width={120} height={90} loading="lazy" style={{opacity:loaded===product.photoUrl?1:0}} onLoad={()=>setLoaded(product.photoUrl!)} onError={()=>setFailed(product.photoUrl!)}/> : null}</div>;
}
