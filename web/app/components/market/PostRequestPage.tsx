"use client";
import { RequestCatalogCover } from "./RequestCatalogCover";
import { attachmentDraft as createAttachmentDraft } from "../../lib/attachment-draft";
import { FileAttachments } from "./FileAttachments";
import { RequestPreferenceFields, RequestPreferenceSummary, preferenceError, preferenceRows, type RequestPreferences } from "./RequestPreferences";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { FormLayout } from "../ui/FormLayout";
import { OpportunityCard } from "./OpportunityCard";
import { CustomSelect } from "../ui/CustomSelect";
import { Icon } from "../Icon";
import { useMarketStore, type PublicSnapshot, type Store } from "../../lib/market-client";
import { categories, categoryIcon, cities, currentCategory, units } from "../../lib/categories";
import { clearRequestDraft, deleteServerDraft, hasRequestDraftContent, loadServerDraft, readRequestDraft, readRequestDraftAt, saveRequestDraft, saveServerDraft, type RequestDraft } from "../../lib/request-draft";
import { toast } from "../Toasts";
import { dateShort, dateTime } from "../../lib/format";
import { categoryOptions } from "./CategoryOptions";
import { MatchingSuppliers, MatchingPreview } from "./post/MatchingSuppliers";
import styles from "./post/Post.module.css";
import { RequestCopyPrompt } from "./post/RequestCopyPrompt";
import { PostRequestSkeleton } from "./post/PostRequestSkeleton";
import { PhotoField } from "./PhotoField";
import { useFieldErrors, type FieldErrors } from "./fieldErrors";

const steps = ["მოთხოვნა", "პირობები", "გადახედვა"];
const detailFields = ["title", "category", "body", "quantity"];
const deliveryFields = ["city", "neededBy"];
// Drafts keep the date as dd.mm.yyyy text; people read it as "8 ოქტ. 2026".
const draftText = (iso: string) => iso ? iso.split("-").reverse().join(".") : "";
const dateLabel = (iso: string) => dateShort(iso) || "—";
const draftDate = (value: string) => /^\d{2}\.\d{2}\.\d{4}$/.test(value) ? value.split(".").reverse().join("-") : "";
const furthestFor = (draft: RequestDraft | null) => draft && draft.title.trim().length > 0 && draft.body.trim().length >= 10 && Object.hasOwn(categories, draft.category) ? 2 : 1;

function StepBar({ step }: { step: number }) {
  return <nav className="post-steps" aria-label="მოთხოვნის განთავსების ნაბიჯები">
    <div className="post-steps__mobile" aria-hidden="true">
      <span>ნაბიჯი {step} / {steps.length}</span>
      <div className="post-steps__progress">{steps.map((name, i) => <span key={name} className={i + 1 < step ? "is-done" : i + 1 === step ? "is-current" : ""} />)}</div>
    </div>
    <ol>{steps.map((name, i) => <li key={name} className={i + 1 < step ? "is-done" : i + 1 === step ? "is-current" : ""} aria-current={i + 1 === step ? "step" : undefined}>
      <span className="post-steps__circle">{i + 1 < step ? <Icon name="check" /> : i + 1}</span><span className="post-steps__copy">{name}<small>{i + 1 === step ? "მიმდინარე" : i + 1 < step ? "შევსებულია" : "მომავალი"}</small></span>{i < steps.length - 1 ? <span className="post-steps__line" /> : null}
    </li>)}</ol>
  </nav>;
}

