import { dateLabel } from "../../lib/format";

export type AdminAuditEvent = {
  id: string; actor_id: string; target_type: string; target_id: string;
  action: string; reason: string | null; created_at: string;
  old_flags: Record<string, unknown>; new_flags: Record<string, unknown>;
  actor_name?: string | null; target_name?: string | null;
};

const shortId = (id: string) => id.slice(0, 8);

const actions: Record<string, string> = {
  "request.hide": "მოთხოვნის დამალვა", "request.show": "მოთხოვნის გამოჩენა", "request.delete": "მოთხოვნის წაშლა",
  "user.block": "მომხმარებლის დაბლოკვა", "user.unblock": "მომხმარებლის განბლოკვა",
  "company.verify": "კომპანიის დადასტურება", "company.unverify": "დადასტურების მოხსნა",
};

export function AdminAuditTable({ events }: { events: AdminAuditEvent[] }) {
  return <div className="ma-table-wrap"><table className="ma-table">
    <caption className="ma-sr-only">ადმინისტრატორების მოქმედებების ჟურნალი</caption>
    <thead><tr><th scope="col">მოქმედება</th><th scope="col">ჩანაწერი</th><th scope="col">ადმინისტრატორი</th><th scope="col">მიზეზი</th></tr></thead>
    <tbody>{events.length === 0 ? <tr><td colSpan={4}>ჟურნალში მოქმედებები ჯერ არ არის. ისტორია ინახება განახლების ამოქმედებიდან.</td></tr> : events.map(event => <tr key={event.id}>
      <td data-label="მოქმედება">{actions[event.action] || event.action}<small><time dateTime={event.created_at}>{dateLabel(event.created_at)} · {new Date(event.created_at).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tbilisi" })}</time></small></td>
      <td data-label="ჩანაწერი">{event.target_name || (event.target_type === "request" ? "მოთხოვნა" : "მომხმარებელი")}<small>{event.target_name ? (event.target_type === "request" ? "მოთხოვნა" : "მომხმარებელი") : `#${shortId(event.target_id)}`}</small></td>
      <td data-label="ადმინისტრატორი">{event.actor_name || `ადმინი ${shortId(event.actor_id)}`}</td>
      <td data-label="მიზეზი">{event.reason || "—"}</td>
    </tr>)}</tbody>
  </table></div>;
}
