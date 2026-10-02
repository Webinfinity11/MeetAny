"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import { adminSections, type AdminSection } from "../../lib/admin-sections";
import styles from "./admin.module.css";

const sections: AdminSection[] = [
  "overview", "companies", "requests", "offers", "users", "reports",
  "reviews", "content", "contacts", "photos", "audit",
];

export function AdminNavigation({ tab, reports, offersEnabled }: { tab: AdminSection; reports: number; offersEnabled: boolean }) {
  const section = tab === "plans" ? "companies" : tab;
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); if (open) trigger.current?.focus(); };
  return <aside className={styles.sidebar} data-open={open || undefined} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); close(); }
  }}>
    <button ref={trigger} type="button" className={styles.mobileNavigation} aria-label={`ადმინის მენიუ: ${adminSections[section].label}`} aria-expanded={open} aria-controls="admin-section-navigation" onClick={() => setOpen(value => !value)}>
      <Icon name="menu" /><strong>{adminSections[section].label}</strong><Icon name="chevron-down" />
    </button>
    <nav id="admin-section-navigation" className={styles.navigation} aria-label="ადმინისტრირების განყოფილებები">
      {sections.filter(key => key !== "offers" || offersEnabled || tab === "offers").map(key => <Link key={key} href={key === "overview" ? "/admin/" : `/admin/?tab=${key}`} onClick={close} aria-current={key === section ? "page" : undefined}>
          <Icon name={adminSections[key].icon} /><span>{adminSections[key].label}</span>
          {key === "reports" && reports > 0 ? <b className={styles.navBadge} aria-label={`${reports} ახალი`}>{reports}</b> : null}
        </Link>)}
    </nav>
    <Link className={styles.backToSite} href="/"><Icon name="arrow-left" />საიტზე დაბრუნება</Link>
  </aside>;
}
