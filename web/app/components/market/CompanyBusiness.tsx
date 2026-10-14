"use client";
import { Button } from "../ui/Button";

import { AccountSectionFooter, useSavedTime } from "./account/AccountSection";
import { DistributionForm } from "./Distribution";
import type { Distribution } from "../../lib/distribution";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import { toast } from "../Toasts";
import { ListSkeleton } from "./Skeletons";
import { Notice } from "../ui/Notice";
import { dateShort } from "../../lib/format";
import { useMarketStore } from "../../lib/market-client";
import { businessError, plansEnabled, useBusinessResource, type BusinessFeature } from "../../lib/business-client";
import "../../styles/pages/business.css";

export function BusinessMarks({feature,hidePlan=false}:{feature?:BusinessFeature;hidePlan?:boolean}) {
 if(!feature||((hidePlan||!plansEnabled)&&!feature.distributor&&!(feature.reviewCount>0)))return null;
 return <div className="business-marks">{plansEnabled&&feature.plan&&!hidePlan?<span className="business-tier" data-plan={feature.plan}>{feature.plan==='vip'?'VIP':'Premium'}</span>:null}{feature.distributor?<span><Icon name="truck"/>დისტრიბუტორი</span>:null}{feature.reviewCount>0?<span><Icon name="star"/>{feature.rating} <small>({feature.reviewCount})</small></span>:null}</div>;
}
export function BusinessError({error,retry}:{error:string;retry:()=>void}){return <div className="business-error" role="alert"><p>{error}</p><Button type="button" variant="secondary" onClick={retry}><Icon name="refresh-cw"/>ხელახლა ცდა</Button></div>;}

type Settings={distribution?:Distribution;distributor:boolean;membership:{plan:string;expires_at:string}|null;application:{id:string;plan:string;status:string;note:string}|null};
const plans=[{id:'premium',name:'Premium',intro:'მეტი ხილვადობა კატალოგში',items:['Premium ნიშანი კომპანიის გვერდსა და ბარათზე','პრიორიტეტი რეკომენდებულ შედეგებში']},{id:'vip',name:'VIP',intro:'გამოჩნდით მთავარ გვერდზეც',items:['VIP ნიშანი კომპანიის გვერდსა და ბარათზე','უპირატესი ადგილი რეკომენდებულ შედეგებში','მთავარი გვერდის კომპანიების ბლოკში პრიორიტეტი']}];
export function CompanyBusinessPanel({owner}:{owner:string}){
 const {store}=useMarketStore();
 const resource=useBusinessResource<Settings>(plansEnabled?store?.myBusinessSettings:undefined,owner);
 const [pending,setPending]=useState('');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const settings=resource.data;
 if(!plansEnabled)return <div className="business-panel"><Notice>ხილვადობის პაკეტები ამ ეტაპზე არ არის ხელმისაწვდომი. კომპანია კატალოგში ჩანს პაკეტის გარეშეც.</Notice></div>;
 async function act(key:string,work:()=>Promise<Settings>){if(pending)return;setPending(key);setError('');setMessage('');try{resource.replace(await work());const text=key==='cancel'?'განაცხადი გაუქმებულია.':'განაცხადი გაიგზავნა.';setMessage(text);toast(text);}catch(e){setError(businessError(e));}finally{setPending('');}}
 return <div className="business-panel business-panel--plans"><header><h2>ხილვადობის პაკეტები</h2><p>აირჩიეთ თქვენი კომპანიის განთავსება.</p></header>
 {resource.error?<BusinessError error={resource.error} retry={resource.reload}/>:!settings?<ListSkeleton compact kind="records" label="იტვირთება…"/>:<>
 {settings.membership?<div className="business-membership" role="status"><div><span>მიმდინარე პაკეტი</span><strong>{settings.membership.plan==='vip'?'VIP':'Premium'}</strong></div><small>მოქმედებს {dateShort(settings.membership.expires_at)}-მდე</small></div>:null}
 {settings.application?<div className="business-application" id="company-plan-state"><div><strong>{settings.application.plan==='vip'?'VIP':'Premium'}</strong><span>{({pending:'განაცხადი განხილვაშია',approved:'განაცხადი დადასტურებულია',declined:'განაცხადი არ დადასტურდა',cancelled:'განაცხადი გაუქმებულია'} as Record<string,string>)[settings.application.status]}</span></div><div><Button variant="ghost" disabled={!!pending} onClick={resource.reload} aria-label="განაცხადის სტატუსის განახლება"><Icon name="refresh-cw"/>განახლება</Button>{settings.application.status==='pending'?<Button variant="ghost" disabled={!!pending} loading={pending==='cancel'} onClick={()=>void act('cancel',()=>store!.cancelCompanyPlanRequest())}>გაუქმება</Button>:null}</div>{settings.application.note?<details><summary>განაცხადის კომენტარი</summary><p>{settings.application.note}</p></details>:null}</div>:null}
 <div className="business-plans">{plans.map(plan=>{
  const active=settings.membership?.plan===plan.id;
  const awaiting=settings.application?.status==='pending';
  return <article className="business-plan" data-current={active||undefined} key={plan.id}><header><h3>{plan.name}</h3>{active?<span className="ma-badge ma-badge--neutral">აქტიურია</span>:awaiting&&settings.application?.plan===plan.id?<span className="ma-badge ma-badge--neutral">განხილვაშია</span>:null}</header><p>{plan.intro}</p><ul>{plan.items.map(item=><li key={item}><Icon name="check"/>{item}</li>)}</ul><p className="business-plan__terms">ფასი და ვადა შეთანხმებით</p><Button type="button" variant={plan.id==='vip'?'primary':'secondary'} loading={pending===plan.id} disabled={!!pending||awaiting||active} aria-describedby={awaiting?'company-plan-state':undefined} onClick={()=>void act(plan.id,()=>store!.requestCompanyPlan(plan.id))}>{active?'მიმდინარე პაკეტი':awaiting?'განაცხადი განხილვაშია':`${plan.name}-ის მოთხოვნა`}</Button></article>;
 })}</div><p className="business-fineprint">განაცხადის გაგზავნისას თანხა არ ჩამოგეჭრებათ. პაკეტი აქტიურდება ადმინისტრატორთან პირობების შეთანხმების შემდეგ.</p>
 </>}
 {message?<p className="account-save-feedback" role="status"><Icon name="check"/>{message}</p>:null}
 {error?<p className="ma-field__error" role="alert">{error}</p>:null}</div>;
}

