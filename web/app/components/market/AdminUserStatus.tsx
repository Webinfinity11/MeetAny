"use client";
import {ActionMenu,type ActionMenuItem} from '../ui/ActionMenu';
import styles from './admin-status.module.css';
type User={id:string;role:string;company?:string;name:string;verified:boolean;blocked:boolean;blockedReason?:string;blocked_reason?:string};
type Action={kind:'users';action:string;id:string;label:string};
export function AdminUserStatus({user,onAction}:{user:User;onAction:(action:Action)=>void}){
 const {id,role,verified,blocked}=user,name=user.company||user.name;
 const fullLabel=blocked?'დაბლოკილი':role==='company'?verified?'დადასტურებული':'დასადასტურებელი':'აქტიური';
 const label=fullLabel==='დასადასტურებელი'?'განხილვაში':fullLabel;
 const tone=blocked?'danger':role==='company'?verified?'success':'warning':'info';
 const reason=user.blockedReason||user.blocked_reason;
 const action=(key:string)=>()=>onAction({kind:'users',action:key,id,label:name});
 const items:ActionMenuItem[]=[];
 if(role==='company')items.push({id:'verify',label:verified?'დადასტურების მოხსნა':'კომპანიის დადასტურება',disabled:blocked,danger:verified,onSelect:action(verified?'unverify':'verify')});
 items.push({id:'block',label:blocked?'განბლოკვა':'დაბლოკვა',danger:!blocked,onSelect:action(blocked?'unblock':'block')});
 return <div className={styles.status}>{role==='admin'?<span className={styles.static} data-tone={tone}>{label}</span>:<ActionMenu label={`სტატუსის მართვა: ${name} — ${fullLabel}`} className={styles.control} items={items}><span data-tone={tone} className={styles.label}>{label}</span></ActionMenu>}{blocked&&reason?<small className={styles.reason} title={reason}>{reason}</small>:null}</div>;
}
