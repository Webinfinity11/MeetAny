"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import { toast } from "../Toasts";
import { useMarketStore } from "../../lib/market-client";
import { businessError, useBusinessResource, type BusinessFeature } from "../../lib/business-client";
import "../../styles/pages/business.css";

export function BusinessMarks({feature}:{feature?:BusinessFeature}) {
 if(!feature)return null;
 return <div className="business-marks">{feature.plan?<span className="business-tier" data-plan={feature.plan} title="ფასიანი განთავსება"><Icon name="sparkles"/>{feature.plan==='vip'?'VIP':'Premium'}<span className="ma-sr-only"> — ფასიანი განთავსება</span></span>:null}{feature.distributor?<span><Icon name="truck"/>დისტრიბუტორი</span>:null}{feature.reviewCount>0?<span><Icon name="star"/>{feature.rating} <small>({feature.reviewCount})</small></span>:null}</div>;
}
export function BusinessError({error,retry}:{error:string;retry:()=>void}){return <div className="business-error" role="alert"><p>{error}</p><button type="button" className="ma-btn ma-btn--secondary" onClick={retry}><Icon name="refresh-cw"/>ხელახლა ცდა</button></div>;}

type Settings={distributor:boolean;membership:{plan:string;expires_at:string}|null;application:{id:string;plan:string;status:string;note:string}|null};
const plans=[{id:'premium',name:'Premium',intro:'მეტი ხილვადობა კატალოგში',items:['Premium ნიშანი კომპანიის გვერდსა და ქარდზე','პრიორიტეტი რეკომენდებულ შედეგებში']},{id:'vip',name:'VIP',intro:'გამოჩნდი მთავარ გვერდზეც',items:['VIP ნიშანი კომპანიის გვერდსა და ქარდზე','უპირატესი ადგილი რეკომენდებულ შედეგებში','მთავარი გვერდის კომპანიების ბლოკში პრიორიტეტი']}];
export function CompanyBusinessPanel({owner}:{owner:string}){
 const {store}=useMarketStore();
 const resource=useBusinessResource<Settings>(store?.myBusinessSettings,owner);
 const [pending,setPending]=useState('');
 const [error,setError]=useState('');
 const settings=resource.data;
 async function act(key:string,work:()=>Promise<Settings>){if(pending)return;setPending(key);setError('');try{resource.replace(await work());toast('ცვლილება შენახულია.');}catch(e){setError(businessError(e));}finally{setPending('');}}
 return <div className="business-panel"><header><p className="business-kicker">კომპანიის შესაძლებლობები</p><h1>შენი ბიზნესის განვითარებისთვის</h1><p>მიუთითე საქმიანობის ტიპი და შეარჩიე სასურველი ხილვადობა.</p></header>
 {resource.error?<BusinessError error={resource.error} retry={resource.reload}/>:!settings?<p role="status">იტვირთება…</p>:<>
 <section className="business-setting"><div><h2>დისტრიბუცია</h2><p>თუ პროდუქტებს სხვა ბიზნესებს აწვდი, გამოჩნდი დისტრიბუტორების ფილტრშიც. შენი დარგი უცვლელი რჩება.</p></div><label className="filter-switch"><span>ვარ დისტრიბუტორი</span><input type="checkbox" role="switch" checked={settings.distributor} disabled={!!pending} onChange={e=>{const checked=e.target.checked;void act('distributor',()=>store!.setCompanyDistributor(checked));}}/><span className="filter-switch__track" aria-hidden="true"/></label></section>
 <section><div className="business-section-heading"><h2>ხილვადობის პაკეტები</h2><p>ძებნა, მოთხოვნები და მიმოწერა უფასოდ რჩება. ფასიანი განთავსება ხარისხის დადასტურებას არ ნიშნავს.</p></div>
 {settings.membership?<p className="business-notice" role="status">აქტიურია {settings.membership.plan==='vip'?'VIP':'Premium'} · მოქმედებს {new Date(settings.membership.expires_at).toLocaleDateString('ka-GE')}-მდე</p>:null}
 {settings.application?<div className="business-notice"><button type="button" className="ma-link" disabled={!!pending} onClick={resource.reload}><Icon name="refresh-cw"/>სტატუსის განახლება</button><strong>{settings.application.plan==='vip'?'VIP':'Premium'} · {({pending:'განაცხადი განხილვაშია',approved:'განაცხადი დადასტურებულია',declined:'განაცხადი არ დადასტურდა',cancelled:'განაცხადი გაუქმებულია'} as Record<string,string>)[settings.application.status]}</strong>{settings.application.note?<p>{settings.application.note}</p>:null}{settings.application.status==='pending'?<button type="button" className="ma-link" disabled={!!pending} onClick={()=>void act('cancel',()=>store!.cancelCompanyPlanRequest())}>განაცხადის გაუქმება</button>:null}</div>:null}
 <div className="business-plans">{plans.map(plan=><article className="business-plan" key={plan.id}><Icon name={plan.id==='vip'?'sparkles':'building-2'}/><h3>{plan.name}</h3><p>{plan.intro}</p><ul>{plan.items.map(item=><li key={item}><Icon name="check"/>{item}</li>)}</ul><p className="business-plan__terms">ფასი და ვადა შეთანხმებით</p><button type="button" className="ma-btn ma-btn--primary" disabled={!!pending||settings.application?.status==='pending'} onClick={()=>void act(plan.id,()=>store!.requestCompanyPlan(plan.id))}><Icon name="clipboard-list"/>{pending===plan.id?'იგზავნება…':'გააქტიურების მოთხოვნა'}</button></article>)}</div><p className="business-fineprint">განაცხადის გაგზავნა პაკეტს ავტომატურად არ ააქტიურებს და თანხა არ ჩამოგეჭრება. ადმინისტრატორი შენთან პირობებს შეათანხმებს.</p></section></>}
 {error?<p className="ma-field__error" role="alert">{error}</p>:null}</div>;
}

