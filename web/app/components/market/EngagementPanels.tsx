"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { Icon } from "../Icon";
import { toast } from "../Toasts";
import { SaveCompanyButton } from "./SaveCompanyButton";
import styles from "./engagement.module.css";
type Cursor = { created_at: string; id: string; asOf: string } | null;
type Notice = { id: string; kind: string; title: string; request_id: string; created_at: string; read_at: string | null };
type Saved = { company_id: string; company: string; city: string; industry: string };
type Page = { items: (Notice & Saved)[]; nextCursor: Cursor };
const label = (kind: string) => kind === "offer_chosen" ? "შენი შეთავაზება აირჩიეს" : "ახალი შეთავაზება მიიღე";
const date = (value: string) => new Intl.DateTimeFormat("ka-GE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
function NoticeRows({ items }: { items: Notice[] }) {
 const { store } = useMarketStore();
 return <>{items.map(n => <article key={n.id} className={styles.row} data-unread={!n.read_at}>
  <Link href={`/requests/view/?id=${n.request_id}`} onClick={() => { if (!n.read_at) void store?.markNotificationRead(n.id).catch(() => toast("წაკითხვის მონიშვნა ვერ შესრულდა.")); }}>{label(n.kind)}{!n.read_at ? <span className="sr-only"> — წაუკითხავი</span> : null}</Link>
  <p>{n.title}</p><time className={styles.meta} dateTime={n.created_at}>{date(n.created_at)}</time>
 </article>)}</>;
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
  if (!me?.id || me.blocked || !refresh) return;
  const update = () => { if (document.visibilityState === "visible") void refresh(); };
  const timer = window.setInterval(update, 30000);
  window.addEventListener("focus", update);
  return () => { clearInterval(timer); window.removeEventListener("focus", update); };
 }, [me?.id, me?.blocked, refresh]);
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
   <div className={styles.head}><strong>შეტყობინებები</strong><button type="button" className="ma-btn ma-btn--ghost" aria-label="შეტყობინებების დახურვა" onClick={() => {setOpen(false);trigger.current?.focus();}}><Icon name="x"/></button></div>
   {state?.status === "ready" ? state.notifications.items.length ? <div onClick={e => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}><NoticeRows items={state.notifications.items.slice(0,5)}/></div> : <p>ახალი შეტყობინებები ჯერ არ გაქვს.</p> : <p role="status">შეტყობინებები დროებით მიუწვდომელია.</p>}
   <Link className="ma-btn ma-btn--ghost" href="/account/?tab=notifications" onClick={() => setOpen(false)}>ყველა შეტყობინება</Link>
  </div> : null}
 </div>;
}
export function EngagementPanel({ kind }: { kind: "saved" | "notifications" }) {
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
 async function email(enabled: boolean) {
  setPending(true);
  try {await store?.setNotificationEmail(enabled);toast("შეტყობინებების პარამეტრი შენახულია.");}
  catch {toast("პარამეტრი ვერ შეინახა. სცადე ხელახლა.");}
  finally {setPending(false);}
 }
 return <section className={styles.stack}>
  <h1 className="ma-h2">{kind === "saved" ? "შენახული კომპანიები" : "შეტყობინებები"}</h1>
  {state?.status !== "ready" ? <div role="status"><p>სერვისი დროებით მიუწვდომელია.</p><button type="button" className="ma-btn ma-btn--secondary" onClick={() => store?.refreshEngagement()}>ხელახლა ცდა</button></div> : <>
   {kind === "notifications" ? <label className="ma-check"><input type="checkbox" checked={!!state.emailOffers} disabled={pending || !state.emailDelivery} onChange={e => email(e.target.checked)}/> შეთავაზებების შესახებ ელფოსტითაც შემატყობინე{!state.emailDelivery ? <span className={styles.meta}> — მალე დაემატება</span> : null}</label> : null}
   {!current ? <p role="status">იტვირთება…</p> : current.error ? <div role="alert"><p>სია ვერ ჩაიტვირთა.</p><button type="button" className="ma-btn ma-btn--secondary" onClick={() => setRetry(x => x+1)}>ხელახლა ცდა</button></div> : <>
    {!current.page?.items.length ? <p>{kind === "saved" ? "კომპანია ჯერ არ შეგინახავს. კატალოგში შენახვის ნიშნით მონიშნე საინტერესო მომწოდებლები." : "შეტყობინებები ჯერ არ გაქვს."}</p> : kind === "notifications" ? <NoticeRows items={current.page.items}/> : current.page.items.map(c => <article className={styles.savedRow} key={c.company_id}>
     <div><h3 className="ma-h3"><Link href={`/companies/view/?id=${c.company_id}`}>{c.company}</Link></h3><p>{categories[c.industry] || c.industry} · {cities[c.city] || c.city}</p></div><SaveCompanyButton id={c.company_id}/>
    </article>)}
    <div className={styles.head}>{cursor ? <button type="button" className="ma-btn ma-btn--secondary" onClick={() => setCursor(null)}>პირველი გვერდი</button> : null}{current.page?.nextCursor ? <button type="button" className="ma-btn ma-btn--secondary" onClick={() => setCursor(current.page!.nextCursor)}>შემდეგი გვერდი</button> : null}</div>
   </>}
   {kind === "saved" ? <Link href="/companies/" className="ma-btn ma-btn--secondary">კომპანიების მოძებნა <Icon name="arrow-right"/></Link> : null}
  </>}
 </section>;
}
