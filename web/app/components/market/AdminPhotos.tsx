"use client";

import Link from "next/link";
import type { Store } from "../../lib/market-client";
import { categories } from "../../lib/categories";
import { AdminState } from "./AdminState";
import styles from "./admin.module.css";

type Company = { id: string; company?: string; name: string; industry?: string; logoUrl?: string | null; gallery?: string[] };
export type PhotoTarget = { userId: string; url: string; label: string };

// Only uploaded files (Vercel Blob) can be moderated; sample photos are part of the site.
const uploaded = (url?: string | null) => !!url && /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(url);

/** Every uploaded company logo and gallery photo, newest companies first, each with a remove action. */
export function AdminPhotos({ store, onRemove }: { store: Store; onRemove: (photo: PhotoTarget) => void }) {
  const companies = store.listCompanies() as Company[];
  const photos = companies.flatMap(c => [
    ...(uploaded(c.logoUrl) ? [{ company: c, url: c.logoUrl!, kind: "ლოგო" }] : []),
    ...(c.gallery || []).filter(uploaded).map((url, i) => ({ company: c, url, kind: `გალერეა ${i + 1}` })),
  ]);
  if (!photos.length) return <AdminState title="ატვირთული ფოტოები ჯერ არ არის" text="კომპანიების ლოგოები და გალერეის ფოტოები აქ გამოჩნდება." />;
  return <>
    <p className={styles.count} role="status">{photos.length} ფოტო · {new Set(photos.map(p => p.company.id)).size} კომპანია</p>
    <ul className={styles.photoGrid}>
      {photos.map(({ company, url, kind }) => <li key={url} className={styles.photoCard}>
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.photoImage} aria-label={`${company.company || company.name} — ${kind}, სრული ზომით`}>
          <img src={url} alt="" loading="lazy" />
        </a>
        <div className={styles.photoMeta}>
          <Link href={`/companies/view/?id=${company.id}`} target="_blank">{company.company || company.name}</Link>
          <small>{kind} · {categories[company.industry || ""] || company.industry || ""}</small>
        </div>
        <button type="button" className="ma-btn ma-btn--danger-quiet" onClick={() => onRemove({ userId: company.id, url, label: `${company.company || company.name} · ${kind}` })}>წაშლა</button>
      </li>)}
    </ul>
  </>;
}
