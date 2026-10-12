"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { Icon } from "../../Icon";
import { Button } from "../../ui/Button";
import { CustomSelect } from "../../ui/CustomSelect";
import { CompactMultiSelect } from "../../ui/CompactMultiSelect";
import { toast } from "../../Toasts";
import { PasswordInput } from "../AuthForms";
import { useFieldErrors, type FieldErrors } from "../fieldErrors";
import { LogoField, GalleryField, type GalleryItem } from "../PhotoField";
import { CompanyProducts } from "../CompanyProducts";
import { ProfileItems } from "../ProfileItems";
import { LocationPicker } from "../LocationPicker";
import { CompanyDistributionPanel } from "../CompanyBusiness";
import { useMarketStore } from "../../../lib/market-client";
import { cities } from "../../../lib/categories";
import { categoryOptions } from "../CategoryOptions";
import type { AnyUser } from "./shared";
import styles from "./ProfileForm.module.css";
const profileSections = { details: "მონაცემები და ფოტოები", products: "პროდუქტები", distribution: "დისტრიბუცია", security: "პაროლი" };
export function CompanyProfileNav({active}:{active:string}) {
 return <nav className="company-profile-sections" aria-label="კომპანიის პროფილის განყოფილებები">{Object.entries(profileSections).map(([key,label])=><Link key={key} href={`/account/?tab=profile&section=${key}`} aria-current={active===key?"page":undefined}>{label}</Link>)}</nav>;
}
export function CompanyProfile({me,section}:{me:AnyUser;section:string}) {
 const active=Object.hasOwn(profileSections,section)?section:"details";
 return <>
  <CompanyProfileNav active={active}/>
  {active==="details"?<ProfileForm key={me.id} me={me}/>:active==="products"?<section className="account-section"><CompanyProducts companyId={me.id} edit/></section>:active==="distribution"?<CompanyDistributionPanel owner={me.id}/>:<PasswordForm key={me.id}/>}
 </>;
}

/** "41,7151" → 41.7151; empty → null; anything else → NaN. */
function parseCoord(value: string) {
  const text = value.trim().replace(",", ".");
  if (!text) return null;
  return /^[-−]?\d+(\.\d+)?$/.test(text) ? Number(text.replace("−", "-")) : NaN;
}

