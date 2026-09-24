"use client";

import { AccountSkeleton } from "./Skeletons";

import { EngagementPanel } from "./EngagementPanels";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "../Toasts";
import { PageBand } from "./PageBand";
import { CompanyAvatar } from "./CompanyAvatar";
import { AuthForms } from "./AuthForms";
import { Inbox } from "./Inbox";
import { useMarketStore } from "../../lib/market-client";
import { useUnreadMessageCount } from "../../lib/chat-client";
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
  address?: string | null;
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
  const [address, setAddress] = useState(me.address || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    setPending(true);
    setError(null);
    try {
      await store.updateProfile({ name, company, city, industry, about, offers, seeks, serviceCities, ...(isCompany ? { address } : {}) });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "ვერ შესრულდა.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="account-section">
      <h2 className="account-section__title">{isCompany ? "კომპანიის პროფილი" : "პროფილი"}</h2>
      <p className="account-hint">{isCompany ? "ეს ინფორმაცია ჩანს საჯარო პროფილზე და კომპანიების კატალოგში." : "სახელი და კომპანია ჩანს შენს მოთხოვნებზე."}</p>
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
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="address">
                მისამართი <span className="ma-field__opt">არასავალდებულო</span>
              </label>
              <input className="ma-input" id="address" maxLength={200} placeholder="ქუჩა, ნომერი" aria-describedby="address-help" value={address} onChange={(e) => setAddress(e.target.value)} />
              <p className="ma-field__help" id="address-help">ჩანს პროფილზე „მიმართულება“ ბმულით</p>
            </div>
          </div>
        ) : null}
        <p className="account-hint">ტელეფონისა და ელფოსტის შესაცვლელად დაუკავშირდი MeetAny-ს გუნდს.</p>
        {error ? (
          <p className="ma-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <button className="ma-btn ma-btn--primary" type="submit" disabled={pending}>
            {pending ? "ინახება…" : "შენახვა"}
          </button>
        </div>
        {saved ? <p role="status">ცვლილებები შენახულია.</p> : null}
      </form>
    </section>
  );
}

type RequestItem = { id: string; title: string; city: string; createdAt: string; expiresAt: string; hidden: boolean };
type OfferItem = { id: string; requestId: string; status: string; createdAt: string };
type Tab = "overview" | "saved" | "notifications" | "messages" | "profile";

const DAY = 86400000;
function postedLabel(createdAt: string, now: number) {
  const days = Math.floor((now - Date.parse(createdAt)) / DAY);
  return days <= 0 ? "გამოქვეყნდა დღეს" : days === 1 ? "გამოქვეყნდა გუშინ" : `გამოქვეყნდა ${days} დღის წინ`;
}
// Last visit per own request, written by RequestViewPageContent when the author opens it.
function readSeen(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {return JSON.parse(localStorage.getItem("meetany.seen") || "{}") || {};} catch {return {};}
}
const requestTone = (state: string) => state === "open" ? "open" : state === "chosen" ? "chosen" : "done";
const offerTone = (status: string) => status === "chosen" ? "open" : status === "declined" ? "done" : "chosen";
const offerLabel = (status: string) => status === "chosen" ? "არჩეულია" : status === "declined" ? "არ აირჩიეს" : "გაგზავნილია";

