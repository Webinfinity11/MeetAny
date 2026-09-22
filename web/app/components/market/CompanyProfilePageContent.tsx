"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { CompanyAvatar } from "./CompanyAvatar";
import { SectionHead } from "./SectionHead";
import { TagList } from "./TagList";
import { MobileActionBar } from "./MobileActionBar";
import { CallButton } from "./CallButton";
import { statsLabel } from "./CompanyRow";
import { useMarketStore } from "../../lib/market-client";
import { categories, categoryPhoto, cities } from "../../lib/categories";
import { dateLabel } from "../../lib/format";
import { fetchPhone } from "../../lib/phones";

export function CompanyProfilePageContent() {
  const { store, ready, available } = useMarketStore();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";

  const data = useMemo(() => {
    if (!store || !ready || !available || !id) return null;
    const c = store.getCompany(id);
    if (!c) return null;
    const stats = store.companyStats(id);
    const openRequests = (store.listRequests({ ownerId: id, state: "open" }) as { id: string; title: string; quantity: number | null; unit: string | null; city: string }[]).map(
      (r) => ({ id: r.id, title: r.title, city: cities[r.city] || r.city, offerCount: store.offerCount(r.id) }),
    );
    return { c, stats, openRequests };
  }, [store, ready, available, id]);

  const [phone, setPhone] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (id) fetchPhone(id).then((p) => !cancelled && setPhone(p));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (ready && !available) return <div className="ma-page"><p role="alert">სერვისი დროებით მიუწვდომელია. სცადე თავიდან.</p></div>;

  if (!ready) {
    return (
      <div className="ma-page" aria-busy="true">
        <p role="status">იტვირთება…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="ma-page">
        <div className="ma-empty">
          <span className="ma-empty__icon">
            <Icon name="search" />
          </span>
          <h2 className="ma-empty__title">კომპანია ვერ მოიძებნა</h2>
          <Link className="ma-btn ma-btn--secondary" href="/companies/">
            კომპანიების კატალოგზე დაბრუნება
          </Link>
        </div>
      </div>
    );
  }

  const { c, stats, openRequests } = data;
  const name = c.company || c.name;
  const ctaHref = `/requests/new/?category=${encodeURIComponent(c.industry)}`;

  return (
    <div className="ma-page">
      <header
        className="r2-band ma-page-head"
        style={{ "--band-photo": `url(/assets/photos/${categoryPhoto[c.industry] || categoryPhoto.other})` } as React.CSSProperties}
      >
        <CompanyAvatar name={name} size="xl" />
        <div>
          <span className="ma-eyebrow">კომპანიის პროფილი</span>
          <h1 className="ma-h1">{name}</h1>
          <p className="ma-lead">
            {categories[c.industry] || c.industry} · {cities[c.city] || c.city}
          </p>
          <div className="ma-cluster">
            {c.verified ? (
              <span className="ma-badge ma-badge--success">
                <Icon name="check" />
                დადასტურებული
              </span>
            ) : null}
            <span>{statsLabel(stats)}</span>
          </div>
          {phone ? (
            <div className="ma-cluster">
              <CallButton phone={phone} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="ma-proto-account">
        <aside className="ma-panel r2-facts">
          <h2 className="ma-h3">ფაქტები</h2>
          <dl className="ma-kv">
            <div>
              <dt>ქალაქი</dt>
              <dd>{cities[c.city] || c.city}</dd>
            </div>
            <div>
              <dt>ემსახურება</dt>
              <dd>{(c.serviceCities || []).map((id: string) => cities[id] || id).join(", ") || "არ არის მითითებული"}</dd>
            </div>
            <div>
              <dt>წევრია</dt>
              <dd>{dateLabel(c.createdAt)}</dd>
            </div>
            {c.verifiedAt ? (
              <div>
                <dt>დადასტურებულია</dt>
                <dd>{dateLabel(c.verifiedAt)}</dd>
              </div>
            ) : null}
            <div>
              <dt>გაგზავნილი</dt>
              <dd>{stats.sent}</dd>
            </div>
            <div>
              <dt>არჩეული</dt>
              <dd>{stats.chosen}</dd>
            </div>
          </dl>
        </aside>
        <div className="ma-stack">
          <section className="r2-section">
            <SectionHead eyebrow="კომპანიის შესახებ" title="ჩვენს შესახებ" />
            <p>{c.about || "კომპანიას აღწერა ჯერ არ დაუმატებია."}</p>
          </section>
          <section className="r2-section">
            <SectionHead eyebrow="მომსახურება" title="რას გთავაზობთ" />
            <TagList items={c.offers || []} emptyLabel="შეთავაზებები ჯერ არ არის მითითებული." />
          </section>
          <section className="r2-section">
            <SectionHead eyebrow="თანამშრომლობა" title="რას ვეძებთ" />
            <TagList items={c.seeks || []} emptyLabel="საჭიროებები ჯერ არ არის მითითებული." />
          </section>
          <section className="r2-section">
            <SectionHead eyebrow="კომპანიის საჭიროებები" title="ღია მოთხოვნები" />
            {openRequests.length ? (
              <div className="ma-stack">
                {openRequests.map((r) => (
                  <article className="ma-panel" key={r.id}>
                    <Link className="ma-title ma-proto-rowtitle" href={`/requests/view/?id=${r.id}`}>
                      {r.title}
                    </Link>
                    <p className="ma-muted">
                      {r.city} · {r.offerCount} შეთავაზება
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="ma-muted">ამ კომპანიას ღია მოთხოვნა ჯერ არ აქვს.</p>
            )}
          </section>
        </div>
      </div>

      <section className="r2-cta">
        <div>
          <span className="ma-eyebrow ma-eyebrow--brand">იპოვე შესაბამისი პარტნიორი</span>
          <h2 className="ma-h2">გჭირდება {categories[c.industry] || c.industry}?</h2>
          <Link className="ma-btn ma-btn--primary" href={ctaHref}>
            მოთხოვნის დამატება ამ დარგში
          </Link>
        </div>
        <img src="/assets/photos/workshop-process-banner.jpg" alt="" width={640} height={420} />
      </section>

      <MobileActionBar label="მოთხოვნის დამატება ამ დარგში" href={ctaHref} />
    </div>
  );
}
