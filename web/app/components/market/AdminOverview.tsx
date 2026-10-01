"use client";
import { Button } from "../ui/Button";


import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import type { Store } from "../../lib/market-client";
import { categories } from "../../lib/categories";
import { dateLabel } from "../../lib/format";
import { isTestAccount, lastDays, perDay, windowCounts } from "../../lib/admin-helpers";
import { AdminMarketMetrics } from "./AdminMarketMetrics";
import styles from "./admin.module.css";

type Stats = Record<string, number>;
type UserRow = { id: string; name: string; company?: string; email?: string; role: string; verified?: boolean; blocked?: boolean; created_at?: string; createdAt?: string; industry?: string };
type RequestRow = { id: string; title: string; category: string; createdAt: string; ownerId: string; hidden: boolean };

const shortDay = (key: string) => {
  const [, m, d] = key.split("-");
  return `${Number(d)}.${m}`;
};

/** Single-series daily bars (brand blue), hover tooltip per bar, table for screen readers. */
function DailyBars({ title, rows }: { title: string; rows: { day: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map(r => r.count));
  const total = rows.reduce((n, r) => n + r.count, 0);
  const w = 100 / rows.length;
  return <figure className={styles.chart}>
    <figcaption><span>{title}</span><strong>{total}</strong></figcaption>
    <div className={styles.chartPlot} onMouseLeave={() => setHover(null)}>
      <svg viewBox="0 0 300 96" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" x2="300" y1="95.5" y2="95.5" className={styles.chartBase} />
        {rows.map((r, i) => {
          const h = r.count ? Math.max(3, (r.count / max) * 88) : 0;
          const x = i * (300 / rows.length) + 1;
          const bw = 300 / rows.length - 2;
          return <g key={r.day}>
            <rect className={styles.chartHit} x={x - 1} y="0" width={bw + 2} height="96" onMouseEnter={() => setHover(i)} />
            {h ? <path className={`${styles.chartBar} ${hover === i ? styles.chartBarActive : ""}`}
              d={`M${x},96 V${96 - h + 2} q0,-2 2,-2 h${bw - 4} q2,0 2,2 V96 Z`} /> : null}
          </g>;
        })}
      </svg>
      {hover !== null ? <span className={styles.chartTip} style={{ left: `${Math.min(88, Math.max(4, (hover + 0.5) * w))}%` }}>
        <b>{rows[hover].count}</b> · {shortDay(rows[hover].day)}
      </span> : null}
    </div>
    <div className={styles.chartAxis} aria-hidden="true"><span>{shortDay(rows[0].day)}</span><span>დღეს</span></div>
    <table className="ma-sr-only"><caption>{title}</caption><tbody>{rows.map(r => <tr key={r.day}><th scope="row">{r.day}</th><td>{r.count}</td></tr>)}</tbody></table>
  </figure>;
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (!current && !previous) return <span className={styles.delta}>ბოლო 7 დღე: 0</span>;
  const up = current >= previous;
  return <span className={styles.delta}>
    ბოლო 7 დღე: <b>+{current}</b>
    {previous || current ? <em className={up ? styles.deltaUp : styles.deltaDown}>{up ? "▲" : "▼"} წინა კვირა {previous}</em> : null}
  </span>;
}

/** Admin landing: platform totals with weekly change, 30-day activity and what needs attention. */
export function AdminOverview({ store, stats, onVerify, onOpenUser }: {
  store: Store; stats: Stats;
  onVerify: (user: { id: string; label: string }) => void;
  onOpenUser: (id: string) => void;
}) {
  const [recentUsers, setRecentUsers] = useState<UserRow[] | null>(null);
  const [pending, setPending] = useState<UserRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const revision = store.dataRevision();
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      store.adminSearchUsers({ p_limit: 100 }),
      store.adminSearchUsers({ p_role: "company", p_verified: false, p_blocked: false, p_limit: 50 }),
    ]).then(([recent, unverified]) => {
      if (cancelled) return;
      setRecentUsers(recent.items as UserRow[]);
      setPending((unverified.items as UserRow[]).filter(u => !isTestAccount(u)));
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [store, revision]);

  const requests = useMemo(() => (store.listRequests({ state: "", includeHidden: true }) as RequestRow[])
    .filter(r => !isTestAccount(store.userById(r.ownerId))), [store]);
  // The clock is read once per mount; the page is a snapshot, not a live monitor.
  const [now] = useState(() => Date.now());
  const days = useMemo(() => lastDays(30, new Date(now)), [now]);
  const requestDates = requests.map(r => r.createdAt);
  const realUsers = (recentUsers || []).filter(u => u.role !== "admin" && !isTestAccount(u));
  const userDates = realUsers.map(u => u.created_at || u.createdAt);
  const requestWeek = windowCounts(requestDates, 7, now);
  const userWeek = windowCounts(userDates, 7, now);
  // Open, older than 3 days and still without a single offer: the requests at risk of going unanswered.
  const unanswered = requests.filter(r => !r.hidden && store.requestState(r) === "open" && store.offerCount(r.id) === 0 && now - Date.parse(r.createdAt) > 3 * 86_400_000);
  const expiring = requests.filter(r => !r.hidden && store.requestState(r) === "open" && store.daysLeft(r) <= 2);

  const kpis: { key: string; label: string; value: number; delta?: { current: number; previous: number }; href: string }[] = [
    { key: "users", label: "რეგისტრირებული მომხმარებლები", value: stats.users, delta: recentUsers ? userWeek : undefined, href: "/admin/?tab=users" },
    { key: "companies", label: "კომპანიები", value: stats.companies, href: "/admin/?tab=users&role=company" },
    { key: "open", label: "ღია მოთხოვნები", value: stats.open, delta: requestWeek, href: "/admin/?tab=requests&status=open" },
    { key: "offers", label: "შეთავაზებები", value: stats.offers, href: "/admin/?tab=offers" },
    { key: "chosen", label: "არჩეული მომწოდებლები", value: stats.chosen, href: "/admin/?tab=requests&status=chosen" },
    { key: "verified", label: "დადასტურებული კომპანიები", value: stats.verified, href: "/admin/?tab=users&role=company&status=verified" },
  ];

  return <div className={styles.overview}>
    <aside className={styles.presentationHint} aria-label="სადემო პრეზენტაცია"><div><strong>კლიენტს აცნობ MeetAny-ს?</strong><p>სადემო გზამკვლევში ნახავ გამოყენების მაგალითებსა და მაჩვენებლების განმარტებებს.</p></div><Button variant="secondary" href="/admin/?tab=demo">სადემო გზამკვლევი<Icon name="arrow-right" /></Button></aside>
    <div className={styles.kpis}>
      {kpis.map(k => <Link key={k.key} href={k.href} className={styles.kpi}>
        <span className={styles.kpiLabel}>{k.label}</span>
        <strong className={styles.kpiValue}>{k.value ?? "—"}</strong>
        {k.delta ? <Delta {...k.delta} /> : <span className={styles.delta}>&nbsp;</span>}
      </Link>)}
    </div>

    <AdminMarketMetrics store={store} />
    <section className={styles.panel} aria-labelledby="activity-heading">
      <header className={styles.panelHead}><h2 id="activity-heading">აქტივობის დინამიკა · ბოლო 30 დღე</h2><span>სატესტო ანგარიშების გარეშე</span></header>
      <div className={styles.charts}>
        <DailyBars title="ახალი მოთხოვნები" rows={perDay(requestDates, days)} />
        {recentUsers ? <DailyBars title="ახალი რეგისტრაციები" rows={perDay(userDates, days)} />
          : <div className={styles.chartEmpty}>{failed ? "რეგისტრაციები ვერ ჩაიტვირთა." : "იტვირთება…"}</div>}
      </div>
    </section>

    <section className={styles.panel} aria-labelledby="attention-heading">
      <header className={styles.panelHead}><h2 id="attention-heading">ყურადღება სჭირდება</h2></header>
      <div className={styles.attention}>
        <div className={styles.queue}>
          <h3><Icon name="badge-check" />კომპანიები დასადასტურებლად <span>{pending?.length ?? "…"}</span></h3>
          {pending && !pending.length ? <p className={styles.queueEmpty}>ჩატვირთულ სიაში დასადასტურებელი კომპანია არ არის.</p> : null}
          <ul>
            {(pending || []).slice(0, 6).map(u => <li key={u.id}>
              <button type="button" className={styles.queueName} onClick={() => onOpenUser(u.id)}>
                <strong>{u.company || u.name}</strong>
                <small>{categories[u.industry || ""] || u.industry || "კომპანია"}</small>
              </button>
              <Button type="button" variant="secondary" onClick={() => onVerify({ id: u.id, label: u.company || u.name })}>დადასტურება</Button>
            </li>)}
          </ul>
          {(pending?.length || 0) > 6 ? <Link className={styles.queueMore} href="/admin/?tab=users&role=company">ყველა ({pending!.length})<Icon name="arrow-right" /></Link> : null}
        </div>
        <div className={styles.queue}>
          <h3><Icon name="hourglass" />3+ დღე შეთავაზების გარეშე <span>{unanswered.length}</span></h3>
          {!unanswered.length ? <p className={styles.queueEmpty}>3 დღეზე ძველი უპასუხო ღია მოთხოვნა არ არის.</p> : null}
          <ul>
            {unanswered.slice(0, 6).map(r => <li key={r.id}>
              <Link className={styles.queueName} href={`/requests/view/?id=${r.id}`}>
                <strong>{r.title}</strong>
                <small>{categories[r.category] || r.category} · {dateLabel(r.createdAt)}</small>
              </Link>
            </li>)}
          </ul>
        </div>
        <div className={styles.queue}>
          <h3><Icon name="clock" />ვადა 2 დღეში იწურება <span>{expiring.length}</span></h3>
          {!expiring.length ? <p className={styles.queueEmpty}>ახლო დღეებში ვადა არაფერს ეწურება.</p> : null}
          <ul>
            {expiring.slice(0, 6).map(r => <li key={r.id}>
              <Link className={styles.queueName} href={`/requests/view/?id=${r.id}`}>
                <strong>{r.title}</strong>
                <small>{store.offerCount(r.id)} შეთავაზება · {store.daysLeft(r)} დღე დარჩა</small>
              </Link>
            </li>)}
          </ul>
        </div>
      </div>
      <p className={styles.note}>დამალული: {stats.hidden ?? 0} მოთხოვნა · დაბლოკილი: {stats.blocked ?? 0} ანგარიში</p>
    </section>
  </div>;
}
