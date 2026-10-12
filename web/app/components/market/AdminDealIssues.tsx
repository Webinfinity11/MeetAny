'use client';
import {useCallback,useId,useState} from 'react';
import type {Store} from '../../lib/market-client';
import {useBusinessResource} from '../../lib/business-client';
import {Button} from '../ui/Button';
import {FileAttachments} from './FileAttachments';
import {dealHref,dealDate} from '../../lib/deal-client';
import s from './deals.module.css';
type Issue={id:string;deal_id:string;title:string;reason:string;body:string;status:string;created_at:string;resolution?:string};
export function AdminDealIssues({store}:{store:Store}) {
 const load=useCallback(()=>store.callRpc('admin_deal_issues',{}),[store]);const resource=useBusinessResource<Issue[]>(load,'issues');
 return <section className={s.card}><header className={s.cardHead}><h2>გარიგების პრობლემები</h2><Button variant="ghost" size="sm" onClick={resource.reload}>განახლება</Button></header>{resource.error?<p role="alert">{resource.error}</p>:!resource.data?<p role="status">იტვირთება…</p>:!resource.data.length?<p className={s.note}>შეტყობინებები არ არის.</p>:<div className={s.collaborationList}>{resource.data.map(i=><IssueRow key={i.id} issue={i} store={store} onDone={resource.reload}/>)}</div>}</section>;
}
function IssueRow({issue:i,store,onDone}:{issue:Issue;store:Store;onDone:()=>void}) {
 const id=useId();const [resolution,setResolution]=useState('');const [pending,setPending]=useState(false);const [error,setError]=useState('');
 return <details className={s.proposal}><summary>{i.title} · {i.status==='open'?'განხილვაშია':'დასრულებულია'} · {dealDate(i.created_at)}</summary><div className={s.form}><p className={s.description}>{i.body}</p><Button variant="secondary" size="sm" href={dealHref(i.deal_id)}>გარიგების ნახვა</Button><FileAttachments store={store} kind="issue" target={i.deal_id}/>{i.status==='open'?<form className={s.form} onSubmit={async e=>{e.preventDefault();if(pending)return;setPending(true);setError('');try{await store.mutateRpc('admin_resolve_deal_issue',{p_issue_id:i.id,p_resolution:resolution});onDone();}catch{setError('განხილვა ვერ დასრულდა.');}finally{setPending(false);}}}><div className="ma-field"><label htmlFor={id}>განხილვის შედეგი</label><textarea id={id} className="ma-textarea" required minLength={3} maxLength={2000} disabled={pending} value={resolution} onChange={e=>setResolution(e.target.value)}/></div><Button type="submit" loading={pending} disabled={resolution.trim().length<3}>განხილვის დასრულება</Button>{error?<p role="alert">{error}</p>:null}</form>:<p className={s.description}>{i.resolution}</p>}</div></details>;
}
