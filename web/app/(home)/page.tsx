import Link from "next/link";
import { Icon } from "../components/Icon";
import { DiscoverySearch } from "../components/DiscoverySearch";
import { industries, sectors } from "../lib/home-data";

export default function HomePage() {
  return (
    <>
      <section className="home-discovery editorial-discovery" aria-labelledby="discovery-title">
        <div className="discovery-intro">
          <span className="discovery-kicker">MeetAny — ბიზნესკავშირები საქართველოში</span>
          <h1 id="discovery-title">
            იპოვე ყველაფერი,
            <br />
            <span>რაც შენს ბიზნესს სჭირდება.</span>
          </h1>
        </div>
        <DiscoverySearch />
      </section>

      <section className="category-section" aria-labelledby="category-heading">
        <div className="section-heading">
          <div>
            <span className="section-kicker">დაიწყე საჭიროებით</span>
            <h2 id="category-heading">რა სჭირდება შენს ბიზნესს?</h2>
          </div>
          <Link className="text-link" href="/companies/">
            კატალოგის ნახვა <Icon name="arrow-right" />
          </Link>
        </div>
        {/* Populated client-side by app.js (site/dist/app.js), unchanged — matches site/dist/index.html.
            dangerouslySetInnerHTML keeps React from diffing children app.js owns after mount. */}
        <div className="category-grid" id="category-grid" dangerouslySetInnerHTML={{ __html: "" }} />
      </section>

      <section className="industry-section" id="industries" aria-labelledby="industry-heading">
        <div className="industry-heading-row">
          <h2 id="industry-heading">კატეგორიები</h2>
          <Link className="textlink" href="/companies/">
            <span>
              ყველა კატეგორია (<span data-category-total>12</span>)
            </span>
            <Icon name="arrow-right" />
          </Link>
        </div>
        <ul className="industry-list" id="industry-list" aria-label="საქმიანობის მიმართულებები">
          {industries.map((ind) => (
            <li key={ind.id}>
              <Link href={`/companies/?industry=${ind.id}`} aria-label={ind.name}>
                <span className="industry-icon industry-object" aria-hidden="true">
                  <img
                    src="/assets/industry-objects.png"
                    alt=""
                    style={{ "--object-x": ind.x, "--object-y": ind.y } as React.CSSProperties}
                    decoding="async"
                    loading="lazy"
                  />
                </span>
                <span className="industry-title tt">{ind.title}</span>
                <span className="industry-count" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="market-sectors">
        <div className="section-heading">
          <h2>მიმართულებები შენი ბიზნესისთვის</h2>
          <Link className="text-link" href="/companies/">
            ყველა კატეგორია ↗
          </Link>
        </div>
        <div className="market-sector-grid">
          {sectors.map((s) => (
            <Link key={s.photo} href="/companies/">
              <img src={`/assets/photos/${s.photo}`} alt="" width={640} height={420} loading="lazy" />
              <span>
                {s.label} <b aria-hidden="true">↗</b>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="featured-section" aria-labelledby="featured-heading">
        <div className="section-heading">
          <div>
            <span className="section-kicker">კომპანიების კატალოგიდან</span>
            <h2 id="featured-heading">აღმოაჩინე შენი შემდეგი პარტნიორი</h2>
            <p className="section-description">
              გაეცანი მომსახურებას, შეადარე პირობები და აირჩიე შენთვის შესაფერისი კომპანია.
            </p>
          </div>
          <Link className="text-link" href="/companies/">
            ყველა კომპანია <Icon name="arrow-right" />
          </Link>
        </div>
        {/* Populated client-side by market.js's renderLegacyHome() (site/dist/market.js), unchanged.
            dangerouslySetInnerHTML keeps React from diffing children market.js owns after mount. */}
        <div className="company-grid" id="featured-companies" dangerouslySetInnerHTML={{ __html: "" }} />
      </section>

      <section className="partnership-banner" aria-labelledby="partnership-heading">
        <img
          src="/assets/photos/workshop-process-banner.jpg"
          alt="სამუშაო მაგიდაზე თიხის ხელით დამუშავება და კერამიკის ხელსაწყოები"
          width={1600}
          height={1067}
          loading="lazy"
          decoding="async"
        />
        <div className="partnership-banner-content">
          <span className="banner-eyebrow"> ადამიანები საქმიანი კავშირების მიღმა</span>
          <h2 id="partnership-heading">დიდი საქმე კარგი პარტნიორის პოვნით იწყება.</h2>
          <Link className="button banner-action" href="/companies/">
            იპოვე პარტნიორი <Icon name="arrow-right" />
          </Link>
        </div>
      </section>

      <section className="editorial-process">
        <div className="editorial-process-label">როგორ მუშაობს MeetAny</div>
        <ol className="discovery-steps" id="how" aria-label="როგორ მუშაობს MeetAny">
          <li>
            <div className="discovery-step-heading">
              <span className="discovery-step-number">01</span>
              <span className="discovery-step-line" aria-hidden="true" />
            </div>
            <div className="process-symbol" aria-hidden="true">
              <Icon name="search" />
            </div>
            <h2>მოძებნე კომპანია</h2>
            <p>აღწერე საჭიროება ან აირჩიე მიმართულება.</p>
          </li>
          <li>
            <div className="discovery-step-heading">
              <span className="discovery-step-number">02</span>
              <span className="discovery-step-line" aria-hidden="true" />
            </div>
            <div className="process-symbol" aria-hidden="true">
              <Icon name="building-2" />
            </div>
            <h2>გაეცანი შეთავაზებებს</h2>
            <p>ნახე კომპანიის პროფილი, ფოტოები და პირობები.</p>
          </li>
          <li>
            <div className="discovery-step-heading">
              <span className="discovery-step-number">03</span>
              <span className="discovery-step-line" aria-hidden="true" />
            </div>
            <div className="process-symbol" aria-hidden="true">
              <Icon name="clipboard-list" />
            </div>
            <h2>აღწერე შენი საჭიროება</h2>
            <p>მოკლედ ჩამოაყალიბე, რა გჭირდება პარტნიორისგან.</p>
          </li>
        </ol>
      </section>
    </>
  );
}
