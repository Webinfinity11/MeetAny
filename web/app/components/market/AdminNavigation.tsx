"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import { adminSections, type AdminSection } from "../../lib/admin-sections";
import styles from "./admin.module.css";

const groups: { label: string; sections: AdminSection[] }[] = [
  { label: "ყოველდღიური მართვა", sections: ["overview", "companies", "requests", "offers", "reports"] },
  { label: "ანგარიშები და საიტი", sections: ["users", "plans", "content", "reviews"] },
  { label: "დამატებითი", sections: ["contacts", "photos", "audit"] },
];

export function AdminNavigation({ tab, reports, offersEnabled }: { tab: AdminSection; reports: number; offersEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); if (open) trigger.current?.focus(); };
  return <aside className={styles.sidebar} data-open={open || undefined} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); close(); }
  }}>
    <div className={styles.sidebarHeading}><span className={styles.workspaceIcon}><Icon name="layout-grid" /></span><div><strong>სამუშაო სივრცე</strong><span>ადმინ-პანელი</span></div></div>
    <button ref={trigger} type="button" className={styles.mobileNavigation} aria-expanded={open} aria-controls="admin-section-navigation" onClick={() => setOpen(value => !value)}>
      <Icon name="menu" /><span><small>განყოფილება</small><strong>{adminSections[tab].label}</strong></span><Icon name="chevron-down" />
    </button>
    <nav id="admin-section-navigation" className={styles.navigation} aria-label="ადმინისტრირების განყოფილებები">
      {groups.map(group => <div className={styles.navGroup} key={group.label}>
        <p>{group.label}</p>
        {group.sections.filter(key => key !== "offers" || offersEnabled || tab === "offers").map(key => <Link key={key} href={key === "overview" ? "/admin/" : `/admin/?tab=${key}`} onClick={close} aria-current={key === tab ? "page" : undefined}>
          <Icon name={adminSections[key].icon} /><span>{adminSections[key].label}</span>
          {key === "reports" && reports > 0 ? <b className={styles.navBadge} aria-label={`${reports} ახალი`}>{reports}</b> : null}
        </Link>)}
      </div>)}
    </nav>
    <Link className={styles.backToSite} href="/"><Icon name="arrow-left" />საიტზე დაბრუნება</Link>
  </aside>;
}
