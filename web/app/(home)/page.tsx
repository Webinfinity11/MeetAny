import Link from "next/link";
import { DiscoverySearch } from "../components/DiscoverySearch";
import { HomeCategories, HomeIndustries, HomeFeatured, HomeRequestStarter, HomeJoin } from "../components/HomeLive";

export default function HomePage() {
  return <>
    <section className="home-hero" aria-labelledby="discovery-title">
      <div className="home-wrap hero-layout">
        <div className="hero-copy">
          <p className="hero-context">ბიზნესკავშირები საქართველოში</p>
          <h1 id="discovery-title">იპოვე მომწოდებელი<br /><span>შენი ბიზნესისთვის.</span></h1>
          <p className="hero-description">მოძებნე მომწოდებელი, გამოაქვეყნე მოთხოვნა ან იპოვე ახალი შეკვეთა შენი კომპანიისთვის.</p>
          <DiscoverySearch />
          <div className="hero-request"><span>უკვე იცი, რა გჭირდება?</span><Link href="/requests/new/">გამოაქვეყნე მოთხოვნა</Link></div>
        </div>
        <figure className="hero-photo">
          <img src="/assets/photos/warehouse-team.jpg" alt="საწყობის თანამშრომლები ამზადებენ პროდუქციის მიწოდებას" width={1200} height={800} fetchPriority="high" />
          <figcaption><span>პროდუქცია და მომსახურება</span><p>მოძებნე კომპანია.<br />დაუკავშირდი პირდაპირ.</p></figcaption>
        </figure>
      </div>
    </section>

    <section className="home-needs" aria-label="აირჩიე ბიზნესპარტნიორის ტიპი"><div className="home-wrap"><HomeCategories /></div></section>

    <section className="home-request-start home-wrap" aria-labelledby="request-start-heading">
      <div><span className="home-overline">თუ მომწოდებელს ეძებ</span><h2 id="request-start-heading">აღწერე,<br />რა გჭირდება.</h2><p>გამოაქვეყნე მოთხოვნა, რომ კომპანიებმა თავიანთი პროდუქტი ან მომსახურება შემოგთავაზონ.</p></div>
      <HomeRequestStarter />
    </section>

    <section className="home-partners home-wrap" aria-labelledby="featured-heading">
      <div className="home-section-head"><div><span className="home-overline">კომპანიების კატალოგი</span><h2 id="featured-heading">მომწოდებლები და<br />მომსახურების კომპანიები.</h2></div><div><p>ნახე, რას სთავაზობს კომპანია და რომელ ქალაქებში მუშაობს. დეტალების დასაზუსტებლად დაუკავშირდი პირდაპირ.</p><Link className="home-text-link" href="/companies/">ყველა კომპანია</Link></div></div>
      <HomeFeatured />
    </section>

    <section className="home-industries" id="industries" aria-labelledby="industry-heading"><div className="home-wrap industries-layout">
      <div className="industries-intro"><span className="home-overline">მიმართულებები</span><h2 id="industry-heading">აირჩიე<br />საქმიანობის სფერო.</h2><p>მოძებნე პარტნიორი საქმიანობის სფეროს მიხედვით.</p><Link className="home-text-link" href="/companies/">სრული კატალოგი</Link></div>
      <HomeIndustries />
    </div></section>

    <section className="home-process home-wrap" id="how" aria-labelledby="process-heading">
      <div className="process-photo"><img src="/assets/photos/business-collaboration.jpg" alt="ბიზნესგუნდი სამუშაო შეხვედრაზე განიხილავს გეგმებს" width={1200} height={800} loading="lazy" /></div>
      <div className="process-content"><span className="home-overline">თუ მომწოდებელს ეძებ</span><h2 id="process-heading">როგორ მიიღო<br />შეთავაზებები.</h2>
        <div className="process-steps">
          <details open><summary><span>01</span><h3>გამოაქვეყნე მოთხოვნა</h3></summary><div><p>მიუთითე პროდუქტი ან მომსახურება, რაოდენობა, ქალაქი და სასურველი ვადა.</p><Link href="/requests/new/">მოთხოვნის გამოქვეყნება</Link></div></details>
          <details><summary><span>02</span><h3>გაეცანი შეთავაზებებს</h3></summary><div><p>შენს მოთხოვნაზე მიღებული შეთავაზებები ანგარიშში გამოჩნდება. შეადარე პირობები და გაეცანი კომპანიების პროფილებს.</p></div></details>
          <details><summary><span>03</span><h3>დაუკავშირდი კომპანიას</h3></summary><div><p>მიწერე ან დაურეკე კომპანიას, დააზუსტე დეტალები და დაიწყე თანამშრომლობა.</p></div></details>
        </div>
      </div>
    </section>

    <HomeJoin />
  </>;
}
