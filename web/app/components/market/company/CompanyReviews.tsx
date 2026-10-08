"use client";
import { useCallback } from "react";
import { useMarketStore } from "../../../lib/market-client";
import { useBusinessResource } from "../../../lib/business-client";
import { EmptyState } from "../../ui/Structure";
import { Button } from "../../ui/Button";
import styles from "./CompanyProfile.module.css";

type Reviews = { total: number; rating: number | null; items: { id: string; author: string; rating: number; body: string; updated_at: string }[] };
export function CompanyReviews({ companyId }: { companyId: string }) {
  const { store, sessionReady, available } = useMarketStore();
  const read = store?.companyReviews;
  const load = useCallback(() => read!(companyId) as Promise<Reviews>, [read, companyId]);
  const resource = useBusinessResource<Reviews>(sessionReady && available && read ? load : undefined, companyId);
  return <section aria-labelledby="company-reviews"><h2 id="company-reviews" className="detail-section-title">შეფასებები</h2>
    {resource.error ? <p role="alert">{resource.error} <Button variant="ghost" onClick={resource.reload}>ხელახლა ცდა</Button></p> : !resource.data ? <p role="status">შეფასებები იტვირთება…</p> : resource.data.total === 0 ? <EmptyState text="შეფასებები ჯერ არაა — ჩნდება დასრულებული გარიგებების შემდეგ"/> : <>
      <p className={styles.rating}><strong>{resource.data.rating ?? "—"} / 5</strong> · {resource.data.total} შეფასება</p>
      <ul className={styles.reviews}>{resource.data.items.slice(0, 3).map(review => <li key={review.id}><div className={styles.reviewHeading}><strong>{review.author}</strong><span aria-label={`${review.rating} ქულა 5-დან`}>{review.rating} / 5</span></div><time dateTime={review.updated_at}>{new Date(review.updated_at).toLocaleDateString("ka-GE")}</time><p>{review.body}</p></li>)}</ul>
    </>}
  </section>;
}
