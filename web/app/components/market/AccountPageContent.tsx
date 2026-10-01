"use client";
import { Button } from "../ui/Button";


import { CustomSelect } from "../ui/CustomSelect";
import { AccountSkeleton } from "./Skeletons";

import { EngagementPanel } from "./EngagementPanels";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "../Toasts";
import { Icon } from "../Icon";
import { DuoIcon } from "../ui/DuoIcon";
import { CompanyAvatar } from "./CompanyAvatar";
import { AuthForms, PasswordInput } from "./AuthForms";
import { useFieldErrors, type FieldErrors } from "./fieldErrors";
import { LogoField, GalleryField, type GalleryItem } from "./PhotoField";
import { CompanyBusinessPanel } from "./CompanyBusiness";
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
  gallery?: string[];
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
  const [gallery, setGallery] = useState<GalleryItem[]>(() => (me.gallery || []).map(url => ({ key: url, url })));
  const [galleryChanged, setGalleryChanged] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "gallery" | null>(null);
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
        setUploading("logo");
        const uploaded = await store.uploadLogo(logoFile);
        nextLogo = uploaded.url;
        setUploading(null);
      }
      await store.updateProfile({ name, company, city, industry, about, offers, seeks, serviceCities, ...(isCompany ? { address, lat: latValue, lng: lngValue, ...(logoChanged ? { logoUrl: nextLogo } : {}) } : {}) });
      setLogoUrl(nextLogo);
      setLogoFile(null);
      setLogoChanged(false);
      if (isCompany && galleryChanged) {
        // New files upload only now; the store removes them again if saving fails.
        setUploading("gallery");
        const user = await store.setGallery(gallery.map(item => item.file || item.url));
        setGallery((user?.gallery || []).map((url: string) => ({ key: url, url })));
        setGalleryChanged(false);
      }
      setSaved(true);
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "ვერ შესრულდა.");
    } finally {
      setUploading(null);
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
        {isCompany ? <LogoField name={company || name} logoUrl={logoUrl} file={logoFile} disabled={pending} uploading={uploading === "logo"}
          onChange={file => { setLogoFile(file); setLogoChanged(true); setSaved(false); }}
          onRemove={() => { setLogoFile(null); setLogoUrl(""); setLogoChanged(true); setSaved(false); }} /> : null}
        {isCompany ? <GalleryField items={gallery} disabled={pending} uploading={uploading === "gallery"}
          onChange={next => { setGallery(next); setGalleryChanged(true); setSaved(false); }} /> : null}
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
            <CustomSelect className="ma-select" id="profile-city" value={city} onChange={(e) => setCity(e.target.value)}>
              {Object.entries(cities).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>
        <div className="ma-form__row ma-form__row--3 account-contact">
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="profile-phone">
              ტელეფონი
            </label>
            <input className="ma-input ma-input--num" id="profile-phone" readOnly value={me.phone} aria-describedby="profile-phone-help" />
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
              <CustomSelect className="ma-select" id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                {categoryOptions()}
              </CustomSelect>
            </div>
          ) : null}
        </div>
        <p className="ma-field__help account-contact__help" id="profile-phone-help">ტელეფონი ჩანს სხვებისთვის, ელფოსტა — არა. მათ შესაცვლელად დაუკავშირდი MeetAny-ს გუნდს.</p>
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
            <details className="account-location-details">
              <summary><Icon name="map-pin" />რუკაზე ზუსტი მდებარეობა</summary>
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
            </details>
          </fieldset>
          </>
        ) : null}
        {error ? (
          <p className="ma-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="account-form-actions">
          <Button variant="primary" type="submit" disabled={pending}>
            {pending ? "ინახება…" : "შენახვა"}
          </Button>
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
        <fieldset className="account-form-group account-password" disabled={pending} aria-labelledby="password-title">
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
          <Button variant="primary" type="submit" disabled={pending}>{pending ? "ინახება…" : "პაროლის შეცვლა"}</Button>
        </div>
      </form>
    </section>
  );
}

