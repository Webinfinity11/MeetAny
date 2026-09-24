"use client";

import { AccountSkeleton } from "./Skeletons";

import { EngagementPanel } from "./EngagementPanels";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "../Toasts";
import { Icon } from "../Icon";
import { PageBand } from "./PageBand";
import { CompanyAvatar } from "./CompanyAvatar";
import { AuthForms } from "./AuthForms";
import { ConversationList } from "./ChatPopup";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";

type AnyUser = {
  id: string;
  role: string;
  name: string;
  company?: string;
  phone: string;
  email: string;
  city: string;
  industry?: string;
  verified: boolean;
  blocked: boolean;
  about?: string;
  offers?: string[];
  seeks?: string[];
  serviceCities?: string[];
};

function ProfileForm({ me, onSaved }: { me: AnyUser; onSaved: () => void }) {
  const { store } = useMarketStore();
  const isCompany = me.role === "company";
  const [name, setName] = useState(me.name);
  const [company, setCompany] = useState(me.company || "");
  const [city, setCity] = useState(me.city);
  const [industry, setIndustry] = useState(me.industry || "");
  const [about, setAbout] = useState(me.about || "");
  const [offers, setOffers] = useState((me.offers || []).join("\n"));
  const [seeks, setSeeks] = useState((me.seeks || []).join("\n"));
  const [serviceCities, setServiceCities] = useState<string[]>(me.serviceCities || []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    setPending(true);
    setError(null);
    try {
      await store.updateProfile({ name, company, city, industry, about, offers, seeks, serviceCities });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "ვერ შესრულდა.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="ma-panel">
      <h2 className="ma-h3">{isCompany ? "კომპანიის პროფილი" : "პროფილი"}</h2>
      <p className="ma-lead">{isCompany ? "ეს ინფორმაცია ჩანს საჯარო პროფილზე და კომპანიების კატალოგში." : "სახელი და კომპანია ჩანს შენს მოთხოვნებზე."}</p>
      <form className="ma-form" onSubmit={submit}>
        <div className="ma-form__row ma-form__row--2">
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="name">
              სახელი და გვარი *
            </label>
            <input className="ma-input" id="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="company">
              კომპანიის დასახელება{isCompany ? " *" : ""}
            </label>
            <input className="ma-input" id="company" required={isCompany} maxLength={100} value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
        </div>
        <div className="ma-form__row ma-form__row--2">
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="profile-city">
              ქალაქი *
            </label>
            <select className="ma-select" id="profile-city" value={city} onChange={(e) => setCity(e.target.value)}>
              {Object.entries(cities).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {isCompany ? (
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="industry">
                მიმართულება *
              </label>
              <select className="ma-select" id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                {Object.entries(categories).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        {isCompany ? (
          <div className="ma-stack">
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="about">
                კომპანიის შესახებ · მაქს. 1000 სიმბოლო
              </label>
              <textarea className="ma-textarea" id="about" maxLength={1000} value={about} onChange={(e) => setAbout(e.target.value)} />
            </div>
            <div className="ma-form__row ma-form__row--2">
              <div className="ma-field">
                <label className="ma-field__label" htmlFor="offers">
                  რას ვთავაზობთ · თითო ხაზზე ერთი, მაქს. 8
                </label>
                <textarea className="ma-textarea" id="offers" value={offers} onChange={(e) => setOffers(e.target.value)} />
              </div>
              <div className="ma-field">
                <label className="ma-field__label" htmlFor="seeks">
                  რას ვეძებთ · თითო ხაზზე ერთი, მაქს. 8
                </label>
                <textarea className="ma-textarea" id="seeks" value={seeks} onChange={(e) => setSeeks(e.target.value)} />
              </div>
            </div>
            <fieldset className="ma-field">
              <legend className="ma-field__label">რომელ ქალაქებს ემსახურებით?</legend>
              <div className="ma-cluster">
                {Object.entries(cities).map(([id, label]) => (
                  <label className="ma-check" key={id}>
                    <input
                      type="checkbox"
                      checked={serviceCities.includes(id)}
                      onChange={(e) =>
                        setServiceCities((prev) => (e.target.checked ? [...prev, id] : prev.filter((c) => c !== id)))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}
        <p className="ma-note">ტელეფონისა და ელფოსტის შესაცვლელად დაუკავშირდი MeetAny-ს გუნდს.</p>
        {error ? (
          <p className="ma-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="ma-cluster">
          <button className="ma-btn ma-btn--primary" type="submit" disabled={pending}>
            {pending ? "ინახება…" : "შენახვა"}
          </button>
        </div>
        {saved ? <p role="status">ცვლილებები შენახულია.</p> : null}
      </form>
    </section>
  );
}

export function AccountPageContent() {
  const { store, ready, available } = useMarketStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab") || "";
  const tab = ["saved", "notifications", "messages"].includes(rawTab) ? rawTab : ["profile", "settings"].includes(rawTab) ? "profile" : "overview";

  const me = ready && available ? (store?.currentUser() as AnyUser | null) : null;
  useEffect(() => {
    if (!me?.id) return;
    let next = "";
    try { next = sessionStorage.getItem("meetany.chatReturn") || ""; sessionStorage.removeItem("meetany.chatReturn"); } catch {}
    if (!next) return;
    const url = new URL(next, window.location.origin);
    if (url.origin === window.location.origin && ["/companies/view/", "/requests/view/"].includes(url.pathname)) router.replace(url.pathname + url.search + url.hash);
  }, [me?.id, router]);

  const data = useMemo(() => {
    if (!store || !me) return null;
    const myRequests = store.listRequests({ ownerId: me.id, state: "", includeHidden: true });
    if (me.role === "company") {
      const matching = (store.listRequests({ category: me.industry }) as { id: string; ownerId: string }[]).filter((r) => r.ownerId !== me.id);
      const myOffers = store.myOffers(me);
      return { matching, myOffers, myRequests };
    }
    return { matching: [] as unknown[], myOffers: [] as unknown[], myRequests };
  }, [store, me]);

  if (ready && !available) return <div className="ma-page"><ServiceUnavailable /></div>;

  if (!ready) return <AccountSkeleton />;

  if (!me) {
    return (
      <div className="ma-page">
        <PageBand eyebrow="MeetAny · ანგარიში" title="შენი ანგარიში" description="შედი ან შექმენი ანგარიში." />
        <AuthForms initialRole={searchParams.get("role") || ""} />
      </div>
    );
  }

  if (tab === "saved" || tab === "notifications" || tab === "messages") return (
    <div className="ma-page ma-stack">
      <Link className="ma-back" href="/account/"><Icon name="arrow-left"/>ჩემი ანგარიში</Link>
      <nav className="ma-tabs" aria-label="ანგარიშის განყოფილებები">
        <Link className="ma-tab" href="/account/?tab=saved" aria-current={tab === "saved" ? "page" : undefined}>შენახული კომპანიები</Link>
        <Link className="ma-tab" href="/account/?tab=notifications" aria-current={tab === "notifications" ? "page" : undefined}>შეტყობინებები</Link>
        <Link className="ma-tab" href="/account/?tab=messages" aria-current={tab === "messages" ? "page" : undefined}>მიმოწერები</Link>
      </nav>
      {tab === "messages" ? <ConversationList key={me.id}/> : <EngagementPanel key={tab} kind={tab}/>}
    </div>
  );

  const isCompany = me.role === "company";
  const name = me.company || me.name;

  return (
    <div className="ma-page">
      <PageBand eyebrow="MeetAny · ანგარიში" title="ჩემი ანგარიში" description="შენი მოთხოვნები, შეთავაზებები და პროფილი." avatar={<CompanyAvatar name={name} size="lg" />} />
      <div className="ma-proto-account">
        <aside className="ma-panel">
          <CompanyAvatar name={name} size="xl" />
          <h2 className="ma-h3">{name}</h2>
          <p className="ma-small ma-muted">
            {me.name} · {isCompany ? "კომპანია" : "კლიენტი"}
          </p>
          {me.blocked ? <span className="ma-badge ma-badge--danger">დაბლოკილია</span> : null}
          <dl className="ma-kv">
            <div>
              <dt>ქალაქი</dt>
              <dd>{cities[me.city] || me.city}</dd>
            </div>
            <div>
              <dt>ტელეფონი</dt>
              <dd>{me.phone}</dd>
            </div>
            <div>
              <dt>ელფოსტა</dt>
              <dd>{me.email}</dd>
            </div>
            {isCompany ? (
              <div>
                <dt>მიმართულება</dt>
                <dd>{categories[me.industry || ""] || me.industry}</dd>
              </div>
            ) : null}
          </dl>
          <div className="ma-panel__actions">
            <Link className="ma-btn ma-btn--primary" href="/requests/new/">
              მოთხოვნის დამატება
            </Link>
            {isCompany ? (
              <Link className="ma-btn ma-btn--secondary" href={`/companies/view/?id=${me.id}`}>
                საჯარო პროფილი
              </Link>
            ) : null}
            <button
              type="button"
              className="ma-btn ma-btn--ghost"
              onClick={async () => {
                await store?.logout();
                router.push("/account/");
                router.refresh();
              }}
            >
              გასვლა
            </button>
          </div>
          <p className="ma-note">
            <Icon name="lock" />
            ტელეფონი საჯაროდ ჩანს. ელფოსტა მეორე მხარეს ეჩვენება შეთავაზების არჩევის შემდეგ.
          </p>
        </aside>
        <div className="ma-stack">
          <nav className="ma-tabs" aria-label="ანგარიშის განყოფილებები">
            <Link className="ma-tab" href="/account/?tab=saved">შენახული კომპანიები</Link>
            <Link className="ma-tab" href="/account/?tab=notifications">შეტყობინებები</Link>
            <Link className="ma-tab" href="/account/?tab=messages">მიმოწერები</Link>
            <Link className="ma-tab" href="/account/" aria-current={tab === "overview" ? "page" : undefined}>
              მიმოხილვა
            </Link>
            <Link className="ma-tab" href="/account/?tab=profile" aria-current={tab === "profile" ? "page" : undefined}>
              პროფილი
            </Link>
          </nav>
          {tab === "profile" ? (
            <ProfileForm me={me} onSaved={() => undefined} />
          ) : (
            <div className="ma-stack">
              {isCompany ? (
                <>
                  <section className="ma-stack">
                    <div className="ma-section__head">
                      <h2 className="ma-h3">შენი მიმართულების მოთხოვნები</h2>
                      <span className="ma-badge ma-badge--neutral">{data?.matching.length ?? 0}</span>
                    </div>
                    {(data?.matching as { id: string; title: string; city: string }[] | undefined)?.length ? (
                      (data!.matching as { id: string; title: string; city: string }[]).slice(0, 5).map((r) => (
                        <article className="ma-panel" key={r.id}>
                          <Link className="ma-proto-rowtitle ma-title" href={`/requests/view/?id=${r.id}`}>
                            {r.title}
                          </Link>
                          <p className="ma-small ma-muted">{cities[r.city] || r.city}</p>
                        </article>
                      ))
                    ) : (
                      <p className="ma-muted">შენი მიმართულებით მოთხოვნა ჯერ არ არის.</p>
                    )}
                    <Link className="ma-btn ma-btn--secondary" href="/requests/">
                      ყველა მოთხოვნა
                    </Link>
                  </section>
                  <h2 className="ma-h3">ჩემი შეთავაზებები</h2>
                  {(data?.myOffers as { id: string; requestId: string; status: string }[] | undefined)?.length ? (
                    (data!.myOffers as { id: string; requestId: string; status: string }[]).map((o) => (
                      <article className="ma-panel" key={o.id}>
                        <Link className="ma-proto-rowtitle ma-title" href={`/requests/view/?id=${o.requestId}`}>
                          მოთხოვნის ნახვა
                        </Link>
                        <div>
                          <span className={`ma-badge ma-badge--${o.status === "chosen" ? "success" : o.status === "declined" ? "neutral" : "info"}`}>
                            {o.status === "chosen" ? "არჩეულია" : o.status === "declined" ? "არ აირჩიეს" : "გაგზავნილია"}
                          </span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="ma-muted">ჯერ შეთავაზება არ გაგზავნილა.</p>
                  )}
                </>
              ) : null}
              <section className="ma-stack">
                <h2 className="ma-h3">ჩემი მოთხოვნები</h2>
                {(data?.myRequests as { id: string; title: string; city: string; expiresAt: string; hidden: boolean }[] | undefined)?.length ? (
                  (data!.myRequests as { id: string; title: string; city: string }[]).map((r) => {
                    const state = store?.requestState(r);
                    return (
                      <article className="ma-card ma-proto-toolbar" key={r.id}>
                        <div>
                          <Link className="ma-proto-rowtitle ma-title" href={`/requests/view/?id=${r.id}`}>
                            {r.title}
                          </Link>
                          <p className="ma-small ma-muted">{cities[r.city] || r.city}</p>
                        </div>
                        <div className="ma-cluster">
                          <span className={`ma-badge ma-badge--${state === "open" ? "success" : "neutral"}`}>{store?.stateLabels?.[state] || state}</span>
                          {(state === "open" || state === "expired" || state === "closed") ? (
                            <button type="button" className="ma-btn ma-btn--secondary" onClick={async () => {try {await store?.extendRequest(r.id); toast("ვადა გაგრძელდა.");} catch(err) {toast((err as {userMessage?: string}).userMessage || "ვერ შესრულდა.");}}}>
                              +{store?.EXTEND_DAYS ?? 7} დღე
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="ma-empty">
                    <h2 className="ma-empty__title">ჯერ მოთხოვნა არ გაქვს</h2>
                    <p className="ma-empty__text">დაამატე პირველი მოთხოვნა — კომპანიები პირობებით გიპასუხებენ.</p>
                    <Link className="ma-btn ma-btn--primary" href="/requests/new/">
                      მოთხოვნის დამატება
                    </Link>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
