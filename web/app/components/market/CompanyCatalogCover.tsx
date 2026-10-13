"use client";
import Image from "next/image";
import { optimizable } from "../../lib/image";
import { useSiteContent } from "../../lib/site-content";
import { siteContentDefaults } from "../../lib/site-content-defaults";

/** The nine photos published by the admin, visible at every viewport width. */
export function CompanyCatalogCover() {
  const content = useSiteContent();
  return <div role="group" tabIndex={0} aria-label="კატალოგის ფოტოები" data-catalog-cover style={{display:"flex", gap:"var(--space-3)", overflowX:"auto", paddingBlock:"var(--space-4)"}}>
    {Array.from({length:9}, (_, i) => {
      const key = `businessImage${i + 1}`, src = content[key] || siteContentDefaults[key];
      return <Image key={key} src={src} alt="" width={128} height={96} unoptimized={!optimizable(src)}
        style={{width:"var(--size-128)", height:"var(--size-96)", flexShrink:0, objectFit:"cover", borderRadius:"var(--radius-md)"}} />;
    })}
  </div>;
}
