import Link from "next/link";
import { DiscoverySearch } from "../components/DiscoverySearch";
import { Icon } from "../components/Icon";
import { HomeCategories, HomeIndustries, HomeFeatured, HomeRequestStarter, HomeJoin, HomeStats } from "../components/HomeLive";

// Frames of need-process-icons.png (3 across): magnifier + chat, company documents, document + pen.
const steps = [
  { frame: 0, title: "მოძებნე ან აღწერე", text: "იპოვე კომპანია დარგითა და ქალაქით, ან გამოაქვეყნე, რა გჭირდება." },
  { frame: 1, title: "გაეცანი შეთავაზებებს", text: "ნახე კომპანიების პროფილები, პირობები და მიწოდების ვადები." },
  { frame: 2, title: "შეთანხმდი პირდაპირ", text: "აირჩიე საუკეთესო შეთავაზება, მიწერე ან დაურეკე კომპანიას." },
];

// Home (owner decision 2026-09-30): the v1 composition — solid brand-blue hero with the search and the
// three illustrated steps, photo-first cards — refined with Airbnb's type, search and card rules.
export default function HomePage() {
  return <>
    <section className="home-hero" aria-labelledby="discovery-title">
      <div className="home-wrap">
        <p className="hero-context">MeetAny · ბიზნესკავშირები საქართველოში</p>
        <h1 id="discovery-title">აღწერე, რა გჭირდება.<br />იპოვე შესაბამისი კომპანია.</h1>
        <DiscoverySearch />
        <HomeStats />
        <ol className="hero-steps" id="how" aria-label="როგორ მუშაობს">
          {steps.map((step, index) => <li key={step.title}>
            <span className="hero-steps__number">0{index + 1}</span>
            <span className="hero-steps__art" aria-hidden="true" style={{ backgroundPosition: `${step.frame * 50}% 50%` }} />
            <h2>{step.title}</h2>
            <p>{step.text}</p>
          </li>)}
        </ol>
      </div>
    </section>

    <div className="home-wrap"><HomeIndustries /></div>

    <section className="home-section home-wrap" aria-labelledby="types-heading">
      <div className="home-section-head">
        <h2 id="types-heading">რა სჭირდება შენს ბიზნესს?</h2>
        <Link className="home-text-link" href="/companies/">კატალოგის ნახვა<Icon name="arrow-right" /></Link>
      </div>
      <HomeCategories />
    </section>

    <section className="home-section home-wrap" aria-labelledby="featured-heading">
      <div className="home-section-head">
        <h2 id="featured-heading">გაიცანი კომპანიები</h2>
        <Link className="home-text-link" href="/companies/">ყველა კომპანია<Icon name="arrow-right" /></Link>
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
