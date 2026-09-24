"use client";

import { useState } from "react";

export type ProductCardData = { name: string; photoUrl?: string | null; note?: string };

export function ProductCard({ name, photoUrl, note }: ProductCardData) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <article className="company-product">
    {photoUrl && photoUrl !== failedUrl ? <img src={photoUrl} alt="" width={360} height={240} onError={() => setFailedUrl(photoUrl)} /> : null}
    <h3>{name}</h3>
    {note ? <p title={note}>{note}</p> : null}
  </article>;
}
