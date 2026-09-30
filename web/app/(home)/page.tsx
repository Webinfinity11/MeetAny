import Link from "next/link";
import { DiscoverySearch } from "../components/DiscoverySearch";
import { Icon } from "../components/Icon";
import { HomeBusinessScene } from "../components/HomeBusinessScene";
import { HomeIndustries, HomeRequests, HomeFeatured, HomeRequestStarter, HomeJoin } from "../components/HomeLive";

const steps = [
  { frame: 0, title: "მოძებნე ან აღწერე", text: "რა სჭირდება შენს ბიზნესს" },
  { frame: 1, title: "შეადარე პირობები", text: "შენთვის სასურველი შეთავაზებები" },
  { frame: 2, title: "დაიწყე თანამშრომლობა", text: "დაუკავშირდი კომპანიას პირდაპირ" },
];

export default function HomePage() {
  return <>
    <section className="home-hero" aria-labelledby="discovery-title">
      <div className="home-wrap">
        <div className="hero-layout">
          <div className="hero-copy">
            <h1 id="discovery-title">შენი შემდეგი<br /><span>ბიზნესპარტნიორი აქაა.</span></h1>
            <p className="hero-description">იპოვე მომწოდებელი, მიიღე შეთავაზებები და დაიწყე თანამშრომლობა.</p>
            <DiscoverySearch />
          </div>
          <HomeBusinessScene />
        </div>
        <ol className="hero-steps" id="how" aria-label="როგორ მუშაობს">
          {steps.map((step, index) => <li key={step.title}>
            <span className="hero-steps__art" aria-hidden="true" style={{ backgroundPosition: `${step.frame * 50}% 50%` }} />
            <span className="hero-steps__text">
              <h2>{step.title}</h2>
              <span>{step.text}</span>
            </span>
            <span className="hero-steps__number" aria-hidden="true">0{index + 1}</span>
          </li>)}
        </ol>
      </div>
    </section>

    <div className="home-wrap"><HomeIndustries /></div>

    <section className="home-section home-wrap" aria-labelledby="requests-heading">
      <div className="home-section-head">
        <h2 id="requests-heading">ახალი მოთხოვნები</h2>
        <Link className="home-text-link" href="/requests/">ყველა მოთხოვნა<Icon name="clipboard-list" /></Link>
      </div>
      <HomeRequests />
    </section>

    <section className="home-section home-wrap" aria-labelledby="featured-heading">
      <div className="home-section-head">
        <h2 id="featured-heading">გაიცანი კომპანიები</h2>
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
