"use client";
import { Button } from "../ui/Button";


import { useEffect, useMemo, useRef, useState } from "react";
import { CompanyAvatar } from "./CompanyAvatar";
import { Icon } from "../Icon";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function PhotoField({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  const [broken, setBroken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const load = (next: File | undefined | null) => {
    setError(null);
    setBroken(false);
    if (!next) {
      onChange(null);
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setError("ფოტო მაქსიმუმ 5 MB უნდა იყოს."); onChange(null); return;
    }
    if (!ALLOWED.includes(next.type)) {
      setError("აირჩიე JPG, PNG, WEBP ან GIF სურათი.");
      onChange(null);
      return;
    }
    onChange(next);
  };

  const remove = () => {
    onChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  };

  return (
    <div className="ma-field">
      <span className="ma-field__label">
        ფოტო <span className="ma-field__opt">JPG, PNG, WEBP, GIF</span>
      </span>
      <label
        className={`ma-drop${isOver ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          load(e.dataTransfer.files[0]);
        }}
      >
        <Icon name="upload" />
        <span>{file ? file.name : "აირჩიე ფოტო ან ჩააგდე აქ"}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          aria-label="მოთხოვნის ფოტოს არჩევა"
          onChange={(e) => load(e.target.files?.[0])}
        />
      </label>
      {file && !broken ? (
        <div className="ma-proto-preview">
          {previewUrl ? (
            <img alt="" width={96} height={72} src={previewUrl} onError={() => setBroken(true)} />
          ) : null}
          <Button variant="ghost" type="button" onClick={remove}>
            <Icon name="trash-2" />
            მოშორება
          </Button>
        </div>
      ) : null}
      {broken ? <p className="ma-field__error" role="alert">სურათი ვერ გაიხსნა. აირჩიე სხვა ფოტო.</p> : null}
      {error ? (
        <p className="ma-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}


/** Logo selection stays local until the profile is saved, so cancelling leaves no uploaded file. */
export function LogoField({ name, logoUrl, file, onChange, onRemove, disabled, uploading }: {
  name: string; logoUrl?: string | null; file: File | null;
  onChange: (file: File) => void; onRemove: () => void; disabled: boolean; uploading: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const preview = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return <div className="ma-field logo-field" aria-busy={uploading}>
    <label className="ma-field__label" htmlFor="profile-logo">ლოგო</label>
    <div className="logo-field__controls">
      <CompanyAvatar name={name} logoUrl={preview || logoUrl} size="lg" />
      <input ref={input} id="profile-logo" className="ma-sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={disabled} aria-describedby="profile-logo-help" onChange={e => {
        const next = e.target.files?.[0];
        e.target.value = "";
        if (!next) return;
        if (!ALLOWED.includes(next.type) || next.size > 2 * 1024 * 1024) {
          setError("ლოგო უნდა იყოს JPG, PNG, WEBP ან GIF სურათი, მაქსიმუმ 2 მბ.");
          return;
        }
        setError(""); onChange(next);
      }} />
      <Button variant="secondary" type="button" disabled={disabled} onClick={() => input.current?.click()}>ატვირთვა</Button>
      {file || logoUrl ? <Button variant="ghost" type="button" disabled={disabled} onClick={() => { setError(""); onRemove(); }}>წაშლა</Button> : null}
    </div>
    <p id="profile-logo-help" className="account-hint">JPG, PNG, WEBP ან GIF · მაქსიმუმ 2 მბ. ცვლილება გამოჩნდება შენახვის შემდეგ.</p>
    {uploading ? <div className="logo-field__progress" role="status"><progress aria-label="ლოგო იტვირთება" />ლოგო იტვირთება…</div> : null}
    {error ? <p className="ma-field__error" role="alert">{error}</p> : null}
  </div>;
}

/** A gallery item: an already saved URL or a file chosen in this session (uploaded on save). */
export type GalleryItem = { key: string; url?: string; file?: File };
export const GALLERY_MAX = 8;

/** Company photos (up to 8). Like the logo, choices stay local until the profile is saved;
 *  the first photo leads the public gallery and the catalog card. */
export function GalleryField({ items, onChange, disabled, uploading }: {
  items: GalleryItem[]; onChange: (items: GalleryItem[]) => void; disabled: boolean; uploading: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  // Object URLs for chosen files, revoked when a file leaves the list.
  const previews = useMemo(() => new Map(items.filter(i => i.file).map(i => [i.key, URL.createObjectURL(i.file!)])), [items]);
  useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews]);
  const room = GALLERY_MAX - items.length;
  const add = (files: File[]) => {
    const valid = files.filter(f => ALLOWED.includes(f.type) && f.size <= 5 * 1024 * 1024);
    const taken = valid.slice(0, Math.max(0, room));
    setError(valid.length < files.length ? "ზოგი ფაილი გამოტოვებულია: მხოლოდ JPG, PNG, WEBP ან GIF, თითო მაქსიმუმ 5 მბ."
      : taken.length < valid.length ? `გალერეაში შეიძლება მაქსიმუმ ${GALLERY_MAX} ფოტო.` : "");
    if (taken.length) onChange([...items, ...taken.map(file => ({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file }))]);
  };
  const move = (index: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  return <div className="ma-field gallery-field" aria-busy={uploading}>
    <span className="ma-field__label" id="profile-gallery-label">ფოტოები <span className="ma-field__opt">{items.length}/{GALLERY_MAX}</span></span>
    <ul className="gallery-field__grid" aria-labelledby="profile-gallery-label">
      {items.map((item, index) => <li key={item.key} className="gallery-field__item">
        <img src={item.file ? previews.get(item.key) : item.url} alt={`ფოტო ${index + 1}`} />
        {index === 0 ? <span className="gallery-field__badge">მთავარი</span> : null}
        <div className="gallery-field__tools">
          {index > 0 ? <button type="button" disabled={disabled} aria-label={`ფოტო ${index + 1} — მთავრად დაყენება`} title="მთავრად დაყენება" onClick={() => move(index, 0)}><Icon name="star" /></button> : null}
          <button type="button" disabled={disabled} aria-label={`ფოტო ${index + 1} — წაშლა`} title="წაშლა" onClick={() => { setError(""); onChange(items.filter(i => i.key !== item.key)); }}><Icon name="x" /></button>
        </div>
      </li>)}
      {room > 0 ? <li>
        <button type="button" className="gallery-field__add" disabled={disabled} onClick={() => input.current?.click()}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); add([...e.dataTransfer.files]); }}>
          <Icon name="upload" /><span>დამატება</span>
        </button>
      </li> : null}
    </ul>
    <input ref={input} className="ma-sr-only" type="file" multiple tabIndex={-1} aria-hidden="true" aria-label="გალერეის ფოტოების დამატება" accept="image/jpeg,image/png,image/webp,image/gif" disabled={disabled}
      onChange={e => { add([...(e.target.files || [])]); e.target.value = ""; }} />
    <p className="account-hint">ოფისი, საწყობი, პროდუქცია ან შესრულებული სამუშაო · JPG, PNG, WEBP ან GIF, თითო მაქსიმუმ 5 მბ. პირველი ფოტო ჩანს კატალოგის ბარათზე. ცვლილება გამოჩნდება შენახვის შემდეგ.</p>
    {uploading ? <div className="logo-field__progress" role="status"><progress aria-label="ფოტოები იტვირთება" />ფოტოები იტვირთება…</div> : null}
    {error ? <p className="ma-field__error" role="alert">{error}</p> : null}
  </div>;
}
