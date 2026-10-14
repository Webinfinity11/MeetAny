'use client';
import {useState,useEffect,useRef} from 'react';
import Link from 'next/link';
import type {Store} from '../../lib/market-client';
import {Button} from '../ui/Button';
import {useSavedTime} from './account/AccountSection';
import {Badge} from '../ui/Badge';
import {FileAttachments} from './FileAttachments';
import {readVerificationRequirements,verificationRequirements,type VerificationRequirements,verificationHint,verificationLabel,verificationState,verificationTone} from '../../lib/onboarding-client';
import s from './flow-details.module.css';
import v from './onboarding.module.css';
import a from './admin.module.css';
import {verificationLabels} from '../../lib/admin-helpers';
type RequirementKey = keyof VerificationRequirements;
function Checklist({requirements,attempted=false,onDetails,onDocument}:{requirements:VerificationRequirements;attempted?:boolean;onDetails?:()=>void;onDocument?:(slot:'registration'|'tax')=>void}) {
 return <ul className={v.requirements} aria-label="ვერიფიკაციის მოთხოვნები">{(Object.entries(verificationRequirements) as [RequirementKey,string][]).map(([key,label]) => <li key={key} data-missing={!requirements[key] || undefined} data-error={attempted && !requirements[key] || undefined}>
  <span aria-hidden="true">{requirements[key] ? '✓' : '✗'}</span>
  {key==='legal_name'||key==='registration_code' ? onDetails ? <Button variant="ghost" onClick={onDetails}>{label}</Button> : <Link href="/onboarding/?step=details">{label}</Link> : onDocument ? <Button variant="ghost" onClick={()=>onDocument(key==='registration_document'?'registration':'tax')}>{label}</Button> : <span>{label}</span>}
  <span className="ma-sr-only">{requirements[key]?'შესრულებულია':'არ არის მითითებული'}</span>
 </li>)}</ul>;
}
/** Read-only requirements also explain exactly what is missing in the final review. */
export function VerificationSummary({store,id,onDetails}:{store:Store;id:string;onDetails:()=>void}) {
 const [requirements,setRequirements]=useState<VerificationRequirements>();const [error,setError]=useState('');const [revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;void readVerificationRequirements(store).then(value=>{if(active)setRequirements(value);},()=>{if(active)setError('მოთხოვნები ვერ ჩაიტვირთა.');});return()=>{active=false;};},[store,id,revision]);
 return requirements?<Checklist requirements={requirements} onDetails={onDetails}/>:error?<div role="alert">{error}<Button variant="ghost" onClick={()=>{setError('');setRevision(value=>value+1);}}>ხელახლა ცდა</Button></div>:<p role="status">მოთხოვნები იტვირთება…</p>;
}
/** Company verification has two document slots, shown one at a time. */
export function VerificationDocuments({store,id,status,verified=false,note,onStatus,onBusy,onDetails,blockFooter=false}:{blockFooter?:boolean;store:Store;id:string;status:string;verified?:boolean;note?:string|null;onStatus?:(status:string)=>void;onBusy?:(value:boolean)=>void;onDetails?:()=>void}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[attempted,setAttempted]=useState(false);
 const {savedAt,markSaved}=useSavedTime();
 const [requirements,setRequirements]=useState<VerificationRequirements>(),[revision,setRevision]=useState(0);
 const [slot,setSlot]=useState<'registration'|'tax'|'review'>('registration');
 const root=useRef<HTMLDivElement>(null);const state=verificationState(status,verified);const locked=state==='pending'||state==='approved';
 const updateBusy=(value:boolean)=>{setBusy(value);onBusy?.(value);};
 useEffect(()=>{let active=true;void readVerificationRequirements(store).then(value=>{if(active){setRequirements(value);setError('');}},()=>{if(active)setError('ვერიფიკაციის მოთხოვნები ვერ ჩაიტვირთა. სცადეთ ხელახლა.');});return()=>{active=false;};},[store,id,revision,status]);
 const focusMissing=()=>requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('[data-missing] button, [data-missing] a')?.focus());
 const submit=async()=>{
  updateBusy(true);setAttempted(true);setError('');
  try {
   const current=await readVerificationRequirements(store);setRequirements(current);
   if(Object.values(current).some(value=>!value)){focusMissing();return;}
   const profile=await store.mutateRpc('submit_verification',{});onStatus?.(profile.verification_documents_status);markSaved();
  }catch(err){
   if((err as {code?:string})?.code==='MA902'||(err as Error)?.message?.includes('MA902')){
    try{setRequirements(await readVerificationRequirements(store));focusMissing();}catch{setError('ვერიფიკაციის მოთხოვნები ვერ ჩაიტვირთა. სცადეთ ხელახლა.');}
   }else setError('ვერ გაიგზავნა. სცადეთ ხელახლა.');
  }finally{updateBusy(false);}
 };
 return <div ref={root} className={s.fields}>
 {requirements?<Checklist requirements={requirements} attempted={attempted} onDetails={onDetails} onDocument={setSlot}/>:<p role="status">მოთხოვნები იტვირთება…</p>}
 <div className={v.verificationStatus}><Badge status={verificationTone(status,verified)}>{verificationLabel(status,verified)}</Badge><p>{verificationHint(status,verified,note)}</p></div>
 <nav className={v.addRow} aria-label="დოკუმენტების ნაბიჯები">{(['registration','tax','review'] as const).map((value,index)=><Button key={value} variant={slot===value?'secondary':'ghost'} disabled={busy} aria-current={slot===value?'step':undefined} onClick={()=>setSlot(value)}>{index+1}. {value==='registration'?'რეგისტრაცია':value==='tax'?'საგადასახადო':'მიმოხილვა'}</Button>)}</nav>
 {slot!=='review'?<FileAttachments key={slot} store={store} kind="verification" target={id} slot={slot} label={slot==='registration'?'რეგისტრაციის ამონაწერი':'საგადასახადო დოკუმენტი'} editable={!locked} onBusy={updateBusy} onChange={()=>setRevision(value=>value+1)}/>:<p className={v.muted}>გაგზავნამდე შეამოწმეთ ზემოთ ჩამოთვლილი ოთხივე პუნქტი.</p>}
 {slot!=='review'&&<Button variant="secondary" disabled={busy} onClick={()=>setSlot(slot==='registration'?'tax':'review')}>შემდეგი დოკუმენტის ნაბიჯი</Button>}
 <div className={blockFooter ? 'account-section__footer' : undefined}>
 {error?<div className="ma-field__error" role="alert">{error}<Button variant="ghost" disabled={busy} onClick={()=>setRevision(value=>value+1)}>ხელახლა ცდა</Button></div>:blockFooter?<p className="account-section__status" role="status">{savedAt?`შენახულია · ${new Date(savedAt).toLocaleTimeString('ka-GE',{hour:'2-digit',minute:'2-digit'})}`:locked?'დოკუმენტები გაგზავნილია':'ატვირთვა თითოეულ დოკუმენტს ინახავს'}</p>:null}
 {!locked?<Button disabled={busy} loading={busy} onClick={()=>void submit()}>{state==='returned'?'ხელახლა გაგზავნა':'განხილვაზე გაგზავნა'}</Button>:null}
 </div>
 </div>;
}
// Admin side: one verification term and status, documents, and the review actions in one row (decisions go through ModerationSheet).
type AdminVerificationAction={kind:'users';action:string;id:string;label:string};
export function AdminVerification({store,id,verified=false,label='',onAction}:{store:Store;id:string;verified?:boolean;label?:string;onAction?:(action:AdminVerificationAction)=>void}) {
 const [error,setError]=useState('');const [revision,setRevision]=useState(0);const [busy,setBusy]=useState(false);const [manual,setManual]=useState('');
 const [record,setRecord]=useState<{status:string;legal_name?:string;registration_code?:string;legal_form?:string;note?:string|null}>();const call=store.callRpc;
 useEffect(()=>{let active=true;void call('verification_record',{p_profile_id:id}).then((data:{status:string;legal_name?:string;registration_code?:string;legal_form?:string;note?:string|null})=>{if(active){setRecord(data);setError('');}},()=>{if(active)setError('ვერიფიკაციის მონაცემები ვერ ჩაიტვირთა.');});return()=>{active=false;};},[call,id,revision]);
 const status=verified?'approved':record?.status||'not_submitted';
 return <section className={a.verification} aria-label="ვერიფიკაცია"><header><h4>ვერიფიკაცია</h4>{record?<Badge status={status==='approved'?'success':status==='pending'?'warning':'neutral'}>{verificationLabels[status]}</Badge>:null}</header>
 {record?<>{status==='rejected'&&record.note?<p className={a.note}>დაბრუნების მიზეზი: {record.note}</p>:null}<dl className={a.detailFacts}><dt>იურიდიული სახელი</dt><dd>{record.legal_name||'—'}</dd><dt>საიდენტიფიკაციო კოდი</dt><dd>{record.registration_code||'—'}</dd>{record.legal_form?<><dt>სამართლებრივი ფორმა</dt><dd>{record.legal_form}</dd></>:null}</dl></>:null}
 <FileAttachments store={store} kind="verification" target={id} label="დოკუმენტები"/>
 {status==='pending'&&onAction?<div className={a.inlineActions}><Button variant="secondary" onClick={()=>onAction({kind:'users',action:'approveDocs',id,label})}>დოკუმენტების დადასტურება…</Button><Button variant="danger-quiet" onClick={()=>onAction({kind:'users',action:'returnDocs',id,label})}>დოკუმენტების დაბრუნება…</Button></div>:null}
 {!verified&&record?<details className={a.disclosure}><summary>დოკუმენტების სტატუსის ხელით შეცვლა</summary><div className={a.inlineActions}><select aria-label="დოკუმენტების სტატუსი" className="ma-select" value={manual||record.status} onChange={e=>setManual(e.target.value)} disabled={busy}>{['not_submitted','pending','rejected'].map(v=><option key={v} value={v}>{verificationLabels[v]}</option>)}</select><Button variant="secondary" disabled={busy||!manual||manual===record.status} onClick={async()=>{setBusy(true);setError('');try{await store.mutateRpc('admin_set_document_status',{p_profile_id:id,p_status:manual});setManual('');setRevision(n=>n+1);}catch{setError('სტატუსი ვერ შეიცვალა. სცადეთ ხელახლა.');}finally{setBusy(false);}}}>სტატუსის შენახვა</Button></div><p className={a.note}>ვერიფიცირებისთვის გამოიყენეთ „ვერიფიცირება“ — ის სტატუსსაც შეცვლის.</p></details>:null}
 {error?<p className="ma-field__error" role="alert">{error}</p>:null}</section>;
}
