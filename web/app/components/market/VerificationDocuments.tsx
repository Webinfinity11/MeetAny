'use client';
import {useState,useEffect} from 'react';
import type {Store} from '../../lib/market-client';
import {Button} from '../ui/Button';
import {Badge} from '../ui/Badge';
import {FileAttachments} from './FileAttachments';
import s from './flow-details.module.css';
export function VerificationDocuments({store,id,status,verified=false,onStatus,onBusy}:{store:Store;id:string;status:string;verified?:boolean;onStatus?:(status:string)=>void;onBusy?:(value:boolean)=>void}) {
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const locked=verified||['pending','approved'].includes(status);
 const updateBusy=(v:boolean)=>{setBusy(v);onBusy?.(v);};
 return <div className={s.fields}><Badge status={verified?'success':status==='pending'?'warning':'neutral'}>{verified?'ვერიფიცირებული':status==='pending'?'განხილვაშია':status==='rejected'?'საჭიროა დოკუმენტების შესწორება':'დოკუმენტები არ გაგზავნილა'}</Badge>
 <FileAttachments store={store} kind="verification" target={id} slot="registration" label="რეგისტრაციის ამონაწერი" editable={!locked} onBusy={updateBusy}/>
 <FileAttachments store={store} kind="verification" target={id} slot="tax" label="საგადასახადო დოკუმენტი" editable={!locked} onBusy={updateBusy}/>
 <FileAttachments store={store} kind="verification" target={id} slot="certificate" label="სერტიფიკატები" editable={!locked} onBusy={updateBusy}/>
 {!locked?<Button disabled={busy} loading={busy} onClick={async()=>{updateBusy(true);setError('');try{const p=await store.mutateRpc('submit_verification',{});onStatus?.(p.verification_documents_status);}catch{setError('შეავსეთ იურიდიული მონაცემები, დაამატეთ ლოგო, რეგისტრაციისა და საგადასახადო დოკუმენტები.');}finally{updateBusy(false);}}}>განხილვაზე გაგზავნა</Button>:null}
 {error?<p className="ma-field__error" role="alert">{error}</p>:null}</div>;
}
export function AdminVerification({store,id}:{store:Store;id:string}) {
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [status,setStatus]=useState('');
 const [record,setRecord]=useState<{status:string;legal_name?:string;registration_code?:string}>();const call=store.callRpc;
 useEffect(()=>{let active=true;void call('verification_record',{p_profile_id:id}).then((data:{status:string;legal_name?:string;registration_code?:string})=>{if(active)setRecord(data);},()=>{if(active)setError('მონაცემები ვერ ჩაიტვირთა.');});return()=>{active=false;};},[call,id]);
 return <section className={s.fields}><h3>ვერიფიკაციის დოკუმენტები</h3>{record?<><Badge status={record.status==='pending'?'warning':'neutral'}>{{pending:'განხილვაშია',approved:'დამტკიცებულია',rejected:'დაბრუნებულია შესწორებისთვის',not_submitted:'დოკუმენტები არ გაგზავნილა'}[record.status]}</Badge><dl className={s.recordRows}><div><dt>იურიდიული სახელი</dt><dd>{record.legal_name||'—'}</dd></div><div><dt>საიდენტიფიკაციო კოდი</dt><dd>{record.registration_code||'—'}</dd></div></dl></>:null}<FileAttachments store={store} kind="verification" target={id}/><div className={s.two}>{[['approved','დოკუმენტების დამტკიცება'],['rejected','შესწორებისთვის დაბრუნება']].map(([value,label])=><Button key={value} variant="secondary" disabled={busy||!!status||record?.status!=='pending'} onClick={async()=>{setBusy(true);setError('');try{await store.mutateRpc('review_verification',{p_profile_id:id,p_status:value});setStatus(value==='approved'?'დოკუმენტები დამტკიცებულია.':'დოკუმენტები დაბრუნებულია შესწორებისთვის.');}catch{setError('განხილვა მხოლოდ გაგზავნილ დოკუმენტებზეა შესაძლებელი. განაახლეთ მომხმარებლის მონაცემები.');}finally{setBusy(false);}}}>{label}</Button>)}</div>{status?<p role="status">{status}</p>:null}{error?<p className="ma-field__error" role="alert">{error}</p>:null}</section>;
}
