"use client";

import { AccountSkeleton } from "./Skeletons";

import { EngagementPanel } from "./EngagementPanels";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "../Toasts";
import { PageBand } from "./PageBand";
import { AuthForms, PasswordInput } from "./AuthForms";
import { useFieldErrors, type FieldErrors } from "./fieldErrors";
import { LogoField } from "./PhotoField";
import { Inbox } from "./Inbox";
import { useMarketStore } from "../../lib/market-client";
import { useUnreadMessageCount } from "../../lib/chat-client";
import { categories, cities, groupOf } from "../../lib/categories";
import { categoryOptions } from "./CategoryOptions";

type AnyUser = {
  id: string;
  role: string;
  name: string;
  company?: string;
  logoUrl?: string | null;
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
  lat?: number | null;
  lng?: number | null;
};

/** "41,7151" → 41.7151; empty → null; anything else → NaN. */
function parseCoord(value: string) {
  const text = value.trim().replace(",", ".");
  if (!text) return null;
  return /^[-−]?\d+(\.\d+)?$/.test(text) ? Number(text.replace("−", "-")) : NaN;
}

function ProfileForm({ me }: { me: AnyUser }) {
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
  const [lat, setLat] = useState(me.lat == null ? "" : String(me.lat));
  const [lng, setLng] = useState(me.lng == null ? "" : String(me.lng));
  const [logoUrl, setLogoUrl] = useState(me.logoUrl || "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const v = useFieldErrors();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    const errors: FieldErrors = {};
    if (name.trim().length < 2) errors.name = "მიუთითე სახელი და გვარი";
    if (isCompany && company.trim().length < 2) errors.company = "მიუთითე კომპანიის დასახელება";
    const latValue = isCompany ? parseCoord(lat) : null;
    const lngValue = isCompany ? parseCoord(lng) : null;
    if (latValue !== null && !(latValue >= -90 && latValue <= 90)) errors.lat = "განედი უნდა იყოს რიცხვი −90-დან 90-მდე";
    if (lngValue !== null && !(lngValue >= -180 && lngValue <= 180)) errors.lng = "გრძედი უნდა იყოს რიცხვი −180-დან 180-მდე";
    if (!errors.lat && !errors.lng) {
      if (latValue === null && lngValue !== null) errors.lat = "მიუთითე განედიც — ან წაშალე ორივე";
      if (lngValue === null && latValue !== null) errors.lng = "მიუთითე გრძედიც — ან წაშალე ორივე";
    }
    if (!v.check(errors, ["name", "company", "lat", "lng"])) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      let nextLogo = logoUrl;
      if (isCompany && logoFile) {
        setUploading(true);
        const uploaded = await store.uploadLogo(logoFile);
        nextLogo = uploaded.url;
        setUploading(false);
      }
      await store.updateProfile({ name, company, city, industry, about, offers, seeks, serviceCities, ...(isCompany ? { address, lat: latValue, lng: lngValue, ...(logoChanged ? { logoUrl: nextLogo } : {}) } : {}) });
      setLogoUrl(nextLogo);
      setLogoFile(null);
      setLogoChanged(false);
      setSaved(true);
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "ვერ შესრულდა.");
    } finally {
      setUploading(false);
      setPending(false);
    }
  }

  return (
    <section className="account-section">
      <h2 className="account-section__title">{isCompany ? "კომპანიის პროფილი" : "პირადი მონაცემები"}</h2>
      <p className="account-hint">{isCompany ? "ეს ინფორმაცია ჩანს საჯარო პროფილზე და კომპანიების კატალოგში." : "სახელი და კომპანია ჩანს შენს მოთხოვნებზე."}</p>
      <form className="ma-form" onSubmit={submit} noValidate>
        <fieldset className="account-form-group">
          {isCompany ? <legend>ძირითადი</legend> : null}
        {isCompany ? <LogoField name={company || name} logoUrl={logoUrl} file={logoFile} disabled={pending} uploading={uploading}
          onChange={file => { setLogoFile(file); setLogoChanged(true); setSaved(false); }}
          onRemove={() => { setLogoFile(null); setLogoUrl(""); setLogoChanged(true); setSaved(false); }} /> : null}
        <div className="ma-form__row ma-form__row--3">
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="name">
              სახელი და გვარი *
            </label>
            <input className="ma-input" maxLength={80} autoComplete="name" value={name} onChange={(e) => {setName(e.target.value); v.clear("name");}} {...v.control("name")} />
            {v.message("name")}
          </div>
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="company">
              {isCompany ? "კომპანიის დასახელება *" : "კომპანია / ორგანიზაცია"}
            </label>
            <input className="ma-input" maxLength={100} autoComplete="organization" value={company} onChange={(e) => {setCompany(e.target.value); v.clear("company");}} {...v.control("company")} />
            {v.message("company")}
          </div>
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
        </div>
        <div className="ma-form__row ma-form__row--3 account-contact">
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="profile-phone">
              ტელეფონი
            </label>
            <input className="ma-input ma-input--num" id="profile-phone" readOnly value={me.phone} aria-describedby="profile-phone-help" />
            <p className="ma-field__help" id="profile-phone-help">ტელეფონი ჩანს სხვებისთვის. ელფოსტა არ ქვეყნდება. მათ შესაცვლელად დაუკავშირდი MeetAny-ს გუნდს.</p>
          </div>
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="profile-email">
              ელფოსტა
            </label>
            <input className="ma-input" id="profile-email" readOnly value={me.email} />
          </div>
          {isCompany ? (
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="industry">
                მიმართულება *
              </label>
              <select className="ma-select" id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                {categoryOptions()}
              </select>
            </div>
          ) : null}
        </div>
        </fieldset>
        {isCompany ? (
          <>
          <fieldset className="account-form-group">
            <legend>მომსახურება</legend>
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="about">
                კომპანიის შესახებ · მაქს. 1000 სიმბოლო
              </label>
              <textarea className="ma-textarea" id="about" maxLength={1000} aria-describedby="about-count" value={about} onChange={(e) => setAbout(e.target.value)} />
              <p className="ma-field__help account-counter" id="about-count">{about.length}/1000</p>
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
          </fieldset>
          <fieldset className="account-form-group">
            <legend>მისამართი</legend>
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="address">
                მისამართი <span className="ma-field__opt">არასავალდებულო</span>
              </label>
              <input className="ma-input" id="address" maxLength={200} placeholder="ქუჩა, ნომერი" aria-describedby="address-help" value={address} onChange={(e) => setAddress(e.target.value)} />
              <p className="ma-field__help" id="address-help">ჩანს პროფილზე „მიმართულება“ ბმულით</p>
            </div>
            <fieldset className="ma-field account-coords" aria-describedby="coords-help">
              <legend className="ma-field__label">
                კოორდინატები <span className="ma-field__opt">არასავალდებულო</span>
              </legend>
              <div className="ma-form__row ma-form__row--2">
                <div className="ma-field">
                  <label className="ma-field__label" htmlFor="lat">განედი</label>
                  <input className="ma-input ma-input--num" inputMode="decimal" autoComplete="off" maxLength={20} placeholder="41.7151" value={lat} onChange={(e) => {setLat(e.target.value); v.clear("lat"); v.clear("lng");}} {...v.control("lat")} />
                  {v.message("lat")}
                </div>
                <div className="ma-field">
                  <label className="ma-field__label" htmlFor="lng">გრძედი</label>
                  <input className="ma-input ma-input--num" inputMode="decimal" autoComplete="off" maxLength={20} placeholder="44.8271" value={lng} onChange={(e) => {setLng(e.target.value); v.clear("lat"); v.clear("lng");}} {...v.control("lng")} />
                  {v.message("lng")}
                </div>
              </div>
              <p className="account-coords__help" id="coords-help">Google Maps-იდან: მარჯვენა ღილაკი → კოორდინატები. თუ მითითებულია, „მიმართულება“ ზუსტ წერტილზე მიგიყვანს.</p>
            </fieldset>
          </fieldset>
          </>
        ) : null}
        {error ? (
          <p className="ma-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="account-form-actions">
          <button className="ma-btn ma-btn--primary" type="submit" disabled={pending}>
            {pending ? "ინახება…" : "შენახვა"}
          </button>
          {saved ? <p className="account-hint" role="status">ცვლილებები შენახულია.</p> : null}
        </div>
        {isCompany ? <div className="account-form-links">
          <Link className="account-link" href={`/companies/view/?id=${encodeURIComponent(me.id)}`}>საჯარო პროფილი</Link>
        </div> : null}
      </form>
    </section>
  );
}

function PasswordForm() {
  const { store } = useMarketStore();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = useFieldErrors();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    setError(null);
    const errors: FieldErrors = {};
    if (!current) errors["password-current"] = "მიუთითე მიმდინარე პაროლი";
    if (password.length < 8) errors["password-new"] = "მინიმუმ 8 სიმბოლო";
    if (password.length > 128) errors["password-new"] = "მაქსიმუმ 128 სიმბოლო";
    if (!repeat) errors["password-repeat"] = "გაიმეორე ახალი პაროლი";
    else if (repeat !== password) errors["password-repeat"] = "პაროლები არ ემთხვევა";
    if (!v.check(errors, ["password-current", "password-new", "password-repeat"])) return;
    setPending(true);
    try {
      await store.changePassword(current, password);
      setCurrent(""); setPassword(""); setRepeat("");
      toast("პაროლი შეიცვალა.");
    } catch (err) {
      setError((err as { userMessage?: string }).userMessage || "პაროლი ვერ შეიცვალა.");
    } finally { setPending(false); }
  }
  return (
    <section className="account-section" aria-labelledby="password-title">
      <h2 className="account-section__title" id="password-title">პაროლი</h2>
      <form className="ma-form" id="account-password" onSubmit={submit} noValidate>
        <fieldset className="account-form-group" disabled={pending} aria-labelledby="password-title">
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="password-current">მიმდინარე პაროლი</label>
            <PasswordInput autoComplete="current-password" disabled={pending} value={current} onChange={value => {setCurrent(value); v.clear("password-current");}} field={v.control("password-current")} />
            <div className="auth-field-message">{v.message("password-current")}</div>
          </div>
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="password-new">ახალი პაროლი <span className="ma-field__opt">მინიმუმ 8 სიმბოლო</span></label>
            <PasswordInput autoComplete="new-password" disabled={pending} value={password} onChange={value => {setPassword(value); v.clear("password-new"); v.clear("password-repeat");}} field={{...v.control("password-new"), maxLength: 128}} />
            <div className="auth-field-message">{v.message("password-new")}</div>
          </div>
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="password-repeat">გაიმეორე ახალი პაროლი</label>
            <PasswordInput autoComplete="new-password" disabled={pending} value={repeat} onChange={value => {setRepeat(value); v.clear("password-repeat");}} field={{...v.control("password-repeat"), maxLength: 128}} />
            <div className="auth-field-message">{v.message("password-repeat")}</div>
          </div>
        </fieldset>
        <div className="auth-field-message"><p className="ma-field__error" role="alert">{error || ""}</p></div>
        <div className="account-form-actions">
          <button className="ma-btn ma-btn--primary" type="submit" disabled={pending}>{pending ? "ინახება…" : "პაროლის შეცვლა"}</button>
        </div>
      </form>
    </section>
  );
}

