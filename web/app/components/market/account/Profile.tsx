"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
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
import { CategoryChips } from "../../ui/CategoryChips";
import { ChipsInput } from "../../ui/ChipsInput";
import { Sheet } from "../../ui/Sheet";
import { ConfirmSheet } from "../../ui/ConfirmSheet";
import { useUnsavedGuard } from "../../../lib/use-unsaved-draft";
import { normalizeMobilePhone } from "../../../lib/mobile-phone";
import { isEmail } from "../fieldErrors";
import { readOnboardProfile, type OnboardProfile } from "../../../lib/onboarding-client";
import { VerificationDocuments } from "../VerificationDocuments";
import type { AnyUser } from "./shared";
import styles from "./ProfileForm.module.css";
const profileSections = { details: "მონაცემები და ფოტოები", legal: "იურიდიული მონაცემები", documents: "დოკუმენტები", products: "პროდუქტები", distribution: "დისტრიბუცია", security: "პაროლი" };
export function CompanyProfileNav({active}:{active:string}) {
 return <nav className="company-profile-sections ma-scroll-row" aria-label="კომპანიის პროფილის განყოფილებები">{Object.entries(profileSections).map(([key,label])=><Link key={key} href={`/account/?tab=profile&section=${key}`} aria-current={active===key?"page":undefined}>{label}</Link>)}</nav>;
}
export function CompanyProfile({me,section}:{me:AnyUser;section:string}) {
 const active=Object.hasOwn(profileSections,section)?section:"details";
 return <>
  <CompanyProfileNav active={active}/>
  {active==="details"?<ProfileForm key={me.id} me={me}/>:active==="legal"?<LegalProfile key={me.id}/>:active==="documents"?<ProfileDocuments key={me.id} me={me}/>:active==="products"?<section className="account-section"><CompanyProducts companyId={me.id} edit/></section>:active==="distribution"?<CompanyDistributionPanel owner={me.id}/>:<PasswordForm key={me.id}/>}
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
  const [savedAt, setSavedAt] = useState("");
  const coordinateDetails = useRef<HTMLDetailsElement>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const v = useFieldErrors();

  const snapshot = JSON.stringify({name, company, city, industry, about, offers, seeks, serviceCities, address, lat, lng});
  const [baseline, setBaseline] = useState(snapshot);
  const dirty = snapshot !== baseline || logoChanged || galleryChanged;
  const guard = useUnsavedGuard(dirty);
  async function submit(e: React.FormEvent) { e.preventDefault(); await save(); }
  async function save() {
    if (!store || pending) return false;
    if (!dirty) return true;
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
    if (!city) errors["profile-city"] = "აირჩიეთ ქალაქი";
    if (isCompany && !industry) errors.industry = "აირჩიეთ დარგი";
    if (!v.check(errors, ["name", "company", "profile-city", "industry", "lat", "lng"])) {
      if (guard.open) setError("შეასწორეთ მონიშნული ველები. ფორმაში დასაბრუნებლად აირჩიეთ „დარჩენა“.");
      return false;
    }
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
      setBaseline(snapshot);
      setSavedAt(new Date().toLocaleTimeString("ka-GE", {hour:"2-digit", minute:"2-digit"}));
      setSaved(true);
      toast("პროფილი შენახულია.");
      return true;
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "ვერ შესრულდა.");
      return false;
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
        <div className="ma-field profile-city-field"><label className="ma-field__label" htmlFor="profile-city">ქალაქი *</label><CustomSelect {...v.control("profile-city")} value={city} onChange={event=>{setCity(event.target.value);v.clear("profile-city");}}>{Object.entries(cities).map(([id,label])=><option key={id} value={id}>{label}</option>)}</CustomSelect>{v.message("profile-city")}</div>
          {isCompany ? (
            <div className="ma-field account-category-field">
              <label className="ma-field__label" htmlFor="industry">
                დარგი *
              </label>
              <CategoryChips id="industry" label="დარგი" compact value={industry ? [industry] : []} onChange={value => {setIndustry(value[0] || ""); v.clear("industry");}} />
              {v.message("industry")}
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
        <ContactChange me={me}/>
        </fieldset>
        {isCompany ? (
          <>
          <fieldset className="account-form-group" disabled={pending}>
            <legend>მომსახურება</legend>
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="about">
                კომპანიის შესახებ (არასავალდებულო) <span className="ma-field__opt" id="about-count">{about.length}/1000</span>
              </label>
              <textarea className="ma-textarea" id="about" maxLength={1000} aria-describedby="about-count" value={about} onChange={(e) => setAbout(e.target.value)} />
            </div>
            <div className="ma-form__row ma-form__row--2">
              <ProfileItems compact id="offers" label="რას ვთავაზობთ" items={offers} disabled={pending} onChange={items=>{setOffers(items);setSaved(false);}}/>
              <ProfileItems compact id="seeks" label="რას ვეძებთ" items={seeks} disabled={pending} onChange={items=>{setSeeks(items);setSaved(false);}}/>
            </div>
            <CompactMultiSelect id="profile-service-cities" label="მომსახურების ქალაქები" options={Object.entries(cities).map(([value,label])=>({value,label}))} value={serviceCities} exclusiveValue="georgia" disabled={pending} onChange={next=>{setServiceCities(next);setSaved(false);}}/>
            <p className="ma-field__help">იგივე სია დისტრიბუციის რეგიონებისაა</p>
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
        <div className="ma-form-bar">
          <p className="ma-form-bar__note" role="status">{dirty ? "შეუნახავი ცვლილებები" : saved ? `შენახულია ${savedAt}` : "ცვლილებები არ არის"}</p>
          <Button variant="primary" type="submit" loading={pending}>შენახვა</Button>
        </div>
        {error ? <p className="ma-field__error" role="alert">{error}</p> : null}
      </form>
      <UnsavedSheet guard={guard} pending={pending} error={error} save={save}/>
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


function UnsavedSheet({guard, pending, error, save}: {guard: ReturnType<typeof useUnsavedGuard>; pending: boolean; error: string | null; save: () => Promise<boolean>}) {
 return <ConfirmSheet id="profile-unsaved" open={guard.open} title="შეუნახავი ცვლილებები" confirmLabel="შენახვა" pendingLabel="ინახება…" cancelLabel="დარჩენა" pending={pending} error={error} onCancel={guard.stay} onConfirm={async () => {if (await save()) guard.leave();}}>
  <p>გასვლამდე შეინახეთ ცვლილებები ან უარყავით ისინი.</p>
  <Button variant="ghost" disabled={pending} onClick={guard.leave}>უარყოფა</Button>
 </ConfirmSheet>;
}

function ContactChange({me}: {me: AnyUser}) {
 const {store} = useMarketStore();
 const [open, setOpen] = useState(false), [phone, setPhone] = useState(''), [email, setEmail] = useState(''), [note, setNote] = useState('');
 const [pending, setPending] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false);
 const fields = useFieldErrors();
 async function send(event: React.FormEvent) {
  event.preventDefault(); event.stopPropagation();
  if (!store || pending) return;
  const errors: FieldErrors = {};
  if (phone.trim() && !normalizeMobilePhone(phone)) errors['contact-phone'] = 'ჩაწერეთ მობილურის ნომერი';
  if (email.trim() && !isEmail(email)) errors['contact-email'] = 'ჩაწერეთ სწორი ელფოსტა';
  if (!phone.trim() && !email.trim()) errors['contact-phone'] = 'მიუთითეთ ახალი ტელეფონი ან ელფოსტა';
  if (!fields.check(errors, Object.keys(errors))) return;
  setPending(true); setError('');
  try {
   await store.callRpc('request_contact_change', {p_phone: phone.trim() || null, p_email: email.trim() || null, p_note: note.trim() || null});
   setSent(true); setOpen(false); setPhone(''); setEmail(''); setNote('');
  } catch (failure) {
   const detail = failure as {code?: string; hint?: string; message?: string; userMessage?: string; cause?: {code?: string; hint?: string; message?: string}};
   const text = [detail.code, detail.hint, detail.message, detail.userMessage, detail.cause?.code, detail.cause?.hint, detail.cause?.message].join(' ');
   setError(text.includes('MA710') ? 'მოთხოვნა უკვე გაგზავნილია' : text.includes('MA711') ? 'მიუთითეთ ახალი, სწორი კონტაქტი; მოთხოვნა მაქსიმუმ 500 სიმბოლოა.' : detail.userMessage || 'მოთხოვნა ვერ გაიგზავნა. სცადეთ ხელახლა.');
  } finally {setPending(false);}
 }
 return <>
  <dl className={styles.contacts}><div><dt>ტელეფონი</dt><dd>{me.phone}</dd></div><div><dt>ელფოსტა</dt><dd>{me.email}</dd></div></dl>
  <Button variant="secondary" aria-label="კონტაქტის შეცვლა" aria-haspopup="dialog" onClick={() => setOpen(true)}>შეცვლა</Button>
  {sent && <p role="status">მოთხოვნა გაგზავნილია. პასუხს მიიღებთ 1–2 სამუშაო დღეში.</p>}
  {open && createPortal(<Sheet open={open} onClose={() => {if (!pending) setOpen(false);}} title="კონტაქტის შეცვლა" footer={<Button type="submit" form="contact-change" loading={pending}>მოთხოვნის გაგზავნა</Button>}>
   <p>ეს ანგარიშის იდენტიფიკატორებია; ცვლილებას ადმინისტრატორი ასრულებს 1–2 სამუშაო დღეში</p>
   <form id="contact-change" className="ma-form" onSubmit={send} noValidate>
    <div className="ma-field"><label className="ma-field__label" htmlFor="contact-phone">ახალი ტელეფონი</label><input className="ma-input" type="tel" autoComplete="tel" value={phone} onChange={e => {setPhone(e.target.value); fields.clear('contact-phone');}} {...fields.control('contact-phone')}/>{fields.message('contact-phone')}</div>
    <div className="ma-field"><label className="ma-field__label" htmlFor="contact-email">ახალი ელფოსტა</label><input className="ma-input" type="email" autoComplete="email" maxLength={200} value={email} onChange={e => {setEmail(e.target.value); fields.clear('contact-email');}} {...fields.control('contact-email')}/>{fields.message('contact-email')}</div>
    <div className="ma-field"><label className="ma-field__label" htmlFor="contact-note">შენიშვნა</label><textarea className="ma-textarea" id="contact-note" maxLength={500} value={note} onChange={e => setNote(e.target.value)}/><p className="ma-field__help">მთლიანი მოთხოვნა — მაქსიმუმ 500 სიმბოლო.</p></div>
    {error && <p className="ma-field__error" role="alert">{error}</p>}
   </form>
  </Sheet>, document.body)}
 </>;
}

function ProfileDocuments({me}: {me: AnyUser}) {
 const {store} = useMarketStore();
 const [profile, setProfile] = useState<OnboardProfile | null>(null), [error, setError] = useState('');
 useEffect(() => {let active = true; if (store) void readOnboardProfile(store).then(p => {if(active) setProfile(p);}, () => {if(active) setError('დოკუმენტების სტატუსი ვერ ჩაიტვირთა.');}); return () => {active=false;};}, [store]);
 return <section className="account-section"><h2 className="account-section__title">დოკუმენტები</h2>{error ? <p role="alert">{error}</p> : profile && store ? <VerificationDocuments store={store} id={me.id} status={profile.verification_documents_status} verified={profile.verified} note={profile.verification_note} onStatus={status => setProfile({...profile, verification_documents_status: status as OnboardProfile['verification_documents_status']})}/> : <p role="status">იტვირთება…</p>}</section>;
}

const legalFields = [
 ['legal_name', 'იურიდიული სახელი', 200], ['registration_code', 'საიდენტიფიკაციო კოდი', 40],
 ['contact_position', 'პოზიცია', 100], ['website', 'ვებგვერდი', 500],
] as const;
function LegalProfile() {
 const {store} = useMarketStore();
 const [profile, setProfile] = useState<OnboardProfile | null>(null), [baseline, setBaseline] = useState('');
 const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null), [savedAt, setSavedAt] = useState('');
 const fields = useFieldErrors();
 const editable = (p: OnboardProfile) => JSON.stringify([...legalFields.map(([key]) => p[key]), p.legal_form, p.founded_year, p.employee_band, p.markets, p.languages]);
 useEffect(() => {let active=true; if(store) void readOnboardProfile(store).then(p => {if(active) {setProfile(p); setBaseline(editable(p));}}, () => {if(active) setError('მონაცემები ვერ ჩაიტვირთა.');}); return () => {active=false;};}, [store]);
 const dirty = !!profile && editable(profile) !== baseline;
 const guard = useUnsavedGuard(dirty);
 const patch = (value: Partial<OnboardProfile>) => setProfile(p => p ? {...p, ...value} : p);
 async function save() {
  if (!store || !profile || pending) return false;
  if (!dirty) return true;
  const errors: FieldErrors = {};
  if (profile.legal_name && profile.legal_name.trim().length < 2) errors['legal-legal_name'] = 'მინიმუმ 2 სიმბოლო';
  if (profile.registration_code && profile.registration_code.trim().length < 3) errors['legal-registration_code'] = 'მინიმუმ 3 სიმბოლო';
  if (profile.website && !/^https?:\/\//.test(profile.website)) errors['legal-website'] = 'ბმული დაიწყეთ https://-ით';
  if (profile.founded_year !== null && (!Number.isInteger(profile.founded_year) || profile.founded_year < 1800 || profile.founded_year > new Date().getFullYear())) errors['legal-year'] = 'მიუთითეთ წელი 1800-დან მიმდინარე წლამდე';
  if (!fields.check(errors, Object.keys(errors))) {if (guard.open) setError('შეასწორეთ მონიშნული ველები. ფორმაში დასაბრუნებლად აირჩიეთ „დარჩენა“.'); return false;}
  setPending(true); setError(null);
  try {
   // Preserve the other onboarding fields from a fresh server row.
   const current = await readOnboardProfile(store);
   await store.mutateRpc('set_onboarding_details', {p_account_intent: current.account_intent, p_business_tags: current.business_tags, p_certificates: current.certificates,
    p_legal_name: profile.legal_name?.trim() || null, p_registration_code: profile.registration_code?.trim() || null,
    p_legal_form: profile.legal_form || null, p_founded_year: profile.founded_year, p_employee_band: profile.employee_band || null,
    p_contact_position: profile.contact_position?.trim() || null, p_website: profile.website?.trim() || null,
    p_markets: profile.markets, p_languages: profile.languages});
   setBaseline(editable(profile)); setSavedAt(new Date().toLocaleTimeString('ka-GE', {hour:'2-digit', minute:'2-digit'})); return true;
  } catch(failure) {setError((failure as {userMessage?: string}).userMessage || 'მონაცემები ვერ შეინახა.'); return false;}
  finally {setPending(false);}
 }
 return <section className={`account-section ${styles.profileForm}`}><h2 className="account-section__title">იურიდიული მონაცემები</h2><p className="account-hint">ყველა ველი არასავალდებულოა.</p>
  {profile ? <form className="ma-form" onSubmit={async e => {e.preventDefault(); await save();}} noValidate>
   <fieldset className="account-form-group" disabled={pending}><div className="ma-form__row ma-form__row--2">
    {legalFields.map(([key, label, max]) => <div className="ma-field" key={key}><label className="ma-field__label" htmlFor={`legal-${key}`}>{label}</label><input className="ma-input" maxLength={max} type={key === 'website' ? 'url' : 'text'} value={profile[key] || ''} onChange={e => {patch({[key]: e.target.value || null}); fields.clear(`legal-${key}`);}} {...fields.control(`legal-${key}`)}/>{fields.message(`legal-${key}`)}</div>)}
    <div className="ma-field"><label className="ma-field__label" htmlFor="legal-form">იურიდიული ფორმა</label><CustomSelect id="legal-form" value={profile.legal_form || ''} onChange={e => patch({legal_form: e.target.value || null})}><option value="">აირჩიეთ</option>{Array.from(new Set(['შპს', 'ინდ. მეწარმე', 'სს', 'კოოპერატივი', 'სხვა', ...(profile.legal_form ? [profile.legal_form] : [])])).map(value => <option key={value}>{value}</option>)}</CustomSelect></div>
    <div className="ma-field"><label className="ma-field__label" htmlFor="legal-year">დაარსების წელი</label><input className="ma-input" type="number" min={1800} max={new Date().getFullYear()} value={profile.founded_year ?? ''} onChange={e => {patch({founded_year: e.target.value ? Number(e.target.value) : null}); fields.clear('legal-year');}} {...fields.control('legal-year')}/>{fields.message('legal-year')}</div>
    <div className="ma-field"><label className="ma-field__label" htmlFor="legal-employees">თანამშრომლები</label><CustomSelect id="legal-employees" value={profile.employee_band || ''} onChange={e => patch({employee_band: e.target.value || null})}><option value="">აირჩიეთ</option>{['1-7','8-50','51-200','201+'].map(value => <option key={value}>{value}</option>)}</CustomSelect></div>
   </div><ChipsInput id="legal-markets" label="ბაზრები" compact values={profile.markets} onChange={markets => patch({markets})}/><ChipsInput id="legal-languages" label="ენები" compact values={profile.languages} onChange={languages => patch({languages})}/></fieldset>
   <div className="ma-form-bar"><p className="ma-form-bar__note" role="status">{dirty ? 'შეუნახავი ცვლილებები' : savedAt ? `შენახულია ${savedAt}` : 'ცვლილებები არ არის'}</p><Button type="submit" loading={pending}>შენახვა</Button></div>
  </form> : !error ? <p role="status">იტვირთება…</p> : null}
  {error && <p className="ma-field__error" role="alert">{error}</p>}
  <UnsavedSheet guard={guard} pending={pending} error={error} save={save}/>
 </section>;
}
