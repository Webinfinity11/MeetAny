"use client";
import { useCallback } from "react";
import { useMarketStore } from "../../../lib/market-client";
import { useBusinessResource } from "../../../lib/business-client";
import { EmptyState } from "../../ui/Structure";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";
import { avatarInitials } from "../CompanyAvatar";
import styles from "./CompanyProfile.module.css";

type Reviews = { total: number; rating: number | null; items: { id: string; author: string; rating: number; body: string; updated_at: string }[] };
export function useCompanyReviews(companyId: string) {
  const { store, sessionReady, available } = useMarketStore();
  const read = store?.companyReviews;
  const load = useCallback(() => read!(companyId) as Promise<Reviews>, [read, companyId]);
  return useBusinessResource<Reviews>(companyId && sessionReady && available && read ? load : undefined, companyId);
}
export function CompanyReviews({ resource }: { resource: ReturnType<typeof useCompanyReviews> }) {
  return <section aria-labelledby="company-reviews">
    <div className={styles.sectionHeading}><h2 id="company-reviews" className="detail-section-title">შეფასებები</h2><span>მხოლოდ დასრულებული გარიგებებიდან</span></div>
    {resource.error ? <p role="alert">{resource.error} <Button variant="ghost" onClick={resource.reload}>ხელახლა ცდა</Button></p> : !resource.data ? <p role="status">შეფასებები იტვირთება…</p> : resource.data.total === 0 ? <EmptyState text="შეფასებები ჯერ არაა — ჩნდება დასრულებული გარიგებების შემდეგ"/> :
      <ul className={styles.reviews}>{resource.data.items.slice(0, 3).map(review => <li key={review.id}>
        <span className={styles.reviewAvatar}>{avatarInitials(review.author)}</span>
        <div className={styles.reviewCopy}>
          <div className={styles.reviewHeading}><strong>{review.author}</strong><span className={styles.stars} role="img" aria-label={`${review.rating} ქულა 5-დან`}>{Array.from({ length: 5 }, (_, i) => <Icon key={i} name="star" className={i < review.rating ? styles.filledStar : undefined}/>)}</span></div>
          <time dateTime={review.updated_at}>{new Date(review.updated_at).toLocaleDateString("ka-GE", { timeZone: "UTC" })}</time>
          <p>{review.body}</p>
        </div>
      </li>)}</ul>}
  </section>;
}
