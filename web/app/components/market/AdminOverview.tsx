"use client";
import { Button } from "../ui/Button";


import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import type { Store } from "../../lib/market-client";
import { categories } from "../../lib/categories";
import { dateLabel } from "../../lib/format";
import { lastDays, perDay, windowCounts, readAllAdminPages } from "../../lib/admin-helpers";
import { AdminMarketMetrics } from "./AdminMarketMetrics";
import { AdminActivityChart } from "./AdminActivityChart";
import { AdminRegistrationAnalytics } from "./AdminRegistrationAnalytics";
import styles from "./admin.module.css";
import analyticsStyles from "./analytics.module.css";

type Stats = Record<string, number>;
type UserRow = { id: string; name: string; company?: string; email?: string; role: string; verified?: boolean; blocked?: boolean; created_at?: string; createdAt?: string; industry?: string };
type RequestRow = { id: string; title: string; category: string; createdAt: string; ownerId: string; hidden: boolean };

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
  const loadUsers = store.adminSearchUsers;
  const actorId = store.currentUser()?.id;
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      readAllAdminPages<UserRow>(loadUsers, {}, Number.MAX_SAFE_INTEGER),
      readAllAdminPages<UserRow>(loadUsers, { p_role: "company", p_verified: false, p_blocked: false }, Number.MAX_SAFE_INTEGER),
    ]).then(([recent, unverified]) => {
      if (cancelled) return;
      setRecentUsers(recent);
      setPending(unverified);
      setFailed(false);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [loadUsers, actorId, revision]);

  const requests = useMemo(() => store.listRequests({ state: "", includeHidden: true }) as RequestRow[], [store]);
  // The clock is read once per mount; the page is a snapshot, not a live monitor.
  const [now] = useState(() => Date.now());
  const [activityPeriod,setActivityPeriod]=useState<7|30>(30);
  const days = useMemo(() => lastDays(activityPeriod, new Date(now)), [now,activityPeriod]);
  const previousDays = useMemo(() => lastDays(activityPeriod, new Date(now-activityPeriod*86_400_000)), [now,activityPeriod]);
  const requestDates = requests.map(r => r.createdAt);
  const realUsers = (recentUsers || []).filter(u => u.role !== "admin");
  const userDates = realUsers.map(u => u.created_at || u.createdAt);
  const requestWeek = windowCounts(requestDates, 7, now);
  const userWeek = windowCounts(userDates, 7, now);
  // Open, older than 3 days and still without a single offer: the requests at risk of going unanswered.
  const unanswered = requests.filter(r => !r.hidden && store.requestState(r) === "open" && store.offerCount(r.id) === 0 && now - Date.parse(r.createdAt) > 3 * 86_400_000);
  const expiring = requests.filter(r => !r.hidden && store.requestState(r) === "open" && store.daysLeft(r) <= 2);

  const kpis: { key: string; label: string; value: number; delta?: { current: number; previous: number }; href: string }[] = [
    { key: "users", label: "მომხმარებლები", value: stats.users, delta: recentUsers ? userWeek : undefined, href: "/admin/?tab=users" },
    { key: "companies", label: "კომპანიები", value: stats.companies, href: "/admin/?tab=users&role=company" },
    { key: "open", label: "ღია მოთხოვნები", value: stats.open, href: "/admin/?tab=requests&status=open" },
    { key: "offers", label: "შეთავაზებები", value: stats.offers, href: "/admin/?tab=offers" },
    { key: "chosen", label: "არჩეული მომწოდებლები", value: stats.chosen, href: "/admin/?tab=requests&status=chosen" },
    { key: "verified", label: "დადასტურებული კომპანიები", value: stats.verified, href: "/admin/?tab=users&role=company&status=verified" },
  ];

  return <div className={styles.overview}>
    <div className={styles.kpis}>
      {[kpis[2], kpis[3], kpis[1], kpis[0]].map(k => <Link key={k.key} href={k.href} className={styles.kpi}>
        <span className={styles.kpiLabel}>{k.label}</span>
        <strong className={styles.kpiValue}>{k.value ?? "—"}</strong>
        <span className={styles.delta}>საერთო რაოდენობა<Icon name="arrow-right" /></span>
      </Link>)}
    </div>

    <div className={styles.overviewSecondary}>{kpis.slice(4).map(k => <Link key={k.key} href={k.href}><span>{k.label}</span><strong>{k.value ?? "—"}</strong><Icon name="arrow-right" /></Link>)}</div>
    <div className={styles.overviewSplit}>
    <section className={styles.panel} aria-labelledby="activity-heading">
      <header className={analyticsStyles.activityHeader}><h2 id="activity-heading">აქტივობის ანალიტიკა</h2><div className={analyticsStyles.periodControl} role="group" aria-label="აქტივობის პერიოდი">{([7,30] as const).map(period=><Button key={period} variant="ghost" size="sm" aria-pressed={activityPeriod===period} onClick={()=>setActivityPeriod(period)}>{period} დღე</Button>)}</div></header>
      <div className={analyticsStyles.activityCharts}>
        <AdminActivityChart title="ახალი მოთხოვნები" rows={perDay(requestDates, days)} previousTotal={perDay(requestDates,previousDays).reduce((sum,row)=>sum+row.count,0)} />
        {recentUsers ? <AdminActivityChart title="ახალი რეგისტრაციები" rows={perDay(userDates, days)} previousTotal={perDay(userDates,previousDays).reduce((sum,row)=>sum+row.count,0)} />
          : <div className={styles.chartEmpty}>{failed ? "რეგისტრაციები ვერ ჩაიტვირთა." : "იტვირთება…"}</div>}
      </div>
      <p className={styles.note}>ბოლო {activityPeriod} დღე · ყველა ჩანაწერი</p>
      <div className={styles.overviewSecondary}><span>ახალი მოთხოვნები <Delta {...requestWeek}/></span>{recentUsers?<span>რეგისტრაციები <Delta {...userWeek}/></span>:null}</div>
    </section>

    <section className={styles.panel} aria-labelledby="attention-heading">
      <header className={styles.panelHead}><h2 id="attention-heading">ყურადღება სჭირდება</h2></header>
      <div className={styles.attention}>
        <details className={styles.queue} open>
          <summary><Icon name="badge-check" />დასადასტურებელი კომპანიები <span>{pending?.length ?? "…"}</span><Icon name="chevron-down" /></summary>
          <p className={styles.queueEmpty}>ახალი კომპანიის პროფილები აქ გადამოწმდება.</p>
          {failed ? <p className={styles.queueEmpty}>კომპანიების ჩატვირთვა ვერ მოხერხდა. განაახლე გვერდი.</p> : null}
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
          <Link className={styles.queueMore} href="/admin/?tab=companies&status=unverified">დასადასტურებელი კომპანიების ნახვა<Icon name="arrow-right" /></Link>
        </details>
        <details className={styles.queue}>
          <summary><Icon name="hourglass" />3+ დღე უპასუხოდ <span>{unanswered.length}</span><Icon name="chevron-down" /></summary>
          {!unanswered.length ? <p className={styles.queueEmpty}>3 დღეზე ძველი უპასუხო ღია მოთხოვნა არ არის.</p> : null}
          <ul>
            {unanswered.slice(0, 6).map(r => <li key={r.id}>
              <Link className={styles.queueName} href={`/requests/view/?id=${r.id}`}>
                <strong>{r.title}</strong>
                <small>{categories[r.category] || r.category} · {dateLabel(r.createdAt)}</small>
              </Link>
            </li>)}
          </ul>
        </details>
        <details className={styles.queue}>
          <summary><Icon name="clock" />ვადა იწურება <span>{expiring.length}</span><Icon name="chevron-down" /></summary>
          {!expiring.length ? <p className={styles.queueEmpty}>ახლო დღეებში ვადა არაფერს ეწურება.</p> : null}
          <ul>
            {expiring.slice(0, 6).map(r => <li key={r.id}>
              <Link className={styles.queueName} href={`/requests/view/?id=${r.id}`}>
                <strong>{r.title}</strong>
                <small>{store.offerCount(r.id)} შეთავაზება · {store.daysLeft(r)} დღე დარჩა</small>
              </Link>
            </li>)}
          </ul>
        </details>
      </div>
      <p className={styles.note}>დამალული: {stats.hidden ?? 0} მოთხოვნა · დაბლოკილი: {stats.blocked ?? 0} ანგარიში</p>
    </section>
    </div>
    <AdminRegistrationAnalytics />
    <AdminMarketMetrics store={store} />
  </div>;
}
