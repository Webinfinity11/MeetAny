"use client";
import Image from "next/image";
import { Button } from "../ui/Button";


import { useEffect, useRef, useState } from "react";
import { ImageUpload, type ImageUploadItem } from "../ui/ImageUpload";
import { Icon } from "../Icon";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function PhotoField({ file, onChange, variant = "drop" }: { file: File | null; onChange: (file: File | null) => void; variant?: "drop" | "tile" }) {
  const [broken, setBroken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : null;
    // Synchronize the browser-owned resource; recreate it after Strict Mode's cleanup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewUrl(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [file]);

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
      setError("აირჩიეთ JPG, PNG, WEBP ან GIF სურათი.");
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

  if (variant === "tile") return <div className="post-photos">
    <div className="post-photos__tiles">
      {file && previewUrl && !broken ? <div className="post-photos__tile">
        <Image unoptimized src={previewUrl} width={88} height={88} alt="არჩეული ფოტო" onError={() => { setBroken(true); onChange(null); }} />
        <Button variant="ghost" className="post-photos__remove" aria-label="ფოტოს წაშლა" onClick={remove}><Icon name="x" /></Button>
      </div> : null}
      <label className={`ma-drop post-photos__add${isOver ? " is-over" : ""}`}
        onDragOver={e => { e.preventDefault(); setIsOver(true); }} onDragLeave={() => setIsOver(false)}
        onDrop={e => { e.preventDefault(); setIsOver(false); load(e.dataTransfer.files[0]); }}>
        <Icon name="upload" /><span>{file ? "შეცვლა" : "დამატება"}</span>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="მოთხოვნის ფოტოს არჩევა"
          onChange={e => { load(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
    </div>
    <p className="post-hint">ერთი ფოტო · JPG, PNG, WEBP ან GIF · მაქსიმუმ 5 მბ</p>
    {broken || error ? <p className="ma-field__error" role="alert">{error || "სურათი ვერ გაიხსნა. აირჩიეთ სხვა ფოტო."}</p> : null}
  </div>;

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
        <span>{file ? file.name : "აირჩიეთ ფოტო ან ჩააგდეთ აქ"}</span>
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
            <Image unoptimized alt="" width={96} height={72} src={previewUrl} onError={() => setBroken(true)} />
          ) : null}
          <Button variant="ghost" type="button" onClick={remove}>
            <Icon name="trash-2" />
            მოშორება
          </Button>
        </div>
      ) : null}
      {broken ? <p className="ma-field__error" role="alert">სურათი ვერ გაიხსნა. აირჩიეთ სხვა ფოტო.</p> : null}
      {error ? (
        <p className="ma-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}


/** Logo selection stays local until the profile is saved, so cancelling leaves no uploaded file. */
export function LogoField({ name, logoUrl, file, onChange, onRemove, disabled, uploading, compact = false }: {
  name: string; logoUrl?: string | null; file: File | null;
  onChange: (file: File) => void; onRemove: () => void; disabled: boolean; uploading: boolean;
  compact?: boolean;
}) {
  return <ImageUpload id="profile-logo" label="ლოგო" kind="logo" items={file ? [{ key: 'logo', file }] : logoUrl ? [{ key: 'logo', url: logoUrl }] : []}
    onChange={items => { if (items[0]?.file) onChange(items[0].file); else if (!items.length) onRemove(); }} disabled={disabled} uploading={uploading}
    hint={compact ? 'JPG, PNG, WEBP, GIF · 2 მბ-მდე' : `${name} — JPG, PNG, WEBP ან GIF · 2 მბ-მდე. ცვლილება გამოჩნდება შენახვის შემდეგ.`} />;
}

export type GalleryItem = ImageUploadItem;
export function GalleryField({ items, onChange, disabled, uploading, compact = false }: {
  items: GalleryItem[]; onChange: (items: GalleryItem[]) => void; disabled: boolean; uploading: boolean; compact?: boolean;
}) {
  return <ImageUpload id="profile-gallery" label="ფოტოები" kind="gallery" items={items} onChange={onChange} disabled={disabled} uploading={uploading}
    hint={compact ? 'JPG, PNG, WEBP, GIF · 5 მბ-მდე. პირველი ფოტო — კატალოგში.' : 'JPG, PNG, WEBP ან GIF · თითო 5 მბ-მდე. პირველი ფოტო ჩანს კატალოგში. რიგის შესაცვლელად გადაათრიეთ ფოტო; ვარსკვლავით მთავრად დააყენებთ. ცვლილება გამოჩნდება შენახვის შემდეგ.'} />;
}
