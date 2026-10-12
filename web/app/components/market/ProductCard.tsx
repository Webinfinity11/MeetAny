"use client";

import { optimizable } from "../../lib/image";
import Image from "next/image";
import { useState } from "react";

export type ProductCardData = { name: string; photoUrl?: string | null; note?: string };

export function ProductCard({ name, photoUrl, note: rawNote, preview = false }: ProductCardData & { preview?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const note = String(rawNote || "").replace(/^(სადემო პროდუქტი\s*·\s*)?(ფოტო საილუსტრაციოა[;.]?\s*)?/, "").trim();
  return <article className={`company-product${preview ? " company-product--preview" : ""}`}>
    {photoUrl && photoUrl !== failedUrl ? <Image src={photoUrl} alt="" width={360} height={240} sizes="(max-width: 720px) 50vw, 360px" unoptimized={!optimizable(photoUrl)} onError={() => setFailedUrl(photoUrl)} /> : null}
    {!preview ? <h3>{name}</h3> : null}
    {!preview && note ? <p title={note}>{note}</p> : null}
  </article>;
}
