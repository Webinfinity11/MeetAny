"use client";
import { attachmentDraft as createAttachmentDraft } from "../../lib/attachment-draft";
import { FileAttachments } from "./FileAttachments";
import { RequestPreferenceFields, RequestPreferenceSummary, preferenceError, type RequestPreferences } from "./RequestPreferences";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import { Icon } from "../Icon";
import { useMarketStore, type PublicSnapshot, type Store } from "../../lib/market-client";
import { categories, categoryIcon, cities, currentCategory, units } from "../../lib/categories";
import { clearRequestDraft, deleteServerDraft, hasRequestDraftContent, loadServerDraft, readRequestDraft, readRequestDraftAt, saveRequestDraft, saveServerDraft, type RequestDraft } from "../../lib/request-draft";
import { toast } from "../Toasts";
import { categoryOptions } from "./CategoryOptions";
import { MatchingSuppliers, MatchingPreview } from "./post/MatchingSuppliers";
import styles from "./post/Post.module.css";
import { PostRequestSkeleton } from "./post/PostRequestSkeleton";
import { PhotoField } from "./PhotoField";
import { useFieldErrors, type FieldErrors } from "./fieldErrors";

const steps = ["დეტალები", "მიწოდება", "გადახედვა", "გამოქვეყნდა"];
const detailFields = ["title", "category", "body", "quantity"];
const deliveryFields = ["city", "neededBy"];
const dateLabel = (iso: string) => iso ? iso.split("-").reverse().join(".") : "—";
const draftDate = (value: string) => /^\d{2}\.\d{2}\.\d{4}$/.test(value) ? value.split(".").reverse().join("-") : "";
const furthestFor = (draft: RequestDraft | null) => draft && draft.title.trim().length > 0 && draft.body.trim().length >= 10 && Object.hasOwn(categories, draft.category) && Number(draft.quantity.replace(",", ".")) > 0 ? (draftDate(draft.neededByText) ? 3 : 2) : 1;

function StepBar({ step }: { step: number }) {
  return <nav className="post-steps" aria-label="მოთხოვნის განთავსების ნაბიჯები">
    <div className="post-steps__mobile" aria-hidden="true">
      <div><strong>{steps[step - 1]}</strong><span>ნაბიჯი {step} / 4</span></div>
      <div className="post-steps__progress">{steps.map((name, i) => <span key={name} className={(i + 1 < step || step === 4) ? "is-done" : i + 1 === step ? "is-current" : ""} />)}</div>
    </div>
    <ol>{steps.map((name, i) => <li key={name} className={(i + 1 < step || step === 4) ? "is-done" : i + 1 === step ? "is-current" : ""} aria-current={i + 1 === step ? "step" : undefined}>
      <span className="post-steps__circle">{(i + 1 < step || step === 4) ? <Icon name="check" /> : i + 1}</span><span>{name}</span>{i < 3 ? <span className="post-steps__line" /> : null}
    </li>)}</ol>
  </nav>;
}

function FormCard({ title, optional, action, children, className = "" }: { title: string; optional?: boolean; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`post-card ${className}`}><header><h2>{title}{optional ? <span>არასავალდებულო</span> : null}</h2>{action}</header><div className="post-card__body">{children}</div></section>;
}

export function PostRequestPage({ initial }: { initial?: PublicSnapshot }) {
  const { store, sessionReady } = useMarketStore(initial);
  if (!store) return <PostRequestSkeleton />;
  const status = !sessionReady ? "loading" : store.sessionLoadError?.() || !store.isAvailable() ? "error" : store.hasSession() && !store.currentUser() ? "profile" : "ready";
  return <PostRequestForm key={store.currentUser()?.id||"guest"} store={store} sessionStatus={status} />;
}

