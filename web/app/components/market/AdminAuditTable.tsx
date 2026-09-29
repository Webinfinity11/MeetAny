import Link from "next/link";
import { dateLabel } from "../../lib/format";

export type AdminAuditEvent = {
  id: string; actor_id: string; target_type: string; target_id: string;
  action: string; reason: string | null; created_at: string;
  old_flags: Record<string, unknown>; new_flags: Record<string, unknown>;
  actor_name?: string | null; actor_email?: string | null; target_name?: string | null;
  target_exists?: boolean; target_context?: string | null; target_context_id?: string | null;
};

export const auditActions: Record<string, string> = {
  "request.hide": "მოთხოვნის დამალვა", "request.show": "მოთხოვნის გამოჩენა", "request.delete": "მოთხოვნის წაშლა",
  "offer.delete": "შეთავაზების წაშლა",
  "user.block": "მომხმარებლის დაბლოკვა", "user.unblock": "მომხმარებლის განბლოკვა",
  "company.verify": "კომპანიის დადასტურება", "company.unverify": "დადასტურების მოხსნა",
};
const targets: Record<string, string> = { request: "მოთხოვნა", user: "მომხმარებელი", offer: "შეთავაზება" };

export function AdminAuditTable({ events }: { events: AdminAuditEvent[] }) {
  return <div className="ma-table-wrap"><table className="ma-table">
    <caption className="ma-sr-only">ადმინისტრატორების მოქმედებების ჟურნალი</caption>
    <thead><tr><th scope="col">მოქმედება</th><th scope="col">ჩანაწერი</th><th scope="col">ადმინისტრატორი</th><th scope="col">მიზეზი</th></tr></thead>
    <tbody>{events.map(event => <tr key={event.id}>
      <td data-label="მოქმედება">{auditActions[event.action] || event.action}<small><time dateTime={event.created_at}>{dateLabel(event.created_at)} · {new Date(event.created_at).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tbilisi" })}</time></small></td>
      <td data-label="ჩანაწერი">{event.target_name || `${event.target_exists === false ? "წაშლილი " : ""}${targets[event.target_type] || "ჩანაწერი"} · #${event.target_id.slice(0, 8)}`}
        {event.target_name ? <small>{targets[event.target_type]}</small> : null}
        {event.target_context ? <small>{event.target_context_id ? <Link className="ma-link" href={`/requests/view/?id=${event.target_context_id}`}>{event.target_context}</Link> : event.target_context}</small> : null}
      </td>
      <td data-label="ადმინისტრატორი">{event.actor_name || `ადმინი · #${event.actor_id.slice(0, 8)}`}{event.actor_email ? <small>{event.actor_email}</small> : null}</td>
      <td data-label="მიზეზი">{event.reason || "—"}</td>
    </tr>)}</tbody>
  </table></div>;
}
