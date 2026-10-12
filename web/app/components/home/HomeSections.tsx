import Link from "next/link";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { formatNumber } from "../../lib/format";
import { buyerSteps, homeFaq, homeRules } from "../../lib/home-data";
import styles from "./HomeSections.module.css";

export type HomeStatsData = { openRequests: number; verifiedCompanies: number; offersSent: number; completedDeals: number };

/** Live counters under the hero; zero counters are left out, and the band hides below two. */
export function HomeStats({ stats }: { stats?: HomeStatsData | null }) {
  const items = stats ? ([
    ["openRequests", "ღია მოთხოვნა", "/requests/"],
    ["verifiedCompanies", "ვერიფიცირებული კომპანია", "/companies/"],
    ["offersSent", "გაგზავნილი შეთავაზება", null],
    ["completedDeals", "დასრულებული გარიგება", null],
  ] as const).filter(([key]) => Number(stats[key]) > 0) : [];
  if (items.length < 2) return null;
  return <section className={styles.stats} aria-label="MeetAny რიცხვებში"><dl className={`home-wrap ${styles.statsList}`} data-count={items.length}>{items.map(([key, label, href]) => <div key={key} className={styles.stat}>
    <dt>{href ? <Link href={href}>{label}</Link> : label}</dt><dd>{formatNumber(Number(stats![key]), 0)}</dd>
  </div>)}</dl></section>;
}

export function HomeHow() {
  return <section className={`${styles.block} ${styles.how}`} aria-labelledby="home-how-title"><div className="home-wrap">
    <div className="home-section-head"><h2 id="home-how-title">როგორ მუშაობს</h2><Link className="home-text-link" href="/how-it-works/">დეტალურად</Link></div>
    <ol className={styles.steps}>{buyerSteps.map(({ icon, title, text }, i) => <li key={title}><div className={styles.stepHead}><span className={styles.stepIcon}><Icon name={icon} /></span>{i < buyerSteps.length - 1 && <span className={styles.connector} />}</div><div><p className={styles.number}>0{i + 1}</p><h3>{title}</h3><p className={styles.stepText}>{text}</p></div></li>)}</ol>
  </div></section>;
}

export function HomeWhy() {
  return <section className={`home-wrap ${styles.block}`} aria-labelledby="home-why-title">
    <div className={styles.intro}><h2 id="home-why-title">რატომ MeetAny</h2><p>სამი წესი, რომელსაც საიტი ყველა გარიგებაზე იცავს.</p></div>
    <ul className={styles.rules}>{homeRules.map(({ icon, title, text }) => <li key={title}><span className={styles.ruleIcon}><Icon name={icon} /></span><h3>{title}</h3><p>{text}</p></li>)}</ul>
  </section>;
}

export function HomeFaq() {
  return <section className={`home-wrap ${styles.block} ${styles.faqBlock}`} aria-labelledby="home-faq-title">
    <div className={styles.intro}><h2 id="home-faq-title">ხშირი კითხვები</h2><p>დანარჩენი — <Link href="/how-it-works/">როგორ მუშაობს</Link> და <Link href="/terms/">წესების</Link> გვერდებზე.</p></div>
    <div className={styles.faq}>{homeFaq.map(([question, answer]) => <details key={question}><summary>{question}<Icon name="chevron-down" /></summary><p>{answer}</p></details>)}</div>
  </section>;
}

export function HomeCta() {
  return <section className={`home-wrap ${styles.cta}`} aria-labelledby="home-cta-title">
    <div><h2 id="home-cta-title">ერთი მოთხოვნა — რამდენიმე შეთავაზება</h2><p>აღწერეთ, რა გჭირდებათ, და შეადარეთ ვერიფიცირებული კომპანიების პასუხები.</p></div>
    <Button size="lg" href="/requests/new/"><Icon name="plus" />განათავსეთ მოთხოვნა</Button>
  </section>;
}
