"use client";

import { optimizable } from "../../lib/image";
import { productPresentation } from "../../lib/product-presentation";
import Image from "next/image";
import { useState } from "react";
import type { ImportProduct } from "../../lib/products-import";

export type ProductCardData = ImportProduct;

export function ProductCard({ preview = false, ...original }: ProductCardData & { preview?: boolean }) {
  const { name, photoUrl, note: rawNote, illustrative, photoPosition } = productPresentation(original);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const note = String(rawNote || "").replace(/^(სადემო პროდუქტი\s*·\s*)?(ფოტო საილუსტრაციოა[;.]?\s*)?/, "").trim();
  return <article className={`company-product${preview ? " company-product--preview" : ""}`}>
    {photoUrl && photoUrl !== failedUrl ? <Image src={photoUrl} alt="" style={{objectPosition: photoPosition}} width={360} height={240} sizes="(max-width: 720px) 50vw, 360px" unoptimized={!optimizable(photoUrl)} onError={() => setFailedUrl(photoUrl)} /> : null}
    {!preview && illustrative ? <small>საილუსტრაციო ფოტო</small> : null}
    {!preview ? <h3>{name}</h3> : null}
    {!preview && note ? <p title={note}>{note}</p> : null}
  </article>;
}
