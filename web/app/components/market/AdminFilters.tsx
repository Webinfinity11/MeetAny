import { CustomSelect } from "../ui/CustomSelect";
import styles from "./admin.module.css";

const states: Record<string, [string, string][]> = {
  requests: [["open", "ღია"], ["chosen", "მომწოდებელი არჩეულია"], ["closed", "დახურული"], ["expired", "ვადაგასული"], ["hidden", "დამალული"]],
  offers: [["sent", "გაგზავნილი"], ["chosen", "არჩეული"], ["declined", "არ შეირჩა"], ["withdrawn", "გაუქმებული"], ["expired", "ვადაგასული"]],
  companies: [["pending", "განსახილველი"], ["verified", "ვერიფიცირებული"], ["returned", "დაბრუნებული"], ["no_documents", "დოკუმენტები არ არის"], ["unverified", "ყველა ვერიფიკაციის გარეშე"], ["blocked", "დაბლოკილი"]],
  users: [["active", "აქტიური"], ["blocked", "დაბლოკილი"], ["unverified", "კომპანია ვერიფიკაციის გარეშე"]],
};
const placeholders: Record<string, string> = { requests: "სათაური, ავტორი ან ID", offers: "კომპანია, მოთხოვნა ან ID", companies: "სახელი, ელფოსტა, ნომერი", users: "სახელი, ელფოსტა, ნომერი" };

export function AdminFilters({ tab, query, status, role, lockRole = false, onChange }: {
  tab: "requests" | "users" | "companies" | "offers"; query: string; status: string; role: string; lockRole?: boolean;
  onChange: (key: string, value: string) => void;
}) {
  return <div className={styles.filters} role="search" aria-label="ადმინისტრირების ჩანაწერების ძიება">
    <div className={styles.search}><label htmlFor="admin-search">ძიება</label><input id="admin-search" className="ma-input" type="search" value={query} maxLength={200}
      placeholder={placeholders[tab]} onChange={event => onChange("q", event.target.value)} /></div>
    {tab === "users" && !lockRole ? <div><label htmlFor="admin-role">როლი</label><CustomSelect id="admin-role" className="ma-select" value={role} onChange={event => onChange("role", event.target.value)}>
      <option value="">ყველა როლი</option><option value="client">კლიენტი</option><option value="company">კომპანია</option><option value="admin">ადმინისტრატორი</option>
    </CustomSelect></div> : null}
    <div><label htmlFor="admin-status">{tab === "companies" ? "ვერიფიკაცია" : "სტატუსი"}</label><CustomSelect id="admin-status" className="ma-select" value={status} onChange={event => onChange("status", event.target.value)}>
      <option value="">ყველა სტატუსი</option>{states[tab].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </CustomSelect></div>
  </div>;
}
