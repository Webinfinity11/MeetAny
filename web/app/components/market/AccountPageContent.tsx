"use client";
import { Button } from "../ui/Button";


import { CustomSelect } from "../ui/CustomSelect";
import { CompactMultiSelect } from "../ui/CompactMultiSelect";
import { AccountSkeleton } from "./Skeletons";

import { EngagementPanel } from "./EngagementPanels";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "../Toasts";
import { Icon } from "../Icon";
import { openChat } from "./ChatPopup";
import { AuthForms, PasswordInput } from "./AuthForms";
import { useFieldErrors, type FieldErrors } from "./fieldErrors";
import { LogoField, GalleryField, type GalleryItem } from "./PhotoField";
import { CompanyProducts } from "./CompanyProducts";
import { ProfileItems } from "./ProfileItems";
import { LocationPicker } from "./LocationPicker";
import { CompanyBusinessPanel, CompanyDistributionPanel } from "./CompanyBusiness";
import { Inbox } from "./Inbox";
import { useMarketStore, type Store } from "../../lib/market-client";
import { useConversationList, useUnreadMessageCount } from "../../lib/chat-client";
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

const profileSections = { details: "მონაცემები და ფოტოები", products: "პროდუქტები", distribution: "დისტრიბუცია", security: "პაროლი" };
function CompanyProfile({me,section}:{me:AnyUser;section:string}) {
 const active=Object.hasOwn(profileSections,section)?section:"details";
 return <>
  <nav className="company-profile-sections" aria-label="კომპანიის პროფილის განყოფილებები">{Object.entries(profileSections).map(([key,label])=><Link key={key} href={`/account/?tab=profile&section=${key}`} aria-current={active===key?"page":undefined}>{label}</Link>)}</nav>
  {active==="details"?<ProfileForm key={me.id} me={me}/>:active==="products"?<section className="account-section"><CompanyProducts companyId={me.id} edit/><p className="account-hint">ფოტოების დასამატებლად გახსენი <Link className="ma-link" href="/account/?tab=profile&section=details">მონაცემები და ფოტოები</Link>. ჯერ შეინახე გალერეა, შემდეგ აირჩიე პროდუქტის ფოტო.</p></section>:active==="distribution"?<CompanyDistributionPanel owner={me.id}/>:<PasswordForm key={me.id}/>}
 </>;
}

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
  const [offers, setOffers] = useState<string[]>(me.offers || []);
  const [seeks, setSeeks] = useState<string[]>(me.seeks || []);
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
  const coordinateDetails = useRef<HTMLDetailsElement>(null);
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
    if ((errors.lat || errors.lng) && coordinateDetails.current) coordinateDetails.current.open=true;
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
      toast("პროფილი შენახულია.");
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
      <form className="ma-form" onSubmit={submit} onChange={() => setSaved(false)} noValidate>
        <fieldset className="account-form-group" disabled={pending}>
          {isCompany ? <legend>ძირითადი</legend> : null}
        {isCompany ? <LogoField name={company || name} logoUrl={logoUrl} file={logoFile} disabled={pending} uploading={uploading === "logo"}
          onChange={file => { setLogoFile(file); setLogoChanged(true); setSaved(false); }}
          onRemove={() => { setLogoFile(null); setLogoUrl(""); setLogoChanged(true); setSaved(false); }} /> : null}
        {isCompany ? <GalleryField items={gallery} disabled={pending} uploading={uploading === "gallery"}
          onChange={next => { setGallery(next); setGalleryChanged(true); setSaved(false); }} /> : null}
        <div className="ma-form__row ma-form__row--2">
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
        </div>
        <div className="ma-field profile-city-field"><label className="ma-field__label" htmlFor="profile-city">ქალაქი *</label><CustomSelect id="profile-city" value={city} onChange={event=>setCity(event.target.value)}>{Object.entries(cities).map(([id,label])=><option key={id} value={id}>{label}</option>)}</CustomSelect></div>
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
          <fieldset className="account-form-group" disabled={pending}>
            <legend>მომსახურება</legend>
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="about">
                კომპანიის შესახებ · მაქს. 1000 სიმბოლო
              </label>
              <textarea className="ma-textarea" id="about" maxLength={1000} aria-describedby="about-count" value={about} onChange={(e) => setAbout(e.target.value)} />
              <p className="ma-field__help account-counter" id="about-count">{about.length}/1000</p>
            </div>
            <div className="ma-form__row ma-form__row--2">
              <ProfileItems id="offers" label="რას ვთავაზობთ" items={offers} disabled={pending} onChange={items=>{setOffers(items);setSaved(false);}}/>
              <ProfileItems id="seeks" label="რას ვეძებთ" items={seeks} disabled={pending} onChange={items=>{setSeeks(items);setSaved(false);}}/>
            </div>
            <CompactMultiSelect id="profile-service-cities" label="მომსახურების ქალაქები" options={Object.entries(cities).map(([value,label])=>({value,label}))} value={serviceCities} exclusiveValue="georgia" disabled={pending} onChange={next=>{setServiceCities(next);setSaved(false);}}/>
          </fieldset>
          <fieldset className="account-form-group" disabled={pending}>
            <legend>მისამართი</legend>
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="address">
                მისამართი <span className="ma-field__opt">არასავალდებულო</span>
              </label>
              <input className="ma-input" id="address" maxLength={200} placeholder="ქუჩა, ნომერი" aria-describedby="address-help" value={address} onChange={(e) => setAddress(e.target.value)} />
              <p className="ma-field__help" id="address-help">ჩანს პროფილზე „მიმართულება“ ბმულით</p>
            </div>
            <LocationPicker city={city} disabled={pending} value={Number.isFinite(parseCoord(lat))&&Number.isFinite(parseCoord(lng))&&Math.abs(parseCoord(lat)!)<=90&&Math.abs(parseCoord(lng)!)<=180?{lat:parseCoord(lat)!,lng:parseCoord(lng)!}:null} onChange={point=>{setLat(point?String(point.lat):"");setLng(point?String(point.lng):"");v.clear("lat");v.clear("lng");setSaved(false);}}/>
            <details className="account-location-details" ref={coordinateDetails}>
              <summary>კოორდინატების ხელით მითითება</summary>
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
              <p className="account-coords__help" id="coords-help">ზუსტი კოორდინატების მითითება რუკაზე მონიშვნის ნაცვლადაც შეგიძლია.</p>
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
          {saved ? <p className="account-save-feedback" role="status"><Icon name="check"/>ცვლილებები შენახულია.</p> : null}
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

