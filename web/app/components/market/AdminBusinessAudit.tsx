"use client";
import {useCallback,useState} from 'react';
import Link from 'next/link';
import type {Store} from '../../lib/market-client';
import {useBusinessResource,businessError} from '../../lib/business-client';
import {dateLabel} from '../../lib/format';
import {Button} from '../ui/Button';
import styles from './admin-edit.module.css';
type Entry={id:number;action:string;created_at:string;actor:string;target:string;company_id?:string;changes:{plan?:string;expiresAt?:string;days?:number;approved?:boolean;rating?:number;status?:string;reason?:string;keys?:string[]}};
const labels:Record<string,string>={plan_managed:'პაკეტის შეცვლა',plan_resolved:'პაკეტის განაცხადი',site_content_saved:'საიტის შიგთავსის განახლება',review_saved:'შეფასების შენახვა',review_hidden:'შეფასების დამალვა',review_published:'შეფასების აღდგენა',report_hidden:'საჩივრის დაკმაყოფილება',report_rejected:'საჩივრის უარყოფა'};
function changeLabel(row:Entry){const c=row.changes;const parts:string[]=[];if(row.action==='plan_managed')parts.push(c.plan==='vip'?'VIP':c.plan==='premium'?'Premium':'უფასო');if(row.action==='plan_resolved')parts.push(c.approved?'დადასტურებული':'უარყოფილი',c.plan==='vip'?'VIP':'Premium');if(c.expiresAt)parts.push(`ვადა: ${dateLabel(c.expiresAt)}`);if(c.days)parts.push(`${c.days} დღე`);if(c.rating)parts.push(`${c.rating}/5`);if(c.status==='hidden')parts.push('დამალული');if(c.keys){const photos=c.keys.filter(key=>key.includes('Image')).length;parts.push(`${c.keys.length-photos} ტექსტი`,`${photos} ფოტო`);}if(c.reason)parts.push(c.reason);return parts.join(' · ');}
export function AdminBusinessAudit({store}:{store:Store}){
 const [open,setOpen]=useState(false),[offset,setOffset]=useState(0);
 const read=store.adminBusinessAudit;const load=useCallback(()=>read(offset,20),[read,offset]);
 const resource=useBusinessResource<{total:number;items:Entry[]}>(open?load:undefined,`business-audit:${offset}`,store.dataRevision());
 return <details className={styles.businessAudit} open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary>პაკეტები და შიგთავსი</summary>{open?<>{resource.error?<div role="alert"><p>{businessError(resource.error)}</p><Button variant="secondary" onClick={resource.reload}>თავიდან ცდა</Button></div>:!resource.data?<p role="status">იტვირთება…</p>:<>{resource.data.items.length?<ol className={styles.auditList}>{resource.data.items.map(row=><li key={row.id}><div><strong>{labels[row.action]||'მოქმედება'}</strong><time dateTime={row.created_at}>{dateLabel(row.created_at)} · {new Date(row.created_at).toLocaleTimeString('ka-GE',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Tbilisi'})}</time></div><p>{row.company_id?<Link href={`/admin/?tab=companies&q=${row.company_id}`}>{row.target}</Link>:row.target}<span> · {row.actor}</span></p>{changeLabel(row)?<small>{changeLabel(row)}</small>:null}</li>)}</ol>:<p>მოქმედება ჯერ არ არის.</p>}{resource.data.total>20?<nav className={styles.actions} aria-label="ბიზნესის ისტორიის გვერდები"><Button variant="secondary" onClick={()=>setOffset(value=>Math.max(0,value-20))} disabled={!offset}>წინა</Button><span>{offset+1}–{Math.min(offset+20,resource.data.total)}</span><Button variant="secondary" onClick={()=>setOffset(value=>value+20)} disabled={offset+20>=resource.data.total}>შემდეგი</Button></nav>:null}</>}</>:null}</details>;
}