function FormCard({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`post-card ${className}`}><header><h2>{title}</h2>{action}</header><div className="post-card__body">{children}</div></section>;
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
  const targetCompany = store.getCompany(params.get("company") || "");
  const initialCategory = currentCategory(params.get("category") || "");
  const [title, setTitle] = useState(params.has("title") ? (params.get("title") || "").slice(0, 120) : draft?.title || "");
  const [category, setCategory] = useState(params.has("category") ? (Object.hasOwn(categories, initialCategory) ? initialCategory : "") : draft?.category || "");
  const [preferences,setPreferences]=useState<RequestPreferences>(draft?.preferences||{});
  const [preferenceSubmitted,setPreferenceSubmitted]=useState(false);
  const fileDraftKey=`meetany.requestFiles.${store.currentUser()?.id||"guest"}`;
  const [attachmentDraft,setAttachmentDraft]=useState(()=>createAttachmentDraft(fileDraftKey,typeof sessionStorage!=="undefined"?sessionStorage:undefined));
  const [fileBusy,setFileBusy]=useState(false);
  const [body, setBody] = useState(draft?.body || "");
  const [quantity, setQuantity] = useState(draft?.quantity || "");
  const [unit, setUnit] = useState(draft?.unit || "pcs");
  const [cityChoice, setCity] = useState(params.has("city") ? (Object.hasOwn(cities, params.get("city") || "") ? params.get("city")! : "") : draft?.city && Object.hasOwn(cities, draft.city) ? draft.city : "");
  const [addressNote, setAddressNote] = useState(draft?.addressNote || "");
  const [neededBy, setNeededBy] = useState(draftDate(draft?.neededByText || ""));
  // "server" only after save_request_draft succeeded; "browser" is this tab's sessionStorage copy.
  const [saved, setSaved] = useState<{ where: "server" | "browser"; at: string } | null>(null);
  const clock = () => new Date().toLocaleTimeString("ka-GE", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hour12: false });
  const [photo, setPhoto] = useState<File | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(!!draft);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [limitError, setLimitError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [published, setPublished] = useState<{ id: string; title: string; createdAt: string } | null>(null);
  const [furthest, setFurthest] = useState(() => furthestFor(draft));
  const [draftFiles, setDraftFiles] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(1);
  const v = useFieldErrors();
  const user = store.currentUser();
  const city = cityChoice || (user?.city && Object.hasOwn(cities, user.city) ? user.city : "tbilisi");
  const signedIn = sessionStatus === "ready" && !!user;
  const openRequestCount = signedIn ? store.listRequests({ ownerId: user.id, state: "open" }).length : 0;
  const current: RequestDraft = { title, category, city, addressNote, quantity, unit, neededByText: draftText(neededBy), body, preferences, attachmentDraft };
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
      setRestoredDraft(true);
      setTitle(server.title); setCategory(server.category); setPreferences(server.preferences || {}); setBody(server.body);
      setQuantity(server.quantity); setUnit(server.unit); setCity(Object.hasOwn(cities, server.city) ? server.city : ""); setAddressNote(server.addressNote);
      setNeededBy(draftDate(server.neededByText)); setFurthest(furthestFor(server));
    }).catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, store]);
  useEffect(() => {
    if (!signedIn || !serverReady || published || !hasContent) return;
    const timer = window.setTimeout(() => { void queueServer(() => saveServerDraft(store, current)).then(() => setSaved({ where: "server", at: clock() }), () => undefined); }, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, serverReady, published, hasContent, title, category, city, addressNote, quantity, unit, neededBy, body, preferences, attachmentDraft]);
  async function saveAsDraft() {
    if (savingDraft || !signedIn) return;
    setSavingDraft(true);
    try {
      await queueServer(() => saveServerDraft(store, current));
      saveRequestDraft(current);
      setSaved({ where: "server", at: clock() });
      toast({ title: "მონახაზი შენახულია", sub: photo ? "ტექსტი ინახება თქვენს ანგარიშში. ფოტო არ ინახება მონახაზში." : "ტექსტი ინახება თქვენს ანგარიშში.", tone: "success" });
    } catch (err) { toast({ title: "მონახაზი ვერ შეინახა", sub: (err as { userMessage?: string })?.userMessage || "ტექსტი ამ ბრაუზერში შენარჩუნდა. სცადეთ ხელახლა.", tone: "danger" }); }
    finally { setSavingDraft(false); }
  }
  useEffect(() => {
    // State is initialized from storage before the first save, including on auth remounts.
    if (published) return;
    const current = { title, category, city, addressNote, quantity, unit, neededByText: draftText(neededBy), body,preferences,attachmentDraft };
    saveRequestDraft(current);
    const stored = readRequestDraft();
    // A change makes the last server copy stale until the next autosave: until then only this browser holds it.
    const acknowledgement = window.setTimeout(() => setSaved(stored && Object.entries(current).every(([key, value]) => JSON.stringify(stored[key as keyof typeof current]) === JSON.stringify(value)) ? { where: "browser", at: clock() } : null), 0);
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
  const step = published ? 3 : Math.min(furthest, [1, 2, 3].includes(requestedStep) ? requestedStep : 1);
  const preview = useMemo(() => photo ? URL.createObjectURL(photo) : null, [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!published && requestedStep !== step) {
      const url = new URL(window.location.href); url.searchParams.set("step", String(step));
      window.history.replaceState(null, "", url);
    }
    if (previousStep.current !== step) {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "start" });
      previousStep.current = step;
    }
  }, [step, requestedStep, published]);
  useEffect(() => {
    // The review lists files only when there are some; an empty files card says nothing.
    if (step !== 3 || !signedIn || published) return;
    let active = true;
    void store.listAttachments("request_draft", attachmentDraft).then((items: unknown[]) => { if (active) setDraftFiles(items.length); }, () => { if (active) setDraftFiles(0); });
    return () => { active = false; };
  }, [step, signedIn, published, store, attachmentDraft]);
  const today = store.todayDate() as string;
  const tomorrow = new Date(`${today}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);
  const maxDate = store.maxNeededBy() as string;
  const expiry = new Date(`${today}T12:00:00Z`); expiry.setUTCDate(expiry.getUTCDate() + 14);
  const previewDays = neededBy ? Math.min(14, Math.max(0, Math.round((Date.parse(neededBy) - Date.parse(today)) / 86400000) + 1)) : 14;
  const responseDeadline = neededBy && neededBy < expiry.toISOString().slice(0, 10) ? neededBy : expiry.toISOString().slice(0, 10);


  function go(next: number) {
    setError("");
    const url = new URL(window.location.href); url.searchParams.set("step", String(next));
    window.history.pushState(null, "", url);
  }
  function errorsFor(part: number): FieldErrors {
    const errors: FieldErrors = {};
    if (part === 1) {
      if (!title.trim()) errors.title = "მიუთითეთ სათაური";
      if (!Object.hasOwn(categories, category)) errors.category = "აირჩიეთ კატეგორია";
      if (body.trim().length < 10) errors.body = body.trim() ? "აღწერა მინიმუმ 10 სიმბოლო უნდა იყოს" : "აღწერეთ, რა გჭირდებათ";
      const n = Number(quantity.trim().replace(/\s+/g, "").replace(",", "."));
      if (quantity.trim() && (!Number.isFinite(n) || n <= 0 || Math.round(n * 1000) <= 0)) errors.quantity = "მიუთითეთ 0-ზე მეტი რაოდენობა";
      else if (n > 1e9) errors.quantity = "რაოდენობა ძალიან დიდია";
    } else {
      if (!Object.hasOwn(cities, city)) errors.city = "აირჩიეთ ქალაქი";
      if (neededBy && neededBy < minDate) errors.neededBy = "თარიღი ხვალიდან უნდა იყოს";
      else if (neededBy > maxDate) errors.neededBy = `აირჩიეთ თარიღი ${dateLabel(maxDate)}-მდე`;
    }
    return errors;
  }
  function checkFields(errors: FieldErrors, order: string[]) {
    const valid = v.check(errors, order);
    if (!valid) requestAnimationFrame(() => document.getElementById("post-errors")?.focus());
    return valid;
  }
  function checkPreferences() {
    setPreferenceSubmitted(true);
    if (!preferenceError(preferences)) return true;
    go(2);
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-budget-field][aria-invalid="true"]')?.focus());
    return false;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || published || fileBusy) return;
    if (step < 3) {
      if(step===2&&!checkPreferences())return;
      if (!checkFields(errorsFor(step), step === 1 ? detailFields : deliveryFields)) return;
      setFurthest(Math.max(furthest, step + 1)); go(step + 1); return;
    }
    for (const part of [1, 2]) {
      const errors = errorsFor(part);
      if (Object.keys(errors).length) {
        go(part);
        requestAnimationFrame(() => checkFields(errors, part === 1 ? detailFields : deliveryFields));
        return;
      }
    }
    if (!checkPreferences()) return;
    if (!signedIn || sessionStatus !== "ready") return;
    submitting.current = true; setPending(true); setError(""); setLimitError(false);
    try {
      const effectivePreferences = { ...preferences };
      if (!neededBy) delete effectivePreferences.flexibility;
      const created = await store.createRequest({ title, category, city, addressNote: addressNote.trim() || null, quantity, unit, neededBy, body, photo,preferences:effectivePreferences,attachmentDraft });
      clearRequestDraft();
      void queueServer(() => deleteServerDraft(store)).catch(() => undefined);
      try{sessionStorage.removeItem(fileDraftKey);}catch{}
      setPublished({ id: created.id, title: created.title, createdAt: created.createdAt });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setLimitError((err as { code?: string })?.code === "MA105");
      setError((err as { userMessage?: string })?.userMessage || "მოთხოვნა ვერ გამოქვეყნდა. სცადეთ ხელახლა.");
    } finally { submitting.current = false; setPending(false); }
  }
  const next = encodeURIComponent(`/requests/new/?${new URLSearchParams({ title, category, city, draft: "1" })}`);
  const keepDraft = () => saveRequestDraft({ title, category, city, addressNote, quantity, unit, neededByText: draftText(neededBy), body,preferences,attachmentDraft });
  const edit = (part: number) => <Button variant="ghost" size="sm" onClick={() => go(part)}><Icon name="pencil" />შეცვლა<span className="ma-sr-only">: {steps[part - 1]}</span></Button>;
  const quantityLabel = quantity ? `${quantity} ${units[unit as keyof typeof units] || ""}` : "დასაზუსტებელია";
  const previewQuantity = Number(quantity.trim().replace(/\s+/g, "").replace(",", "."));

  const requiredErrors = { ...errorsFor(1), ...errorsFor(2) };
  const missing = ["title", "category", "body", "city"].flatMap(key => requiredErrors[key] ? [requiredErrors[key]] : []);
  const hasLegacyConditions = !!(preferences.specification || preferences.design || preferences.supplierTypes?.length || preferences.certificates || preferences.verifiedOnly);
  const primaryAction = step === 3 && !signedIn && (sessionStatus === "ready" || sessionStatus === "profile")
    ? <Button variant="primary" className="post-actions__next" href={`/account/?next=${next}`} onClick={keepDraft}>{sessionStatus === "profile" ? "პროფილის დასრულება" : "შესვლა და გაგრძელება"}</Button>
    : <Button variant="primary" className="post-actions__next" type="submit" form="post-request-form" disabled={fileBusy || (step === 3 && sessionStatus !== "ready")} loading={pending}>{pending ? "იგზავნება…" : step < 3 ? "შემდეგი" : sessionStatus === "loading" ? "მოწმდება…" : "განთავსება"}</Button>;
  const savedStatus = saved ? <p className={styles.saved} role="status">{saved.where === "server" ? `ტექსტი შენახულია · ${saved.at}` : `ტექსტი შენახულია ამ ბრაუზერში · ${saved.at}`}{photo ? <span> · ფოტო არ ინახება მონახაზში</span> : null}</p> : hasContent ? <p className={styles.saved}>ავტომატური შენახვა მიუწვდომელია</p> : null;

  return <div className={`post-page ${styles.page}`}>
    {published ? <>
      <section className="post-published">
        <span className="post-published__check"><Icon name="check" /></span>
        <div><h1 ref={heading} tabIndex={-1}>მოთხოვნა გამოქვეყნდა</h1><p>„{published.title}“ — მომწოდებლებს უკვე შეუძლიათ შეთავაზების გამოგზავნა.</p></div>
        <div className="post-published__actions"><Button size="lg" href={`/requests/view/?id=${encodeURIComponent(published.id)}`}>მოთხოვნის ნახვა</Button><Button size="lg" variant="secondary" href="/account/?tab=requests">ჩემი მოთხოვნები</Button></div>
      </section>
      <div className="post-layout">
        <div className="post-content">
          <FormCard title="რა ხდება ახლა"><ol className={styles.timeline}>
            <li><Icon name="check" /><div><strong>მოთხოვნა გამოქვეყნდა</strong><time dateTime={published.createdAt}>{dateTime(published.createdAt)}</time></div></li>
            {[['მომწოდებლების გამოხმაურება', 'მომწოდებლები მოთხოვნას კატალოგში ან შეტყობინებით ნახავენ.'], ['პირველი შეთავაზებები', 'მიღებული შეთავაზებები გამოჩნდება თქვენს ანგარიშში.'], ['შედარება და არჩევა', 'შეადარეთ ფასი, ვადა და პირობები.']].map(([label, description]) => <li className={styles.future} key={label}><span className={styles.timelineCircle} aria-hidden="true"/><div><strong>{label}</strong><p>{description}</p></div></li>)}
          </ol><Link className={styles.catalogLink} href={`/requests/?${new URLSearchParams({ q: published.title })}`}>გამოქვეყნებული მოთხოვნა სიაში</Link></FormCard>
        </div>
        <aside className={styles.aside}><FormCard title="შესაბამისი მომწოდებლები"><MatchingSuppliers store={store} requestId={published.id} /></FormCard></aside>
      </div>
    </> : <FormLayout className={styles.layout} title={steps[step - 1]} titleRef={heading}
      subtitle={step === 1 ? "დაწერეთ, რა გჭირდებათ — მომწოდებლები შეთავაზებებს გამოგიგზავნიან." : step === 2 ? "მიუთითეთ ადგილი და თქვენთვის ცნობილი პირობები." : "გადაამოწმეთ მოთხოვნა და განათავსეთ მომწოდებლებისთვის."}
      steps={<StepBar step={step} />} stepsPosition="top" asideLabel="ასე ჩანს"
      aside={<>
        <section className={styles.progressPanel} aria-label="შევსების პროგრესი">
          <strong>შევსებულია {4 - missing.length}/4 სავალდებულო ველი</strong>
          <progress value={4 - missing.length} max={4} aria-label="შევსებული სავალდებულო ველები" />
          <p>{missing.length ? missing[0] : "ყველა სავალდებულო ველი შევსებულია."}</p>
        </section>
        <section className={styles.catalogPreview} aria-label="მოთხოვნის წინასწარი ხედი">
          <h2>ასე ჩანს</h2>
          <div inert><OpportunityCard request={{ id: "draft-preview", title: title.trim() || "მოთხოვნის სათაური", body, category: category || "კატეგორია", city, cityLabel: cities[city] || "ქალაქი", photo: preview, quantity: Number.isFinite(previewQuantity) && previewQuantity > 0 ? previewQuantity : null, unit, daysLeft: previewDays }} buyer={{ name: user?.company || user?.name || "მყიდველი", verified: !!user?.verified }} offers={0} /></div>
          <p className="ma-sr-only">{title.trim() || "მოთხოვნის სათაური"} · {categories[category] || "კატეგორია"} · {cities[city] || "ქალაქი"} · {quantityLabel}</p>
          <p className={styles.previewDate}>სასურველი თარიღი: {neededBy ? dateLabel(neededBy) : "შეთანხმებით"}</p>
        </section>
        <FormCard title="შესაბამისი მომწოდებლები"><MatchingPreview store={store} category={category}/></FormCard>
      </>}
      footer={<div className="post-actions__buttons"><Button variant="secondary" disabled={step === 1 || pending || fileBusy} onClick={() => go(step - 1)}>უკან</Button>{primaryAction}</div>}
    >
      {targetCompany ? <div className={styles.connectionNotice} role="status"><p>მოთხოვნა საჯაროა — {targetCompany.company || targetCompany.name} და სხვა შესაბამისი კომპანიებიც ნახავენ.</p></div> : null}
      {openRequestCount >= 5 ? <div className={styles.connectionNotice} role="status"><p>თქვენ გაქვთ {openRequestCount} ღია მოთხოვნა — დახურეთ ერთი, რომ ახალი გამოაქვეყნოთ.</p><Button variant="secondary" href="/account/?tab=requests&filter=open" onClick={keepDraft}>ღია მოთხოვნების ნახვა</Button></div> : null}
      {sessionStatus === "loading" ? <p className="post-guest" role="status"><Icon name="info" /><span>ანგარიში მოწმდება. მოთხოვნის შევსება ამასობაში შეგიძლიათ.</span></p> : sessionStatus === "error" ? <div className={styles.connectionNotice} role="status"><p>კავშირი ვერ დამყარდა. შევსებული ტექსტი შენარჩუნდება.</p><Button variant="secondary" size="sm" loading={retrying} onClick={async () => { setRetrying(true); try { await store.refresh(); } finally { setRetrying(false); } }}>ხელახლა ცდა</Button></div> : sessionStatus === "profile" ? <p className="post-guest"><Icon name="info" /><span>გამოსაქვეყნებლად <Link onClick={keepDraft} href={`/account/?next=${next}`}>დაასრულეთ პროფილი</Link>. შევსებული ტექსტი შენარჩუნდება.</span></p> : !signedIn && step === 1 ? <p className="post-guest"><Icon name="info" /><span>გამოსაქვეყნებლად <Link onClick={keepDraft} href={`/account/?next=${next}`}>შედით ანგარიშში</Link>. შევსებული ტექსტი შენარჩუნდება.</span></p> : null}
      {params.get("copy") && signedIn ? <RequestCopyPrompt store={store} id={params.get("copy")!} ready={serverReady && !pending && !fileBusy} onCopy={source => {
        setTitle(source.title); setBody(source.body); setCategory(source.category); setCity(source.city);
        setAddressNote(source.addressNote); setQuantity(source.quantity); setUnit(source.unit);
        setPreferences(source.preferences || {}); setNeededBy(""); setPhoto(null); setDraftFiles(0);
        const fresh = crypto.randomUUID();
        try { sessionStorage.setItem(fileDraftKey, fresh); } catch {}
        setAttachmentDraft(fresh); setRestoredDraft(false); setFurthest(1); v.check({}, []); setError("");
        const url = new URL(window.location.href); url.searchParams.delete("copy"); url.searchParams.set("step", "1");
        window.history.replaceState(null, "", url);
        toast("მონახაზი მზადაა — გადაამოწმეთ პირობები და აირჩიეთ ახალი თარიღი.");
      }}/> : null}
      {restoredDraft ? <p className="post-guest" role="status"><Icon name="info"/><span>მონახაზი აღდგენილია. ფოტო არ ინახება მონახაზში — თუ ფოტო გქონდათ არჩეული, აირჩიეთ ხელახლა.</span></p> : null}
      {Object.keys(v.errors).length ? <section id="post-errors" tabIndex={-1} className={styles.errorSummary} role="alert" aria-labelledby="post-errors-title"><h2 id="post-errors-title">შეასწორეთ მონიშნული ველები</h2><ul>{Object.entries(v.errors).map(([field, message]) => <li key={field}><a href={`#${field}`} onClick={event => { event.preventDefault(); document.getElementById(field)?.focus(); }}>{message}</a></li>)}</ul></section> : null}
      <form id="post-request-form" noValidate onSubmit={submit} aria-busy={pending}>
        <fieldset disabled={pending} className={styles.fields}>
          <div className="post-content">
            {step === 1 ? <>
              <FormCard title="რა გჭირდებათ" className={styles.detailsCard}>
                <div className="post-fields post-fields--title">
                  <div className="ma-field"><label htmlFor="title">სათაური <span>*</span></label><input className="ma-input" required maxLength={120} placeholder="მოკლედ დაწერეთ, რა გჭირდებათ" value={title} onChange={e => { setTitle(e.target.value); v.clear("title"); }} {...v.control("title")} />{v.message("title")}</div>
                  <div className="ma-field"><label htmlFor="category">კატეგორია <span>*</span></label><div className={styles.iconField}><Icon name={categoryIcon[category] || "layout-grid"}/><CustomSelect required value={category} onChange={e => { setCategory(e.target.value); v.clear("category"); }} {...v.control("category")}><option value="" disabled>აირჩიეთ კატეგორია</option>{categoryOptions()}</CustomSelect></div>{v.message("category")}</div>
                </div>
                <div className="ma-field"><label htmlFor="body">აღწერა <span>*</span><small>{body.length} / 2000</small></label><textarea className="ma-textarea" required maxLength={2000} placeholder="აღწერეთ საჭიროება და მნიშვნელოვანი პირობები" value={body} onChange={e => { setBody(e.target.value); v.clear("body"); }} {...v.control("body")} />{v.message("body")}</div>
                <div className="ma-field"><label htmlFor="quantity">რაოდენობა / მოცულობა</label>
                  <div className={styles.quantity}><input className="ma-input" inputMode="decimal" placeholder="თუ ცნობილია" value={quantity} onChange={e => { setQuantity(e.target.value); v.clear("quantity"); }} {...v.control("quantity")} />
                    <CustomSelect aria-label="ერთეული" value={unit} onChange={e => setUnit(e.target.value)}>{Object.entries(units).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</CustomSelect>
                  </div>{v.message("quantity")}
                </div>
              </FormCard>
              {hasLegacyConditions ? <FormCard title="დამატებითი პირობები"><RequestPreferenceFields part="specification" value={preferences} onChange={setPreferences}/></FormCard> : null}
              {signedIn ? <><FormCard title="ფოტო"><PhotoField file={photo} onChange={setPhoto} variant="tile" /><p className="ma-note">ფოტო არ ინახება მონახაზში.</p></FormCard><FormCard title="ფაილები"><FileAttachments store={store} kind="request_draft" showTitle={false} target={attachmentDraft} editable onBusy={setFileBusy}/></FormCard></> : null}
            </> : step === 2 ? <><FormCard title="ადგილი და ვადა" className={styles.deliveryCard}>
              <div className={styles.deliveryFields}>
                <div className="ma-field"><label id="city-label">ქალაქი / რეგიონი <span>*</span></label>
                  <div className={styles.iconField}><Icon name="map-pin"/><CustomSelect aria-labelledby="city-label" required value={city} onChange={e => { setCity(e.target.value); v.clear("city"); }} {...v.control("city")}>
                    <option value="" disabled>აირჩიეთ ქალაქი</option>
                    {Object.entries(cities).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </CustomSelect></div>
                  {v.message("city")}
                </div>
                <div className="ma-field"><label htmlFor="addressNote">მისამართი</label><input className="ma-input" id="addressNote" maxLength={120} placeholder="რაიონი / ორიენტირი" value={addressNote} onChange={e => setAddressNote(e.target.value)} /></div>
                <div className="ma-field"><label htmlFor="neededBy">სასურველი თარიღი</label><input className="ma-input" type="date" onInput={e=>{setNeededBy(e.currentTarget.value);v.clear("neededBy");}} min={minDate} max={maxDate} value={neededBy} onChange={e => { setNeededBy(e.target.value); v.clear("neededBy"); }} {...v.control("neededBy")} />{v.message("neededBy")}</div>
              </div>
            </FormCard><FormCard title="ბიუჯეტი და გადახდა"><RequestPreferenceFields showErrors={preferenceSubmitted} showFlexibility={!!neededBy} part="delivery" value={preferences} onChange={setPreferences}/></FormCard></> : <>
              <section className="post-card"><div className={styles.reviewOverview}>{preview ? <Image unoptimized width={96} height={72} src={preview} alt="მოთხოვნის ფოტო"/> : <span className={styles.reviewPlaceholder}><RequestCatalogCover category={category}/></span>}<div><h2>{title}</h2><span className={styles.category}>{categories[category]}</span></div>{edit(1)}</div><p className={styles.description}>{body}</p></section>
              <FormCard title="მოთხოვნის დეტალები"><dl className={styles.reviewRows}>{[
                ['რაოდენობა', quantityLabel, 1], ['ქალაქი / მისამართი', [cities[city], addressNote].filter(Boolean).join(', '), 2], ['სასურველი თარიღი', neededBy ? dateLabel(neededBy) : 'შეთანხმებით', 2],
              ].map(([label, value, part]) => <div key={label}><dt>{label}</dt><dd>{value}</dd><dd>{edit(Number(part))}</dd></div>)}<div><dt>შეთავაზებების ბოლო ვადა</dt><dd>{dateLabel(responseDeadline)}<small>14 დღემდე; არჩეული თარიღის შემთხვევაში — ამ თარიღამდე</small></dd><dd/></div></dl></FormCard>
            </>}
            {step===3&&preferenceRows(preferences).length?<FormCard title="დამატებითი პირობები"><RequestPreferenceSummary value={neededBy ? preferences : { ...preferences, flexibility: undefined }}/></FormCard>:null}
            {step===3&&signedIn&&draftFiles?<FormCard title="ფაილები"><FileAttachments store={store} kind="request_draft" showTitle={false} target={attachmentDraft}/></FormCard>:null}
          </div>
        </fieldset>
      </form>
      {error ? <div className="ma-field__error" role="alert"><p>{error}</p>{limitError ? <Button variant="secondary" href="/account/?tab=requests&filter=open" onClick={keepDraft}>ღია მოთხოვნების ნახვა</Button> : null}</div> : null}
      {savedStatus || signedIn ? <div className={styles.draftActions}>{savedStatus}{signedIn ? <Button variant="secondary" disabled={pending || fileBusy || !hasContent} loading={savingDraft} onClick={() => void saveAsDraft()}>მონახაზად შენახვა</Button> : null}</div> : null}
    </FormLayout>}
  </div>;
}
