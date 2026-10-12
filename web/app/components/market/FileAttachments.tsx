'use client';
import { useEffect,useRef,useState } from 'react';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Icon } from '../Icon';
import { uploadFile,downloadFile,type Attachment,type FileKind } from '../../lib/files-client';
import type { Store } from '../../lib/market-client';
import styles from './files.module.css';
/** `optional`: a read-only list that may simply be absent (request detail) — a failed load leaves no block, like an empty one. */
export function FileAttachments({store,kind,target,slot='',editable=false,optional=false,label='ფაილები',onBusy,onChange,showTitle=true}:{store:Store;kind:FileKind;target:string;slot?:string;editable?:boolean;optional?:boolean;label?:string;showTitle?:boolean;onBusy?:(busy:boolean)=>void;onChange?:(file?:Attachment)=>void}) {
 const [files,setFiles]=useState<Attachment[]>();const [error,setError]=useState('');const [progress,setProgress]=useState<number>();const [revision,setRevision]=useState(0);const input=useRef<HTMLInputElement>(null);const call=store.callRpc;const list=store.listAttachments;
 useEffect(()=>{let active=true;void list(kind,target).then((items:Attachment[])=>{if(active)setFiles(items.filter(f=>!slot||f.slot===slot));},()=>{if(active)setError('ფაილები ვერ ჩაიტვირთა.');});return()=>{active=false;};},[list,kind,target,slot,revision]);
 if(!editable&&files?.length===0&&!error)return null;
 if(!editable&&optional&&!files)return null;
 const busy=progress!==undefined;
 return <section className={styles.files} aria-label={label}><header>{showTitle?<h3>{label}</h3>:null}{editable?<Button variant="secondary" size="sm" disabled={busy||!files||files.length>=10} onClick={()=>input.current?.click()}><Icon name="upload"/>{busy?`${progress}%`:'დამატება'}</Button>:null}</header>
 {!files&&!error?<p role="status">ფაილები იტვირთება…</p>:null}
 <ul>{files?.map(file=><li key={file.id}><Icon name={file.mime==='application/pdf'?'file-text':'image'}/><div><Button variant="ghost" disabled={busy} onClick={()=>void downloadFile(store,file).catch((e:Error)=>setError(e.message))}>{file.name}</Button><small>{Math.ceil((file.size||0)/1024)} კბ</small></div>{editable&&file.owner_id===store.currentUser()?.id?<Button variant="ghost" size="sm" disabled={busy} aria-label={`${file.name} — წაშლა`} onClick={async()=>{setError('');try{await call('remove_attachment',{p_id:file.id});setFiles(old=>old?.filter(f=>f.id!==file.id));onChange?.();}catch{setError('ფაილის წაშლა ვერ შესრულდა.');}}}><Icon name="x"/></Button>:null}</li>)}</ul>
 {editable?<><input ref={input} className="ma-sr-only" type="file" aria-label={`${label} — დამატება`} accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file||busy)return;setError('');setProgress(0);onBusy?.(true);try{const result=await uploadFile(store,kind,target,file,slot,setProgress);setFiles(old=>[...(old||[]),result]);onChange?.(result);}catch(err){setError((err as Error).message);}finally{setProgress(undefined);onBusy?.(false);}}}/><small>PDF, JPG, PNG, WEBP · მაქსიმუმ 10 მბ</small></>:null}
 {error?<Notice tone="error" action={files?null:<Button variant="secondary" size="sm" onClick={()=>{setError('');setRevision(n=>n+1);}}>ხელახლა ცდა</Button>}>{error}</Notice>:null}
 </section>;
}
