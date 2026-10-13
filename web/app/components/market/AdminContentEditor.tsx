"use client";
import Image from "next/image";
import { optimizable } from "../../lib/image";
import { useCallback, useEffect, useState } from 'react';
import type { Store } from '../../lib/market-client';
import { useBusinessResource } from '../../lib/business-client';
import { adminErrorMessage } from '../../lib/use-admin-data';
import { useRouter } from 'next/navigation';
import { Sheet } from '../ui/Sheet';
import {useUnsavedDraft} from '../../lib/use-unsaved-draft';
import { Button } from '../ui/Button';
import { toast } from '../Toasts';
import { Notice } from '../ui/Notice';
import styles from './admin-edit.module.css';
import {siteContentDefaults} from '../../lib/site-content-defaults';
type Content=Record<string,string>;
const photos=['შედუღება','ლოგისტიკა','სასურსათო მაღაზია','გუნდი','სამზარეულო','ინჟინერია','ნერგები','სატვირთოები','ლითონის დამუშავება'];
export function AdminContentEditor({store}:{store:Store}){
 const read=store.siteContent;const load=useCallback(()=>read(),[read]);const resource=useBusinessResource<Content>(load,'site-editor');
 return resource.error?<div role="alert"><p>შიგთავსი ვერ ჩაიტვირთა. სცადეთ ხელახლა.</p><Button variant="secondary" onClick={resource.reload}>ხელახლა ცდა</Button></div>:resource.data?<ContentForm store={store} initial={resource.data}/>:<p role="status">გვერდის შიგთავსი იტვირთება…</p>;
}
function ContentForm({store,initial}:{store:Store;initial:Content}){
 const [saved,setSaved]=useState({...siteContentDefaults,...initial});
 const [draft,setDraft]=useState({...siteContentDefaults,...initial}),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(''),[error,setError]=useState(''),[published,setPublished]=useState(false);
 const router=useRouter();const [leaving,setLeaving]=useState<string|null>(null);const dirty=JSON.stringify(draft)!==JSON.stringify(saved);useUnsavedDraft(dirty);
 useEffect(()=>{if(!dirty)return;const protect=(event:MouseEvent)=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=(event.target as Element)?.closest('a[href]');if(!(link instanceof HTMLAnchorElement)||!['http:','https:'].includes(link.protocol)||link.target==='_blank'||link.hasAttribute('download')||link.href===location.href)return;event.preventDefault();event.stopPropagation();setLeaving(link.href);};document.addEventListener('click',protect,true);return()=>document.removeEventListener('click',protect,true);},[dirty]);
 const change=(key:string,value:string)=>{setPublished(false);setDraft(v=>({...v,[key]:value}));};
 async function upload(key:string,file:File|undefined){if(!file)return;setUploading(key);setError('');try{const result=await store.adminUploadPhoto(store.currentUser().id,file,'site');change(key,result.url);}catch(e){setError(adminErrorMessage(e));}finally{setUploading('');}}
 async function save(e:React.FormEvent){e.preventDefault();if(busy||uploading)return;if(!dirty){toast('ცვლილებები არ არის');return;}setBusy(true);setError('');setPublished(false);try{await store.adminSaveSiteContent(draft);setSaved(draft);setPublished(true);toast('კატალოგის ფოტოები გამოქვეყნდა.');}catch(e){setError(adminErrorMessage(e));}finally{setBusy(false);}}
 const photo=(key:string,label:string)=><div className={styles.imageField} key={key}><strong>{label}</strong>{draft[key]?<div className={styles.photo}><Image src={draft[key]} width={160} height={120} unoptimized={!optimizable(draft[key])} alt={label}/></div>:null}<div className={styles.photoActions}><label className={styles.upload}><span>{uploading===key?'იტვირთება…':'ფოტოს შეცვლა'}</span><input type="file" aria-label={label+' — შეცვალეთ ფოტო'} accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy||!!uploading} onChange={e=>void upload(key,e.target.files?.[0])}/></label>{draft[key]&&draft[key]!==siteContentDefaults[key]?<Button variant="ghost" size="sm" type="button" onClick={()=>change(key,siteContentDefaults[key]||'')} disabled={busy||!!uploading}>საწყისი ფოტოს დაბრუნება</Button>:null}</div></div>;
 return <><form onSubmit={save} className={styles.cms}><div className={styles.publishBar}><span role="status">{dirty?'შეუნახავი ცვლილებები':'ცვლილებები არ არის'}</span><Button variant="primary" type="submit" disabled={busy||!!uploading}>{busy?'ინახება…':'გამოქვეყნება'}</Button></div><section className={styles.surface}><h2>კომპანიების კატალოგის ფოტოები</h2><p>ფოტოები ჩანს <a href="/companies/" target="_blank" rel="noopener noreferrer">კომპანიების გვერდის</a> ზედა კოლაჟში. მთავარი გვერდის ტექსტები და ფოტოები ამ რედაქტორიდან არ იცვლება.</p><div className={styles.grid}>{photos.map((name,i)=>photo(`businessImage${i+1}`,`კატალოგის ზედა კოლაჟი — ${name} (ფოტო ${i+1})`))}</div></section>{published?<Notice role="status">გამოქვეყნდა · <a href="/companies/" target="_blank" rel="noopener noreferrer">ნახეთ კატალოგში</a></Notice>:null}{error?<p className="ma-field__error" role="alert">{error}</p>:null}<footer className={styles.actions}>{dirty?<span className={styles.dirty}>შეუნახავი ცვლილებები</span>:null}<Button variant="primary" type="submit" disabled={busy||!!uploading}>{busy?'ინახება…':'ცვლილებების გამოქვეყნება'}</Button></footer></form><Sheet open={!!leaving} title="შეუნახავი ცვლილებები" onClose={()=>setLeaving(null)} footer={<><Button type="button" variant="secondary" onClick={()=>setLeaving(null)}>რედაქტირების გაგრძელება</Button><Button type="button" variant="danger-quiet" onClick={()=>{const href=leaving;setLeaving(null);if(href){setDraft(saved);router.push(href);}}}>ცვლილებების გაუქმება</Button></>}><p>გვერდის დატოვებამდე შეინახეთ ცვლილებები.</p></Sheet></>;
}