function PostRequestForm({ store, sessionStatus }: { store: Store; sessionStatus: "loading" | "error" | "profile" | "ready" }) {
  const params = useSearchParams();
  const [draft] = useState(() => readRequestDraft());
  const [sessionAt] = useState(() => draft ? readRequestDraftAt() : 0);
  const initialCategory = currentCategory(params.get("category") || "");
  const [title, setTitle] = useState(params.has("title") ? (params.get("title") || "").slice(0, 120) : draft?.title || "");
  const [category, setCategory] = useState(params.has("category") ? (Object.hasOwn(categories, initialCategory) ? initialCategory : "") : draft?.category || "");
  const [preferences,setPreferences]=useState<RequestPreferences>(draft?.preferences||{});
  const fileDraftKey=`meetany.requestFiles.${store.currentUser()?.id||"guest"}`;
  const [attachmentDraft]=useState(()=>createAttachmentDraft(fileDraftKey,typeof sessionStorage!=="undefined"?sessionStorage:undefined));
  const [fileBusy,setFileBusy]=useState(false);
  const [body, setBody] = useState(draft?.body || "");
  const [quantity, setQuantity] = useState(draft?.quantity || "");
  const [unit, setUnit] = useState(draft?.unit || "pcs");
  const [cityChoice, setCity] = useState(params.has("city") ? (Object.hasOwn(cities, params.get("city") || "") ? params.get("city")! : "") : draft?.city || "");
  const [addressNote, setAddressNote] = useState(draft?.addressNote || "");
  const [neededBy, setNeededBy] = useState(draftDate(draft?.neededByText || ""));
  const [otherCity, setOtherCity] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [published, setPublished] = useState<{ id: string; title: string; createdAt: string } | null>(null);
  const actions = useRef<HTMLDivElement>(null);
  const [actionsHeight, setActionsHeight] = useState(0);
  useEffect(() => {
    const element = actions.current;
    if (!element) return;
    const measure = () => setActionsHeight(Math.ceil(element.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [published]);
  const [furthest, setFurthest] = useState(() => furthestFor(draft));
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(1);
  const v = useFieldErrors();
  const user = store.currentUser();
  const city = otherCity ? cityChoice : cityChoice || (user?.city && Object.hasOwn(cities, user.city) ? user.city : "tbilisi");
  const signedIn = sessionStatus === "ready" && !!user;
  const current: RequestDraft = { title, category, city, addressNote, quantity, unit, neededByText: neededBy ? dateLabel(neededBy) : "", body, preferences, attachmentDraft };
  const hasContent = hasRequestDraftContent(current);
  const latest = useRef({ hasContent });
  useEffect(() => { latest.current = { hasContent }; });
  const [serverReady, setServerReady] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const serverQueue = useRef<Promise<unknown>>(Promise.resolve());
  const queueServer = <T,>(job: () => Promise<T>) => { const run = serverQueue.current.then(job, job); serverQueue.current = run.catch(() => undefined); return run; };
  useEffect(() => {
    // The server draft fills the form once, when it is newer than this tab's copy (or this tab has none).
    if (!signedIn) return;
    let cancelled = false;
    loadServerDraft(store).then(server => {
      if (cancelled) return;
      setServerReady(true);
      if (!server) return;
      const serverAt = server.updatedAt ? Date.parse(server.updatedAt) : 0;
      if (draft ? !(serverAt > sessionAt) : latest.current.hasContent) return;
      setTitle(server.title); setCategory(server.category); setPreferences(server.preferences || {}); setBody(server.body);
      setQuantity(server.quantity); setUnit(server.unit); setCity(server.city); setAddressNote(server.addressNote);
      setNeededBy(draftDate(server.neededByText)); setFurthest(furthestFor(server));
    }).catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, store]);
  useEffect(() => {
    if (!signedIn || !serverReady || published || !hasContent) return;
    const timer = window.setTimeout(() => { void queueServer(() => saveServerDraft(store, current)).catch(() => undefined); }, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, serverReady, published, hasContent, title, category, city, addressNote, quantity, unit, neededBy, body, preferences, attachmentDraft]);
  async function saveAsDraft() {
    if (savingDraft || !signedIn) return;
    setSavingDraft(true);
    try {
      await queueServer(() => saveServerDraft(store, current));
      saveRequestDraft(current);
      setSavedAt(new Date().toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit", hour12: false }));
      toast("მონახაზი შენახულია");
    } catch (err) { toast((err as { userMessage?: string })?.userMessage || "მონახაზი ვერ შეინახა. სცადე თავიდან."); }
    finally { setSavingDraft(false); }
  }
  useEffect(() => {
    // State is initialized from storage before the first save, including on auth remounts.
    if (published) return;
    const current = { title, category, city, addressNote, quantity, unit, neededByText: neededBy ? dateLabel(neededBy) : "", body,preferences,attachmentDraft };
    saveRequestDraft(current);
    const saved = readRequestDraft();
    const acknowledgement = window.setTimeout(() => setSavedAt(saved && Object.entries(current).every(([key, value]) => JSON.stringify(saved[key as keyof typeof current]) === JSON.stringify(value)) ? new Date().toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit", hour12: false }) : ""), 0);
    return () => window.clearTimeout(acknowledgement);
  }, [title, category, city, addressNote, quantity, unit, neededBy, body, published,preferences,attachmentDraft]);
  useEffect(() => {
    // Prefills apply once: a later reload must restore edits, not the original URL text.
    const url = new URL(window.location.href);
    if (["title", "category", "city"].some(key => url.searchParams.has(key))) {
      for (const key of ["title", "category", "city"]) url.searchParams.delete(key);
      window.history.replaceState(null, "", url);
    }
  }, []);
  const requestedStep = Number(params.get("step") || 1);
  const step = published ? 4 : Math.min(furthest, [1, 2, 3].includes(requestedStep) ? requestedStep : 1);
  const preview = useMemo(() => photo ? URL.createObjectURL(photo) : null, [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (requestedStep !== step) {
      const url = new URL(window.location.href); url.searchParams.set("step", String(step));
      window.history.replaceState(null, "", url);
    }
    if (previousStep.current !== step) {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "start" });
      previousStep.current = step;
    }
  }, [step, requestedStep]);
  const today = store.todayDate() as string;
  const tomorrow = new Date(`${today}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);
  const maxDate = store.maxNeededBy() as string;
  const expiry = new Date(`${today}T12:00:00Z`); expiry.setUTCDate(expiry.getUTCDate() + 14);


  function go(next: number) {
    setError("");
    const url = new URL(window.location.href); url.searchParams.set("step", String(next));
    window.history.pushState(null, "", url);
  }
  function errorsFor(part: number): FieldErrors {
    const errors: FieldErrors = {};
    if (part === 1) {
      if (!title.trim()) errors.title = "მიუთითე სათაური";
      if (!Object.hasOwn(categories, category)) errors.category = "აირჩიე კატეგორია";
      if (body.trim().length < 10) errors.body = body.trim() ? "აღწერა მინიმუმ 10 სიმბოლოა" : "აღწერე, რა გჭირდება";
      const n = Number(quantity.trim().replace(/\s+/g, "").replace(",", "."));
      if (!quantity.trim() || !Number.isFinite(n) || n <= 0 || n > 1e9 || Math.round(n * 1000) <= 0) errors.quantity = "მიუთითე რაოდენობა 0-ზე მეტი და არაუმეტეს 1 000 000 000";
    } else {
      if (!Object.hasOwn(cities, city)) errors.city = "აირჩიე ქალაქი";
      if (!neededBy) errors.neededBy = "მიუთითე სასურველი თარიღი";
      else if (neededBy < minDate) errors.neededBy = "თარიღი ხვალიდან უნდა იყოს";
      else if (neededBy > maxDate) errors.neededBy = `თარიღი არაუგვიანეს ${dateLabel(maxDate)}`;
    }
    return errors;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || published || fileBusy) return;
    if (step < 3) {
      if(step===2&&preferenceError(preferences)){setError(preferenceError(preferences));return;}
      if (!v.check(errorsFor(step), step === 1 ? detailFields : deliveryFields)) return;
      setFurthest(Math.max(furthest, step + 1)); go(step + 1); return;
    }
    for (const part of [1, 2]) {
      const errors = errorsFor(part);
      if (Object.keys(errors).length) {
        go(part);
        requestAnimationFrame(() => v.check(errors, part === 1 ? detailFields : deliveryFields));
        return;
      }
    }
    if (preferenceError(preferences)) { go(2);setError(preferenceError(preferences));return; }
    if (!signedIn || sessionStatus !== "ready") return;
    submitting.current = true; setPending(true); setError("");
    try {
      const created = await store.createRequest({ title, category, city, addressNote: addressNote.trim() || null, quantity, unit, neededBy, body, photo,preferences,attachmentDraft });
      clearRequestDraft();
      void queueServer(() => deleteServerDraft(store)).catch(() => undefined);
      try{sessionStorage.removeItem(fileDraftKey);}catch{}
      setPublished({ id: created.id, title: created.title, createdAt: created.createdAt });
      go(4);
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "რაღაც ვერ შესრულდა. სცადე თავიდან.");
    } finally { submitting.current = false; setPending(false); }
  }
  const next = encodeURIComponent(`/requests/new/?${new URLSearchParams({ title, category, city, draft: "1" })}`);
  const keepDraft = () => saveRequestDraft({ title, category, city, addressNote, quantity, unit, neededByText: neededBy ? dateLabel(neededBy) : "", body,preferences,attachmentDraft });
  const edit = (part: number) => <Button variant="ghost" size="sm" onClick={() => go(part)}><Icon name="pencil" />შეცვლა<span className="ma-sr-only">: {steps[part - 1]}</span></Button>;
  const quantityLabel = quantity ? `${quantity} ${units[unit as keyof typeof units] || ""}` : "რაოდენობა";

  return <div className={`post-page ${styles.page}`} style={{ '--post-actions-height': `${published ? 0 : actionsHeight}px` } as CSSProperties}>
    {!published ? <header className="post-heading"><h1 ref={heading} tabIndex={-1}>მოთხოვნის განთავსება</h1></header> : null}
    <StepBar step={step} />
    {published ? <>
      <section className="post-published">
        <span className="post-published__check"><Icon name="check" /></span>
        <div><h1 ref={heading} tabIndex={-1}>მოთხოვნა გამოქვეყნდა</h1><p>„{published.title}“ — მომწოდებლებს უკვე შეუძლიათ შეთავაზების გამოგზავნა.</p></div>
        <div className="post-published__actions"><Button size="lg" href="/account/?tab=requests">ჩემი მოთხოვნები</Button><Button size="lg" variant="secondary" href={`/requests/view/?id=${encodeURIComponent(published.id)}`}>ნახვა</Button></div>
      </section>
      <div className="post-layout">
        <div className="post-content">
          <FormCard title="რა ხდება ახლა"><ol className={styles.timeline}>
            <li><Icon name="check" /><div><strong>მოთხოვნა გამოქვეყნდა</strong><time dateTime={published.createdAt}>{new Date(published.createdAt).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit", hour12: false })}</time></div></li>
            {[['მომწოდებლებს ეცნობათ', 'შესაბამისი კომპანიები გაეცნობიან მოთხოვნას.'], ['პირველი შეთავაზებები', 'მიღებული შეთავაზებები გამოჩნდება თქვენს ანგარიშში.'], ['შედარება და არჩევა', 'შეადარეთ ფასი, ვადა და პირობები.']].map(([label, description]) => <li className={styles.future} key={label}><span className={styles.timelineCircle} aria-hidden="true"/><div><strong>{label}</strong><p>{description}</p></div></li>)}
          </ol></FormCard>
        </div>
        <aside className={styles.aside}><FormCard title="შესაბამისი მომწოდებლები"><MatchingSuppliers store={store} requestId={published.id} /></FormCard></aside>
      </div>
    </> : <>
      {sessionStatus === "loading" ? <p className="post-guest" role="status"><Icon name="info" /><span>ანგარიში მოწმდება. შეგიძლია შეავსო მოთხოვნა.</span></p> : sessionStatus === "error" ? <div className={styles.connectionNotice} role="status"><p>კავშირი ვერ დამყარდა. შევსებული ტექსტი შენარჩუნდება.</p><Button variant="secondary" size="sm" loading={retrying} onClick={async () => { setRetrying(true); try { await store.refresh(); } finally { setRetrying(false); } }}>ხელახლა ცდა</Button></div> : sessionStatus === "profile" ? <p className="post-guest"><Icon name="info" /><span>გამოსაქვეყნებლად <Link onClick={keepDraft} href={`/account/?next=${next}`}>დაასრულე პროფილი</Link>. შევსებული ტექსტი შენარჩუნდება.</span></p> : !signedIn ? <p className="post-guest"><Icon name="info" /><span>გამოსაქვეყნებლად <Link onClick={keepDraft} href={`/account/?next=${next}`}>შედი ანგარიშში</Link>. შევსებული ტექსტი შენარჩუნდება.</span></p> : null}
      <form id="post-request-form" noValidate onSubmit={submit} aria-busy={pending}>
        <fieldset disabled={pending} className="post-layout">
          <div className="post-content">
            {step === 1 ? <>
              <FormCard title="რა გჭირდებათ">
                <div className="post-fields post-fields--title">
                  <div className="ma-field"><label htmlFor="title">სათაური <span>*</span></label><input className="ma-input" required maxLength={120} placeholder="მაგ. 100 კომპლექტი თეთრეული" value={title} onChange={e => { setTitle(e.target.value); v.clear("title"); }} {...v.control("title")} />{v.message("title")}</div>
                  <div className="ma-field"><label htmlFor="category">კატეგორია <span>*</span></label><div className={styles.iconField}><Icon name={categoryIcon[category] || "layout-grid"}/><CustomSelect required value={category} onChange={e => { setCategory(e.target.value); v.clear("category"); }} {...v.control("category")}><option value="" disabled>აირჩიე კატეგორია</option>{categoryOptions()}</CustomSelect></div>{v.message("category")}</div>
                </div>
                <div className="ma-field"><label htmlFor="body">აღწერა <span>*</span><small>{body.length} / 2000</small></label><textarea className="ma-textarea" required maxLength={2000} placeholder="აღწერეთ, რა გჭირდებათ და მიუთითეთ მნიშვნელოვანი დეტალები" value={body} onChange={e => { setBody(e.target.value); v.clear("body"); }} {...v.control("body")} />{v.message("body")}</div>
                <div className="ma-field"><label htmlFor="quantity">რაოდენობა <span>*</span></label>
                  <div className={styles.quantity}><input className="ma-input" required inputMode="decimal" value={quantity} onChange={e => { setQuantity(e.target.value); v.clear("quantity"); }} {...v.control("quantity")} />
                    <CustomSelect aria-label="ერთეული" value={unit} onChange={e => setUnit(e.target.value)}>{Object.entries(units).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</CustomSelect>
                  </div>{v.message("quantity")}
                </div>
              </FormCard>
              <FormCard title="სპეციფიკაცია და მომწოდებელი" optional><RequestPreferenceFields part="specification" value={preferences} onChange={setPreferences}/></FormCard>
              {signedIn ? <><FormCard title="ფოტო" optional><PhotoField file={photo} onChange={setPhoto} variant="tile" /></FormCard><FormCard title="ფაილები" optional><FileAttachments store={store} kind="request_draft" showTitle={false} target={attachmentDraft} editable onBusy={setFileBusy}/></FormCard></> : null}
            </> : step === 2 ? <><FormCard title="მიწოდება" className={styles.deliveryCard}>
              <div className={styles.deliveryFields}>
                <div className="ma-field"><label id="city-label">ქალაქი / რეგიონი <span>*</span></label>
                  <div className={styles.iconField}><Icon name="map-pin"/><CustomSelect aria-labelledby="city-label" required value={otherCity || !["tbilisi", "batumi", "kutaisi"].includes(city) ? "other" : city} onChange={e => { const value = e.target.value; setOtherCity(value === "other"); setCity(value === "other" ? "" : value); v.clear("city"); }} {...v.control("city")}>
                    {["tbilisi", "batumi", "kutaisi"].map(id => <option key={id} value={id}>{cities[id]}</option>)}<option value="other">სხვა</option>
                  </CustomSelect></div>
                  {otherCity || !["tbilisi", "batumi", "kutaisi"].includes(city) ? <><input className="ma-input" aria-label="სხვა ქალაქი / რეგიონი" list="post-cities" value={cities[cityChoice] || cityChoice} onChange={e => { setCity(Object.entries(cities).find(([, label]) => label === e.target.value)?.[0] || e.target.value); v.clear("city"); }}/><datalist id="post-cities">{Object.values(cities).map(label => <option key={label} value={label}/>)}</datalist></> : null}{v.message("city")}
                </div>
                <div className="ma-field"><label htmlFor="addressNote">მისამართი <small>არასავალდებულო</small></label><input className="ma-input" id="addressNote" maxLength={120} placeholder="რაიონი / ორიენტირი" value={addressNote} onChange={e => setAddressNote(e.target.value)} /></div>
                <div className="ma-field"><label htmlFor="neededBy">სასურველი თარიღი <span>*</span></label><input className="ma-input" required type="date" onInput={e=>{setNeededBy(e.currentTarget.value);v.clear("neededBy");}} min={minDate} max={maxDate} value={neededBy} onChange={e => { setNeededBy(e.target.value); v.clear("neededBy"); }} {...v.control("neededBy")} />{v.message("neededBy")}</div>
              </div>
            </FormCard><FormCard title="ბიუჯეტი და გადახდა" optional><RequestPreferenceFields part="delivery" value={preferences} onChange={setPreferences}/></FormCard></> : <>
              <section className="post-card"><div className={styles.reviewOverview}>{preview ? <Image unoptimized width={96} height={72} src={preview} alt="მოთხოვნის ფოტო"/> : <span className={styles.reviewPlaceholder}><Icon name="image"/></span>}<div><h2>{title}</h2><span className={styles.category}>{categories[category]}</span></div>{edit(1)}</div><p className={styles.description}>{body}</p></section>
              <FormCard title="მოთხოვნის დეტალები"><dl className={styles.reviewRows}>{[
                ['რაოდენობა', quantityLabel, 1], ['ქალაქი / მისამართი', [cities[city], addressNote].filter(Boolean).join(', '), 2], ['სასურველი თარიღი', dateLabel(neededBy), 2],
              ].map(([label, value, part]) => <div key={label}><dt>{label}</dt><dd>{value}</dd><dd>{edit(Number(part))}</dd></div>)}<div><dt>შეთავაზებების ბოლო ვადა</dt><dd>{dateLabel(expiry.toISOString().slice(0, 10))}<small>გამოქვეყნებიდან 14 დღე</small></dd></div></dl></FormCard>
            </>}
            {step===3?<FormCard title="დამატებითი პირობები"><RequestPreferenceSummary value={preferences}/></FormCard>:null}
            {step===3&&signedIn?<FormCard title="ფაილები"><FileAttachments store={store} kind="request_draft" showTitle={false} target={attachmentDraft}/></FormCard>:null}
          </div>
          <aside className={styles.aside}>{step < 3 ? <div className={styles.preview} aria-label="მოთხოვნის წინასწარი ნახვა">
            <article className={styles.previewCard}>{preview ? <Image unoptimized width={360} height={180} src={preview} alt="მოთხოვნის ფოტო"/> : null}<div><h2>{title.trim() || "მოთხოვნის სათაური"}</h2><span className={styles.category}>{categories[category] || "კატეგორია"}</span><p>{user?.company || user?.name || "მყიდველი"} · {cities[city] || city}</p><p>{quantityLabel}</p>{step === 2 && neededBy ? <p>{dateLabel(neededBy)}</p> : null}</div></article>
          </div> : <FormCard title="შესაბამისი მომწოდებლები"><MatchingPreview store={store} category={category}/></FormCard>}</aside>
        </fieldset>
      </form>
      <div className="post-actions" ref={actions}><div className="post-actions__inner">
        {error ? <p className="ma-field__error" role="alert">{error}</p> : null}
        {savedAt || hasRequestDraftContent({ title, category, city, addressNote, quantity, unit, neededByText: neededBy, body }) ? <p className={styles.saved}>{savedAt ? `შენახულია · ${savedAt}` : "ავტომატური შენახვა მიუწვდომელია"}</p> : null}
        <div className="post-actions__buttons">{step > 1 ? <Button variant="secondary" size="lg" disabled={pending||fileBusy} onClick={() => go(step - 1)}>უკან</Button> : null}
          {signedIn ? <Button variant="secondary" size="lg" disabled={pending||fileBusy||!hasContent} loading={savingDraft} onClick={() => void saveAsDraft()}>მონახაზად შენახვა</Button> : null}

          {step === 3 && !signedIn && (sessionStatus === "ready" || sessionStatus === "profile") ? <Button size="lg" className="post-actions__next" href={`/account/?next=${next}`} onClick={keepDraft}>{sessionStatus === "profile" ? "პროფილის დასრულება" : "შესვლა და გაგრძელება"}</Button> : <Button size="lg" className="post-actions__next" type="submit" form="post-request-form" disabled={fileBusy || (step === 3 && sessionStatus !== "ready")} loading={pending}>{pending ? "იგზავნება…" : <><span className={styles.long}>{step === 1 ? "შემდეგი: მიწოდება" : step === 2 ? "შემდეგი: გადახედვა" : sessionStatus === "loading" ? "ანგარიში მოწმდება…" : "მოთხოვნის გამოქვეყნება"}</span><span className={styles.short}>{step < 3 ? "შემდეგი" : sessionStatus === "loading" ? "მოწმდება…" : "გამოქვეყნება"}</span></>}</Button>}
        </div>
      </div></div>
    </>}
  </div>;
}
