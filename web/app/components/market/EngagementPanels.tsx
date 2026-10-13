"use client";
import { Button } from "../ui/Button";

import { ListSkeleton } from "./Skeletons";
import { ServiceUnavailable } from "./ServiceUnavailable";
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMarketStore, type Store } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { Icon } from "../Icon";
import { toast, toastError } from "../Toasts";
import { RequestAlertSettings } from "./RequestAlertSettings";
import styles from "./engagement.module.css";
import { dealActionLabel, dealHref, type Deal } from "../../lib/deal-client";
import { dateShort, money } from "../../lib/format";
import { EmptyState } from "../ui/Structure";
import { Notice as InlineNotice } from "../ui/Notice";
type Cursor = { created_at: string; id: string; asOf: string } | null;
type Notice = { deal_id?: string | null; deal_action?: string | null; deal_revision?: number | null; id: string; kind: string; title: string; request_id: string | null; created_at: string; detail?: { title?: string; status?: string; note?: string; resolution?: string; kind?: string } | null; read_at: string | null; category?: string; city?: string; needed_by?: string | null };
type Saved = { company_id: string; company: string; city: string; industry: string };
type Page = { items: (Notice & Saved)[]; nextCursor: Cursor };
// Store statuses: idle (not loaded yet) → ready | unavailable (feature off) | error (request failed).
const failed = (status?: string) => status === "unavailable" || status === "error";
const label = (kind: string) => kind === "request_match" ? "შესაბამისი მოთხოვნა" : kind === "offer_chosen" ? "შეთავაზება აირჩიეს" : kind === "offer_received" ? "ახალი შეთავაზება" : kind === "offer_declined" ? "შეთავაზება არ შეირჩა" : kind === "verification_reviewed" ? "ვერიფიკაცია" : kind === "report_resolved" ? "საჩივარი განხილულია" : kind === "verify_to_respond" ? "ახალი მოთხოვნა თქვენს მიმართულებაზე" : "შეტყობინება";
// An unverified company sees a matching request; answering it needs verification first.
const verifyText = "ამ მოთხოვნაზე პასუხისთვის დაასრულეთ ვერიფიკაცია";
// Calendar day in Tbilisi as a UTC-midnight number, for "today / yesterday / N days ago".
const tbilisiDay = (value: string | number) => Date.parse(new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date(value)));
const clock = (value: string) => new Intl.DateTimeFormat("en-GB", {timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hour12: false}).format(new Date(value));
function relative(value: string, now: number) {
 const days = Math.round((tbilisiDay(now) - tbilisiDay(value)) / 86400000);
 return days <= 0 ? `დღეს ${clock(value)}` : days === 1 ? `გუშინ ${clock(value)}` : days < 7 ? `${days} დღის წინ` : dateShort(value);
}
const noticeType = (n: Notice) => n.deal_id ? "deal" : n.kind === "offer_received" || n.kind === "offer_chosen" || n.kind === "offer_declined" ? "offers" : "system";
// Conversations have their own section („მიმოწერები“); notifications are offers, deals and system notices.
const noticeTypes = { offers: "შეთავაზებები", deal: "გარიგებები", system: "სისტემა" };
const noticeLabel = (n: Notice) => {
 const stage = ({ selected: "მომწოდებლის არჩევა", discuss: "დეტალების განხილვა", progress: "შესრულება", complete: "დასრულდა", cancelled: "გაუქმდა" } as Record<string, string>)[n.deal_action || ""];
 if (n.kind === "verification_reviewed") { const status = n.detail?.status; return status === "approved" ? "ვერიფიკაცია — ვერიფიცირებულია" : status === "rejected" || status === "returned" ? "ვერიფიკაცია — დაბრუნებულია შესასწორებლად" : label(n.kind); }
 return n.deal_id ? stage ? `გარიგება გადავიდა ეტაპზე „${stage}“` : dealActionLabel(n.deal_action) : label(n.kind);
};
// Second line: what the notice is about; a returned verification carries the moderator's note.
const noticeSubject = (n: Notice, requestTitle?: string) => n.kind === "verification_reviewed" ? (n.detail?.status === "approved" ? null : n.detail?.note) || n.detail?.title || n.title : requestTitle || n.title || n.detail?.title;
/** Where a notice leads; null when there is nowhere to go (resolved reports, unknown kinds without a request). */
const noticeHref = (n: Notice): string | null => n.deal_id ? dealHref(n.deal_id) : n.kind === "verification_reviewed" ? "/onboarding/" : n.kind === "verify_to_respond" ? "/onboarding/?step=verify" : n.kind === "report_resolved" || !n.request_id ? null : n.kind === "offer_received" ? `/requests/compare/?id=${encodeURIComponent(n.request_id)}` : `/requests/view/?id=${encodeURIComponent(n.request_id)}`;
const actionLabel = (n: Notice) => n.kind === "offer_received" && !n.deal_id ? "შედარება" : n.kind === "verification_reviewed" ? "პროფილის გახსნა" : n.kind === "verify_to_respond" ? "ვერიფიკაციის გავლა" : "ნახვა";
function NoticeRows({ items, limit, store, compact = false }: { items: Notice[]; limit?: number; store?: Store; compact?: boolean }) {
 const [now] = useState(() => Date.now());
 const [selectedId, setSelectedId] = useState<string | null>(null);
 const rows = limit ? items.slice(0, limit) : items;
 const selected = rows.find(n => n.id === selectedId) || rows[0];
 const dayBand = (value: string) => { const days = Math.round((tbilisiDay(now) - tbilisiDay(value)) / 86400000); return days <= 0 ? "დღეს" : days === 1 ? "გუშინ" : dateShort(new Date(tbilisiDay(value)).toISOString().slice(0, 10)); };
 const acknowledge = (n: Notice) => { if (store && !n.read_at) void store.markNotificationRead(n.id).catch(() => toastError("წაკითხვის მონიშვნა ვერ შესრულდა.")); };
 if (!rows.length) return <EmptyState icon="bell" text="ამ ტიპის შეტყობინება ჯერ არ არის."/>;
 return <div className={compact ? styles.noticeList : styles.noticeWorkspace}><div className={compact ? styles.noticeList : styles.noticeCard}>{rows.map((n, index) => {
  const day = dayBand(n.created_at);
  const request = n.request_id ? store?.getRequest(n.request_id) : null;
  const href = noticeHref(n);
  const chosen = n.kind === "offer_chosen" && request?.chosenOfferId ? store?.visibleOffers(request.id).find((offer: { id: string }) => offer.id === request.chosenOfferId) : null;
  const company = chosen ? store?.userById(chosen.companyUserId) : null;
  // Received notices do not identify their sender or offer; never guess from the latest offer.
  const title = !n.deal_id && company ? `${company.company || company.name} — შეთავაზება აირჩიეს` : noticeLabel(n);
  const subtitle = [noticeSubject(n, request?.title), chosen?.price != null ? money(Number(chosen.price)) : null, chosen?.deliveryDays != null ? `${chosen.deliveryDays} დღე` : null].filter(Boolean).join(" · ");
  return <Fragment key={n.id}>
   {!compact && (!index || dayBand(rows[index - 1].created_at) !== day) ? <h2 className={styles.dayHeading}>{day}</h2> : null}
   <article className={styles.row} data-unread={!n.read_at} data-selected={!compact && selected?.id === n.id}>
    {(() => { const body = <>
     <span className={styles.noticeIcon} data-type={noticeType(n)}><Icon name={noticeType(n) === "offers" ? "inbox" : noticeType(n) === "deal" ? "handshake" : "bell"}/>{!n.read_at ? <span className={styles.unreadDot} aria-hidden="true"/> : null}</span>
     <span className={styles.noticeCopy}><strong className={styles.noticeTitle}>{title}</strong><span className={styles.noticeSubtitle}>{subtitle}</span>
      {n.kind === "request_match" ? <span className={styles.meta}>{[categories[n.category || ""], cities[n.city || ""]].filter(Boolean).join(" · ")}</span> : null}
      {n.kind === "verify_to_respond" ? <span className={styles.meta}>{verifyText}</span> : null}
     </span>
     <time className={styles.noticeTime} dateTime={n.created_at}>{compact ? relative(n.created_at, now) : clock(n.created_at)}</time>
     {!n.read_at ? <span className="ma-sr-only">წაუკითხავი</span> : null}
    </>;
     // A notice without a destination is a button that selects (and marks read) instead of a dead link.
     return href ? <Link href={href} data-navigation-preview={!compact || undefined} aria-current={!compact && selected?.id === n.id ? "true" : undefined} onClick={event => {
      if (!compact && matchMedia("(min-width:1024px)").matches && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setSelectedId(n.id); }
      acknowledge(n);
     }} className={styles.noticeLink}>{body}</Link> : <button type="button" className={`${styles.noticeLink} ${styles.noticeButton}`} aria-pressed={!compact && selected?.id === n.id} onClick={() => { setSelectedId(n.id); acknowledge(n); }}>{body}</button>; })()}
    {!compact && href && noticeType(n) !== "system" ? <Button variant="secondary" size="sm" className={styles.noticeAction} href={href} onClick={() => acknowledge(n)}>{actionLabel(n)}</Button> : null}
   </article>
  </Fragment>;
 })}</div>{!compact && selected ? <NoticeDetail key={selected.id} notice={selected} store={store} acknowledge={() => acknowledge(selected)}/> : null}</div>;
}
function NoticeDetail({ notice, store, acknowledge }: { notice: Notice; store?: Store; acknowledge: () => void }) {
 const [deal, setDeal] = useState<Deal | null>(null);
 const call = store?.callRpc;
 useEffect(() => {
  if (!notice.deal_id || !call) return;
  let active = true;
  void call("get_deal", { p_deal_id: notice.deal_id }).then((value: Deal) => { if (active) setDeal(value); }, () => {});
  return () => { active = false; };
 }, [call, notice.deal_id]);
 const request = notice.request_id ? store?.getRequest(notice.request_id) : null;
 const href = noticeHref(notice);
 // The notification API has no offer/sender id. Only selection events identify a specific offer via the request.
 const offer = notice.kind === "offer_chosen" && request?.chosenOfferId ? store?.visibleOffers(request.id).find((item: { id: string }) => item.id === request.chosenOfferId) : null;
 const company = deal ? store?.userById(deal.supplier_id) : offer ? store?.userById(offer.companyUserId) : null;
 return <aside className={styles.noticeDetail} aria-label="შეტყობინების დეტალი">
  <p className={styles.meta}>{noticeLabel(notice)} · {clock(notice.created_at)}</p>
  <h2>{request?.title || notice.detail?.title || notice.title}</h2>
  {notice.kind === "verification_reviewed" && notice.detail?.note ? <p>{notice.detail.note}</p> : notice.kind === "report_resolved" && notice.detail?.resolution ? <p>{notice.detail.resolution}</p> : notice.kind === "verify_to_respond" ? <p>{verifyText}</p> : null}
  {company ? <h3>{company.company || company.name}</h3> : null}
  <dl>{request ? <div><dt>მოთხოვნა</dt><dd>{[request.quantity != null ? `${request.quantity} ${store?.units[request.unit] || ""}` : null, cities[request.city] || request.city].filter(Boolean).join(" · ")}</dd></div> : null}
   {deal ? <><div><dt>ფასი</dt><dd>{money(deal.total_price == null ? null : Number(deal.total_price))}</dd></div>{deal.delivery_days != null ? <div><dt>მიწოდება</dt><dd>{deal.delivery_days} დღე</dd></div> : null}</> : offer ? <><div><dt>ფასი</dt><dd>{money(offer.price == null ? null : Number(offer.price))}{offer.price != null && offer.priceType === "unit" ? " / ერთეული" : ""}</dd></div>{offer.deliveryDays != null ? <div><dt>მიწოდება</dt><dd>{offer.deliveryDays} დღე</dd></div> : null}</> : null}
  </dl>
  {href ? <Button href={href} onClick={acknowledge}>{actionLabel(notice)}</Button> : null}
 </aside>;
}
export function NotificationBell() {
 const { store, ready } = useMarketStore();
 const me = ready ? store?.currentUser() : null;
 const state = store?.engagement();
 const refresh = store?.refreshEngagement;
 const [open, setOpen] = useState(false);
 const root = useRef<HTMLDivElement>(null);
 const trigger = useRef<HTMLButtonElement>(null);
 const retry = async () => {
  await refresh?.();
  // The retry button disappears after recovery; keep keyboard focus in the bell.
  if (document.activeElement === document.body || root.current?.contains(document.activeElement)) trigger.current?.focus();
 };
 useEffect(() => {
  const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
  document.addEventListener("pointerdown", close);
  return () => document.removeEventListener("pointerdown", close);
 }, []);
 if (!me || me.blocked) return null;
 const count = state?.unread || 0;
 return <div className={styles.bell} ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }} onKeyDown={e => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
  <button ref={trigger} type="button" className={`${styles.save} ${styles.bellButton}`} aria-label={`შეტყობინებები${count ? `, ${count} წაუკითხავი` : ""}`} aria-expanded={open} aria-controls="notification-list" onClick={() => { setOpen(!open); if (!open) void refresh?.(); }}><Icon name="bell"/>{count ? <span className={styles.badge} aria-hidden="true"></span> : null}</button>
  {open ? <div id="notification-list" className={styles.popover} aria-label="შეტყობინებები">
   <div className={styles.head}><strong>შეტყობინებები</strong><Button type="button" variant="ghost" aria-label="შეტყობინებების დახურვა" onClick={() => {setOpen(false);trigger.current?.focus();}}><Icon name="x"/></Button></div>
   {state?.status === "ready" ? state.notifications.items.length ? <div className={styles.noticeList} onClick={e => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}><NoticeRows store={store} items={state.notifications.items} limit={5} compact/></div> : <p>ახალი შეტყობინებები ჯერ არ გაქვთ.</p> : failed(state?.status) ? <div className={styles.noticeError} role="status"><p>შეტყობინებები დროებით მიუწვდომელია.</p><Button type="button" variant="secondary" size="sm" onClick={() => void retry()}>ხელახლა ცდა</Button></div> : <ListSkeleton compact label="შეტყობინებები იტვირთება…" />}
   <Button variant="ghost" size="sm" className={styles.noticeFooter} href="/account/?tab=notifications" onClick={() => setOpen(false)}>ყველა შეტყობინება</Button>
  </div> : null}
 </div>;
}
export function EngagementPanel({ kind, all = true }: { kind: "saved" | "notifications"; all?: boolean }) {
 const { store } = useMarketStore();
 const full = useSearchParams().get("tab") === "notifications" || all;
 const actor = store?.currentUser()?.id;
 const state = store?.engagement();
 const [cursor, setCursor] = useState<Cursor>(null);
 const [retry, setRetry] = useState(0);
 const [result, setResult] = useState<{scope: string; page?: Page; error?: boolean} | null>(null);
 const [pending, setPending] = useState(false);
 const [marking, setMarking] = useState(false);
 const [removing, setRemoving] = useState<string | null>(null);
 const [filter, setFilter] = useState("all");
 const scope = JSON.stringify([kind, actor, cursor]);
 const key = JSON.stringify([kind, actor, cursor, retry, state?.status, kind === "saved" ? state?.savedIds : state?.unread]);
 const load = kind === "saved" ? store?.listSavedCompanies : store?.listNotifications;
 useEffect(() => {
  if (!actor || !load || state?.status !== "ready") return;
  let cancelled = false;
  load(cursor).then((page: Page) => {if (!cancelled) setResult({scope,page});}, () => {if (!cancelled) setResult({scope,error:true});});
  return () => {cancelled=true;};
 }, [actor, load, cursor, key, scope, state?.status]);
 const current = result?.scope === scope ? result : null;
 // The store starts at "idle" and only refreshes on session events; make sure a first load is under way.
 useEffect(() => { if (actor && state?.status === "idle") void store?.refreshEngagement(); }, [actor, state?.status, store]);
 async function markAll() {
  if (!store || marking) return;
  setMarking(true);
  try {
   // Gather the complete cursor snapshot before writes change the unread counter.
   const unread: Notice[] = [];
   let next: Cursor = null;
   do {
    const page: Page = await store.listNotifications(next);
    unread.push(...page.items.filter(n => !n.read_at));
    next = page.nextCursor;
   } while (next);
   for (const notice of unread) await store.markNotificationRead(notice.id);
   setRetry(x => x + 1);
   toast("ყველა შეტყობინება წაკითხულია.");
  } catch { toastError("ყველას წაკითხვა ვერ შესრულდა. სცადეთ ხელახლა."); }
  finally { setMarking(false); }
 }
 async function email(enabled: boolean) {
  setPending(true);
  try {await store?.setNotificationEmail(enabled);toast("შეტყობინებების პარამეტრი შენახულია.");}
  catch {toastError("პარამეტრი ვერ შეინახა. სცადეთ ხელახლა.");}
  finally {setPending(false);}
 }
 async function unsave(id: string) {
  if (!store || removing) return;
  setRemoving(id);
  try { await store.setSavedCompany(id, false); toast("კომპანია შენახულიდან ამოიშალა."); }
  catch (err) { toastError((err as { userMessage?: string }).userMessage || "ამოშლა ვერ შესრულდა."); }
  finally { setRemoving(null); }
 }
 const loadingLabel = kind === "saved" ? "შენახული კომპანიები იტვირთება…" : "შეტყობინებები იტვირთება…";
 // Filter counts come from the same loaded page as the list, so „ყველა“ is always the sum of the others.
 const items = current?.page?.items || [];
 const filters = [["all", "ყველა", items.length] as const, ...Object.entries(noticeTypes).map(([type, text]) => [type, text, items.filter(n => noticeType(n) === type).length] as const)].filter(([type, , count]) => type === "all" || count > 0 || filter === type);
 return <div className={styles.stack}>
  {kind === "saved" ? <div className={styles.sectionHead}><h2 className="account-section__title">შენახული კომპანიები</h2>{items.length ? <Button variant="ghost" size="sm" href="/companies/"><Icon name="search"/>კომპანიების ძიება</Button> : null}</div>
   : <div className={styles.notificationHead}><div className={styles.filters} role="group" aria-label="შეტყობინებების ტიპი">{filters.map(([type, text, count]) => <Button key={type} variant={filter === type ? "primary" : "secondary"} aria-pressed={filter === type} onClick={() => setFilter(type)}>{text}{current?.page ? count ? <span>{count}</span> : null : <span>…</span>}</Button>)}</div><Button variant="secondary" disabled={marking || !state?.unread || state?.status !== "ready"} onClick={() => void markAll()}><Icon name="check"/>{marking ? "ინიშნება…" : "ყველას წაკითხულად მონიშვნა"}</Button></div>}
  {failed(state?.status) ? <ServiceUnavailable /> : state?.status !== "ready" || !current ? <ListSkeleton compact label={loadingLabel} /> : current.error ? <InlineNotice tone="error" action={<Button type="button" variant="secondary" size="sm" onClick={() => setRetry(x => x+1)}>ხელახლა ცდა</Button>}>სია ვერ ჩაიტვირთა.</InlineNotice> : <>
   {!items.length ? kind === "saved"
     ? <EmptyState icon="bookmark" title="შენახული კომპანიები ჯერ არ გაქვთ" text="მონიშნეთ საინტერესო მომწოდებლები და აქ მარტივად დაუბრუნდებით." action={<Button variant="secondary" href="/companies/"><Icon name="search"/>კომპანიების ძიება</Button>}/>
     : <EmptyState icon="bell" title="შეტყობინებები ჯერ არ გაქვთ" text="ახალი შეთავაზებები, გარიგების ცვლილებები და შესაბამისი მოთხოვნები აქ გამოჩნდება."/>
    : kind === "notifications" ? <NoticeRows store={store} items={items.filter(n => filter === "all" || noticeType(n) === filter)} limit={full ? undefined : 5}/> : items.map(c => <article className={styles.savedRow} key={c.company_id}>
     <div><h3 className="account-row__title"><Link className={styles.savedLink} href={`/companies/view/?id=${c.company_id}`}>{c.company}</Link></h3><p className="account-row__meta">{[categories[c.industry] || c.industry, cities[c.city] || c.city].filter(Boolean).join(" · ")}</p></div>
     <Button variant="ghost" size="sm" loading={removing === c.company_id} disabled={!!removing} aria-label={`${c.company} — შენახულიდან ამოშლა`} onClick={() => void unsave(c.company_id)}><Icon name="trash-2"/>ამოშლა</Button>
    </article>)}
   {kind === "notifications" && !full && current.page && (current.page.nextCursor || items.length > 5) ? <Link className="account-link" href="/account/?tab=notifications">ყველა შეტყობინება ({items.length}{current.page.nextCursor ? "+" : ""})</Link> : null}
   {(full || kind === "saved") && (cursor || current.page?.nextCursor) ? <div className={styles.head}>{cursor ? <Button type="button" variant="secondary" onClick={() => { setCursor(null); setFilter("all"); }}>პირველი გვერდი</Button> : null}{current.page?.nextCursor ? <Button type="button" variant="secondary" onClick={() => { setCursor(current.page!.nextCursor); setFilter("all"); }}>შემდეგი გვერდი</Button> : null}</div> : null}
  </>}
  {kind === "notifications" && state?.status === "ready" && (state.requestAlerts || state.emailDelivery) ? <details className={styles.preferences}><summary><Icon name="settings"/><span>შეტყობინებების პარამეტრები</span><Icon name="chevron-down"/></summary><div>
   {state.requestAlerts ? <RequestAlertSettings key={actor} initial={state.requestAlerts} emailDelivery={!!state.emailDelivery} profile={store?.currentUser()}/> : null}
   {state.emailDelivery ? <label className="ma-check"><input type="checkbox" checked={!!state.emailOffers} disabled={pending} onChange={e=>email(e.target.checked)}/>ახალ შეთავაზებებზე ელფოსტითაც მაცნობეთ</label> : null}
  </div></details> : null}
 </div>;
}
