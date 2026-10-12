"use client";
import { useState } from 'react';
import type { Store } from '../../../lib/market-client';
import { FileAttachments } from '../FileAttachments';
import { Icon } from '../../Icon';
import styles from './SharedFiles.module.css';

/** One shared conversation file list in every chat surface. */
export function SharedFiles({ store, target }: { store: Store; target: string }) {
  const [open, setOpen] = useState(false);
  const [error,setError]=useState('');
  const [busy, setBusy] = useState(false);
  const editable = !store.currentUser()?.blocked;
  return <details className={styles.panel} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary aria-label="საერთო ფაილები" title="საერთო ფაილები" aria-busy={busy || undefined} onClick={event => { if (busy) event.preventDefault(); }}><Icon name="upload"/></summary>
    {open && <div className={styles.content}><FileAttachments key={target} store={store} kind="conversation" target={target} editable={editable} onBusy={setBusy} onChange={file=>{if(file)void store.sendMessage(target,`ფაილი: ${file.name}`).catch(()=>setError("ფაილი შენახულია; ჩატის შეტყობინება ვერ გაიგზავნა."));}}/>{error?<p role="alert">{error}</p>:null}</div>}
  </details>;
}
