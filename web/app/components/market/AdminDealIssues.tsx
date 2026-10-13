'use client';
import {AdminIssueComment} from './AdminIssueComment';
import {useCallback} from 'react';
import type {Store} from '../../lib/market-client';
import {useBusinessResource} from '../../lib/business-client';
import {Button} from '../ui/Button';
import {adminDateTime} from '../../lib/admin-helpers';
import {issueOutcomes,issueReasons} from '../../lib/admin-deals';
import type {AdminAction,AdminTarget} from './AdminDetail';
import styles from './admin.module.css';
type Issue={id:string;deal_id:string;title:string;reason:string;body:string;status:string;outcome?:string|null;stage:string;created_at:string;resolution?:string;resolved_at?:string|null;actor_name?:string;actor_side?:'buyer'|'supplier';resolver_name?:string|null};
/** Deal issues: the open ones need a decision (outcome + comment via ModerationSheet); the closed ones keep the outcome. */
export function AdminDealIssues({store,revision,onOpen,onAction}:{store:Store;revision:number;onOpen:(target:AdminTarget)=>void;onAction:(action:AdminAction)=>void}) {
 const load=useCallback(()=>store.callRpc('admin_deal_issues',{}),[store]);const resource=useBusinessResource<Issue[]>(load,`issues:${revision}`);
 const items=resource.data||[];const open=items.filter(i=>i.status==='open');const closed=items.filter(i=>i.status!=='open').slice(0,5);
 const row=(i:Issue)=><li key={i.id} className={styles.issue}>
  <div className={styles.issueHead}><strong>{issueReasons[i.reason]||i.reason}</strong><span className={`ma-badge ma-badge--${i.status==='open'?'warning':'neutral'}`}>{i.status==='open'?'განხილვაშია':issueOutcomes[i.outcome||'resolved']}</span></div>
  <button type="button" className={styles.rowLink} onClick={()=>onOpen({kind:'deal',id:i.deal_id})}>{i.title}</button>
  <small>{i.actor_side==='buyer'?'მყიდველი':'მომწოდებელი'}{i.actor_name?` · ${i.actor_name}`:''} · {adminDateTime(i.created_at)}</small>
  <p className={styles.listText}>{i.body}</p>
  {i.resolution?<p className={styles.listText}>შედეგი: {i.resolution}{i.resolver_name?` — ${i.resolver_name}`:''}</p>:null}
  <AdminIssueComment store={store} issueId={i.id}/>
  {i.status==='open'?<div className={styles.inlineActions}><Button variant="secondary" size="sm" onClick={()=>onAction({kind:'issues',action:'resolveIssue',id:i.id,label:`${i.title} · ${issueReasons[i.reason]||''}`,choice:{label:'შედეგი',options:Object.entries(issueOutcomes).filter(([value])=>value!=='cancelled'||i.stage!=='complete')}})}>განხილვის დასრულება…</Button><Button variant="ghost" size="sm" onClick={()=>onOpen({kind:'deal',id:i.deal_id})}>გარიგების ნახვა</Button></div>:null}
 </li>;
 return <section className={styles.panel} aria-labelledby="deal-issues-heading"><header className={styles.panelHead}><h2 id="deal-issues-heading">გარიგების პრობლემები</h2>{open.length?<span>{open.length} ღია</span>:null}</header>
  {resource.error?<div role="alert" className={styles.inlineActions}><p className={styles.note}>სია ვერ ჩაიტვირთა. სცადეთ ხელახლა.</p><Button variant="secondary" size="sm" onClick={resource.reload}>ხელახლა ცდა</Button></div>
  :!resource.data?<p className={styles.note} role="status">იტვირთება…</p>
  :!items.length?<p className={styles.note}>გარიგების პრობლემები ახლა არ არის.</p>
  :<>{open.length?<ul className={styles.issueList}>{open.map(row)}</ul>:<p className={styles.note}>ღია პრობლემა არ არის.</p>}
   {closed.length?<details className={styles.disclosure}><summary>ბოლოს დასრულებული <span className={styles.disclosureCount}>{closed.length}</span></summary><ul className={styles.issueList}>{closed.map(row)}</ul></details>:null}</>}
 </section>;
}
