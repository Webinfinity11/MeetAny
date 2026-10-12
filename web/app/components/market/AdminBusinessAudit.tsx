"use client";
import {useCallback,useState} from 'react';
import Link from 'next/link';
import type {Store} from '../../lib/market-client';
import {useBusinessResource} from '../../lib/business-client';
import {dateLabel} from '../../lib/format';
import {adminDateTime,verificationLabels} from '../../lib/admin-helpers';
import {Button} from '../ui/Button';
import styles from './admin-edit.module.css';
type Entry={id:number;action:string;created_at:string;actor:string;target:string;company_id?:string;changes:{plan?:string;expiresAt?:string;days?:number;approved?:boolean;rating?:number;status?:string;reason?:string;keys?:string[]}};
// Admin actions only: a review author saving their own review (review_saved) is not an admin action.
const labels:Record<string,string>={plan_managed:'პაკეტის შეცვლა',plan_resolved:'პაკეტის განაცხადი',site_content_saved:'საიტის შიგთავსის განახლება',review_hidden:'შეფასების დამალვა',review_published:'შეფასების აღდგენა',report_hidden:'საჩივრის დაკმაყოფილება',report_rejected:'საჩივრის უარყოფა',document_status:'დოკუმენტების სტატუსის შეცვლა'};
function changeLabel(row:Entry){const c=row.changes;const parts:string[]=[];if(row.action==='plan_managed')parts.push(c.plan==='vip'?'VIP':c.plan==='premium'?'Premium':'უფასო');if(row.action==='plan_resolved')parts.push(c.approved?'დადასტურებული':'უარყოფილი',c.plan==='vip'?'VIP':'Premium');if(c.expiresAt)parts.push(`ვადა: ${dateLabel(c.expiresAt)}`);if(c.days)parts.push(`${c.days} დღე`);if(c.rating)parts.push(`${c.rating}/5`);if(row.action==='document_status'&&c.status)parts.push(verificationLabels[c.status]||c.status);else if(c.status==='hidden')parts.push('დამალული');if(c.keys){const photos=c.keys.filter(key=>key.includes('Image')).length;parts.push(`${c.keys.length-photos} ტექსტი`,`${photos} ფოტო`);}if(c.reason)parts.push(c.reason);return parts.join(' · ');}
export function AdminBusinessAudit({store}:{store:Store}){
 const [open,setOpen]=useState(false),[offset,setOffset]=useState(0);
 const read=store.adminBusinessAudit;const load=useCallback(()=>read(offset,20),[read,offset]);
 const resource=useBusinessResource<{total:number;items:Entry[]}>(open?load:undefined,`business-audit:${offset}`,store.dataRevision());
 const items=resource.data?.items.filter(row=>row.action!=='review_saved')||[];
 return <details className={styles.businessAudit} open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary>შეფასებები, საჩივრები და შიგთავსი</summary>{open?<>{resource.error?<div role="alert"><p>ისტორია ვერ ჩაიტვირთა. სცადეთ ხელახლა.</p><Button variant="secondary" onClick={resource.reload}>ხელახლა ცდა</Button></div>:!resource.data?<p role="status">იტვირთება…</p>:<>{items.length?<ol className={styles.auditList}>{items.map(row=><li key={row.id}><div><strong>{labels[row.action]||'მოქმედება'}</strong><time dateTime={row.created_at}>{adminDateTime(row.created_at)}</time></div><p>{row.company_id?<Link href={`/admin/?tab=companies&q=${row.company_id}`}>{row.target}</Link>:row.target}<span> · {row.actor}</span></p>{changeLabel(row)?<small>{changeLabel(row)}</small>:null}</li>)}</ol>:<p>მოქმედება ჯერ არ არის.</p>}{resource.data.total>20?<nav className={styles.actions} aria-label="ისტორიის გვერდები"><Button variant="secondary" onClick={()=>setOffset(value=>Math.max(0,value-20))} disabled={!offset}>წინა</Button><span>{offset+1}–{Math.min(offset+20,resource.data.total)}</span><Button variant="secondary" onClick={()=>setOffset(value=>value+20)} disabled={offset+20>=resource.data.total}>შემდეგი</Button></nav>:null}</>}</>:null}</details>;
}