export function ProfileForm({ me }: { me: AnyUser }) {
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
  const [mapOpen, setMapOpen] = useState(false);
  const v = useFieldErrors();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    const errors: FieldErrors = {};
    if (name.trim().length < 2) errors.name = "მიუთითეთ სახელი და გვარი";
    if (isCompany && company.trim().length < 2) errors.company = "მიუთითეთ კომპანიის დასახელება";
    const latValue = isCompany ? parseCoord(lat) : null;
    const lngValue = isCompany ? parseCoord(lng) : null;
    if (latValue !== null && !(latValue >= -90 && latValue <= 90)) errors.lat = "განედი რიცხვია −90-დან 90-მდე";
    if (lngValue !== null && !(lngValue >= -180 && lngValue <= 180)) errors.lng = "გრძედი რიცხვია −180-დან 180-მდე";
    if (!errors.lat && !errors.lng) {
      if (latValue === null && lngValue !== null) errors.lat = "მიუთითეთ განედიც ან წაშალეთ ორივე";
      if (lngValue === null && latValue !== null) errors.lng = "მიუთითეთ გრძედიც ან წაშალეთ ორივე";
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
    <section className={`account-section ${styles.profileForm}`}>
      <div className={styles.heading}>
        <h2 className="account-section__title">{isCompany ? "მონაცემები და ფოტოები" : "პირადი მონაცემები"}</h2>
        <p className="account-hint">{isCompany ? "ეს ინფორმაცია ჩანს საჯარო პროფილზე და კომპანიების კატალოგში." : "სახელი და კომპანია ჩანს თქვენს მოთხოვნებზე."}</p>
      </div>
      <form id="account-profile-form" className="ma-form" onSubmit={submit} onChange={() => setSaved(false)} noValidate>
        <fieldset className="account-form-group" disabled={pending}>
          {isCompany ? <legend>ძირითადი</legend> : null}
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
        <div className="ma-form__row ma-form__row--2">
        <div className="ma-field profile-city-field"><label className="ma-field__label" htmlFor="profile-city">ქალაქი *</label><CustomSelect id="profile-city" value={city} onChange={event=>setCity(event.target.value)}>{Object.entries(cities).map(([id,label])=><option key={id} value={id}>{label}</option>)}</CustomSelect></div>
          {isCompany ? (
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="industry">
                დარგი *
              </label>
              <CustomSelect className="ma-select" id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                {categoryOptions()}
              </CustomSelect>
            </div>
          ) : null}
        </div>
        </fieldset>
        {isCompany ? <fieldset className="account-form-group" disabled={pending}><legend>ლოგო და ფოტოები</legend><div className={styles.media}>
        {isCompany ? <LogoField compact name={company || name} logoUrl={logoUrl} file={logoFile} disabled={pending} uploading={uploading === "logo"}
          onChange={file => { setLogoFile(file); setLogoChanged(true); setSaved(false); }}
          onRemove={() => { setLogoFile(null); setLogoUrl(""); setLogoChanged(true); setSaved(false); }} /> : null}
        {isCompany ? <GalleryField compact items={gallery} disabled={pending} uploading={uploading === "gallery"}
          onChange={next => { setGallery(next); setGalleryChanged(true); setSaved(false); }} /> : null}

        </div></fieldset> : null}
        <fieldset className="account-form-group" disabled={pending}><legend>კონტაქტი</legend>
        <div className="ma-form__row ma-form__row--2 account-contact">
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

        </div>
        <p className="ma-field__help account-contact__help" id="profile-phone-help">კონტაქტს მხოლოდ გარიგების მეორე მხარე ხედავს. შესაცვლელად: <Link href="/terms/#contact">მხარდაჭერასთან დაკავშირება</Link>.</p>
        </fieldset>
        {isCompany ? (
          <>
          <fieldset className="account-form-group" disabled={pending}>
            <legend>მომსახურება</legend>
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="about">
                კომპანიის შესახებ <span className="ma-field__opt" id="about-count">{about.length}/1000</span>
              </label>
              <textarea className="ma-textarea" id="about" maxLength={1000} aria-describedby="about-count" value={about} onChange={(e) => setAbout(e.target.value)} />
            </div>
            <div className="ma-form__row ma-form__row--2">
              <ProfileItems compact id="offers" label="რას ვთავაზობთ" items={offers} disabled={pending} onChange={items=>{setOffers(items);setSaved(false);}}/>
              <ProfileItems compact id="seeks" label="რას ვეძებთ" items={seeks} disabled={pending} onChange={items=>{setSeeks(items);setSaved(false);}}/>
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
              <p className="ma-field__help" id="address-help">ჩანს საჯარო პროფილზე ბმულით „მისამართი რუკაზე“.</p>
            </div>
            <details className={styles.locationDetails} onToggle={e => setMapOpen(e.currentTarget.open)}><summary><Icon name="map-pin"/><span>მდებარეობა რუკაზე</span>{lat && lng ? <small>მონიშნულია</small> : null}<Icon name="chevron-down"/></summary>
            {mapOpen ? <LocationPicker city={city} disabled={pending} value={Number.isFinite(parseCoord(lat))&&Number.isFinite(parseCoord(lng))&&Math.abs(parseCoord(lat)!)<=90&&Math.abs(parseCoord(lng)!)<=180?{lat:parseCoord(lat)!,lng:parseCoord(lng)!}:null} onChange={point=>{setLat(point?String(point.lat):"");setLng(point?String(point.lng):"");v.clear("lat");v.clear("lng");setSaved(false);}}/> : null}
            </details>
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
              <p className="account-coords__help" id="coords-help">რუკაზე მონიშვნის ნაცვლად ზუსტი კოორდინატებიც შეგიძლიათ მიუთითოთ.</p>
            </fieldset>
            </details>
          </fieldset>
          </>
        ) : null}
        {/* Save sits after the last field, where the form ends. */}
        <div className="account-form-actions">
          <Button variant="primary" type="submit" loading={pending}>ცვლილებების შენახვა</Button>
          {isCompany ? <Button variant="ghost" href={`/companies/view/?id=${encodeURIComponent(me.id)}`}><Icon name="external-link"/>საჯარო პროფილის ნახვა</Button> : null}
          {saved ? <p className="account-save-feedback" role="status"><Icon name="check"/>ცვლილებები შენახულია.</p> : null}
        </div>
        {error ? <p className="ma-field__error" role="alert">{error}</p> : null}
      </form>
    </section>
  );
}

export function PasswordForm() {
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
    if (!current) errors["password-current"] = "მიუთითეთ მიმდინარე პაროლი";
    if (password.length < 8) errors["password-new"] = "პაროლი მოკლეა";
    if (password.length > 128) errors["password-new"] = "პაროლი გრძელია";
    if (!repeat) errors["password-repeat"] = "შეიყვანეთ პაროლი ხელახლა";
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
            <label className="ma-field__label" htmlFor="password-new">ახალი პაროლი <span className="ma-field__opt">8–128 სიმბოლო</span></label>
            <PasswordInput autoComplete="new-password" disabled={pending} value={password} onChange={value => {setPassword(value); v.clear("password-new"); v.clear("password-repeat");}} field={{...v.control("password-new"), maxLength: 128}} />
            <div className="auth-field-message">{v.message("password-new")}</div>
          </div>
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="password-repeat">ახალი პაროლი ხელახლა</label>
            <PasswordInput autoComplete="new-password" disabled={pending} value={repeat} onChange={value => {setRepeat(value); v.clear("password-repeat");}} field={{...v.control("password-repeat"), maxLength: 128}} />
            <div className="auth-field-message">{v.message("password-repeat")}</div>
          </div>
        </fieldset>
        {error ? <p className="ma-field__error" role="alert">{error}</p> : null}
        <div className="account-form-actions">
          <Button variant="primary" type="submit" disabled={pending}>{pending ? "ინახება…" : "პაროლის შეცვლა"}</Button>
        </div>
      </form>
    </section>
  );
}