/** Distribution is part of the company profile, alongside products and photos. */
export function CompanyDistributionPanel({owner}:{owner:string}) {
 const {store}=useMarketStore();
 const resource=useBusinessResource<Settings>(store?.myBusinessSettings,owner);
 return <div className="account-distribution">{resource.error?<BusinessError error={resource.error} retry={resource.reload}/>:!resource.data?<ListSkeleton compact kind="records"/>:<>
  <DistributorStatus key={owner} initial={resource.data.distributor} onSaved={resource.replace}/>
  {resource.data.distributor?<DistributionForm key={owner} initial={resource.data.distribution} onSaved={resource.reload}/>:null}
 </>}</div>;
}
function DistributorStatus({initial,onSaved}:{initial:boolean;onSaved:(settings:Settings)=>void}) {
 const {store}=useMarketStore();
 const [enabled,setEnabled]=useState(initial),[pending,setPending]=useState(false),[error,setError]=useState('');
 const {savedAt,markSaved,clearSaved}=useSavedTime();
 const [baseline,setBaseline]=useState(initial);
 return <section className="account-section account-profile-block"><header className="account-section__heading"><h2 className="account-section__title">დისტრიბუცია</h2><p className="account-hint">დისტრიბუტორის სტატუსით კომპანია კატალოგის შესაბამის ფილტრშიც გამოჩნდება.</p></header>
 <form className="ma-form" onSubmit={async e=>{e.preventDefault();if(!store||pending||enabled===baseline)return;setPending(true);setError('');try{const settings=await store.setCompanyDistributor(enabled);setBaseline(enabled);markSaved();onSaved(settings);}catch(err){setError(businessError(err));}finally{setPending(false);}}}>
 <label className="filter-switch"><span>ვარ დისტრიბუტორი</span><input type="checkbox" role="switch" checked={enabled} disabled={pending} onChange={e=>{setEnabled(e.target.checked);clearSaved();}}/><span className="filter-switch__track" aria-hidden="true"/></label>
 <AccountSectionFooter dirty={enabled!==baseline} pending={pending} savedAt={savedAt} error={error}/>
 </form></section>;
}

