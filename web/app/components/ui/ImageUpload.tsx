'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { Icon } from '../Icon';
import s from './image-upload.module.css';

export type ImageUploadItem = { key: string; url?: string; file?: File };
export type ImageUploadProps = { id: string; label: string; kind: 'logo' | 'gallery'; items: ImageUploadItem[]; onChange: (items: ImageUploadItem[]) => void; max?: number; disabled?: boolean; uploading?: boolean; hint?: string };
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
function Preview({ item, logo, label }: { item: ImageUploadItem; logo: boolean; label: string }) {
  const [preview, setPreview] = useState<string>();
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    const url = item.file ? URL.createObjectURL(item.file) : undefined;
    // The object URL is a browser resource with the same lifetime as this file.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(url);
    setBroken(false);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [item.file, item.url]);
  const src = item.file ? preview : item.url;
  return logo ? <Avatar name={label} logoUrl={src} size="lg" /> : broken ? <span className={s.failed} role="img" aria-label="სურათი ვერ ჩაიტვირთა" title="სურათი ვერ ჩაიტვირთა"><Icon name="image" /></span> : src ? <img src={src} alt={label} onError={() => setBroken(true)} /> : <Icon name="image" />;
}
export function ImageUpload({ id, label, kind, items, onChange, max = 8, disabled = false, uploading = false, hint }: ImageUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(''), [over, setOver] = useState(false);
  const dragged = useRef<string | null>(null);
  const logo = kind === 'logo', limit = logo ? 1 : Math.min(8, max), size = logo ? 2 : 5;
  const inactive = disabled || uploading;
  const add = (files: File[]) => {
    if (inactive || !files.length) return;
    const valid = files.filter(file => ALLOWED.includes(file.type) && file.size <= size * 1024 * 1024);
    const room = logo ? 1 : Math.max(0, limit - items.length), taken = valid.slice(0, room);
    setError(valid.length !== files.length ? `აირჩიეთ JPG, PNG, WEBP ან GIF სურათი, მაქსიმუმ ${size} მბ.` : taken.length !== valid.length ? `მაქსიმუმ ${limit} ფოტო` : '');
    if (taken.length) onChange([...(logo ? [] : items), ...taken.map(file => ({ key: crypto.randomUUID(), file }))]);
  };
  const move = (key: string, to: number) => {
    if (inactive) return;
    const index = items.findIndex(item => item.key === key);
    if (index < 0 || index === to) return;
    const next = [...items], [item] = next.splice(index, 1);
    next.splice(to, 0, item); onChange(next);
  };
  return <div className={`ma-field ${s.root}`} data-kind={kind} aria-busy={uploading}>
    <span className="ma-field__label" id={`${id}-label`}>{label}{!logo && <span className="ma-field__opt">{items.length} / {limit}</span>}</span>
    <ul className={s.grid} aria-labelledby={`${id}-label`}>
      {items.map((item, index) => <li key={item.key} className={s.item} draggable={!logo && !inactive}
        onDragStart={event => { dragged.current = item.key; event.dataTransfer.setData('text/plain', item.key); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { dragged.current = null; }}
        onDragOver={event => { event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (dragged.current) move(dragged.current, index); else add(Array.from(event.dataTransfer.files)); dragged.current = null; }}>
        <div className={s.tile} data-logo={logo || undefined}><Preview item={item} logo={logo} label={`${label} ${index + 1}`} />{!logo && index === 0 && <span className={s.badge}>მთავარი</span>}</div>
        <div className={s.tools}>{logo ? <Button variant="ghost" disabled={inactive} onClick={() => input.current?.click()}>შეცვლა</Button> : index > 0 ? <Button variant="ghost" disabled={inactive} aria-label={`ფოტო ${index + 1} — მთავრად დაყენება`} title="მთავრად დაყენება" onClick={() => move(item.key, 0)}><Icon name="star" /></Button> : null}
          <Button variant="ghost" disabled={inactive} aria-label={`${logo ? 'ლოგო' : `ფოტო ${index + 1}`} — წაშლა`} onClick={() => { setError(''); onChange(items.filter(i => i.key !== item.key)); }}>{logo ? 'წაშლა' : <Icon name="x" />}</Button></div>
      </li>)}
      {items.length < limit && <li><Button variant="secondary" className={`${s.tile} ${s.add}`} disabled={inactive} data-over={over || undefined} aria-describedby={`${id}-help`} onClick={() => input.current?.click()}
        onDragOver={event => { event.preventDefault(); if (!inactive) setOver(true); }} onDragLeave={() => setOver(false)} onDrop={event => { event.preventDefault(); setOver(false); add(Array.from(event.dataTransfer.files)); }}><Icon name="upload" /><span>{logo ? 'ლოგოს ატვირთვა' : 'დამატება'}</span>{!logo && <span className={s.format}>{size} მბ-მდე</span>}</Button></li>}
    </ul>
    <input ref={input} id={id} className="ma-sr-only" type="file" multiple={!logo} disabled={inactive} tabIndex={-1} aria-label={`${label} — დამატება`} accept={ALLOWED.join(',')} onChange={event => { add(Array.from(event.target.files || [])); event.target.value = ''; }} />
    <p id={`${id}-help`} className="ma-field__help">{hint ?? `JPG, PNG, WEBP ან GIF · ${size} მბ-მდე${logo ? '' : ' · პირველი ფოტო მთავარია.'}`}</p>
    {uploading && <p role="status" className={s.status}>იტვირთება…</p>}
    {error && <p className="ma-field__error" role="alert">{error}</p>}
  </div>;
}
