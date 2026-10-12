import Link from "next/link";
import styles from "../components/home/HomeSections.module.css";
import { HomeSections } from "../components/home/HomeSections";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui/Button";
import { HomeBusinessScene } from "../components/HomeBusinessScene";
import { HomeRequests } from "../components/HomeLive";

export default function HomePage() {
  return <>
    <section className="home-hero" aria-labelledby="discovery-title">
      <div className="home-wrap hero-layout">
        <div className={`hero-copy ${styles.heroEnter}`}>
          <p className="hero-eyebrow">ბიზნესები ბიზნესებისთვის</p>
          <h1 id="discovery-title">რა სჭირდება შენს ბიზნესს?</h1>
          <p className="hero-subtitle">განათავსე მოთხოვნა, შეადარე შეთავაზებები და აირჩიე მომწოდებელი.</p>
          <div className="hero-actions">
            <Button size="lg" href="/requests/new/"><Icon name="plus" />მოთხოვნის განთავსება</Button>
            <Button size="lg" variant="secondary" href="/requests/">ღია მოთხოვნები</Button>
          </div>
        </div>
        <HomeBusinessScene />
      </div>
    </section>
    <section className="home-section home-wrap" aria-labelledby="requests-heading">
      <div className="home-section-head">
        <h2 id="requests-heading">ახალი მოთხოვნები</h2>
        <Link className="home-text-link" href="/requests/">ყველას ნახვა</Link>
      </div>
      <HomeRequests />
    </section>
    <HomeSections />
  </>;
}
