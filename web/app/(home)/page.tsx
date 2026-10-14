import { JsonLd } from "../components/JsonLd";
import { siteUrl } from "../lib/site-url";
import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { loadPublicSnapshot } from "../lib/public-snapshot";
import styles from "../components/home/HomeSections.module.css";
import { HomeAudience, HomeCta, HomeFaq, HomeHeroStats, HomeHow, HomeWhy } from "../components/home/HomeSections";
import { HomeSupplier } from "../components/home/HomeSupplier";
import { HomeCompanies } from "../components/home/HomeCompanies";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui/Button";
import { HomeBusinessScene } from "../components/HomeBusinessScene";
import { HomeRequests } from "../components/HomeLive";

// The public snapshot seeds the live sections (as on /requests/), so new requests, companies and
// the counters ship in the first HTML instead of skeletons that wait for hydration and /bootstrap.
export default async function HomePage() {
  await connection();
  const initial = await loadPublicSnapshot();
  // eslint-disable-next-line react-hooks/purity
  const initialNow = Date.now();
  const stats = initial?.homeStats;
  return <>
    <section className="home-hero" aria-labelledby="discovery-title">
      <div className="home-wrap hero-layout">
        <div className={`hero-copy ${styles.heroEnter}`}>
          <p className="hero-eyebrow">ბიზნესები ბიზნესებისთვის</p>
          <h1 id="discovery-title">დაწერეთ, რა სჭირდება თქვენს ბიზნესს. <span>მიიღეთ შეთავაზებები რეალური კომპანიებისგან.</span></h1>
          <p className="hero-subtitle">ერთი მოთხოვნა — რამდენიმე შეთავაზება. შეადარეთ ფასი, ვადა და პირობები და აირჩიეთ მომწოდებელი.</p>
          <div className="hero-actions">
            <Button size="lg" href="/requests/new/"><Icon name="plus" />მოთხოვნის განთავსება</Button>
            <Button size="lg" variant="secondary" href="/requests/">ღია მოთხოვნები<Icon name="arrow-right" /></Button>
          </div>
          <ul className="hero-trust">
            <li><Icon name="badge-check" />გადამოწმებული კომპანიები</li>
            <li><Icon name="wallet" />განთავსება უფასოა</li>
            <li><Icon name="lock" />კონტაქტი — არჩევის შემდეგ</li>
          </ul>
          <HomeHeroStats stats={stats} />
        </div>
        {/* One photo, reserved by aspect-ratio (no layout shift) and preloaded from <head>: it is the LCP
            on every viewport. (fetchPriority="high" was measured too: it raced the CSS and fonts and delayed FCP by ~150 ms.)
            Phones get the 640w file (about 2× density, 22 KB) instead of 1080w: on a slow line every KB is LCP time. */}
        <div className="hero-media">
          <Image src="/assets/photos/hero-partners.jpg" alt="" fill preload sizes="(max-width: 639px) 50vw, (max-width: 1023px) calc(100vw - 48px), 600px" />
        </div>
      </div>
    </section>
    <HomeAudience stats={stats} />
    <section className="home-section home-wrap" aria-labelledby="requests-heading">
      <div className="home-section-head">
        <h2 id="requests-heading">ახალი მოთხოვნები</h2>
        <Link className="home-text-link" href="/requests/">ყველა მოთხოვნა<Icon name="arrow-right" /></Link>
      </div>
      <HomeRequests initial={initial ?? undefined} initialNow={initialNow} />
    </section>
    <section className={`home-wrap ${styles.block} ${styles.live}`} aria-labelledby="live-title">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>ახლა MeetAny-ზე</p>
        <h2 id="live-title">მოთხოვნა იწერება — შეთავაზებები მოდის</h2>
        <p>ბიზნესები აქვეყნებენ, რა სჭირდებათ, და გადამოწმებული კომპანიები პასუხობენ ფასითა და ვადით. შეთავაზებებს მხოლოდ მოთხოვნის ავტორი ხედავს.</p>
      </div>
      <HomeBusinessScene initial={initial ?? undefined} />
    </section>
    <HomeHow />
    <HomeWhy />
    <HomeCompanies initial={initial ?? undefined} />
    <HomeSupplier />
    <HomeFaq />
    <HomeCta />
    <JsonLd data={{ "@context": "https://schema.org", "@graph": [
      { "@type": "WebSite", name: "MeetAny", url: `${siteUrl()}/`, potentialAction: {
        "@type": "SearchAction", target: `${siteUrl()}/requests/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      } },
      { "@type": "Organization", name: "MeetAny", url: `${siteUrl()}/`, logo: `${siteUrl()}/assets/favicon.png` },
    ] }} />
  </>;
}
