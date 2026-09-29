import styles from "./admin.module.css";

export function AdminFilters({ tab, query, status, role, onChange }: {
  tab: "requests" | "users" | "offers"; query: string; status: string; role: string;
  onChange: (key: string, value: string) => void;
}) {
  const states = tab === "requests"
    ? [["open", "ღია"], ["chosen", "არჩეული"], ["closed", "დახურული"], ["expired", "ვადაგასული"], ["hidden", "დამალული"]]
    : tab === "offers" ? [["sent", "გაგზავნილი"], ["chosen", "არჩეული"], ["declined", "უარყოფილი"]]
    : [["active", "აქტიური"], ["blocked", "დაბლოკილი"], ["verified", "დადასტურებული კომპანია"]];
  return <div className={styles.filters} role="search" aria-label="ადმინისტრირების ჩანაწერების ძიება">
    <div className={styles.search}><label htmlFor="admin-search">ძიება</label><input id="admin-search" className="ma-input" type="search" value={query} maxLength={200}
      placeholder={tab === "requests" ? "მოთხოვნა, ავტორი ან ID" : tab === "offers" ? "შეთავაზება, კომპანია ან მოთხოვნა" : "სახელი, კომპანია, ელფოსტა ან ნომერი"}
      onChange={event => onChange("q", event.target.value)} /></div>
    {tab === "users" ? <div><label htmlFor="admin-role">როლი</label><select id="admin-role" className="ma-select" value={role} onChange={event => onChange("role", event.target.value)}>
      <option value="">ყველა როლი</option><option value="client">კლიენტი</option><option value="company">კომპანია</option><option value="admin">ადმინისტრატორი</option>
    </select></div> : null}
    <div><label htmlFor="admin-status">სტატუსი</label><select id="admin-status" className="ma-select" value={status} onChange={event => onChange("status", event.target.value)}>
      <option value="">ყველა სტატუსი</option>{states.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></div>
  </div>;
}