type Review={id:string;rating:number;body:string;author:string;updated_at:string};
type ReviewTarget={id:string;title:string;rating:number|null;body:string|null;status:string|null;reason:string|null};
type Reviews={items:Review[];total:number;rating:number|null};
export function CompanyReviews({companyId}:{companyId:string}){
 const {store,ready}=useMarketStore();const me=ready?store?.currentUser():null;
 const [offset,setOffset]=useState(0),[revision,setRevision]=useState(0);
 const read=store?.companyReviews,readTargets=store?.myCompanyReviewTargets;
 const load=useCallback(()=>read!(companyId,offset),[read,companyId,offset]);
 const reviews=useBusinessResource<Reviews>(ready&&store?load:undefined,`${companyId}:${offset}:${revision}`);
 const own=useCallback(()=>readTargets!(companyId),[readTargets,companyId]);
 const targets=useBusinessResource<ReviewTarget[]>(me&&!me.blocked&&me.id!==companyId?own:undefined,`${companyId}:${me?.id}:${revision}`);
 return <section id="company-reviews" className="company-reviews"><div className="business-section-heading"><h2>შეფასებები{reviews.data?.total?<span className="business-rating"><Icon name="star"/>{reviews.data.rating} <small>· {reviews.data.total}</small></span>:null}</h2><p>შეფასებას წერს მოთხოვნის ავტორი, როცა მისი გარიგება ამ კომპანიასთან დასრულდება.</p></div>
 {reviews.error?<BusinessError error={reviews.error} retry={reviews.reload}/>:!reviews.data?<ListSkeleton compact kind="records" label="შეფასებები იტვირთება…"/>:<>
 {!reviews.data.total?<p className="business-empty">კომპანიას გამოქვეყნებული შეფასება ჯერ არ აქვს.</p>:reviews.data.items.map(r=><article className="business-review" key={r.id}><header><strong>{r.author}</strong><span aria-label={`${r.rating} ქულა 5-დან`}>{Array.from({length:r.rating},(_,i)=><Icon key={i} name="star"/>)}</span></header>{r.body?<p>{r.body}</p>:null}<small>{dateShort(r.updated_at)} · MeetAny-ზე დასრულებული გარიგება</small></article>)}
 {reviews.data.total>10?<div className="business-pagination"><Button variant="secondary" type="submit" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-10))}>წინა</Button><span>{offset+1}–{Math.min(offset+10,reviews.data.total)} / {reviews.data.total}</span><Button variant="secondary" type="submit" disabled={offset+10>=reviews.data.total} onClick={()=>setOffset(n=>n+10)}>შემდეგი</Button></div>:null}</>}
 {targets.error?<BusinessError error={targets.error} retry={targets.reload}/>:targets.data?.length?<ReviewForm key={`${companyId}:${revision}`} targets={targets.data} onSaved={()=>setRevision(n=>n+1)}/>:!me?<Link className="ma-link" href={`/account/?next=${encodeURIComponent(`/companies/view/?id=${companyId}#company-reviews`)}`}>შეფასების დასაწერად შედით ანგარიშზე</Link>:null}
 </section>;
}
function ReviewForm({targets,onSaved}:{targets:ReviewTarget[];onSaved:()=>void}){
 const {store}=useMarketStore();const [id,setId]=useState(targets[0].id);const target=targets.find(t=>t.id===id)!;
 const [rating,setRating]=useState(target.rating||0),[body,setBody]=useState(target.body||''),[pending,setPending]=useState(false),[error,setError]=useState('');
 return <details className="business-review-form"><summary><Icon name="pencil"/>{target.status?'თქვენი შეფასების ნახვა და შეცვლა':'შეფასების დაწერა'}</summary><form onSubmit={async e=>{e.preventDefault();if(pending)return;setPending(true);setError('');try{const saved = await store!.saveCompanyReview(id,rating,body);toast(saved.status==='hidden'?'შეფასების ცვლილება შენახულია.':'შეფასება გამოქვეყნებულია.');onSaved();}catch(err){setError(businessError(err));}finally{setPending(false);}}}>
 <label className="ma-field">მოთხოვნა<select className="ma-select" value={id} disabled={pending} onChange={e=>{const t=targets.find(t=>t.id===e.target.value)!;setId(t.id);setBody(t.body||'');setRating(t.rating||0);setError('');}}>{targets.map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></label>
 {target.status?<p className="business-notice">{({pending:'შეფასება შენახულია',published:'შეფასება გამოქვეყნებულია',hidden:'შეფასება არ გამოქვეყნდა'} as Record<string,string>)[target.status]}{target.reason?` · ${target.reason}`:''}</p>:null}
 <fieldset className="business-stars"><legend>შეაფასეთ გამოცდილება</legend>{[1,2,3,4,5].map(n=><label key={n} data-active={n<=rating||undefined}><input type="radio" name="rating" value={n} checked={rating===n} required disabled={pending} onChange={()=>setRating(n)}/><Icon name="star"/><span className="ma-sr-only">{n} ქულა</span></label>)}</fieldset>
 <label className="ma-field">თქვენი გამოცდილება<textarea className="ma-textarea" value={body} onChange={e=>setBody(e.target.value)} minLength={20} maxLength={1500} required disabled={pending} rows={4} placeholder="როგორი იყო კომუნიკაცია, მომსახურება და შეთანხმებული პირობების შესრულება?"/></label><p className="business-fineprint">მინიმუმ 20 სიმბოლო. შეფასება გამოქვეყნდება შენახვისთანავე.</p>{error?<p role="alert" className="ma-field__error">{error}</p>:null}<Button variant="primary" type="submit" disabled={pending||!rating||body.trim().length<20}><Icon name="send"/>{pending?'იგზავნება…':'შეფასების გაგზავნა'}</Button></form></details>;
}
