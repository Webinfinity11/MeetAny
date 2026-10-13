import { useState } from "react";
import { CustomSelect } from "../ui/CustomSelect";
import { adminDateTime } from "../../lib/admin-helpers";
import type { AdminTarget } from "./AdminDetail";
import styles from "./admin.module.css";

export type AdminAuditEvent = {
  id: string; actor_id: string; target_type: string; target_id: string;
  action: string; reason: string | null; created_at: string;
  old_flags: Record<string, unknown>; new_flags: Record<string, unknown>;
  actor_name?: string | null; actor_email?: string | null; target_name?: string | null; target_role?: string | null;
  target_exists?: boolean; target_context?: string | null; target_context_id?: string | null;
};

export const auditActions: Record<string, string> = {
  "user.role": "როლის შეცვლა", "user.anonymize": "ანგარიშის ანონიმიზაცია", "company.hide": "კატალოგიდან დამალვა", "company.show": "კატალოგში დაბრუნება",
  "offer.edit": "შეთავაზების რედაქტირება", "report.resolve": "საჩივრის განხილვა", "deal.issue_comment": "პრობლემაზე ადმინისტრაციის კომენტარი",
  edit_profile: "პროფილის რედაქტირება", edit_request: "მოთხოვნის რედაქტირება",
  "request.hide": "მოთხოვნის დამალვა", "request.show": "მოთხოვნის გამოჩენა", "request.delete": "მოთხოვნის წაშლა",
  "request.preferences": "ბიუჯეტისა და პირობების შეცვლა",
  "offer.delete": "შეთავაზების წაშლა",
  "user.photo_remove": "ფოტოს წაშლა",
  "user.block": "ანგარიშის დაბლოკვა", "user.unblock": "ანგარიშის განბლოკვა",
  "company.verify": "კომპანიის ვერიფიცირება", "company.unverify": "ვერიფიკაციის მოხსნა",
  "company.verification_review": "ვერიფიკაციის დოკუმენტების განხილვა",
  "deal.stage": "გარიგების ეტაპის შეცვლა", "deal.issue_resolve": "გარიგების პრობლემის განხილვა",
};
const targets: Record<string, string> = { request: "მოთხოვნა", user: "ანგარიში", offer: "შეთავაზება", deal: "გარიგება", report: "საჩივარი" };
const roles: Record<string, string> = { company: "კომპანია", client: "კლიენტი", admin: "ადმინი" };
const targetLabel = (e: AdminAuditEvent) => e.target_type === "user" && e.target_role ? roles[e.target_role] : targets[e.target_type];
const openable = (e: AdminAuditEvent): AdminTarget => e.target_exists === false ? null
  : e.target_type === "user" ? { kind: "user", id: e.target_id } : e.target_type === "request" ? { kind: "request", id: e.target_id }
  : e.target_type === "deal" ? { kind: "deal", id: e.target_id } : e.target_type === "offer" ? { kind: "offer", id: e.target_id } : null;

export function AdminAuditFilters({ action, target, query, period, onChange }: { action: string; target: string; query: string; period: string; onChange: (key: string, value: string) => void }) {
  return <div className={styles.filters} role="search" aria-label="ისტორიის ფილტრები">
    <div className={styles.search}><label htmlFor="audit-search">სამიზნის ძიება</label><input id="audit-search" type="search" className="ma-input" value={query} placeholder="სახელი ან ID" onChange={e=>onChange("q",e.target.value)}/></div>
    <div><label htmlFor="audit-period">პერიოდი</label><CustomSelect id="audit-period" className="ma-select" value={period} onChange={e=>onChange("period",e.target.value)}><option value="">ყველა დრო</option><option value="1">დღეს</option><option value="7">7 დღე</option><option value="30">30 დღე</option></CustomSelect></div>
    <div><label htmlFor="audit-action">მოქმედება</label><CustomSelect id="audit-action" className="ma-select" value={action} onChange={e => onChange("action", e.target.value)}>
      <option value="">ყველა მოქმედება</option>{Object.entries(auditActions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </CustomSelect></div>
    <div><label htmlFor="audit-target">ჩანაწერი</label><CustomSelect id="audit-target" className="ma-select" value={target} onChange={e => onChange("target", e.target.value)}>
      <option value="">ყველა ჩანაწერი</option>{Object.entries(targets).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </CustomSelect></div>
  </div>;
}

export function AdminAuditTable({ events, query, period, onOpen }: { events: AdminAuditEvent[]; query: string; period: string; onOpen: (target: AdminTarget) => void }) {
  // Until admin_list_audit_v2 accepts p_q/p_from/p_to (including its count and cursor),
  // search and date filtering deliberately apply only to the loaded page.
  const [now] = useState(() => Date.now());
  // Calendar days in Tbilisi (UTC+4), matching the admin overview.
  const today = Math.floor((now + 4 * 3600000) / 86400000) * 86400000 - 4 * 3600000;
  const since = ["1", "7", "30"].includes(period) ? today - (Number(period) - 1) * 86400000 : -Infinity;
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered = events.filter(event => Date.parse(event.created_at) >= since && terms.every(term => `${event.target_name || ""} ${event.target_id}`.toLocaleLowerCase().includes(term)));
  return <><p className={styles.note}>ძიება და პერიოდი ფილტრავს მხოლოდ ჩატვირთულ გვერდს · ნაპოვნია {filtered.length} / {events.length}</p>{!filtered.length?<p role="status">ამ გვერდზე შესაბამისი ჩანაწერი ვერ მოიძებნა. შეცვალეთ ფილტრები ან გადადით შემდეგ გვერდზე.</p>:null}<div className="ma-table-wrap"><table className={`ma-table ${styles.auditTable}`}>
    <caption className="ma-sr-only">ადმინისტრატორების მოქმედებების ისტორია</caption>
    <colgroup><col className={styles.colWide} /><col className={styles.colWide} /><col /><col /></colgroup>
    <thead><tr><th scope="col">მოქმედება</th><th scope="col">ჩანაწერი</th><th scope="col">ადმინისტრატორი</th><th scope="col">მიზეზი</th></tr></thead>
    <tbody>{filtered.map(event => { const target = openable(event); const name = event.target_name || `${event.target_exists === false ? "წაშლილი " : ""}${targets[event.target_type] || "ჩანაწერი"} · #${event.target_id.slice(0, 8)}`; return <tr key={event.id}>
      <td data-label="მოქმედება">{auditActions[event.action] || "მოქმედება"}<small><time dateTime={event.created_at} className={styles.nowrap}>{adminDateTime(event.created_at)}</time></small></td>
      <td data-label="ჩანაწერი">{target ? <button type="button" className={styles.rowLink} onClick={() => onOpen(target)}>{name}</button> : name}
        {event.target_name ? <small>{targetLabel(event)}</small> : null}
        {event.target_context ? <small>{event.target_context_id ? <button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "request", id: event.target_context_id! })}>{event.target_context}</button> : event.target_context}</small> : null}
      </td>
      <td data-label="ადმინისტრატორი">{event.actor_name || `ადმინი · #${event.actor_id.slice(0, 8)}`}{event.actor_email ? <small>{event.actor_email}</small> : null}</td>
      <td data-label="მიზეზი">{event.reason || "—"}</td>
    </tr>; })}</tbody>
  </table></div></>;
}