type RequestItem = { id: string; title: string; category: string; city: string; createdAt: string; expiresAt: string; hidden: boolean };
type OfferItem = { id: string; requestId: string; status: string; createdAt: string };
type Tab = "overview" | "requests" | "offers" | "saved" | "messages" | "notifications" | "profile" | "business";

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
const offerTone = (status: string) => status === "chosen" ? "chosen" : status === "sent" ? "open" : "done";
const offerLabel = (status: string) => status === "chosen" ? "არჩეულია" : status === "declined" ? "არ აირჩიეს" : "გაგზავნილია";

// One tab strip for both widths and every account view (registry design system).
type NavItem = { key: Tab; href: string; label: string; icon: string; count?: number | null; alert?: boolean };

/** Account sidebar (Airbnb-style account hub): who you are on top, sections with icons and counts. */
function AccountTabs({ tab, items, me, name, roleLabel, isCompany }: { tab: Tab; items: NavItem[]; me: AnyUser; name: string; roleLabel: string; isCompany: boolean }) {
  const list = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = list.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const reveal = () => {
      if (nav.scrollWidth <= nav.clientWidth) return;
      nav.scrollLeft += active.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - active.offsetWidth) / 2;
    };
    reveal();
    const resize = new ResizeObserver(reveal);
    resize.observe(nav);
    return () => resize.disconnect();
  }, [tab]);
  return (
    <aside className="account-nav" aria-label="ანგარიში">
      <div className="account-nav__who">
        <CompanyAvatar name={name} logoUrl={(me as { logoUrl?: string | null }).logoUrl} size="lg" />
        <div>
          <p className="account-nav__name">{name}</p>
          <p className="account-nav__role">{roleLabel}{me.blocked ? " · დაბლოკილია" : ""}</p>
        </div>
      </div>
      {isCompany ? <Link className="account-nav__public" href={`/companies/view/?id=${encodeURIComponent(me.id)}`}><Icon name="external-link" />საჯარო გვერდის ნახვა</Link> : null}
      <nav ref={list} className="account-nav__list" aria-label="ანგარიშის განყოფილებები">
        {items.map((t) => (
          <Link key={t.key} href={t.href} aria-current={tab === t.key ? "page" : undefined}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
            {t.count ? <span className={t.alert ? "account-nav__count is-alert" : "account-nav__count"}>{t.count}</span> : null}
          </Link>
        ))}
      </nav>
    </aside>
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
  // ?tab=alerts (old links) opens the notifications tab; ?tab=settings the profile.
  const tab: Tab = rawTab === "business" || rawTab === "saved" || rawTab === "messages" || rawTab === "requests" || rawTab === "offers" || rawTab === "notifications" ? rawTab : rawTab === "alerts" ? "notifications" : ["profile", "settings"].includes(rawTab) ? "profile" : "overview";
  const [seen] = useState(readSeen);
  const [now] = useState(() => Date.now());

  const me = ready && available ? (store?.currentUser() as AnyUser | null) : null;
  const unread = useUnreadMessageCount(store, me?.id, !!me && !me.blocked && me.role !== "admin");
  useEffect(() => { if (me?.role === "admin") router.replace("/admin/"); }, [me?.role, router]);
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
      const matching = (store.listRequests({ category: groupOf[me.industry || ""] || me.industry }) as (RequestItem & { ownerId: string })[])
        .filter((r) => r.ownerId !== me.id)
        .sort((a, b) => Number(b.city === me.city) - Number(a.city === me.city));
      const myOffers = store.myOffers(me) as OfferItem[];
      return { matching, myOffers, myRequests };
    }
    return { matching: [] as RequestItem[], myOffers: [] as OfferItem[], myRequests };
  }, [store, me]);

  if (ready && !available) return <div className="ma-page"><ServiceUnavailable /></div>;

  if (!ready) return <AccountSkeleton />;

  if (me?.role === "admin") return <AccountSkeleton admin label="ადმინ-პანელი იტვირთება…" />;

  if (!me) return <AuthForms initialRole={searchParams.get("role") || ""} />;

  const isCompany = me.role === "company";
  const name = me.company || me.name;
  const roleLabel = isCompany ? "კომპანია" : "კლიენტი";
  const engagement = store?.engagement();
  const savedCount = engagement?.status === "ready" ? (engagement.savedIds as string[]).length : null;
  const myRequests = data?.myRequests ?? [];
  const matching = data?.matching ?? [];
  const myOffers = data?.myOffers ?? [];
  const activeTab: Tab = tab === "overview" ? isCompany ? "offers" : "requests" : !isCompany && tab === "offers" ? "requests" : tab;
  const tabs: NavItem[] = [
    ...(isCompany ? [{ key: "offers" as Tab, href: "/account/?tab=offers", label: "შეთავაზებები", icon: "send", count: myOffers.length }] : []),
    { key: "requests", href: "/account/?tab=requests", label: "მოთხოვნები", icon: "clipboard-list", count: myRequests.length },
    { key: "saved", href: "/account/?tab=saved", label: "შენახული", icon: "bookmark", count: savedCount },
    { key: "messages", href: "/account/?tab=messages", label: "მიმოწერები", icon: "message-square", count: unread, alert: true },
    { key: "notifications", href: "/account/?tab=notifications", label: "შეტყობინებები", icon: "bell" },
    ...(isCompany ? [{ key:"business" as Tab, href:"/account/?tab=business", label:"განვითარება", icon:"sparkles" }] : []),
    { key: "profile", href: "/account/?tab=profile", label: "პროფილი", icon: "user-round" },
  ];
  const nav = <AccountTabs tab={activeTab} items={tabs} me={me} name={name} roleLabel={roleLabel} isCompany={isCompany} />;

  if (tab === "notifications") return (
    <div className="ma-page account-page">
      {nav}
      <div id="alerts" className="account-main account-main--profile account-alerts">
        <EngagementPanel kind="notifications" all={searchParams.get("alerts") === "all"} />
      </div>
    </div>
  );

  if (tab === "saved" || tab === "messages") return (
    <div className="ma-page account-page">
      {nav}
      <div className="account-wide">
        {tab === "messages" ? (store ? <Inbox key={me.id} store={store} me={me}/> : null) : <EngagementPanel key={tab} kind={tab}/>}
      </div>
    </div>
  );

  if (tab === "business" && isCompany) return <div className="ma-page account-page">{nav}<div className="account-wide"><CompanyBusinessPanel key={me.id} owner={me.id}/></div></div>;

  if (tab === "profile") return (
    <div className="ma-page account-page">
      {nav}
      <div className="account-main account-main--profile">
        {me.blocked ? <p className="ma-field__error" role="status">ანგარიში დაბლოკილია.</p> : null}
        <ProfileForm me={me} />
        <PasswordForm key={me.id} />
      </div>
    </div>
  );

  async function extend(id: string) {
    try {await store?.extendRequest(id); toast("ვადა გაგრძელდა 7 დღით.");}
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
                  {/* Offer the extension only when it matters: a week or less left, or already closed. */}
                  {(state === "open" && left != null && left <= 7) || state === "expired" || state === "closed" ? (
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
        <div className="account-empty-state">
          <DuoIcon name="file-text" size={26} tile />
          <p className="account-empty-state__title">მოთხოვნა ჯერ არ გაქვს</p>
          <p className="account-empty">აღწერე, რა გჭირდება — კომპანიები შეთავაზებებს თავად გამოგიგზავნიან.</p>
          <Button variant="primary" href="/requests/new/">მოთხოვნის დამატება</Button>
        </div>
      )}
    </section>
  );

  return (
    <div className="ma-page account-page">
      {nav}
      <div className="account-layout account-layout--single">
        <div className="account-main">
          {isCompany && rawTab !== "requests" ? (
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
                            <Status tone={offerTone(o.status)}>{offerLabel(o.status)}</Status>
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
                  <h2 className="account-section__title">შენი დარგის მოთხოვნები ({matching.length})</h2>
                  <Link className="account-link" href={`/requests/?category=${encodeURIComponent(groupOf[me.industry || ""] || me.industry || "")}`}>ყველა ნახვა</Link>
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
                  <p className="account-empty">შენი დარგით ღია მოთხოვნა ჯერ არ არის — ახალზე შეგატყობინებთ.</p>
                )}
              </section>
            </>
          ) : null}
          {!isCompany || tab === "requests" ? requestsSection : null}
        </div>
      </div>
    </div>
  );
}
