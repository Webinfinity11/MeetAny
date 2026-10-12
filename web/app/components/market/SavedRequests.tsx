"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/Structure";
import { toast } from "../Toasts";
import { ListSkeleton } from "./Skeletons";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities, currentCategory } from "../../lib/categories";
import { dateLabel } from "../../lib/format";
import { budgetLabel } from "./OpportunityCard";
import styles from "./SavedRequests.module.css";

type Cursor = Record<string, unknown> | null;
type SavedRequest = {
 created_at: string; request_id: string; title: string; category: string; city: string;
 budget_type: "range" | "exact" | null; budget_min: number | null; budget_max: number | null;
 expires_at: string; owner_company: string | null; state: string;
};
type Page = { items: SavedRequest[]; nextCursor: Cursor };

// "Saved requests" section of the account "saved" tab. Self-contained: loads list_saved_requests with cursor paging.
export function SavedRequests() {
 const { store } = useMarketStore();
 const actor = store?.currentUser()?.id;
 const state = store?.engagement();
 const [items, setItems] = useState<SavedRequest[] | null>(null);
 const [next, setNext] = useState<Cursor>(null);
 const [error, setError] = useState(false);
 const [loading, setLoading] = useState(false);
 const [removing, setRemoving] = useState<string | null>(null);
 const generation = useRef(0);

 async function load(cursor: Cursor, append: boolean) {
  if (!store) return;
  const mine = ++generation.current;
  setLoading(true);
  try {
   const page: Page = await store.listSavedRequests(cursor);
   if (mine !== generation.current) return;
   setItems(prev => append && prev ? [...prev, ...page.items.filter(i => !prev.some(p => p.request_id === i.request_id))] : page.items);
   setNext(page.nextCursor || null); setError(false);
  } catch { if (mine === generation.current) setError(true); }
  finally { if (mine === generation.current) setLoading(false); }
 }
 useEffect(() => {
  if (!store || !actor || state?.status !== "ready") return;
  const mine = ++generation.current;
  store.listSavedRequests(null).then((page: Page) => {
   if (mine !== generation.current) return;
   setItems(page.items); setNext(page.nextCursor || null); setError(false);
  }, () => { if (mine === generation.current) setError(true); });
 }, [actor, state?.status, store]);
 useEffect(() => { if (actor && state?.status === "idle") void store?.refreshEngagement(); }, [actor, state?.status, store]);

 async function remove(id: string) {
  if (!store || removing) return;
  setRemoving(id);
  try { await store.setSavedRequest(id, false); setItems(prev => prev && prev.filter(i => i.request_id !== id)); toast("მოთხოვნა შენახულებიდან ამოიშალა."); }
  catch (err) { toast((err as { userMessage?: string }).userMessage || "წაშლა ვერ შესრულდა."); }
  finally { setRemoving(null); }
 }

 const labels = (store?.stateLabels || {}) as Record<string, string>;
 return <section className={styles.section} aria-labelledby="saved-requests-title">
  <h2 className="account-section__title" id="saved-requests-title">შენახული მოთხოვნები</h2>
  {state?.status !== "ready" || (!items && !error) ? <ListSkeleton compact label="შენახული მოთხოვნები იტვირთება…" />
   : error ? <div role="alert"><p>სია ვერ ჩაიტვირთა.</p><Button type="button" variant="secondary" onClick={() => void load(null, false)}>ხელახლა ცდა</Button></div>
   : !items?.length ? <EmptyState icon="bookmark" title="შენახული მოთხოვნები ჯერ არ გაქვს" text="მონიშნე საინტერესო მოთხოვნები და აქ მარტივად დაუბრუნდი." action={<Button variant="secondary" href="/requests/">მოთხოვნების ნახვა</Button>} />
   : <>
    <div className={styles.list}>{items.map(r => {
     const budget = budgetLabel({ budgetType: r.budget_type, budgetMin: r.budget_min, budgetMax: r.budget_max });
     return <article className={`${styles.row} ${r.state === "open" ? "" : styles.muted}`} key={r.request_id}>
      <div>
       <h3 className="account-row__title"><Link className={styles.title} href={`/requests/view/?id=${encodeURIComponent(r.request_id)}`}>{r.title}</Link></h3>
       <ul className={styles.meta}>
        <li>{categories[currentCategory(r.category)] || r.category}</li>
        <li><Icon name="map-pin" />{cities[r.city] || r.city}</li>
        {budget && <li><Icon name="wallet" />{budget}</li>}
        <li><Icon name="calendar" />{dateLabel(r.expires_at)}</li>
        <li>{labels[r.state] || r.state}</li>
       </ul>
      </div>
      <Button type="button" variant="secondary" size="sm" disabled={removing === r.request_id} onClick={() => void remove(r.request_id)}><Icon name="trash-2" />წაშლა</Button>
     </article>;
    })}</div>
    {next ? <Button type="button" variant="secondary" className={styles.more} disabled={loading} onClick={() => void load(next, true)}>{loading ? "იტვირთება…" : "მეტის ჩატვირთვა"}</Button> : null}
   </>}
 </section>;
}
