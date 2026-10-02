"use client";
import { Button } from "../ui/Button";


import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import type { AdminOverviewData } from "../../lib/admin-overview";
import type { Store } from "../../lib/market-client";
import { categories } from "../../lib/categories";
import { dateLabel } from "../../lib/format";
import { AdminMarketMetrics } from "./AdminMarketMetrics";
import { AdminActivityChart } from "./AdminActivityChart";
import { AdminRegistrationAnalytics } from "./AdminRegistrationAnalytics";
import styles from "./admin.module.css";
import analyticsStyles from "./analytics.module.css";

type Stats = Record<string, number>;
/** Bounded server overview: next actions, totals and calendar-day activity. */
export function AdminOverview({ store, stats, onVerify, onOpenUser }: {
  store: Store; stats: Stats;
  onVerify: (user: { id: string; label: string }) => void;
  onOpenUser: (id: string) => void;
}) {
  const [resource, setResource] = useState<{ actor: string; data?: AdminOverviewData; failed?: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const unansweredQueue = useRef<HTMLDetailsElement>(null);
  const expiringQueue = useRef<HTMLDetailsElement>(null);
  const revision = store.dataRevision();
  const loadOverview = store.adminOverview;
  const actorId = store.currentUser()?.id as string;
  const [activityPeriod, setActivityPeriod] = useState<7 | 30>(30);
  useEffect(() => {
    let cancelled = false;
    loadOverview().then((data: AdminOverviewData) => {
      if (!cancelled) setResource({ actor: actorId, data });
    }).catch(() => {
      if (!cancelled) setResource(previous => ({ actor: actorId, data: previous?.actor === actorId ? previous.data : undefined, failed: true }));
    });
    return () => { cancelled = true; };
  }, [loadOverview, actorId, revision, retry]);
  // Keep a successful snapshot visible during background refresh; never show another actor's data.
  const current = resource?.actor === actorId ? resource : null;
  const overview = current?.data;
  const totals = overview?.stats || stats;
  const failed = current?.failed;
  const pending = overview?.pending;
  const unanswered = overview?.unanswered;
  const expiring = overview?.expiring;
  const activity = overview?.activity || [];
  const days = activity.slice(-activityPeriod);
  const previousDays = activity.slice(-activityPeriod * 2, -activityPeriod);
  const kpis = [
    { key: "open", label: "ღია მოთხოვნები", value: totals.open, action: "მოთხოვნების ნახვა", href: "/admin/?tab=requests&status=open" },
    { key: "offers", label: "შეთავაზებები", value: totals.offers, action: "შეთავაზებების ნახვა", href: "/admin/?tab=offers" },
    { key: "companies", label: "კომპანიები", value: totals.companies, action: "კომპანიების ნახვა", href: "/admin/?tab=companies" },
    { key: "users", label: "ანგარიშები", value: totals.users, action: "ანგარიშების ნახვა", href: "/admin/?tab=users" },
    { key: "chosen", label: "მოთხოვნები არჩეული მომწოდებლით", value: totals.chosen, action: "ნახვა", href: "/admin/?tab=requests&status=chosen" },
    { key: "verified", label: "დადასტურებული კომპანიები", value: totals.verified, action: "ნახვა", href: "/admin/?tab=companies&status=verified" },
  ];

  return <div className={styles.overview}>
    <div className={styles.nextActions} aria-label="შემდეგი მოქმედებები">
      <strong><Icon name="badge-check" />შემდეგი მოქმედებები</strong>
      {overview ? <>
        {pending!.total > 0 ? <Link href="/admin/?tab=companies&status=unverified">{pending!.total} კომპანია განხილვას ელოდება<Icon name="arrow-right" /></Link> : null}
        {unanswered!.total > 0 ? <a href="#unanswered-queue" onClick={() => { if (unansweredQueue.current) unansweredQueue.current.open = true; }}>{unanswered!.total} მოთხოვნა უპასუხოდაა<Icon name="arrow-right" /></a> : null}
        {expiring!.total > 0 ? <a href="#expiring-queue" onClick={() => { if (expiringQueue.current) expiringQueue.current.open = true; }}>{expiring!.total} მოთხოვნის ვადა იწურება<Icon name="arrow-right" /></a> : null}
        {!pending!.total && !unanswered!.total && !expiring!.total ? <p>მიმდინარე რიგებში გადაუდებელი მოქმედება არ არის.</p> : null}
      </> : <p role="status">{failed ? "მოქმედებები ვერ ჩაიტვირთა." : "მოქმედებები იტვირთება…"}</p>}
    </div>
    {failed ? <div className={`${styles.panel} ${styles.overviewError}`} role="alert"><p>{overview ? "განახლება ვერ მოხერხდა. ნაჩვენებია ბოლოს ჩატვირთული მონაცემები." : "მიმოხილვა ვერ ჩაიტვირთა. სცადე ხელახლა."}</p><Button variant="secondary" size="sm" onClick={() => setRetry(value => value + 1)}>ხელახლა ცდა</Button></div> : null}
    <div className={styles.kpis}>
      {kpis.slice(0, 4).map(k => <Link key={k.key} href={k.href} className={styles.kpi}>
        <span className={styles.kpiLabel}>{k.label}</span>
        <strong className={styles.kpiValue}>{k.value ?? "—"}</strong>
        <span className={styles.delta}>{k.action}<Icon name="arrow-right" /></span>
      </Link>)}
    </div>

    <div className={styles.overviewSecondary}>{kpis.slice(4).map(k => <Link key={k.key} href={k.href}><span>{k.label}</span><strong>{k.value ?? "—"}</strong><Icon name="arrow-right" /></Link>)}</div>
    <div className={styles.overviewSplit}>
    <section className={styles.panel} aria-labelledby="activity-heading">
      <header className={analyticsStyles.activityHeader}><h2 id="activity-heading">აქტივობის ანალიტიკა</h2><div className={analyticsStyles.periodControl} role="group" aria-label="აქტივობის პერიოდი">{([7,30] as const).map(period=><Button key={period} variant="ghost" size="sm" aria-pressed={activityPeriod===period} onClick={()=>setActivityPeriod(period)}>{period} დღე</Button>)}</div></header>
      <div className={analyticsStyles.activityCharts}>
        {overview ? <>
          <AdminActivityChart title="ახალი მოთხოვნები" rows={days.map(row => ({ day: row.day, count: row.requests }))} previousTotal={previousDays.reduce((sum, row) => sum + row.requests, 0)} />
          <AdminActivityChart title="ახალი რეგისტრაციები" rows={days.map(row => ({ day: row.day, count: row.registrations }))} previousTotal={previousDays.reduce((sum, row) => sum + row.registrations, 0)} />
        </> : <div className={styles.chartEmpty} role="status">{failed ? "ანალიტიკა ვერ ჩაიტვირთა." : "ანალიტიკა იტვირთება…"}</div>}
      </div>
      <p className={styles.note}>ბოლო {activityPeriod} დღე · დამალული მოთხოვნების გარეშე · თბილისის დროით</p>
    </section>

    <section className={styles.panel} aria-labelledby="attention-heading">
      <header className={styles.panelHead}><h2 id="attention-heading">ყურადღება სჭირდება</h2></header>
      <div className={styles.attention}>
        <details className={styles.queue} open>
          <summary><Icon name="badge-check" />დასადასტურებელი კომპანიები <span>{pending?.total ?? "…"}</span><Icon name="chevron-down" /></summary>
          {pending && !pending.total ? <p className={styles.queueEmpty}>განხილვის მომლოდინე კომპანია არ არის.</p> : null}
          <ul>
            {(pending?.items || []).map(u => <li key={u.id}>
              <button type="button" className={styles.queueName} onClick={() => onOpenUser(u.id)}>
                <strong>{u.company || u.name}</strong>
                <small>{categories[u.industry || ""] || u.industry || "კომპანია"}</small>
              </button>
              <Button type="button" variant="secondary" onClick={() => onVerify({ id: u.id, label: u.company || u.name })}>დადასტურება</Button>
            </li>)}
          </ul>
          {(pending?.total || 0) > 6 ? <p className={styles.queueEmpty}>ნაჩვენებია 6 კომპანია {pending!.total}-დან.</p> : null}
          <Link className={styles.queueMore} href="/admin/?tab=companies&status=unverified">დასადასტურებელი კომპანიების ნახვა<Icon name="arrow-right" /></Link>
        </details>
        <details id="unanswered-queue" ref={unansweredQueue} className={styles.queue}>
          <summary><Icon name="hourglass" />3+ დღე უპასუხოდ <span>{(unanswered?.total ?? "…")}</span><Icon name="chevron-down" /></summary>
          {unanswered && !unanswered.total ? <p className={styles.queueEmpty}>3 დღეზე ძველი უპასუხო ღია მოთხოვნა არ არის.</p> : null}
          <ul>
            {(unanswered?.items || []).map(r => <li key={r.id}>
              <Link className={styles.queueName} href={`/requests/view/?id=${r.id}`}>
                <strong>{r.title}</strong>
                <small>{categories[r.category] || r.category} · {dateLabel(r.createdAt)}</small>
              </Link>
            </li>)}
          </ul>
          {(unanswered?.total || 0) > 6 ? <p className={styles.queueEmpty}>ნაჩვენებია 6 ყველაზე ძველი მოთხოვნა.</p> : null}
        </details>
        <details id="expiring-queue" ref={expiringQueue} className={styles.queue}>
          <summary><Icon name="clock" />ვადა იწურება <span>{(expiring?.total ?? "…")}</span><Icon name="chevron-down" /></summary>
          {expiring && !expiring.total ? <p className={styles.queueEmpty}>ახლო დღეებში ვადა არაფერს ეწურება.</p> : null}
          <ul>
            {(expiring?.items || []).map(r => <li key={r.id}>
              <Link className={styles.queueName} href={`/requests/view/?id=${r.id}`}>
                <strong>{r.title}</strong>
                <small>{r.offerCount} შეთავაზება · {r.daysLeft} დღე დარჩა</small>
              </Link>
            </li>)}
          </ul>
          {(expiring?.total || 0) > 6 ? <p className={styles.queueEmpty}>ნაჩვენებია 6 უახლოესი ვადა.</p> : null}
        </details>
      </div>
      <p className={styles.note}>დამალული: {totals.hidden ?? 0} მოთხოვნა · დაბლოკილი: {totals.blocked ?? 0} ანგარიში</p>
    </section>
    </div>
    <AdminRegistrationAnalytics />
    <AdminMarketMetrics store={store} />
  </div>;
}