// One tab strip for both widths and every account view (registry design system).
function AccountTabs({ tab, items }: { tab: Tab; items: { key: Tab; href: string; label: string }[] }) {
  return (
    <nav className="ma-tabs account-tabs" aria-label="ანგარიშის განყოფილებები">
      {items.map((t) => (
        <Link key={t.key} className="ma-tab" href={t.href} aria-current={tab === t.key ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

function Status({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className="account-status" data-tone={tone}>{children}</span>;
}

export function AccountPageContent() {
  const { store, ready, available } = useMarketStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab") || "";
  const tab: Tab = rawTab === "saved" || rawTab === "notifications" || rawTab === "messages" ? rawTab : ["profile", "settings"].includes(rawTab) ? "profile" : "overview";
  const [seen] = useState(readSeen);
  const [now] = useState(() => Date.now());

  const me = ready && available ? (store?.currentUser() as AnyUser | null) : null;
  const unread = useUnreadMessageCount(store, me?.id, !!me && !me.blocked);
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
    const myRequests = store.listRequests({ ownerId: me.id, state: "", includeHidden: true }) as RequestItem[];
    if (me.role === "company") {
      const matching = (store.listRequests({ category: me.industry }) as (RequestItem & { ownerId: string })[]).filter((r) => r.ownerId !== me.id);
      const myOffers = store.myOffers(me) as OfferItem[];
      return { matching, myOffers, myRequests };
    }
    return { matching: [] as RequestItem[], myOffers: [] as OfferItem[], myRequests };
  }, [store, me]);

  if (ready && !available) return <div className="ma-page"><ServiceUnavailable /></div>;

  if (!ready) return <AccountSkeleton />;

  if (!me) return <AuthForms initialRole={searchParams.get("role") || ""} />;

  const isCompany = me.role === "company";
  const name = me.company || me.name;
  const engagement = store?.engagement();
  const savedCount = engagement?.status === "ready" ? (engagement.savedIds as string[]).length : null;
  const tabs: { key: Tab; href: string; label: string }[] = [
    { key: "overview", href: "/account/", label: isCompany ? "მიმოხილვა" : `მოთხოვნები (${data?.myRequests.length ?? 0})` },
    { key: "saved", href: "/account/?tab=saved", label: savedCount == null ? "შენახული კომპანიები" : `შენახული კომპანიები (${savedCount})` },
    { key: "notifications", href: "/account/?tab=notifications", label: "შეტყობინებები" },
    { key: "messages", href: "/account/?tab=messages", label: unread ? `მიმოწერები (${unread})` : "მიმოწერები" },
    { key: "profile", href: "/account/?tab=profile", label: "პროფილი" },
  ];

  if (tab === "saved" || tab === "notifications" || tab === "messages") return (
    <div className="ma-page account-page">
      <PageBand title="ჩემი ანგარიში" />
      <AccountTabs tab={tab} items={tabs} />
      <div className="account-wide">
        {tab === "messages" ? (store ? <Inbox key={me.id} store={store} me={me}/> : null) : <EngagementPanel key={tab} kind={tab}/>}
      </div>
    </div>
  );

  async function extend(id: string) {
    try {await store?.extendRequest(id); toast("ვადა გაგრძელდა.");}
    catch (err) {toast((err as {userMessage?: string}).userMessage || "ვერ შესრულდა.");}
  }

  const requestHref = (id: string) => `/requests/view/?id=${encodeURIComponent(id)}`;
  const myRequests = data?.myRequests ?? [];
  const matching = data?.matching ?? [];
  const myOffers = data?.myOffers ?? [];

  return (
    <div className="ma-page account-page">
      <PageBand title="ჩემი ანგარიში" />
      <AccountTabs tab={tab} items={tabs} />
      <div className="account-layout">
        <aside className="account-profile" aria-label="პროფილი">
          <div className="account-profile__id">
            <CompanyAvatar name={name} size="lg" />
            <div>
              <h2 className="account-profile__name">{name}</h2>
              <p className="account-profile__role">{me.name} · {isCompany ? "კომპანია" : "კლიენტი"}</p>
            </div>
          </div>
          {me.blocked ? <span className="ma-badge ma-badge--danger">დაბლოკილია</span> : null}
          <dl className="account-kv">
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
          <Link className="ma-btn ma-btn--primary ma-btn--block" href="/requests/new/">
            მოთხოვნის დამატება
          </Link>
          <div className="account-profile__links">
            {isCompany ? <Link className="account-link" href={`/companies/view/?id=${encodeURIComponent(me.id)}`}>საჯარო პროფილი</Link> : null}
            <button
              type="button"
              className="account-link"
              onClick={async () => {
                await store?.logout();
                router.push("/account/");
                router.refresh();
              }}
            >
              გასვლა
            </button>
          </div>
          <p className="account-profile__note">ტელეფონი საჯაროა; ელფოსტა — არჩევისას.</p>
        </aside>
        <div className="account-main">
          {tab === "profile" ? (
            <ProfileForm me={me} onSaved={() => undefined} />
          ) : (
            <>
              {isCompany ? (
                <>
                  <section className="account-section">
                    <h2 className="account-section__title">შენი მიმართულების მოთხოვნები ({matching.length})</h2>
                    {matching.length ? (
                      <ul className="account-rows">
                        {matching.slice(0, 5).map((r) => (
                          <li className="account-row account-row--plain" key={r.id}>
                            <div className="account-row__main">
                              <h3 className="account-row__title"><Link href={requestHref(r.id)}>{r.title}</Link></h3>
                              <p className="account-row__meta">{cities[r.city] || r.city} · {postedLabel(r.createdAt, now)}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="account-empty">შენი მიმართულებით მოთხოვნა ჯერ არ არის.</p>
                    )}
                    <Link className="account-link" href="/requests/">ყველა მოთხოვნა</Link>
                  </section>
                  <section className="account-section">
                    <h2 className="account-section__title">ჩემი შეთავაზებები ({myOffers.length})</h2>
                    {myOffers.length ? (
                      <ul className="account-rows">
                        {myOffers.map((o) => {
                          const r = store?.getRequest(o.requestId) as RequestItem | null;
                          return (
                            <li className="account-row" key={o.id}>
                              <div className="account-row__main">
                                <h3 className="account-row__title"><Link href={requestHref(o.requestId)}>{r?.title || "მოთხოვნა"}</Link></h3>
                                <p className="account-row__meta">{[r ? cities[r.city] || r.city : "", `გაიგზავნა ${postedLabel(o.createdAt, now).replace("გამოქვეყნდა ", "")}`].filter(Boolean).join(" · ")}</p>
                              </div>
                              <div className="account-row__stats">
                                <Status tone={offerTone(o.status)}>{offerLabel(o.status)}</Status>
                              </div>
                              <div className="account-row__actions">
                                <Link className="account-link" href={requestHref(o.requestId)}>მოთხოვნის ნახვა</Link>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="account-empty">ჯერ შეთავაზება არ გაგზავნილა.</p>
                    )}
                  </section>
                </>
              ) : null}
              <section className="account-section">
                <h2 className="account-section__title">ჩემი მოთხოვნები</h2>
                {myRequests.length ? (
                  <ul className="account-rows">
                    {myRequests.map((r) => {
                      const state = store?.requestState(r) as string;
                      const count = store?.offerCount(r.id) ?? 0;
                      const seenAt = seen[r.id];
                      const fresh = (store?.visibleOffers(r.id, me) as OfferItem[] | undefined ?? []).filter((o) => o.status === "sent" && (!seenAt || Date.parse(o.createdAt) > Date.parse(seenAt))).length;
                      return (
                        <li className="account-row" key={r.id}>
                          <div className="account-row__main">
                            <h3 className="account-row__title"><Link href={requestHref(r.id)}>{r.title}</Link></h3>
                            <p className="account-row__meta">{cities[r.city] || r.city} · {postedLabel(r.createdAt, now)}</p>
                          </div>
                          <div className="account-row__stats">
                            <span className="account-row__count">
                              <strong>{count} შეთავაზება</strong>
                              {fresh ? <span className="account-row__new">{fresh} ახალი</span> : null}
                            </span>
                            <Status tone={requestTone(state)}>{store?.stateLabels?.[state] || state}</Status>
                          </div>
                          <div className="account-row__actions">
                            <Link className="account-link" href={requestHref(r.id)}>შეთავაზებების ნახვა</Link>
                            {state === "open" || state === "expired" || state === "closed" ? (
                              <button type="button" className="account-link" onClick={() => extend(r.id)}>
                                {state === "open" ? "ვადის გაგრძელება" : "ხელახლა გახსნა"} +{store?.EXTEND_DAYS ?? 7} დღე
                              </button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="account-empty">ჯერ მოთხოვნა არ გაქვს. დაამატე პირველი — კომპანიები პირობებით გიპასუხებენ.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
