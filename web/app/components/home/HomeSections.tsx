import Link from "next/link";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { formatNumber } from "../../lib/format";
import { buyerSteps, homeFaq, homeRules } from "../../lib/home-data";
import styles from "./HomeSections.module.css";

export type HomeStatsData = { openRequests: number; verifiedCompanies: number; offersSent: number; completedDeals: number };

type StatKey = keyof HomeStatsData;
/** Real counters only (home_stats); a zero counter is left out rather than shown. */
const counted = (stats: HomeStatsData | null | undefined, keys: StatKey[]) => stats ? keys.filter(key => Number(stats[key]) > 0).map(key => [key, Number(stats[key])] as const) : [];

/** Existing real counters follow the hero copy in normal document flow. */
export function HomeHeroStats({ stats }: { stats?: HomeStatsData | null }) {
  const labels: Partial<Record<StatKey, [string, string]>> = { verifiedCompanies: ["building-2", "ვერიფიცირებული კომპანია"], offersSent: ["inbox", "გაგზავნილი შეთავაზება"] };
  const items = counted(stats, ["verifiedCompanies", "offersSent"]);
  if (!items.length) return null;
  return <ul className={styles.heroStats} aria-label="MeetAny რიცხვებში">{items.map(([key, value]) => <li key={key} className={styles.heroStat}>
    <span className={styles.heroStatIcon}><Icon name={labels[key]![0]} /></span><strong>{formatNumber(value, 0)}</strong><span>{labels[key]![1]}</span>
  </li>)}</ul>;
}

/** Under the hero: the two ways in (buyer / supplier). Each card carries the one live number that backs it
 *  (completed deals for buyers, open requests for suppliers) instead of a separate counter column. */
export function HomeAudience({ stats }: { stats?: HomeStatsData | null }) {
  const [deals] = counted(stats, ["completedDeals"]);
  const [open] = counted(stats, ["openRequests"]);
  return <section className={`home-wrap ${styles.audience}`} aria-label="ვისთვის არის MeetAny">
    <Link className={styles.path} href="/requests/new/">
      <span className={styles.pathIcon}><Icon name="building-2" /></span>
      <span className={styles.pathCopy}><strong>მჭირდება მომწოდებელი ან პარტნიორი</strong><span>აღწერეთ საჭიროება და მიიღეთ შეთავაზებები გადამოწმებული კომპანიებისგან.</span>
        {deals && <span className={styles.pathProof}><b>{formatNumber(deals[1], 0)}</b> დასრულებული გარიგება</span>}</span>
      <Icon name="arrow-right" className={styles.pathArrow} />
    </Link>
    <Link className={`${styles.path} ${styles.pathSupplier}`} href="/requests/">
      <span className={styles.pathIcon}><Icon name="users" /></span>
      <span className={styles.pathCopy}><strong>ვეძებ კლიენტებს</strong><span>ნახეთ, რა სჭირდებათ ბიზნესებს, და გაუგზავნეთ შეთავაზება.</span>
        {open && <span className={`${styles.pathProof} ${styles.pathLive}`}><b>{formatNumber(open[1], 0)}</b> ღია მოთხოვნა ახლა</span>}</span>
      <Icon name="arrow-right" className={styles.pathArrow} />
    </Link>
  </section>;
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
