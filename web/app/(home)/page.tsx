import Link from "next/link";
import { DiscoverySearch } from "../components/DiscoverySearch";
import { Icon } from "../components/Icon";
import { HomeCategories, HomeIndustries, HomeFeatured, HomeRequestStarter, HomeJoin, HomeStats } from "../components/HomeLive";

const steps = [
  { icon: "file-text", title: "გამოაქვეყნე მოთხოვნა", text: "მიუთითე პროდუქტი ან მომსახურება, რაოდენობა, ქალაქი და სასურველი ვადა." },
  { icon: "inbox", title: "მიიღე შეთავაზებები", text: "შესაბამისი კომპანიები თავად გამოგიგზავნიან პირობებს. შეადარე და გაეცანი პროფილებს." },
  { icon: "handshake", title: "დაუკავშირდი პირდაპირ", text: "აირჩიე საუკეთესო შეთავაზება, მიწერე ან დაურეკე და დაიწყე თანამშრომლობა." },
];

export default function HomePage() {
  return <>
    <section className="home-hero" aria-labelledby="discovery-title">
      <div className="home-wrap hero-layout">
        <div className="hero-copy">
          <p className="hero-context">ბიზნესკავშირები საქართველოში</p>
          <h1 id="discovery-title">იპოვე მომწოდებელი<br /><span>შენი ბიზნესისთვის.</span></h1>
          <p className="hero-description">მოძებნე კომპანია, გამოაქვეყნე მოთხოვნა ან იპოვე ახალი შეკვეთა — ერთ სივრცეში.</p>
          <DiscoverySearch />
          <HomeStats />
        </div>
        <figure className="hero-photo">
          <img src="/assets/photos/warehouse-team.jpg" alt="საწყობის თანამშრომლები ამზადებენ პროდუქციის მიწოდებას" width={1200} height={800} fetchPriority="high" />
          <figcaption>
            <span className="hero-photo__badge"><Icon name="circle-check" />პირდაპირი კონტაქტი</span>
            <p>შუამავლის გარეშე — დაუკავშირდი კომპანიას პირდაპირ.</p>
          </figcaption>
        </figure>
      </div>
    </section>

    <section className="home-needs home-wrap" aria-label="აირჩიე ბიზნესპარტნიორის ტიპი"><HomeCategories /></section>

    <section className="home-section home-wrap" aria-labelledby="featured-heading">
      <div className="home-section-head">
        <div><p className="home-overline">კომპანიების კატალოგი</p><h2 id="featured-heading">მომწოდებლები და მომსახურება</h2></div>
        <Link className="home-text-link" href="/companies/">ყველა კომპანია<Icon name="arrow-right" /></Link>
      </div>
      <HomeFeatured />
    </section>

    <section className="home-section home-wrap" id="industries" aria-labelledby="industry-heading">
      <div className="home-section-head">
        <div><p className="home-overline">მიმართულებები</p><h2 id="industry-heading">აირჩიე საქმიანობის სფერო</h2></div>
        <Link className="home-text-link" href="/companies/">სრული კატალოგი<Icon name="arrow-right" /></Link>
      </div>
      <HomeIndustries />
    </section>

    <section className="home-section home-wrap" id="how" aria-labelledby="process-heading">
      <div className="home-section-head home-section-head--center">
        <div><p className="home-overline">როგორ მუშაობს</p><h2 id="process-heading">სამი ნაბიჯი შეთავაზებამდე</h2></div>
      </div>
      <ol className="home-steps">
        {steps.map((step, index) => <li key={step.title}>
          <span className="home-steps__icon" aria-hidden="true"><Icon name={step.icon} /></span>
          <span className="home-steps__number">0{index + 1}</span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </li>)}
      </ol>
    </section>

    <section className="home-request-start home-wrap" aria-labelledby="request-start-heading">
      <div><p className="home-overline">თუ მომწოდებელს ეძებ</p><h2 id="request-start-heading">აღწერე, რა გჭირდება</h2><p>გამოაქვეყნე მოთხოვნა და კომპანიები თავად შემოგთავაზებენ თავიანთ პროდუქტს ან მომსახურებას.</p></div>
      <HomeRequestStarter />
    </section>

    <HomeJoin />
  </>;
}
