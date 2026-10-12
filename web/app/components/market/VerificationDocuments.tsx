'use client';
import {useState,useEffect} from 'react';
import type {Store} from '../../lib/market-client';
import {Button} from '../ui/Button';
import {Badge} from '../ui/Badge';
import {FileAttachments} from './FileAttachments';
import {verificationHint,verificationLabel,verificationState,verificationTone} from '../../lib/onboarding-client';
import s from './flow-details.module.css';
import v from './onboarding.module.css';
import a from './admin.module.css';
import {verificationLabels} from '../../lib/admin-helpers';
/** The company's side: one status (verificationState), its hint, the three files and the submit action. */
export function VerificationDocuments({store,id,status,verified=false,note,onStatus,onBusy}:{store:Store;id:string;status:string;verified?:boolean;note?:string|null;onStatus?:(status:string)=>void;onBusy?:(value:boolean)=>void}) {
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const state=verificationState(status,verified);const locked=state==='pending'||state==='approved';
 const updateBusy=(v:boolean)=>{setBusy(v);onBusy?.(v);};
 return <div className={s.fields}><div className={v.verificationStatus}><Badge status={verificationTone(status,verified)}>{verificationLabel(status,verified)}</Badge><p>{verificationHint(status,verified,note)}</p></div>
 <FileAttachments store={store} kind="verification" target={id} slot="registration" label="რეგისტრაციის ამონაწერი" editable={!locked} onBusy={updateBusy}/>
 <FileAttachments store={store} kind="verification" target={id} slot="tax" label="საგადასახადო დოკუმენტი" editable={!locked} onBusy={updateBusy}/>
 <FileAttachments store={store} kind="verification" target={id} slot="certificate" label="სერტიფიკატის ასლი (არასავალდებულო)" editable={!locked} onBusy={updateBusy}/>
 {!locked?<Button disabled={busy} loading={busy} onClick={async()=>{updateBusy(true);setError('');try{const p=await store.mutateRpc('submit_verification',{});onStatus?.(p.verification_documents_status);}catch{setError('შეავსეთ იურიდიული მონაცემები, დაამატეთ ლოგო, რეგისტრაციის ამონაწერი და საგადასახადო დოკუმენტი.');}finally{updateBusy(false);}}}>{state==='returned'?'ხელახლა გაგზავნა':'განხილვაზე გაგზავნა'}</Button>:null}
 {error?<p className="ma-field__error" role="alert">{error}</p>:null}</div>;
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
