"use client";
import { Button } from "../ui/Button";

import { CustomSelect } from "../ui/CustomSelect";
import { AdminState } from "./AdminState";
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
export function AdminContacts({ store, kind, target, period, cursor, onChange, onClear }: {
  store: Store; kind: string; target: string; period: string; cursor: string; onChange: (key: string, value: string) => void; onClear: () => void;
}) {
  const hasFilters = !!(kind || target || period !== "month");
  const data = useAdminContacts({ store, kind, target, period, cursor });
  return <section className={styles.contacts} aria-label="კონტაქტების აღრიცხვა">
    <details className={styles.methodology}><summary>რა ითვლება დაკავშირებად?</summary><p className={styles.note}>„ნომრის ნახვა“ ნიშნავს ნომრის გამოჩენას; „დარეკვაზე დაჭერა“ — ტელეფონის ბმულის გახსნას. დასრულებული სატელეფონო საუბარი არ მოწმდება. განმეორებითი მოქმედებები წუთის განმავლობაში არ ითვლება; ანონიმური ვიზიტორები საერთო ჯგუფად აღირიცხება.</p></details>
    <div className={styles.filters} role="search" aria-label="კონტაქტების ფილტრები">
      <div><label htmlFor="contact-kind">მოქმედება</label><CustomSelect id="contact-kind" className="ma-select" value={kind} onChange={e => onChange("kind", e.target.value)}><option value="">ყველა მოქმედება</option><option value="reveal">ნომრის ნახვა</option><option value="call">დარეკვაზე დაჭერა</option></CustomSelect></div>
      <div><label htmlFor="contact-target">ვის დაუკავშირდნენ</label><CustomSelect id="contact-target" className="ma-select" value={target} onChange={e => onChange("target", e.target.value)}><option value="">კომპანიები და მოთხოვნები</option><option value="company">კომპანია</option><option value="request">მოთხოვნა</option></CustomSelect></div>
      <div><label htmlFor="contact-period">პერიოდი</label><CustomSelect id="contact-period" className="ma-select" value={period} onChange={e => onChange("period", e.target.value)}><option value="day">დღეს</option><option value="week">7 დღე</option><option value="month">30 დღე</option></CustomSelect></div>
    </div>
    {hasFilters ? <Button type="button" variant="secondary" className={styles.clear} onClick={onClear}>ფილტრების გასუფთავება</Button> : null}
    {data.loading ? <ListSkeleton compact kind="records" label="კონტაქტები იტვირთება…" /> : data.error ? <AdminState error title="კონტაქტები ვერ ჩაიტვირთა" text={data.error} onRetry={data.reload} onFirst={cursor ? () => onChange("cursor", "") : undefined} /> : data.stats ? <>
      <div className={styles.contactTotals}>{[["day", "დღეს"], ["week", "ბოლო 7 დღე"], ["month", "ბოლო 30 დღე"]].map(([key, label]) => <section className={styles.contactTotal} key={key}>
        <h2>{label}</h2><dl>
          <div><dt>ნომრის ნახვა</dt><dd>{data.stats!.totals[key].reveals}</dd></div>
          <div><dt>დარეკვაზე დაჭერა</dt><dd>{data.stats!.totals[key].calls}</dd></div>
          <div><dt>ახალი მიმოწერა</dt><dd>{data.messageStats?.totals[key].conversations ?? 0}</dd></div>
        </dl>
      </section>)}</div>
      <p className={styles.note}>ზედა მაჩვენებლები ყველა კონტაქტს მოიცავს. ტოპ სიები შერჩეულ პერიოდს ასახავს და ნახვებისა და დარეკვების ჯამით ლაგდება; მოქმედებისა და სამიზნის ფილტრები მოვლენების სიაზე მოქმედებს.</p>
      <div className={styles.contactTops}>{([['companies', 'ტოპ 10 კომპანია'], ['requests', 'ტოპ 10 მოთხოვნა']] as const).map(([key, label]) => <div className="ma-table-wrap" key={key}><table className="ma-table"><caption>{label}</caption><thead><tr><th scope="col">{key === "companies" ? "კომპანია" : "მოთხოვნა"}</th><th scope="col">ნომრის ნახვა</th><th scope="col">დარეკვაზე დაჭერა</th></tr></thead><tbody>{data.stats![key].length ? data.stats![key].map(row => <tr key={row.target_id}><td data-label="სამიზნე"><Target row={row} /></td><td data-label="ნომრის ნახვა">{row.reveals}</td><td data-label="დარეკვაზე დაჭერა">{row.calls}</td></tr>) : <tr><td colSpan={3}>ამ პერიოდში მოვლენები არ არის.</td></tr>}</tbody></table></div>)}</div>
      <h2 className="ma-h3">დაკავშირების ბოლო მოქმედებები</h2>
      <p className={styles.count} role="status">ნაჩვენებია {data.rows?.length || 0} · ფილტრებით სულ {data.page?.filteredTotal || 0}.</p>
      {!data.rows?.length ? <AdminState title={hasFilters ? "ამ ფილტრებით მოვლენები ვერ მოიძებნა" : "ბოლო 30 დღეში კონტაქტები არ არის"} text="ნომრის ნახვა და დარეკვის ბმულზე დაჭერა აქ აღირიცხება." onClear={hasFilters ? onClear : undefined} onFirst={cursor ? () => onChange("cursor", "") : undefined} /> : <div className="ma-table-wrap"><table className="ma-table"><caption className="ma-sr-only">კონტაქტის მოვლენები</caption><thead><tr><th scope="col">ვინ</th><th scope="col">ვის</th><th scope="col">როდის</th><th scope="col">მოქმედება</th><th scope="col">წყარო</th></tr></thead><tbody>{data.rows?.length ? data.rows.map(row => <tr key={row.id} data-contact-event-id={row.id}>
        <td data-label="ვინ">{row.actor_id ? row.actor_company || row.actor_name || "წაშლილი მომხმარებელი" : "ანონიმური"}{row.actor_company && row.actor_name ? <small>{row.actor_name}</small> : null}</td>
        <td data-label="ვის"><Target row={row} /></td><td data-label="როდის"><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString("ka-GE", { timeZone: "Asia/Tbilisi", hour12: false })}</time></td>
        <td data-label="მოქმედება">{row.kind === "reveal" ? "ნომრის ნახვა" : "დარეკვაზე დაჭერა"}</td><td data-label="წყარო">{sources[row.source] || row.source}</td>
      </tr>) : <tr><td colSpan={5}>ამ ფილტრებით მოვლენები ვერ მოიძებნა.</td></tr>}</tbody></table></div>}
      <nav className={styles.pagination} aria-label="კონტაქტების გვერდები">{cursor ? <Button variant="secondary" type="submit" onClick={() => onChange("cursor", "")}>პირველი გვერდი</Button> : null}{data.page?.hasMore && data.page.nextCursor ? <Button variant="secondary" type="submit" onClick={() => onChange("cursor", JSON.stringify(data.page!.nextCursor))}>მეტის ჩვენება</Button> : null}</nav>
    </> : null}
  </section>;
}
