"use client";
import { ListSkeleton } from "./Skeletons";

import Link from "next/link";
import type { Store } from "../../lib/market-client";
import { useAdminContacts, type ContactRow } from "../../lib/use-admin-data";
import styles from "./admin.module.css";

const sources: Record<string, string> = { "company-list": "კომპანიების სია", "company-profile": "კომპანიის პროფილი", "company-partnership": "პარტნიორობა", "request-owner": "მოთხოვნის ავტორი", "chosen-offer": "არჩეული შეთავაზება" };
function Target({ row }: { row: Pick<ContactRow, "target_kind" | "target_id" | "target_name" | "target_exists"> }) {
  const label = row.target_name || (row.target_kind === "company" ? "წაშლილი კომპანია" : "წაშლილი მოთხოვნა");
  return row.target_exists ? <Link className="ma-link" href={`/${row.target_kind === "company" ? "companies" : "requests"}/view/?id=${row.target_id}`}>{label}</Link> : <span>{label}</span>;
}
export function AdminContacts({ store, kind, target, period, cursor, onChange }: {
  store: Store; kind: string; target: string; period: string; cursor: string; onChange: (key: string, value: string) => void;
}) {
  const data = useAdminContacts({ store, kind, target, period, cursor });
  return <section className={styles.contacts} aria-label="კონტაქტების აღრიცხვა">
    <p className={styles.note}>ნახვა — ნომრის გამოჩენა; დარეკვა — ტელეფონის ბმულზე დაჭერა და არა დასრულებული საუბარი. განმეორებითი მოქმედებები წუთის განმავლობაში არ ითვლება; ანონიმური ვიზიტორები საერთო ჯგუფად აღირიცხება.</p>
    <div className={styles.filters} role="search" aria-label="კონტაქტების ფილტრები">
      <div><label htmlFor="contact-kind">მოქმედება</label><select id="contact-kind" className="ma-select" value={kind} onChange={e => onChange("kind", e.target.value)}><option value="">ყველა მოქმედება</option><option value="reveal">ნომრის ნახვა</option><option value="call">დარეკვა</option></select></div>
      <div><label htmlFor="contact-target">სამიზნე</label><select id="contact-target" className="ma-select" value={target} onChange={e => onChange("target", e.target.value)}><option value="">ყველა სამიზნე</option><option value="company">კომპანია</option><option value="request">მოთხოვნა</option></select></div>
      <div><label htmlFor="contact-period">პერიოდი</label><select id="contact-period" className="ma-select" value={period} onChange={e => onChange("period", e.target.value)}><option value="day">დღეს</option><option value="week">7 დღე</option><option value="month">30 დღე</option></select></div>
    </div>
    {data.loading ? <ListSkeleton compact kind="records" label="კონტაქტები იტვირთება…" /> : data.error ? <div role="alert"><p>{data.error}</p><button className="ma-btn ma-btn--secondary" onClick={data.reload}>ხელახლა ცდა</button>{cursor ? <button className="ma-btn ma-btn--secondary" onClick={() => onChange("cursor", "")}>პირველი გვერდი</button> : null}</div> : data.stats ? <>
      <div className="ma-proto-kpis">{[["day", "დღეს"], ["week", "7 დღე"], ["month", "30 დღე"]].flatMap(([key, label]) => [
        <div className="ma-stat" key={`${key}-reveal`}><strong className="ma-stat__value">{data.stats!.totals[key].reveals}</strong><span className="ma-stat__label">ნახვები · {label}</span></div>,
        <div className="ma-stat" key={`${key}-call`}><strong className="ma-stat__value">{data.stats!.totals[key].calls}</strong><span className="ma-stat__label">დარეკვები · {label}</span></div>,
      ])}</div>
      <p className={styles.note}>ზედა მაჩვენებლები ყველა კონტაქტს მოიცავს. ტოპ სიები შერჩეულ პერიოდს ასახავს და ნახვებისა და დარეკვების ჯამით ლაგდება; მოქმედებისა და სამიზნის ფილტრები მოვლენების სიაზე მოქმედებს.</p>
      <div className={styles.contactTops}>{([['companies', 'ტოპ 10 კომპანია'], ['requests', 'ტოპ 10 მოთხოვნა']] as const).map(([key, label]) => <div className="ma-table-wrap" key={key}><table className="ma-table"><caption>{label}</caption><thead><tr><th scope="col">{key === "companies" ? "კომპანია" : "მოთხოვნა"}</th><th scope="col">ნახვა</th><th scope="col">დარეკვა</th></tr></thead><tbody>{data.stats![key].length ? data.stats![key].map(row => <tr key={row.target_id}><td data-label="სამიზნე"><Target row={row} /></td><td data-label="ნახვა">{row.reveals}</td><td data-label="დარეკვა">{row.calls}</td></tr>) : <tr><td colSpan={3}>ამ პერიოდში მოვლენები არ არის.</td></tr>}</tbody></table></div>)}</div>
      <h2 className="ma-h3">ბოლო მოვლენები</h2>
      <p className={styles.count} role="status">ნაჩვენებია {data.rows?.length || 0} · ფილტრებით სულ {data.page?.filteredTotal || 0}.</p>
      <div className="ma-table-wrap"><table className="ma-table"><caption className="ma-sr-only">კონტაქტის მოვლენები</caption><thead><tr><th scope="col">ვინ</th><th scope="col">ვის</th><th scope="col">როდის</th><th scope="col">მოქმედება</th><th scope="col">წყარო</th></tr></thead><tbody>{data.rows?.length ? data.rows.map(row => <tr key={row.id} data-contact-event-id={row.id}>
        <td data-label="ვინ">{row.actor_id ? row.actor_company || row.actor_name || "წაშლილი მომხმარებელი" : "ანონიმური"}{row.actor_company && row.actor_name ? <small>{row.actor_name}</small> : null}</td>
        <td data-label="ვის"><Target row={row} /></td><td data-label="როდის"><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString("ka-GE", { timeZone: "Asia/Tbilisi", hour12: false })}</time></td>
        <td data-label="მოქმედება">{row.kind === "reveal" ? "ნომრის ნახვა" : "დარეკვა"}</td><td data-label="წყარო">{sources[row.source] || row.source}</td>
      </tr>) : <tr><td colSpan={5}>ამ ფილტრებით მოვლენები ვერ მოიძებნა.</td></tr>}</tbody></table></div>
      <nav className={styles.pagination} aria-label="კონტაქტების გვერდები">{cursor ? <button className="ma-btn ma-btn--secondary" onClick={() => onChange("cursor", "")}>პირველი გვერდი</button> : null}{data.page?.hasMore && data.page.nextCursor ? <button className="ma-btn ma-btn--secondary" onClick={() => onChange("cursor", JSON.stringify(data.page!.nextCursor))}>მეტის ჩვენება</button> : null}</nav>
    </> : null}
  </section>;
}
