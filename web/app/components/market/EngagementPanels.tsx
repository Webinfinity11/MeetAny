"use client";
import { Button } from "../ui/Button";

import { ListSkeleton } from "./Skeletons";
import { ServiceUnavailable } from "./ServiceUnavailable";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMarketStore, type Store } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { Icon } from "../Icon";
import { toast } from "../Toasts";
import { SaveCompanyButton } from "./SaveCompanyButton";
import { RequestAlertSettings } from "./RequestAlertSettings";
import styles from "./engagement.module.css";
type Cursor = { created_at: string; id: string; asOf: string } | null;
type Notice = { id: string; kind: string; title: string; request_id: string; created_at: string; read_at: string | null; category?: string; city?: string; needed_by?: string | null };
type Saved = { company_id: string; company: string; city: string; industry: string };
type Page = { items: (Notice & Saved)[]; nextCursor: Cursor };
// Store statuses: idle (not loaded yet) → ready | unavailable (feature off) | error (request failed).
const failed = (status?: string) => status === "unavailable" || status === "error";
const label = (kind: string) => kind === "request_match" ? "ახალი მოთხოვნა შენს კატეგორიაში" : kind === "offer_chosen" ? "შენი შეთავაზება აირჩიეს" : "ახალი შეთავაზება მიიღე";
const date = (value: string, withTime = true) => {
 const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone: withTime ? "Asia/Tbilisi" : "UTC",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date(value)).map(p => [p.type,p.value]));
 return `${parts.day}.${parts.month}.${parts.year}${withTime ? `, ${parts.hour}:${parts.minute}` : ""}`;
};
// Calendar day in Tbilisi as a UTC-midnight number, for "today / yesterday / N days ago".
const tbilisiDay = (value: string | number) => Date.parse(new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date(value)));
const clock = (value: string) => new Intl.DateTimeFormat("en-GB", {timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hour12: false}).format(new Date(value));
function relative(value: string, now: number) {
 const days = Math.round((tbilisiDay(now) - tbilisiDay(value)) / 86400000);
 return days <= 0 ? `დღეს ${clock(value)}` : days === 1 ? `გუშინ ${clock(value)}` : days < 7 ? `${days} დღის წინ` : date(value, false);
}
// Same kind on the same request = one row ("3 ახალი შეთავაზება — სათაური"), newest first.
type Group = { key: string; items: Notice[]; latest: Notice };
function groupNotices(items: Notice[]): Group[] {
 const groups = new Map<string, Group>();
 for (const n of items) {
  const key = `${n.kind}:${n.request_id}`;
  const g = groups.get(key);
  if (g) g.items.push(n); else groups.set(key, {key, items: [n], latest: n});
 }
 return [...groups.values()];
}
const groupLabel = (g: Group) => g.latest.kind === "offer_received" ? (g.items.length > 1 ? `${g.items.length} ახალი შეთავაზება` : "ახალი შეთავაზება") : label(g.latest.kind);
function NoticeRows({ items, limit, store }: { items: Notice[]; limit?: number; store?: Store }) {
 const [now] = useState(() => Date.now());
 const groups = groupNotices(items);
 return <>{(limit ? groups.slice(0, limit) : groups).map(g => {
  const n = g.latest, unread = g.items.filter(x => !x.read_at);
  return <article key={g.key} className={styles.row} data-unread={unread.length > 0}>
   <Link href={`/requests/view/?id=${n.request_id}`} onClick={() => {
    if (!store || !unread.length) return;
    // Read acknowledgement runs in the background; navigation remains immediate.
    void Promise.all(unread.map(x => store.markNotificationRead(x.id)))
      .catch(() => toast("წაკითხვის მონიშვნა ვერ შესრულდა."));
   }}>{groupLabel(g)} — {n.title}{unread.length ? <span className="ma-sr-only"> — წაუკითხავი</span> : null}</Link>
   {n.kind === "request_match" ? <span className={styles.meta}>{categories[n.category || ""]} · {cities[n.city || ""]}{n.needed_by ? ` · საჭიროა ${date(n.needed_by, false)}` : ""}</span> : null}<time className={styles.meta} dateTime={n.created_at}>{relative(n.created_at, now)}</time>
  </article>;
 })}</>;
}
export function NotificationBell() {
 const { store, ready } = useMarketStore();
 const me = ready ? store?.currentUser() : null;
 const state = store?.engagement();
 const refresh = store?.refreshEngagement;
 const [open, setOpen] = useState(false);
 const root = useRef<HTMLDivElement>(null);
 const trigger = useRef<HTMLButtonElement>(null);
 useEffect(() => {
  const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
  document.addEventListener("pointerdown", close);
  return () => document.removeEventListener("pointerdown", close);
 }, []);
 if (!me || me.blocked) return null;
 const count = state?.unread || 0;
 return <div className={styles.bell} ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }} onKeyDown={e => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
  <button ref={trigger} type="button" className={styles.save} aria-label={`შეტყობინებები${count ? `, ${count} წაუკითხავი` : ""}`} aria-expanded={open} aria-controls="notification-list" onClick={() => { setOpen(!open); if (!open) void refresh?.(); }}><Icon name="bell"/>{count ? <span className={styles.badge} aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}</button>
  {open ? <div id="notification-list" className={styles.popover} aria-label="შეტყობინებები">
   <div className={styles.head}><strong>შეტყობინებები</strong><Button type="button" variant="ghost" aria-label="შეტყობინებების დახურვა" onClick={() => {setOpen(false);trigger.current?.focus();}}><Icon name="x"/></Button></div>
   {state?.status === "ready" ? state.notifications.items.length ? <div onClick={e => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}><NoticeRows store={store} items={state.notifications.items} limit={5}/></div> : <p>ახალი შეტყობინებები ჯერ არ გაქვს.</p> : failed(state?.status) ? <p role="status">შეტყობინებები დროებით მიუწვდომელია.</p> : <ListSkeleton compact label="შეტყობინებები იტვირთება…" />}
   <Button variant="ghost" href="/account/?tab=notifications&alerts=all" onClick={() => setOpen(false)}>ყველა შეტყობინება</Button>
  </div> : null}
 </div>;
}
export function EngagementPanel({ kind, all = true }: { kind: "saved" | "notifications"; all?: boolean }) {
 const { store } = useMarketStore();
 const actor = store?.currentUser()?.id;
 const state = store?.engagement();
 const [cursor, setCursor] = useState<Cursor>(null);
 const [retry, setRetry] = useState(0);
 const [result, setResult] = useState<{key: string; page?: Page; error?: boolean} | null>(null);
 const [pending, setPending] = useState(false);
 const key = JSON.stringify([kind, actor, cursor, retry, state?.status, kind === "saved" ? state?.savedIds : state?.unread]);
 const load = kind === "saved" ? store?.listSavedCompanies : store?.listNotifications;
 useEffect(() => {
  if (!actor || !load || state?.status !== "ready") return;
  let cancelled = false;
  load(cursor).then((page: Page) => {if (!cancelled) setResult({key,page});}, () => {if (!cancelled) setResult({key,error:true});});
  return () => {cancelled=true;};
 }, [actor, load, cursor, key, state?.status]);
 const current = result?.key === key ? result : null;
 // The store starts at "idle" and only refreshes on session events; make sure a first load is under way.
 useEffect(() => { if (actor && state?.status === "idle") void store?.refreshEngagement(); }, [actor, state?.status, store]);
 async function email(enabled: boolean) {
  setPending(true);
  try {await store?.setNotificationEmail(enabled);toast("შეტყობინებების პარამეტრი შენახულია.");}
  catch {toast("პარამეტრი ვერ შეინახა. სცადე ხელახლა.");}
  finally {setPending(false);}
 }
 return <section className={styles.stack}>
  <h2 className="account-section__title">{kind === "saved" ? "შენახული კომპანიები" : "შეტყობინებები"}</h2>
  {failed(state?.status) ? <ServiceUnavailable /> : state?.status !== "ready" ? <ListSkeleton compact label={kind === "saved" ? "შენახული კომპანიები იტვირთება…" : "შეტყობინებები იტვირთება…"} /> : <>
   {!current ? <ListSkeleton compact label={kind === "saved" ? "შენახული კომპანიები იტვირთება…" : "შეტყობინებები იტვირთება…"} /> : current.error ? <div role="alert"><p>სია ვერ ჩაიტვირთა.</p><Button type="button" variant="secondary" onClick={() => setRetry(x => x+1)}>ხელახლა ცდა</Button></div> : <>
    {!current.page?.items.length ? <div className={styles.emptyState}><span className={styles.emptyIcon}><Icon name={kind === "saved" ? "bookmark" : "bell"}/></span><h3>{kind === "saved" ? "შენახული კომპანიები ჯერ არ გაქვს" : "შეტყობინებები ჯერ არ გაქვს"}</h3><p>{kind === "saved" ? "მონიშნე საინტერესო მომწოდებლები და აქ მარტივად დაუბრუნდი." : "ახალი შეთავაზებები და შესაბამისი მოთხოვნები აქ გამოჩნდება."}</p><Button variant="secondary" href={kind === "saved" ? "/companies/" : "/requests/"}>{kind === "saved" ? "კომპანიების ნახვა" : "მოთხოვნების ნახვა"}</Button></div> : kind === "notifications" ? <NoticeRows store={store} items={current.page.items} limit={all ? undefined : 5}/> : current.page.items.map(c => <article className={styles.savedRow} key={c.company_id}>
     <div><h3 className="account-row__title"><Link href={`/companies/view/?id=${c.company_id}`}>{c.company}</Link></h3><p className="account-row__meta">{categories[c.industry] || c.industry} · {cities[c.city] || c.city}</p></div><SaveCompanyButton id={c.company_id}/>
    </article>)}
    {kind === "notifications" && !all && current.page && (current.page.nextCursor || groupNotices(current.page.items).length > 5) ? <Link className="account-link" href="/account/?tab=notifications&alerts=all">ყველა შეტყობინება ({current.page.items.length}{current.page.nextCursor ? "+" : ""})</Link> : null}
    {all || kind === "saved" ? <div className={styles.head}>{cursor ? <Button type="button" variant="secondary" onClick={() => setCursor(null)}>პირველი გვერდი</Button> : null}{current.page?.nextCursor ? <Button type="button" variant="secondary" onClick={() => setCursor(current.page!.nextCursor)}>შემდეგი გვერდი</Button> : null}</div> : null}
   </>}
   {kind === "notifications" && (state.requestAlerts || state.emailDelivery) ? <details className={styles.preferences}><summary><Icon name="settings"/><span>შეტყობინებების პარამეტრები</span><Icon name="chevron-down"/></summary><div>
    {state.requestAlerts ? <RequestAlertSettings key={actor} initial={state.requestAlerts} emailDelivery={!!state.emailDelivery} profile={store?.currentUser()}/> : null}
    {state.emailDelivery ? <label className="ma-check"><input type="checkbox" checked={!!state.emailOffers} disabled={pending} onChange={e=>email(e.target.checked)}/>შეთავაზებებზე ელფოსტითაც შემატყობინე</label> : null}
   </div></details>:null}
   {kind === "saved" && !!current?.page?.items.length ? <Link href="/companies/" className="account-link">კომპანიების მოძებნა</Link> : null}
  </>}
 </section>;
}
