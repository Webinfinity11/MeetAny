'use client';
import { useEffect, useId, useState } from 'react';
import type { Store } from '../../lib/market-client';
import { CustomSelect } from '../ui/CustomSelect';
import { Button } from '../ui/Button';
import { money } from '../../lib/deal-client';
import s from './flow-details.module.css';
export type RequestPreferences = { specification?:string;design?:string;supplierTypes?:string[];certificates?:string;verifiedOnly?:boolean;flexibility?:number;budgetType?:string;budgetMin?:number;budgetMax?:number;budgetPrivate?:boolean;payment?:string;vatInvoice?:boolean;deferredPayment?:boolean };
export function preferenceError(p:RequestPreferences) {
 if(p.budgetType&&p.budgetType!=='negotiable'&&(!p.budgetMin||p.budgetMin<=0||p.budgetMin>1e9||(p.budgetType==='range'&&(!p.budgetMax||p.budgetMax<p.budgetMin||p.budgetMax>1e9))))return 'მიუთითეთ ბიუჯეტი 0-ზე მეტი; ზედა ზღვარი ქვედაზე ნაკლები არ უნდა იყოს.';
 return '';
}
const suppliers:Record<string,string>={manufacturer:'მწარმოებელი',distributor:'დისტრიბუტორი',service:'მომსახურების მიმწოდებელი'};
const designs:Record<string,string>={ready:'დიზაინი მზადაა',needed:'დიზაინი მჭირდება',none:'არ არის საჭირო'};
export function RequestPreferenceFields({value:p,onChange,part}:{value:RequestPreferences;onChange:(p:RequestPreferences)=>void;part:'specification'|'delivery'}) {
 const id=useId();const patch=(next:Partial<RequestPreferences>)=>onChange({...p,...next});
 const field=(key:'specification'|'certificates'|'payment',label:string,max:number,multi=false)=><div className="ma-field"><label htmlFor={`${id}-${key}`}>{label}</label>{multi?<textarea id={`${id}-${key}`} className="ma-textarea" maxLength={max} value={p[key]||''} onChange={e=>patch({[key]:e.target.value})}/>:<input id={`${id}-${key}`} className="ma-input" maxLength={max} value={p[key]||''} onChange={e=>patch({[key]:e.target.value})}/>}</div>;
 const check=(key:'verifiedOnly'|'budgetPrivate'|'vatInvoice'|'deferredPayment',label:string)=><label className="ma-check"><input type="checkbox" checked={!!p[key]} onChange={e=>patch({[key]:e.target.checked})}/>{label}</label>;
 return <div className={s.fields}>{part==='specification'?<>
 {field('specification','ზომა, მასალა და ტექნიკური დეტალები',2000,true)}
 <div className="ma-field"><label htmlFor={`${id}-design`}>დიზაინი</label><CustomSelect id={`${id}-design`} value={p.design||''} onChange={e=>patch({design:e.target.value})}><option value="">აირჩიეთ</option>{Object.entries(designs).map(([key,label])=><option key={key} value={key}>{label}</option>)}</CustomSelect></div>
 <fieldset className={s.checks}><legend>მომწოდებლის ტიპი</legend>{Object.entries(suppliers).map(([key,label])=><label className="ma-check" key={key}><input type="checkbox" checked={p.supplierTypes?.includes(key)||false} onChange={e=>patch({supplierTypes:e.target.checked?[...(p.supplierTypes||[]),key]:(p.supplierTypes||[]).filter(v=>v!==key)})}/>{label}</label>)}</fieldset>
 {field('certificates','სასურველი სერტიფიკატები',500)}{check('verifiedOnly','მხოლოდ ვერიფიცირებული კომპანიები')}
 </>:<>
 <div className="ma-field"><label htmlFor={`${id}-flexibility`}>თარიღის მოქნილობა</label><CustomSelect id={`${id}-flexibility`} value={String(p.flexibility||0)} onChange={e=>patch({flexibility:Number(e.target.value)})}>{[0,1,3,7,14,30].map(n=><option key={n} value={n}>{n?`± ${n} დღე`:'ზუსტი თარიღი'}</option>)}</CustomSelect></div>
 <div className="ma-field"><label htmlFor={`${id}-budget`}>ბიუჯეტი</label><CustomSelect id={`${id}-budget`} value={p.budgetType||'negotiable'} onChange={e=>{const type=e.target.value;const next={...p,budgetType:type};if(type==='negotiable'){delete next.budgetMin;delete next.budgetMax;}if(type==='exact')delete next.budgetMax;onChange(next);}}><option value="negotiable">შეთანხმებით</option><option value="exact">ზუსტი თანხა</option><option value="range">დიაპაზონი</option></CustomSelect></div>
 {p.budgetType&&p.budgetType!=='negotiable'?<><div className={s.two}>{(['budgetMin',...(p.budgetType==='range'?['budgetMax']:[])] as const).map(key=><div className="ma-field" key={key}><label htmlFor={`${id}-${key}`}>{key==='budgetMax'?'მაქსიმუმი ₾':p.budgetType==='range'?'მინიმუმი ₾':'თანხა ₾'}</label><input id={`${id}-${key}`} type="number" className="ma-input" min="0.01" max="1000000000" step="0.01" value={p[key as 'budgetMin'|'budgetMax']??''} onChange={e=>{const next={...p};if(e.target.value)Object.assign(next,{[key]:Number(e.target.value)});else delete next[key as 'budgetMin'|'budgetMax'];onChange(next);}}/></div>)}</div>{check('budgetPrivate','თანხა მხოლოდ ჩემთვის იყოს ხილული')}</>:null}
 {field('payment','სასურველი გადახდის პირობები',500)}{check('vatInvoice','საჭიროა დღგ-ის ანგარიშფაქტურა')}{check('deferredPayment','განვიხილავ გადავადებულ გადახდას')}
 </>}</div>;
}
const preferenceRows=(data:RequestPreferences)=>[['ტექნიკური დეტალები',data.specification],['დიზაინი',designs[data.design||'']],['მომწოდებელი',data.supplierTypes?.map(k=>suppliers[k]).join(', ')],['სერტიფიკატები',data.certificates],['ვერიფიკაცია',data.verifiedOnly?'მხოლოდ ვერიფიცირებული კომპანიები':null],['თარიღის მოქნილობა',data.flexibility?`± ${data.flexibility} დღე`:null],['ბიუჯეტი',data.budgetMin?`${money(data.budgetMin)}${data.budgetType==='range'?` – ${money(data.budgetMax)}`:''}${data.budgetPrivate?' · პირადი':''}`:null],['გადახდა',data.payment],['ანგარიშფაქტურა',data.vatInvoice?'საჭიროა დღგ-ის ანგარიშფაქტურა':null],['გადავადება',data.deferredPayment?'განიხილება გადავადებული გადახდა':null]].filter(([,v])=>v);
export function RequestPreferenceSummary({value}:{value:RequestPreferences}) {const rows=preferenceRows(value);return <dl className={s.recordRows}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;}
export function RequestPreferenceRecord({store,id,editable=false}:{store:Store;id:string;editable?:boolean}) {
 const [data,setData]=useState<RequestPreferences>();const [saved,setSaved]=useState<RequestPreferences>();const [error,setError]=useState('');const [revision,setRevision]=useState(0);const [editing,setEditing]=useState(false);const [pending,setPending]=useState(false);const call=store.callRpc;
 useEffect(()=>{let active=true;void call('request_preferences',{p_request_id:id}).then((p:RequestPreferences)=>{if(active){setData(p);setSaved(p);setError('');}},()=>{if(active)setError('დეტალები ვერ ჩაიტვირთა.');});return()=>{active=false;};},[call,id,revision]);
 if(!data)return error?<p role="alert">{error}<Button variant="ghost" onClick={()=>setRevision(n=>n+1)}>ხელახლა ცდა</Button></p>:null;
 const rows=preferenceRows(data);
 return <section className={s.record}>{rows.length||editable?<header><h2>დამატებითი პირობები</h2>{editable?<Button variant="ghost" size="sm" onClick={()=>{if(editing&&saved)setData(saved);setEditing(v=>!v);setError("");}}>{editing?'დახურვა':'შეცვლა'}</Button>:null}</header>:null}{editing?<div className={s.fields}><fieldset disabled={pending}><RequestPreferenceFields value={data} onChange={setData} part="specification"/><RequestPreferenceFields value={data} onChange={setData} part="delivery"/></fieldset><Button loading={pending} onClick={async()=>{const problem=preferenceError(data);if(problem){setError(problem);return;}setPending(true);setError('');try{await call('set_request_preferences',{p_request_id:id,p_preferences:data});setSaved(data);setEditing(false);}catch{setError('შენახვა ვერ შესრულდა.');}finally{setPending(false);}}}>შენახვა</Button></div>:<dl className={s.recordRows}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}{error?<p className="ma-field__error" role="alert">{error}</p>:null}</section>;
}
