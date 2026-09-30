"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useMarketStore } from "../../lib/market-client";
import { useBusinessResource, businessError } from "../../lib/business-client";
import { BusinessError } from "./CompanyBusiness";
import { Icon } from "../Icon";
import { toast } from "../Toasts";

type Entry={id:string;company_id:string;company:string;status:string;rating?:number;body?:string;author?:string;plan?:string;phone?:string;email?:string;reason?:string;note?:string;expires_at?:string};
export function AdminBusiness({kind}:{kind:'reviews'|'plans'}){
 const {store}=useMarketStore();const [offset,setOffset]=useState(0);
 const load=useCallback(()=>store!.adminBusinessQueue(kind,offset),[store?.adminBusinessQueue,kind,offset]);
 const resource=useBusinessResource<{items:Entry[];total:number}>(store?load:undefined,`${kind}:${offset}`);
 return <section className="business-panel"><header><h1>{kind==='reviews'?'შეფასებების მოდერაცია':'პაკეტების განაცხადები'}</h1><p>{kind==='reviews'?'გამოაქვეყნე გამოცდილებაზე დაფუძნებული შეფასებები. დამალვისას მიუთითე მიზეზი.':'პაკეტი გაააქტიურე კომპანიასთან პირობების შეთანხმების შემდეგ. გადახდა აქ არ მუშავდება.'}</p></header>
 {resource.error?<BusinessError error={resource.error} retry={resource.reload}/>:!resource.data?<p role="status">იტვირთება…</p>:<><p>{resource.data.total} ჩანაწერი</p><div className="business-admin-list">{resource.data.items.length?resource.data.items.map(item=><AdminBusinessRow key={`${item.id}:${item.status}`} kind={kind} item={item} refresh={resource.reload}/>):<p className="business-empty">ჩანაწერი ჯერ არ არის.</p>}</div>{resource.data.total>20?<div className="business-pagination"><button className="ma-btn ma-btn--secondary" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-20))}>წინა</button><span>{offset+1}–{Math.min(offset+20,resource.data.total)}</span><button className="ma-btn ma-btn--secondary" disabled={offset+20>=resource.data.total} onClick={()=>setOffset(n=>n+20)}>შემდეგი</button></div>:null}</>}
 </section>;
}
function AdminBusinessRow({kind,item,refresh}:{kind:'reviews'|'plans';item:Entry;refresh:()=>void}){
 const {store}=useMarketStore();const [note,setNote]=useState(item.reason||item.note||''),[days,setDays]=useState(30),[pending,setPending]=useState(false),[error,setError]=useState('');
 async function submit(accept:boolean){if(pending)return;setPending(true);setError('');try{if(kind==='reviews')await store!.adminModerateReview(item.id,accept?'published':'hidden',note);else await store!.adminResolvePlan(item.id,accept,days,note);toast('ცვლილება შენახულია.');refresh();}catch(e){setError(businessError(e));}finally{setPending(false);}}
 return <article className="business-admin-row"><header><Link href={`/companies/view/?id=${item.company_id}`}>{item.company}</Link><strong>{({pending:'მოლოდინში',published:'გამოქვეყნებული',hidden:'დამალული',approved:'დადასტურებული',declined:'უარყოფილი',cancelled:'გაუქმებული'} as Record<string,string>)[item.status]}</strong></header>
 {kind==='reviews'?<><small>{item.author} · {item.rating}/5</small><p>{item.body}</p></>:<><strong>{item.plan==='vip'?'VIP':'Premium'}</strong><p>{item.phone} · {item.email}</p>{item.expires_at?<small>ბოლო აქტივაციის ვადა: {new Date(item.expires_at).toLocaleDateString('ka-GE')}</small>:null}</>}
 {kind==='reviews'||item.status==='pending'?<><label>{kind==='reviews'?'მოდერაციის მიზეზი (დამალვისას აუცილებელია)':'კომპანიისთვის კომენტარი'}<textarea className="ma-textarea" rows={2} maxLength={500} value={note} onChange={e=>setNote(e.target.value)} disabled={pending}/></label>{kind==='plans'?<label>აქტივაციის ვადა<select className="ma-select" value={days} onChange={e=>setDays(Number(e.target.value))} disabled={pending}><option value={30}>30 დღე</option><option value={90}>90 დღე</option><option value={365}>365 დღე</option></select></label>:null}<footer><button type="button" className="ma-btn ma-btn--primary" disabled={pending||item.status==='published'} onClick={()=>void submit(true)}><Icon name="check"/>{kind==='reviews'?'გამოქვეყნება':'პაკეტის გააქტიურება'}</button><button type="button" className="ma-btn ma-btn--secondary" disabled={pending||item.status==='hidden'||kind==='reviews'&&note.trim().length<3} onClick={()=>void submit(false)}><Icon name="x"/>{kind==='reviews'?'დამალვა':'უარყოფა'}</button></footer></>:item.note?<p>{item.note}</p>:null}
 {error?<p className="ma-field__error" role="alert">{error}</p>:null}</article>;
}
