"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { toast, toastError } from "../Toasts";
import { ListSkeleton } from "./Skeletons";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities, currentCategory } from "../../lib/categories";
import { dateShort } from "../../lib/format";
import { EmptyState } from "../ui/Structure";
import { Notice } from "../ui/Notice";
import { budgetLabel } from "./OpportunityCard";
import styles from "./SavedRequests.module.css";
import eng from "./engagement.module.css";

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
  try { await store.setSavedRequest(id, false); setItems(prev => prev && prev.filter(i => i.request_id !== id)); toast("მოთხოვნა შენახულიდან ამოიშალა."); }
  catch (err) { toastError((err as { userMessage?: string }).userMessage || "წაშლა ვერ შესრულდა."); }
  finally { setRemoving(null); }
 }

 const labels = (store?.stateLabels || {}) as Record<string, string>;
 // Same row, remove action, empty and error states as "saved companies" on the same tab.
 return <section className={`${eng.stack} ${styles.section}`} aria-labelledby="saved-requests-title">
  <div className={eng.sectionHead}><h2 className="account-section__title" id="saved-requests-title">შენახული მოთხოვნები</h2>{items?.length ? <Button variant="ghost" size="sm" href="/requests/"><Icon name="search"/>მოთხოვნების ძიება</Button> : null}</div>
  {state?.status !== "ready" || (!items && !error) ? <ListSkeleton compact label="შენახული მოთხოვნები იტვირთება…" />
   : error ? <Notice tone="error" action={<Button type="button" variant="secondary" size="sm" onClick={() => void load(null, false)}>ხელახლა ცდა</Button>}>სია ვერ ჩაიტვირთა.</Notice>
   : !items?.length ? <EmptyState icon="bookmark" title="შენახული მოთხოვნები ჯერ არ გაქვთ" text="მონიშნეთ საინტერესო მოთხოვნები და აქ მარტივად დაუბრუნდებით." action={<Button variant="secondary" href="/requests/"><Icon name="search"/>მოთხოვნების ძიება</Button>}/>
   : <>
    {items.map(r => {
     const budget = budgetLabel({ budgetType: r.budget_type, budgetMin: r.budget_min, budgetMax: r.budget_max });
     return <article className={`${eng.savedRow} ${r.state === "open" ? "" : styles.muted}`} key={r.request_id}>
      <div>
       <h3 className="account-row__title"><Link className={eng.savedLink} href={`/requests/view/?id=${encodeURIComponent(r.request_id)}`}>{r.title}</Link></h3>
       <ul className={styles.meta}>
        <li>{categories[currentCategory(r.category)] || r.category}</li>
        <li><Icon name="map-pin" />{cities[r.city] || r.city}</li>
        {budget && <li><Icon name="wallet" />{budget}</li>}
        <li><Icon name="calendar" />{dateShort(r.expires_at)}</li>
        <li>{labels[r.state] || r.state}</li>
       </ul>
      </div>
      <Button variant="ghost" size="sm" loading={removing === r.request_id} disabled={!!removing} aria-label={`${r.title} — შენახულიდან ამოშლა`} onClick={() => void remove(r.request_id)}><Icon name="trash-2"/>ამოშლა</Button>
     </article>;
    })}
    {next ? <Button type="button" variant="secondary" className={styles.more} disabled={loading} onClick={() => void load(next, true)}>{loading ? "იტვირთება…" : "მეტის ჩატვირთვა"}</Button> : null}
   </>}
 </section>;
}
