import Link from "next/link";
import { DiscoverySearch } from "../components/DiscoverySearch";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui/Button";
import { HomeBusinessScene } from "../components/HomeBusinessScene";
import { HomeRequests } from "../components/HomeLive";

export default function HomePage() {
  return <>
    <section className="home-hero" aria-labelledby="discovery-title">
      <div className="home-wrap hero-layout">
        <div className="hero-copy">
          <p className="hero-eyebrow">BUSINESSES CONNECT. OPPORTUNITIES GROW.</p>
          <h1 id="discovery-title">დაწერე, რა სჭირდება შენს ბიზნესს.</h1>
          <p className="hero-subtitle">მიიღე შეთავაზებები რეალური კომპანიებისგან.</p>
          <p className="hero-description">ერთი მოთხოვნა — რამდენიმე ბიზნეს შეთავაზება. შეადარე, აირჩიე საუკეთესო და დაუკავშირდი პირდაპირ.</p>
          <div className="hero-actions">
            <Button size="lg" href="/requests/new/"><Icon name="plus" />მოთხოვნის განთავსება</Button>
            <Button size="lg" variant="secondary" href="/requests/">შესაძლებლობების ნახვა</Button>
          </div>
          <DiscoverySearch />
        </div>
        <HomeBusinessScene />
      </div>
    </section>
    <section className="home-section home-wrap" aria-labelledby="requests-heading">
      <div className="home-section-head">
        <h2 id="requests-heading">ბოლოდროინდელი შესაძლებლობები</h2>
        <Link className="home-text-link" href="/requests/">ყველას ნახვა</Link>
      </div>
      <HomeRequests />
    </section>
  </>;
}
