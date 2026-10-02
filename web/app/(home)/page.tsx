import Link from "next/link";
import { DiscoverySearch } from "../components/DiscoverySearch";
import { Icon } from "../components/Icon";
import { HomeBusinessScene } from "../components/HomeBusinessScene";
import { HomeHeroText, HomeSectionHeading, HomeIndustries, HomeRequests, HomeFeatured, HomeRequestStarter, HomeJoin } from "../components/HomeLive";

export default function HomePage() {
  return <>
    <section className="home-hero" aria-labelledby="discovery-title">
      <div className="home-wrap">
        <div className="hero-layout">
          <div className="hero-copy">
            <HomeHeroText />
            <DiscoverySearch />
          </div>
          <HomeBusinessScene />
        </div>
      </div>
    </section>

    <div className="home-wrap"><HomeIndustries /></div>

    <section className="home-section home-wrap" aria-labelledby="requests-heading">
      <div className="home-section-head">
        <HomeSectionHeading section="requests" />
        <Link className="home-text-link" href="/requests/">ყველა მოთხოვნა<Icon name="clipboard-list" /></Link>
      </div>
      <HomeRequests />
    </section>

    <section className="home-section home-wrap" aria-labelledby="featured-heading">
      <div className="home-section-head">
        <HomeSectionHeading section="companies" />
        <Link className="home-text-link" href="/companies/">ყველა კომპანია<Icon name="building-2" /></Link>
      </div>
      <HomeFeatured />
    </section>

    <section className="home-request-start home-wrap" aria-labelledby="request-start-heading">
      <div><h2 id="request-start-heading">ვერ იპოვე? აღწერე, რა გჭირდება</h2><p>გამოაქვეყნე მოთხოვნა და შესაბამისი კომპანიები თავად შემოგთავაზებენ პირობებს.</p></div>
      <HomeRequestStarter />
    </section>

    <HomeJoin />
  </>;
}
