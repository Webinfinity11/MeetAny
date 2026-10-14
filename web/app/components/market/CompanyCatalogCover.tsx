"use client";
import Image from "next/image";
import styles from "./catalog/Catalog.module.css";
import { optimizable } from "../../lib/image";
import { useSiteContent } from "../../lib/site-content";
import { siteContentDefaults } from "../../lib/site-content-defaults";

/** The nine photos published by the admin, visible at every viewport width. */
export function CompanyCatalogCover() {
  const content = useSiteContent();
  return <div role="group" tabIndex={0} aria-label="კატალოგის ფოტოები" data-catalog-cover className={styles.cover}>
    {Array.from({length:9}, (_, i) => {
      const key = `businessImage${i + 1}`, src = content[key] || siteContentDefaults[key];
      return <Image key={key} src={src} alt="" width={56} height={42} unoptimized={!optimizable(src)}
        className={styles.coverPhoto} />;
    })}
  </div>;
}
