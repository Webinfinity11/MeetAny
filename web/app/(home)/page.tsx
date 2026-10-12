import Link from "next/link";
import { connection } from "next/server";
import { loadPublicSnapshot } from "../lib/public-snapshot";
import styles from "../components/home/HomeSections.module.css";
import { HomeCta, HomeFaq, HomeHow, HomeStats, HomeWhy } from "../components/home/HomeSections";
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
  return <>
    <section className="home-hero" aria-labelledby="discovery-title">
      <div className="home-wrap hero-layout">
        <div className={`hero-copy ${styles.heroEnter}`}>
          <p className="hero-eyebrow">ბიზნესები ბიზნესებისთვის</p>
          <h1 id="discovery-title">რა სჭირდება თქვენს ბიზნესს?</h1>
          <p className="hero-subtitle">ერთი მოთხოვნა — რამდენიმე შეთავაზება. შეადარეთ ფასი და ვადა და აირჩიეთ მომწოდებელი.</p>
          <div className="hero-actions">
            <Button size="lg" href="/requests/new/"><Icon name="plus" />მოთხოვნის განთავსება</Button>
            <Button size="lg" variant="secondary" href="/requests/">ღია მოთხოვნები</Button>
          </div>
        </div>
        <HomeBusinessScene initial={initial ?? undefined} />
      </div>
    </section>
    <HomeStats stats={initial?.homeStats} />
    <section className="home-section home-wrap" aria-labelledby="requests-heading">
      <div className="home-section-head">
        <h2 id="requests-heading">ღია მოთხოვნები</h2>
        <Link className="home-text-link" href="/requests/">ყველა მოთხოვნა</Link>
      </div>
      <HomeRequests initial={initial ?? undefined} initialNow={initialNow} />
    </section>
    <HomeHow />
    <HomeWhy />
    <HomeCompanies initial={initial ?? undefined} />
    <HomeSupplier />
    <HomeFaq />
    <HomeCta />
  </>;
}