type Review={id:string;rating:number;body:string;author:string;updated_at:string};
type ReviewTarget={id:string;title:string;rating:number|null;body:string|null;status:string|null;reason:string|null};
type Reviews={items:Review[];total:number;rating:number|null};
export function CompanyReviews({companyId}:{companyId:string}){
 const {store,ready}=useMarketStore();const me=ready?store?.currentUser():null;
 const [offset,setOffset]=useState(0),[revision,setRevision]=useState(0);
 const load=useCallback(()=>store!.companyReviews(companyId,offset),[store?.companyReviews,companyId,offset]);
 const reviews=useBusinessResource<Reviews>(ready&&store?load:undefined,`${companyId}:${offset}:${revision}`);
 const own=useCallback(()=>store!.myCompanyReviewTargets(companyId),[store?.myCompanyReviewTargets,companyId]);
 const targets=useBusinessResource<ReviewTarget[]>(me&&!me.blocked&&me.id!==companyId?own:undefined,`${companyId}:${me?.id}:${revision}`);
 return <section id="company-reviews" className="company-reviews"><div className="business-section-heading"><h2>შეფასებები{reviews.data?.total?<span className="business-rating"><Icon name="star"/>{reviews.data.rating} <small>· {reviews.data.total}</small></span>:null}</h2><p>შეფასებას წერს მოთხოვნის ავტორი, რომელმაც ამ კომპანიის შეთავაზება აირჩია.</p></div>
 {reviews.error?<BusinessError error={reviews.error} retry={reviews.reload}/>:!reviews.data?<p role="status">შეფასებები იტვირთება…</p>:<>
 {!reviews.data.total?<p className="business-empty">კომპანიას გამოქვეყნებული შეფასება ჯერ არ აქვს.</p>:reviews.data.items.map(r=><article className="business-review" key={r.id}><header><strong>{r.author}</strong><span aria-label={`${r.rating} ქულა 5-დან`}>{Array.from({length:r.rating},(_,i)=><Icon key={i} name="star"/>)}</span></header><p>{r.body}</p><small>{new Date(r.updated_at).toLocaleDateString('ka-GE')} · MeetAny-ზე არჩეული მომწოდებელი</small></article>)}
 {reviews.data.total>10?<div className="business-pagination"><button className="ma-btn ma-btn--secondary" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-10))}>წინა</button><span>{offset+1}–{Math.min(offset+10,reviews.data.total)} / {reviews.data.total}</span><button className="ma-btn ma-btn--secondary" disabled={offset+10>=reviews.data.total} onClick={()=>setOffset(n=>n+10)}>შემდეგი</button></div>:null}</>}
 {targets.error?<BusinessError error={targets.error} retry={targets.reload}/>:targets.data?.length?<ReviewForm key={`${companyId}:${revision}`} targets={targets.data} onSaved={()=>setRevision(n=>n+1)}/>:!me?<Link className="ma-link" href={`/account/?next=${encodeURIComponent(`/companies/view/?id=${companyId}#company-reviews`)}`}>შედით შეფასების დასაწერად</Link>:null}
 </section>;
}
function ReviewForm({targets,onSaved}:{targets:ReviewTarget[];onSaved:()=>void}){
 const {store}=useMarketStore();const [id,setId]=useState(targets[0].id);const target=targets.find(t=>t.id===id)!;
 const [rating,setRating]=useState(target.rating||0),[body,setBody]=useState(target.body||''),[pending,setPending]=useState(false),[error,setError]=useState('');
 return <details className="business-review-form"><summary><Icon name="pencil"/>{target.status?'შენი შეფასების ნახვა / შეცვლა':'დაწერე შეფასება'}</summary><form onSubmit={async e=>{e.preventDefault();if(pending)return;setPending(true);setError('');try{await store!.saveCompanyReview(id,rating,body);toast('შეფასება გაიგზავნა. გამოქვეყნდება შემოწმების შემდეგ.');onSaved();}catch(err){setError(businessError(err));}finally{setPending(false);}}}>
 <label className="ma-field">მოთხოვნა<select className="ma-select" value={id} disabled={pending} onChange={e=>{const t=targets.find(t=>t.id===e.target.value)!;setId(t.id);setBody(t.body||'');setRating(t.rating||0);setError('');}}>{targets.map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></label>
 {target.status?<p className="business-notice">{({pending:'შეფასება შემოწმებას ელოდება',published:'შეფასება გამოქვეყნებულია',hidden:'შეფასება არ გამოქვეყნდა'} as Record<string,string>)[target.status]}{target.reason?` · ${target.reason}`:''}</p>:null}
 <fieldset className="business-stars"><legend>შეაფასე გამოცდილება</legend>{[1,2,3,4,5].map(n=><label key={n} data-active={n<=rating||undefined}><input type="radio" name="rating" value={n} checked={rating===n} required disabled={pending} onChange={()=>setRating(n)}/><Icon name="star"/><span className="ma-sr-only">{n} ქულა</span></label>)}</fieldset>
 <label className="ma-field">შენი გამოცდილება<textarea className="ma-textarea" value={body} onChange={e=>setBody(e.target.value)} minLength={20} maxLength={1500} required disabled={pending} rows={4} placeholder="როგორი იყო კომუნიკაცია, მომსახურება და შეთანხმებული პირობების შესრულება?"/></label><p className="business-fineprint">მინიმუმ 20 სიმბოლო. გამოქვეყნებამდე შეფასება მოწმდება; რედაქტირებისას ხელახლა გაივლის შემოწმებას.</p>{error?<p role="alert" className="ma-field__error">{error}</p>:null}<button className="ma-btn ma-btn--primary" disabled={pending||!rating||body.trim().length<20}><Icon name="send"/>{pending?'იგზავნება…':'შეფასების გაგზავნა'}</button></form></details>;
}
