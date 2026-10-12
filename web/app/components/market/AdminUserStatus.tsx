"use client";
import {ActionMenu,type ActionMenuItem} from '../ui/ActionMenu';
import {companyStatus} from '../../lib/admin-helpers';
import styles from './admin-status.module.css';
type User={id:string;role:string;company?:string;name:string;verified:boolean;blocked:boolean;blockedReason?:string;blocked_reason?:string;verification_documents_status?:string};
type Action={kind:'users';action:string;id:string;label:string};
/** One chip: the verification state for companies (from the documents status), access for everyone else. */
export function AdminUserStatus({user,onAction}:{user:User;onAction:(action:Action)=>void}){
 const {id,role,verified,blocked}=user,name=user.company||user.name;
 const {label,tone}=companyStatus(user);
 const reason=user.blockedReason||user.blocked_reason;
 const action=(key:string)=>()=>onAction({kind:'users',action:key,id,label:name});
 const items:ActionMenuItem[]=[];
 if(role==='company'&&!blocked){
  if(verified)items.push({id:'unverify',label:'ვერიფიკაციის მოხსნა',danger:true,onSelect:action('unverify')});
  else if(user.verification_documents_status==='pending')items.push({id:'approve',label:'დოკუმენტების დადასტურება',onSelect:action('approveDocs')},{id:'return',label:'დოკუმენტების დაბრუნება',onSelect:action('returnDocs')});
  else items.push({id:'verify',label:'ვერიფიცირება',onSelect:action('verify')});
 }
 items.push({id:'block',label:blocked?'განბლოკვა':'დაბლოკვა',danger:!blocked,onSelect:action(blocked?'unblock':'block')});
 return <div className={styles.status}>{role==='admin'?<span className={styles.static} data-tone={tone}>{label}</span>:<ActionMenu label={`სტატუსის მართვა: ${name} — ${label}`} className={styles.control} items={items}><span data-tone={tone} className={styles.label}>{label}</span></ActionMenu>}{blocked&&reason?<small className={styles.reason} title={reason}>{reason}</small>:null}</div>;
}
