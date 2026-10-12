"use client";
import { Button } from "../ui/Button";
import { useState } from "react";
import type { Store } from "../../lib/market-client";
import { categories } from "../../lib/categories";
import { AdminState } from "./AdminState";
import type { AdminTarget } from "./AdminDetail";
import styles from "./admin.module.css";

type Company = { id: string; company?: string; name: string; industry?: string; logoUrl?: string | null; gallery?: string[] };
export type PhotoTarget = { userId: string; url: string; label: string };

// Only uploaded files (Vercel Blob) can be moderated; sample photos are part of the site.
const uploaded = (url?: string | null) => !!url && /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(url);

/** A photo that cannot load says so (the file was removed or the link expired) instead of an empty box. */
function Photo({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return <a href={url} target="_blank" rel="noopener noreferrer" className={styles.photoImage} aria-label={`${label}, სრული ზომით`}>
    {failed ? <span className={styles.photoMissing}>ფოტო ვერ ჩაიტვირთა<small>ბმულის გახსნა</small></span> : <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />}
  </a>;
}

/** Every uploaded company logo and gallery photo, newest companies first, each with a remove action. */
export function AdminPhotos({ store, onRemove, onOpen }: { store: Store; onRemove: (photo: PhotoTarget) => void; onOpen: (target: AdminTarget) => void }) {
  const companies = store.listCompanies() as Company[];
  const photos = companies.flatMap(c => [
    ...(uploaded(c.logoUrl) ? [{ company: c, url: c.logoUrl!, kind: "ლოგო", logo: true }] : []),
    ...(c.gallery || []).filter(uploaded).map((url, i) => ({ company: c, url, kind: `გალერეა ${i + 1}`, logo: false })),
  ]);
  if (!photos.length) return <AdminState title="ატვირთული ფოტოები ჯერ არ არის" text="კომპანიების ლოგოები და გალერეის ფოტოები აქ გამოჩნდება." />;
  return <>
    <p className={styles.count} role="status">{photos.length} ფოტო · {new Set(photos.map(p => p.company.id)).size} კომპანია</p>
    <ul className={styles.photoGrid}>
      {photos.map(({ company, url, kind, logo }) => <li key={url} className={styles.photoCard} data-logo={logo || undefined}>
        <Photo url={url} label={`${company.company || company.name} — ${kind}`} />
        <div className={styles.photoMeta}>
          <button type="button" className={styles.rowLink} onClick={() => onOpen({ kind: "user", id: company.id })}>{company.company || company.name}</button>
          <small>{logo ? <span className="ma-badge ma-badge--info">ლოგო</span> : kind}{categories[company.industry || ""] ? ` · ${categories[company.industry || ""]}` : ""}</small>
        </div>
        <Button type="button" variant="danger-quiet" onClick={() => onRemove({ userId: company.id, url, label: `${company.company || company.name} · ${kind}` })}>წაშლა…</Button>
      </li>)}
    </ul>
  </>;
}
