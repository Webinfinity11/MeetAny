"use client";

import { useState } from "react";

export type ProductCardData = { name: string; photoUrl?: string | null; note?: string };

export function ProductCard({ name, photoUrl, note, preview = false }: ProductCardData & { preview?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <article className={`company-product${preview ? " company-product--preview" : ""}`}>
    {photoUrl && photoUrl !== failedUrl ? <img src={photoUrl} alt="" width={360} height={240} onError={() => setFailedUrl(photoUrl)} /> : null}
    {!preview ? <h3>{name}</h3> : null}
    {!preview && note ? <p title={note}>{note}</p> : null}
  </article>;
}