type RequestItem = { id: string; title: string; category: string; city: string; createdAt: string; expiresAt: string; hidden: boolean };
type OfferItem = { id: string; requestId: string; status: string; createdAt: string };
type Tab = "overview" | "saved" | "messages" | "profile";

const DAY = 86400000;
function postedLabel(createdAt: string, now: number) {
  const days = Math.floor((now - Date.parse(createdAt)) / DAY);
  return days <= 0 ? "გამოქვეყნდა დღეს" : days === 1 ? "გამოქვეყნდა გუშინ" : `გამოქვეყნდა ${days} დღის წინ`;
}
const requestMeta = (r: RequestItem, now: number) => [categories[r.category] || r.category, cities[r.city] || r.city, postedLabel(r.createdAt, now)].filter(Boolean).join(" · ");
// Last visit per own request, written by RequestViewPageContent when the author opens it.
function readSeen(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {return JSON.parse(localStorage.getItem("meetany.seen") || "{}") || {};} catch {return {};}
}
const offerTone = (status: string) => status === "chosen" ? "chosen" : "done";
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
  // Old links: ?tab=notifications / ?tab=alerts / ?tab=settings open the profile tab (alerts section).
  const toAlerts = rawTab === "notifications" || rawTab === "alerts";
  const tab: Tab = rawTab === "saved" || rawTab === "messages" ? rawTab : ["profile", "settings"].includes(rawTab) || toAlerts ? "profile" : "overview";
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
  const hasMe = !!me;
  useEffect(() => {
    if (!hasMe || tab !== "profile" || !(toAlerts || window.location.hash === "#alerts")) return;
    document.getElementById("alerts")?.scrollIntoView({ block: "start" });
  }, [hasMe, tab, toAlerts, searchParams]);

  const data = useMemo(() => {
    if (!store || !me) return null;
    const myRequests = store.listRequests({ ownerId: me.id, state: "", includeHidden: true }) as RequestItem[];
    if (me.role === "company") {
      const matching = (store.listRequests({ category: groupOf[me.industry || ""] || me.industry }) as (RequestItem & { ownerId: string })[]).filter((r) => r.ownerId !== me.id);
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
  const roleLabel = isCompany ? "კომპანია" : "კლიენტი";
  const engagement = store?.engagement();
  const savedCount = engagement?.status === "ready" ? (engagement.savedIds as string[]).length : null;
  const myRequests = data?.myRequests ?? [];
  const matching = data?.matching ?? [];
  const myOffers = data?.myOffers ?? [];
  const tabs: { key: Tab; href: string; label: string }[] = [
    { key: "overview", href: "/account/", label: isCompany ? `შეთავაზებები (${myOffers.length})` : `მოთხოვნები (${myRequests.length})` },
    { key: "saved", href: "/account/?tab=saved", label: savedCount == null ? "შენახული" : `შენახული (${savedCount})` },
    { key: "messages", href: "/account/?tab=messages", label: unread ? `მიმოწერები (${unread})` : "მიმოწერები" },
    { key: "profile", href: "/account/?tab=profile", label: "პროფილი" },
  ];

  if (tab === "saved" || tab === "messages") return (
    <div className="ma-page account-page">
      <PageBand title="ჩემი ანგარიში" />
      <AccountTabs tab={tab} items={tabs} />
      <div className="account-wide">
        {tab === "messages" ? (store ? <Inbox key={me.id} store={store} me={me}/> : null) : <EngagementPanel key={tab} kind={tab}/>}
      </div>
    </div>
  );

  if (tab === "profile") return (
    <div className="ma-page account-page">
      <PageBand title="ჩემი ანგარიში" />
      <AccountTabs tab={tab} items={tabs} />
      <div className="account-main account-main--profile">
        {me.blocked ? <p className="ma-field__error" role="status">ანგარიში დაბლოკილია.</p> : null}
        <ProfileForm me={me} />
        <PasswordForm key={me.id} />
        <div id="alerts" className="account-alerts">
          <EngagementPanel kind="notifications" all={searchParams.get("alerts") === "all"} />
        </div>
      </div>
    </div>
  );

  async function extend(id: string) {
    try {await store?.extendRequest(id); toast("ვადა გაგრძელდა.");}
    catch (err) {toast((err as {userMessage?: string}).userMessage || "ვერ შესრულდა.");}
  }

  const requestHref = (id: string) => `/requests/view/?id=${encodeURIComponent(id)}`;
  const addRequest = <Link className="account-link" href="/requests/new/">მოთხოვნის დამატება</Link>;

  const requestsSection = (
    <section className="account-section">
      <div className="account-section__head">
        <h2 className="account-section__title">ჩემი მოთხოვნები</h2>
        {myRequests.length ? addRequest : null}
      </div>
      {myRequests.length ? (
        <ul className="account-rows">
          {myRequests.map((r) => {
            const state = store?.requestState(r) as string;
            const count = store?.offerCount(r.id) ?? 0;
            const seenAt = seen[r.id];
            const fresh = (store?.visibleOffers(r.id, me) as OfferItem[] | undefined ?? []).filter((o) => o.status === "sent" && (!seenAt || Date.parse(o.createdAt) > Date.parse(seenAt))).length;
            const left = state === "open" ? (store?.daysLeft(r, now) as number) : null;
            return (
              <li className="account-row" key={r.id}>
                <div className="account-row__main">
                  <h3 className="account-row__title"><Link className="account-row__link" href={requestHref(r.id)}>{r.title}</Link></h3>
                  <p className="account-row__meta">{requestMeta(r, now)}</p>
                </div>
                <div className="account-row__stats">
                  <span className="account-row__count">
                    <strong>{count} შეთავაზება</strong>
                    {fresh ? <span className="account-row__new">{fresh} ახალი</span> : null}
                  </span>
                  {state !== "open" ? <Status tone={state === "chosen" ? "chosen" : "done"}>{store?.stateLabels?.[state] || state}</Status> : null}
                </div>
                <div className="account-row__actions">
                  {left != null ? <span className="account-row__due" data-soon={left <= 2 ? "" : undefined}>{left <= 0 ? "ვადა დღეს იწურება" : `კიდევ ${left} დღე`}</span> : null}
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
        <div className="account-empty-block">
          <p className="account-empty">მოთხოვნა ჯერ არ გაქვს — კომპანიები შეთავაზებას პირობებით გამოგიგზავნიან.</p>
          {addRequest}
        </div>
      )}
    </section>
  );

  return (
    <div className="ma-page account-page">
      <PageBand title="ჩემი ანგარიში" />
      <AccountTabs tab={tab} items={tabs} />
      <p className="account-idline">{name} · {roleLabel}</p>
      <div className="account-layout">
        <aside className="account-profile" aria-label="პროფილი">
          <div>
            <h2 className="account-profile__name">{name}</h2>
            <p className="account-profile__role">{me.company && me.company !== me.name ? `${me.name} · ` : ""}{roleLabel}</p>
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
          <div className="account-profile__links">
            <Link className="account-link" href="/account/?tab=profile">პროფილის რედაქტირება</Link>
            {isCompany ? <Link className="account-link" href={`/companies/view/?id=${encodeURIComponent(me.id)}`}>საჯარო პროფილი</Link> : null}
          </div>
        </aside>
        <div className="account-main">
          {isCompany ? (
            <>
              <section className="account-section">
                <h2 className="account-section__title">ჩემი შეთავაზებები ({myOffers.length})</h2>
                {myOffers.length ? (
                  <ul className="account-rows">
                    {myOffers.map((o) => {
                      const r = store?.getRequest(o.requestId) as RequestItem | null;
                      return (
                        <li className="account-row" key={o.id}>
                          <div className="account-row__main">
                            <h3 className="account-row__title"><Link className="account-row__link" href={requestHref(o.requestId)}>{r?.title || "მოთხოვნა"}</Link></h3>
                            <p className="account-row__meta">{[r ? categories[r.category] || r.category : "", r ? cities[r.city] || r.city : "", `გაიგზავნა ${postedLabel(o.createdAt, now).replace("გამოქვეყნდა ", "")}`].filter(Boolean).join(" · ")}</p>
                          </div>
                          <div className="account-row__stats">
                            {o.status !== "sent" ? <Status tone={offerTone(o.status)}>{offerLabel(o.status)}</Status> : null}
                          </div>
                          <div className="account-row__actions" />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="account-empty">შეთავაზება ჯერ არ გაგიგზავნია.</p>
                )}
              </section>
              <section className="account-section">
                <div className="account-section__head">
                  <h2 className="account-section__title">შენი მიმართულების მოთხოვნები ({matching.length})</h2>
                  <Link className="account-link" href="/requests/">ყველა მოთხოვნა</Link>
                </div>
                {matching.length ? (
                  <ul className="account-rows">
                    {matching.slice(0, 5).map((r) => (
                      <li className="account-row account-row--plain" key={r.id}>
                        <div className="account-row__main">
                          <h3 className="account-row__title"><Link className="account-row__link" href={requestHref(r.id)}>{r.title}</Link></h3>
                          <p className="account-row__meta">{requestMeta(r, now)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="account-empty">შენი მიმართულებით მოთხოვნა ჯერ არ არის.</p>
                )}
              </section>
            </>
          ) : null}
          {requestsSection}
        </div>
      </div>
    </div>
  );
}