type RequestItem = { id: string; ownerId: string; title: string; category: string; city: string; createdAt: string; expiresAt: string; hidden: boolean; photo?: string | null; quantity?: number | null; unit?: string | null };
type OfferItem = { id: string; companyUserId: string; requestId: string; status: string; createdAt: string; price?: number | null; priceType?: string; deliveryDays?: number | null; vatIncluded?: boolean; deliveryIncluded?: boolean };
type Tab = "overview" | "opportunities" | "requests" | "offers" | "saved" | "messages" | "notifications" | "profile" | "business";
type NavItem = { key: Tab; label: string; icon: string; count?: number | null };
const requestHref = (id: string) => `/requests/view/?id=${encodeURIComponent(id)}`;
const offerLabel = (status: string) => status === "chosen" ? "არჩეული" : status === "declined" ? "არ შეირჩა" : "მოლოდინში";
const amount = (offer: OfferItem) => offer.price == null || offer.priceType === "negotiable" ? "შეთანხმებით" : `${new Intl.NumberFormat("ka-GE", { maximumFractionDigits: 2 }).format(offer.price)} ₾${offer.priceType === "unit" ? " / ერთეული" : ""}`;
function readSeen(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("meetany.seen") || "{}") || {}; } catch { return {}; }
}
function Status({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className="account-status" data-tone={tone}>{children}</span>;
}
function RequestPhoto({ request }: { request?: RequestItem | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  return request?.photo && request.photo !== failed ? <img className="account-item-photo" src={request.photo} alt="" width={80} height={56} onError={() => setFailed(request.photo!)} /> : null;
}
function AccountTabs({ tab, items, company }: { tab: Tab; items: NavItem[]; company: boolean }) {
  const list = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = list.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const reveal = () => { if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft += active.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - active.getBoundingClientRect().width) / 2; };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(nav); observer.observe(active);
    return () => observer.disconnect();
  }, [tab]);
  return <aside className="account-nav" aria-label="ანგარიში">
    <div className="account-space">{company ? <><Link href="/account/?tab=requests" aria-current={tab === "requests" ? "page" : undefined}>ყიდვა</Link><Link href="/account/?tab=overview" aria-current={tab !== "requests" ? "page" : undefined}>გაყიდვა</Link></> : <strong>ყიდვა</strong>}</div>
    <nav ref={list} className="account-nav__list" aria-label="ანგარიშის განყოფილებები">{items.map(item => <Link key={item.key} href={`/account/?tab=${item.key}`} aria-current={tab === item.key ? "page" : undefined}><Icon name={item.icon}/><span>{item.label}</span>{item.count != null ? <span className="account-nav__count">{item.count}</span> : null}</Link>)}</nav>
  </aside>;
}
function Filters({ items, value, onChange, label }: { items: { key: string; label: string; count: number }[]; value: string; onChange: (key: string) => void; label: string }) {
  return <div className="account-filter-chips" role="group" aria-label={label}>{items.map(item => <Button key={item.key} variant="secondary" size="sm" aria-pressed={value === item.key} onClick={() => onChange(item.key)}>{item.label}<span>{item.count}</span></Button>)}</div>;
}
function MyRequests({ requests, store, me, now, seen }: { requests: RequestItem[]; store: Store; me: AnyUser; now: number; seen: Record<string, string> }) {
  const [filter, setFilter] = useState("all");
  const [pending, setPending] = useState<string | null>(null);
  const { current: conversations } = useConversationList(store, me.blocked ? undefined : me.id);
  const states = [...new Set(requests.map(request => store.requestState(request) as string))];
  const visible = requests.filter(request => filter === "all" || store.requestState(request) === filter);
  async function extend(id: string) {
    if (pending) return;
    setPending(id);
    try { await store.extendRequest(id); toast("ვადა გაგრძელდა 7 დღით."); }
    catch (err) { toast((err as { userMessage?: string }).userMessage || "ვერ შესრულდა."); }
    finally { setPending(null); }
  }
  return <section className="account-records" aria-label="ჩემი მოთხოვნები">
    <Filters label="მოთხოვნის სტატუსი" value={filter} onChange={setFilter} items={[{ key: "all", label: "ყველა", count: requests.length }, ...states.map(key => ({ key, label: store.stateLabels[key] || key, count: requests.filter(request => store.requestState(request) === key).length }))]}/>
    {visible.length ? <ul className="account-rows account-request-list">{visible.map(request => {
      const state = store.requestState(request);
      const count = store.offerCount(request.id) ?? 0;
      const fresh = (store.visibleOffers(request.id, me) as OfferItem[]).filter(offer => offer.status === "sent" && (!seen[request.id] || Date.parse(offer.createdAt) > Date.parse(seen[request.id]))).length;
      const left = state === "open" ? store.daysLeft(request, now) : null;
      const conversation = conversations?.items?.find(item => item.requestId === request.id);
      const canExtend = (state === "open" && left != null && left <= 7) || state === "expired" || state === "closed";
      return <li className="account-request-card" data-highlight={fresh > 0 || undefined} key={request.id}>
        <div className="account-item-heading"><RequestPhoto request={request}/><div><h2><Link href={requestHref(request.id)} title={request.title}>{request.title}</Link></h2><p>{[request.quantity != null ? `${request.quantity} ${store.units[request.unit || ""] || ""}` : categories[request.category], cities[request.city] || request.city].filter(Boolean).join(" · ")}</p></div></div>
        <Status tone={state === "open" ? "success" : state === "chosen" ? "dark" : "neutral"}>{store.stateLabels[state] || state}</Status>
        <span className="account-request-count"><Icon name="inbox"/>{count} შეთავაზება{fresh ? <strong>+{fresh} ახალი</strong> : null}</span>
        {count ? <Button variant="primary" href={requestHref(request.id)}>შეთავაზებების ნახვა</Button> : conversation ? <Button variant="secondary" onClick={() => openChat({ companyId: conversation.companyId, requestId: request.id, conversation })}><Icon name="message-square"/>ჩატი</Button> : canExtend ? <Button variant="secondary" loading={pending === request.id} disabled={!!pending} onClick={() => void extend(request.id)}>გაგრძელება</Button> : <Button variant="secondary" href={requestHref(request.id)}>მოთხოვნის ნახვა</Button>}
      </li>;
    })}</ul> : <div className="account-empty-state"><p className="account-empty-state__title">{requests.length ? "ამ სტატუსით მოთხოვნა არ არის" : "მოთხოვნა ჯერ არ გაქვს"}</p><p className="account-empty">აღწერე, რა გჭირდება — კომპანიები შეთავაზებებს გამოგიგზავნიან.</p></div>}
  </section>;
}
function SentOffers({ offers, store, me }: { offers: OfferItem[]; store: Store; me: AnyUser }) {
  const [status, setStatus] = useState("all");
  const visible = status === "all" ? offers : offers.filter(offer => offer.status === status);
  const selected = visible.find(offer => offer.status === "chosen");
  const selectedRequest = selected ? store.getRequest(selected.requestId) as RequestItem | null : null;
  const buyer = selectedRequest ? store.userById(selectedRequest.ownerId) as AnyUser | null : null;
  return <section className="account-records" aria-label="ჩემი შეთავაზებები">
    <Filters label="შეთავაზების სტატუსი" value={status} onChange={setStatus} items={[{ key: "all", label: "ყველა", count: offers.length }, ...["sent", "chosen", "declined"].map(key => ({ key, label: offerLabel(key), count: offers.filter(offer => offer.status === key).length }))]}/>
    <div className={`account-offers-layout${selected ? " account-offers-layout--detail" : ""}`}>
      {visible.length ? <ul className="account-rows account-offer-list">{visible.map(offer => {
        const request = store.getRequest(offer.requestId) as RequestItem | null;
        const owner = request ? store.userById(request.ownerId) as AnyUser | null : null;
        return <li className="account-offer-card" data-highlight={offer.status === "chosen" || undefined} key={offer.id}><RequestPhoto request={request}/><div className="account-offer-copy"><h2><Link href={requestHref(offer.requestId)} title={request?.title}>{request?.title || "მოთხოვნა"}</Link></h2><div className="account-offer-buyer"><p>{owner?.company || owner?.name || (request ? cities[request.city] : "")}</p><Status tone={offer.status === "chosen" ? "dark" : offer.status === "sent" ? "warning" : "neutral"}>{offerLabel(offer.status)}</Status></div><div className="account-offer-facts"><strong>{amount(offer)}</strong>{offer.deliveryDays != null ? <span><Icon name="truck"/>{offer.deliveryDays} დღე</span> : null}</div></div></li>;
      })}</ul> : <div className="account-empty-state"><p className="account-empty">{offers.length ? "ამ სტატუსით შეთავაზება არ არის." : "შეთავაზება ჯერ არ გაგიგზავნია."}</p></div>}
      {selected ? <aside className="account-offer-detail" aria-label="არჩეული შეთავაზება"><h2>{selectedRequest?.title || "არჩეული შეთავაზება"}</h2><Status tone="dark">არჩეული</Status><dl><div><dt>ფასი</dt><dd>{amount(selected)}</dd></div>{selected.deliveryDays != null ? <div><dt>მიწოდება</dt><dd>{selected.deliveryDays} დღე</dd></div> : null}<div><dt>მიწოდების ხარჯი</dt><dd>{selected.deliveryIncluded ? "შედის" : "დასაზუსტებელია"}</dd></div>{selected.price != null ? <div><dt>დღგ</dt><dd>{selected.vatIncluded ? "შედის" : "არ შედის"}</dd></div> : null}</dl>{buyer ? <div className="account-buyer-card"><strong>{buyer.company || buyer.name}</strong><p>{cities[buyer.city] || buyer.city}</p></div> : null}{!me.blocked && selectedRequest ? <Button variant="primary" onClick={() => openChat({ companyId: me.id, requestId: selected.requestId })}><Icon name="message-square"/>დეტალების განხილვა</Button> : null}</aside> : null}
    </div>
  </section>;
}
function CompanyWelcome({ me }: { me: AnyUser }) {
  const fields: [string, boolean][] = [["დასახელება", !!me.company?.trim()], ["ქალაქი", !!me.city], ["მიმართულება", !!me.industry], ["აღწერა", !!me.about?.trim()], ["ლოგო", !!me.logoUrl], ["მომსახურებები", !!me.offers?.length], ["მომსახურების ქალაქები", !!me.serviceCities?.length], ["გალერეა", !!me.gallery?.length]];
  const remaining = fields.filter(([, filled]) => !filled).map(([label]) => label);
  const completion = Math.round((fields.length - remaining.length) / fields.length * 100);
  return <><section className="account-profile-status"><div><h2>დადასტურება <Status tone={me.blocked ? "neutral" : me.verified ? "success" : "warning"}>{me.blocked ? "დაბლოკილია" : me.verified ? "დადასტურებული" : "მიმდინარეობს"}</Status></h2><p>{me.verified ? "კომპანიის პროფილი დადასტურებულია." : "კომპანიის მონაცემებს ადმინისტრატორი ამოწმებს."}</p></div><div><div className="account-progress-heading"><h2>პროფილი · {completion}%</h2><Link href="/account/?tab=profile">{remaining.length ? "დასრულება" : "რედაქტირება"}</Link></div><progress aria-label="პროფილის სისრულე" value={completion} max={100}/><p>{remaining.length ? `დარჩა: ${remaining.join(", ")}` : "პროფილი სრულად შევსებულია"}</p></div></section><div className="account-quick-actions"><Button variant="primary" href="/requests/"><Icon name="search"/>მოთხოვნების ნახვა</Button><Button variant="secondary" href="/companies/"><Icon name="building-2"/>კომპანიები</Button><Button variant="secondary" href="/account/?tab=saved"><Icon name="bookmark"/>შენახული</Button><Button variant="secondary" href="/account/?tab=profile"><Icon name="user-round"/>პროფილი</Button></div></>;
}
function Opportunities({ requests, store, overview }: { requests: RequestItem[]; store: Store; overview: boolean }) {
  return <section className="account-records"><div className="account-section__head"><h2 className="account-section__title">{overview ? "თქვენთვის" : "შესაბამისი მოთხოვნები"}</h2>{overview ? <Link className="account-link" href="/account/?tab=opportunities">ყველა</Link> : null}</div>{requests.length ? <ul className="account-recommendations">{(overview ? requests.slice(0, 4) : requests).map(request => {
    const owner = store.userById(request.ownerId) as AnyUser | null;
    return <li key={request.id}><RequestPhoto request={request}/><div><Status tone="success">ყიდვის მოთხოვნა</Status><h3><Link href={requestHref(request.id)} title={request.title}>{request.title}</Link></h3><p>{[owner?.company || owner?.name, cities[request.city] || request.city].filter(Boolean).join(" · ")}</p><Link className="account-link" href={requestHref(request.id)}>შეთავაზება</Link></div></li>;
  })}</ul> : <p className="account-empty">შენი დარგით ღია მოთხოვნა ჯერ არ არის — შეგიძლია სხვა მიმართულებებიც ნახო.</p>}</section>;
}
export function AccountPageContent() {
  const { store, ready, available } = useMarketStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab") || "";
  const tab: Tab = rawTab === "opportunities" || rawTab === "business" || rawTab === "saved" || rawTab === "messages" || rawTab === "requests" || rawTab === "offers" || rawTab === "notifications" ? rawTab : rawTab === "alerts" ? "notifications" : ["profile", "settings"].includes(rawTab) ? "profile" : "overview";
  const [seen] = useState(readSeen);
  const [now] = useState(() => Date.now());
  const me = ready && available ? store?.currentUser() as AnyUser | null : null;
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
      const matching = (store.listRequests({ category: groupOf[me.industry || ""] || me.industry }) as RequestItem[]).filter(request => request.ownerId !== me.id).sort((a, b) => Number(b.city === me.city) - Number(a.city === me.city));
      return { matching, myOffers: store.myOffers(me) as OfferItem[], myRequests };
    }
    return { matching: [] as RequestItem[], myOffers: [] as OfferItem[], myRequests };
  }, [store, me]);
  if (ready && !available) return <div className="ma-page"><ServiceUnavailable/></div>;
  if (!ready || me?.role === "admin") return <AccountSkeleton admin={me?.role === "admin"}/>;
  if (!me || !store) return <AuthForms initialRole={searchParams.get("role") || ""}/>;
  const isCompany = me.role === "company";
  const activeTab: Tab = !isCompany && ["overview", "opportunities", "offers", "business"].includes(tab) ? "requests" : tab;
  const { myRequests = [], myOffers = [], matching = [] } = data || {};
  const engagement = store.engagement();
  const tabs: NavItem[] = [
    ...(isCompany ? [{ key: "overview" as Tab, label: "მიმოხილვა", icon: "layout-grid" }, { key: "opportunities" as Tab, label: "შესაძლებლობები", icon: "search", count: matching.length }, { key: "offers" as Tab, label: "ჩემი შეთავაზებები", icon: "send", count: myOffers.length }] : []),
    { key: "requests", label: "ჩემი მოთხოვნები", icon: "clipboard-list", count: myRequests.length },
    { key: "saved", label: isCompany ? "შენახული" : "შენახული კომპანიები", icon: "bookmark", count: engagement?.status === "ready" ? engagement.savedIds.length : null },
    { key: "messages", label: "მესიჯები", icon: "message-square", count: unread },
    { key: "notifications", label: "შეტყობინებები", icon: "bell", count: engagement?.status === "ready" ? engagement.unread : null },
    ...(isCompany ? [{ key: "business" as Tab, label: "ხილვადობის პაკეტები", icon: "eye" }] : []),
    { key: "profile", label: isCompany ? "კომპანიის პროფილი" : "პროფილი", icon: "user-round" },
  ];
  const buying = !isCompany || activeTab === "requests";
  const title = activeTab === "overview" ? `გამარჯობა, ${me.company || me.name}` : tabs.find(item => item.key === activeTab)?.label;
  return <div className="ma-page account-page"><AccountTabs tab={activeTab} items={tabs} company={isCompany}/><div className="account-main">
    <header className="account-page-heading"><div><h1>{title}</h1><p>{activeTab === "overview" ? "თქვენი პროფილით შერჩეული შესაძლებლობები." : activeTab === "requests" ? "მართე მოთხოვნები და მიღებული შეთავაზებები." : activeTab === "offers" ? "თვალი ადევნე გაგზავნილ შეთავაზებებს." : "შენი ანგარიშის სამუშაო სივრცე."}</p></div>{activeTab !== "overview" ? <Button variant={buying ? "primary" : "secondary"} href={buying ? "/requests/new/" : "/requests/"}><Icon name={buying ? "plus" : "search"}/>{buying ? "ახალი მოთხოვნა" : "ახალი შესაძლებლობები"}</Button> : null}</header>
    {activeTab === "overview" ? <><CompanyWelcome me={me}/><Opportunities requests={matching} store={store} overview/></> : null}
    {activeTab === "opportunities" ? <Opportunities requests={matching} store={store} overview={false}/> : null}
    {activeTab === "requests" ? <MyRequests key={me.id} requests={myRequests} store={store} me={me} now={now} seen={seen}/> : null}
    {activeTab === "offers" ? <SentOffers key={me.id} offers={myOffers} store={store} me={me}/> : null}
    {activeTab === "saved" ? <div className="account-panel"><EngagementPanel kind="saved"/></div> : null}
    {activeTab === "notifications" ? <div id="alerts" className="account-panel account-alerts"><EngagementPanel kind="notifications" all={searchParams.get("alerts") === "all"}/></div> : null}
    {activeTab === "messages" ? <div className="account-wide"><Inbox key={me.id} store={store} me={me}/></div> : null}
    {activeTab === "business" ? <CompanyBusinessPanel key={me.id} owner={me.id}/> : null}
    {activeTab === "profile" ? <div className="account-main--profile">{me.blocked ? <p className="ma-field__error" role="status">ანგარიში დაბლოკილია.</p> : null}{isCompany ? <CompanyProfile me={me} section={searchParams.get("section") || "details"}/> : <><ProfileForm me={me}/><PasswordForm key={me.id}/></>}</div> : null}
  </div></div>;
}
