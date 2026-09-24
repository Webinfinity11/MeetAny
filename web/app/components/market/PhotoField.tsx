"use client";

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
          <button className="ma-btn ma-btn--ghost" type="button" onClick={remove}>
            <Icon name="trash-2" />
            მოშორება
          </button>
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
      <button className="ma-btn ma-btn--secondary" type="button" disabled={disabled} onClick={() => input.current?.click()}>ატვირთვა</button>
      {file || logoUrl ? <button className="ma-btn ma-btn--ghost" type="button" disabled={disabled} onClick={() => { setError(""); onRemove(); }}>წაშლა</button> : null}
    </div>
    <p id="profile-logo-help" className="account-hint">JPG, PNG, WEBP ან GIF · მაქსიმუმ 2 მბ. ცვლილება გამოჩნდება შენახვის შემდეგ.</p>
    {uploading ? <div className="logo-field__progress" role="status"><progress aria-label="ლოგო იტვირთება" />ლოგო იტვირთება…</div> : null}
    {error ? <p className="ma-field__error" role="alert">{error}</p> : null}
  </div>;
}
