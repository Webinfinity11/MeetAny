"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import { Icon } from "../Icon";
import { useMarketStore, type PublicSnapshot, type Store } from "../../lib/market-client";
import { categories, cities, currentCategory, units } from "../../lib/categories";
import { clearRequestDraft, readRequestDraft, saveRequestDraft } from "../../lib/request-draft";
import { categoryOptions } from "./CategoryOptions";
import { PhotoField } from "./PhotoField";
import { useFieldErrors, type FieldErrors } from "./fieldErrors";

const steps = ["დეტალები", "მიწოდება", "გადახედვა", "გამოქვეყნება"];
const detailFields = ["title", "category", "body", "quantity"];
const deliveryFields = ["city", "neededBy"];
const dateLabel = (iso: string) => iso ? iso.split("-").reverse().join(".") : "—";
const draftDate = (value: string) => /^\d{2}\.\d{2}\.\d{4}$/.test(value) ? value.split(".").reverse().join("-") : "";

function StepBar({ step }: { step: number }) {
  return <nav className="post-steps" aria-label="მოთხოვნის განთავსების ნაბიჯები">
    <div className="post-steps__mobile" aria-hidden="true">
      <div><strong>{steps[step - 1]}</strong><span>ნაბიჯი {step} / 4</span></div>
      <div className="post-steps__progress">{steps.map((name, i) => <span key={name} className={i + 1 < step ? "is-done" : i + 1 === step ? "is-current" : ""} />)}</div>
    </div>
    <ol>{steps.map((name, i) => <li key={name} className={i + 1 < step ? "is-done" : i + 1 === step ? "is-current" : ""} aria-current={i + 1 === step ? "step" : undefined}>
      <span className="post-steps__circle">{i + 1 < step ? <Icon name="check" /> : i + 1}</span><span>{name}</span>{i < 3 ? <span className="post-steps__line" /> : null}
    </li>)}</ol>
  </nav>;
}

function FormCard({ title, optional, action, children }: { title: string; optional?: boolean; action?: ReactNode; children: ReactNode }) {
  return <section className="post-card"><header><h2>{title}{optional ? <span>არასავალდებულო</span> : null}</h2>{action}</header><div className="post-card__body">{children}</div></section>;
}

function Facts({ rows }: { rows: [string, string][] }) {
  return <dl className="post-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export function PostRequestPage({ initial }: { initial?: PublicSnapshot }) {
  const { store, sessionReady } = useMarketStore(initial);
  const sessionPending = sessionReady && !!store?.hasSession?.() && !store?.currentUser();
  const retried = useRef(false);
  useEffect(() => {
    if (sessionPending && !retried.current) { retried.current = true; void store?.refresh(); }
  }, [sessionPending, store]);
  if (!store || !sessionReady || sessionPending) return <div className="post-page" role="status">ფორმა იტვირთება…</div>;
  return <PostRequestForm store={store} />;
}

function PostRequestForm({ store }: { store: Store }) {
  const params = useSearchParams();
  const [draft] = useState(() => params.get("draft") === "1" ? readRequestDraft() : null);
  const initialCategory = currentCategory(params.get("category") || "");
  const [title, setTitle] = useState(draft?.title || (params.get("title") || "").slice(0, 120));
  const [category, setCategory] = useState(draft?.category || (Object.hasOwn(categories, initialCategory) ? initialCategory : ""));
  const [body, setBody] = useState(draft?.body || "");
  const [quantity, setQuantity] = useState(draft?.quantity || "");
  const [unit, setUnit] = useState(draft?.unit || "pcs");
  const [cityChoice, setCity] = useState(draft?.city || (Object.hasOwn(cities, params.get("city") || "") ? params.get("city")! : ""));
  const [addressNote, setAddressNote] = useState(draft?.addressNote || "");
  const [neededBy, setNeededBy] = useState(draftDate(draft?.neededByText || ""));
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState<{ id: string; title: string; createdAt: string } | null>(null);
  const [furthest, setFurthest] = useState(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(1);
  const v = useFieldErrors();
  const user = store.currentUser();
  const city = cityChoice || (user?.city && Object.hasOwn(cities, user.city) ? user.city : "tbilisi");
  const signedIn = !!user;
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

  function go(next: number) {
    setError("");
    const url = new URL(window.location.href); url.searchParams.set("step", String(next));
    window.history.pushState(null, "", url);
  }
  function errorsFor(part: number): FieldErrors {
    const errors: FieldErrors = {};
    if (part === 1) {
      if (title.trim().length < 5) errors.title = title.trim() ? "სათაური მინიმუმ 5 სიმბოლოა" : "მიუთითე სათაური";
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
    if (submitting.current || published) return;
    if (step < 3) {
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
    if (!signedIn) return;
    submitting.current = true; setPending(true); setError("");
    try {
      const created = await store.createRequest({ title, category, city, addressNote: addressNote.trim() || null, quantity, unit, neededBy, body, photo });
      clearRequestDraft();
      setPublished({ id: created.id, title: created.title, createdAt: created.createdAt });
      go(4);
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "რაღაც ვერ შესრულდა. სცადე თავიდან.");
    } finally { submitting.current = false; setPending(false); }
  }
  const next = encodeURIComponent(`/requests/new/?${new URLSearchParams({ title, category, city, draft: "1" })}`);
  const keepDraft = () => saveRequestDraft({ title, category, city, addressNote, quantity, unit, neededByText: neededBy ? dateLabel(neededBy) : "", body });
  const edit = (part: number) => <Button variant="ghost" size="sm" onClick={() => go(part)}><Icon name="pencil" />შეცვლა<span className="ma-sr-only">: {steps[part - 1]}</span></Button>;
  const quantityLabel = quantity ? `${quantity} ${units[unit as keyof typeof units] || ""}` : "რაოდენობა";

  return <div className="post-page">
    {!published ? <header className="post-heading"><h1 ref={heading} tabIndex={-1}>მოთხოვნის განთავსება</h1>{step === 1 ? <p>აღწერეთ, რა გჭირდებათ — მომწოდებლები შეთავაზებებს გამოგიგზავნიან.</p> : null}</header> : null}
    <StepBar step={step} />
    {published ? <>
      <section className="post-published">
        <span className="post-published__check"><Icon name="check" /></span>
        <div><h1 ref={heading} tabIndex={-1}>მოთხოვნა გამოქვეყნდა</h1><p>„{published.title}“ — მომწოდებლებს უკვე შეუძლიათ შეთავაზების გამოგზავნა.</p></div>
        <div className="post-published__actions"><Button size="lg" href="/account/?tab=requests">ჩემი მოთხოვნები</Button><Button size="lg" variant="secondary" href={`/requests/view/?id=${encodeURIComponent(published.id)}`}>ნახვა</Button></div>
      </section>
      <div className="post-layout"><FormCard title="რა ხდება ახლა"><ol className="post-timeline"><li><span><Icon name="check" /></span><strong>მოთხოვნა გამოქვეყნდა</strong><time dateTime={published.createdAt}>{new Date(published.createdAt).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit", hour12: false })}</time></li></ol></FormCard></div>
    </> : <>
      {!signedIn ? <p className="post-guest"><Icon name="info" /><span>გამოსაქვეყნებლად <Link onClick={keepDraft} href={`/account/?next=${next}`}>შედი ანგარიშში</Link> ან <Link onClick={keepDraft} href={`/account/?tab=register&next=${next}`}>დარეგისტრირდი</Link>. შევსებული ტექსტი შენარჩუნდება.</span></p> : null}
      <form id="post-request-form" noValidate onSubmit={submit} aria-busy={pending}>
        <fieldset disabled={pending} className="post-layout">
          <div className="post-content">
            {step === 1 ? <>
              <FormCard title="რა გჭირდებათ">
                <div className="post-fields post-fields--title">
                  <div className="ma-field"><label htmlFor="title">სათაური <span>*</span></label><input className="ma-input" required maxLength={120} placeholder="მაგ. 100 კომპლექტი თეთრეული" value={title} onChange={e => { setTitle(e.target.value); v.clear("title"); }} {...v.control("title")} />{v.message("title")}</div>
                  <div className="ma-field"><label htmlFor="category">კატეგორია <span>*</span></label><CustomSelect required value={category} onChange={e => { setCategory(e.target.value); v.clear("category"); }} {...v.control("category")}><option value="" disabled>აირჩიე კატეგორია</option>{categoryOptions()}</CustomSelect>{v.message("category")}</div>
                </div>
                <div className="ma-field"><label htmlFor="body">აღწერა <span>*</span><small>{body.length} / 2000</small></label><textarea className="ma-textarea" required maxLength={2000} placeholder="აღწერეთ, რა გჭირდებათ და მიუთითეთ მნიშვნელოვანი დეტალები" value={body} onChange={e => { setBody(e.target.value); v.clear("body"); }} {...v.control("body")} />{v.message("body")}</div>
                <div className="post-fields">
                  <div className="ma-field"><label htmlFor="quantity">რაოდენობა <span>*</span></label><input className="ma-input" required inputMode="decimal" value={quantity} onChange={e => { setQuantity(e.target.value); v.clear("quantity"); }} {...v.control("quantity")} />{v.message("quantity")}</div>
                  <div className="ma-field"><label htmlFor="unit">ერთეული</label><CustomSelect id="unit" value={unit} onChange={e => setUnit(e.target.value)}>{Object.entries(units).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</CustomSelect></div>
                </div>
              </FormCard>
              {signedIn ? <FormCard title="ფოტოები" optional><PhotoField file={photo} onChange={setPhoto} variant="tile" /></FormCard> : null}
            </> : step === 2 ? <FormCard title="მიწოდება">
              <div className="post-fields">
                <div className="ma-field"><label htmlFor="city">ქალაქი / რეგიონი <span>*</span></label><CustomSelect required value={city} onChange={e => { setCity(e.target.value); v.clear("city"); }} {...v.control("city")}>{Object.entries(cities).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</CustomSelect>{v.message("city")}</div>
                <div className="ma-field"><label htmlFor="addressNote">მისამართი <small>არასავალდებულო</small></label><input className="ma-input" id="addressNote" maxLength={120} placeholder="რაიონი / ორიენტირი" value={addressNote} onChange={e => setAddressNote(e.target.value)} /></div>
                <div className="ma-field"><label htmlFor="neededBy">სასურველი თარიღი <span>*</span></label><input className="ma-input" required type="date" min={minDate} max={maxDate} value={neededBy} onChange={e => { setNeededBy(e.target.value); v.clear("neededBy"); }} {...v.control("neededBy")} />{v.message("neededBy")}</div>
              </div>
            </FormCard> : <>
              <FormCard title="რა გჭირდებათ" action={edit(1)}>
                {preview ? <img className="post-review-photo" src={preview} alt="მოთხოვნის ფოტო" /> : null}
                <Facts rows={[["სათაური", title], ["კატეგორია", categories[category as keyof typeof categories] || "—"], ["აღწერა", body], ["რაოდენობა", quantityLabel]]} />
              </FormCard>
              <FormCard title="მიწოდება" action={edit(2)}><Facts rows={[["ქალაქი / რეგიონი", cities[city as keyof typeof cities]], ...(addressNote.trim() ? [["მისამართი", addressNote] as [string, string]] : []), ["სასურველი თარიღი", dateLabel(neededBy)]]} /></FormCard>
            </>}
          </div>
          {step === 1 ? <aside className="post-preview"><p><Icon name="eye" />ასე დაინახავს მომწოდებელი</p><article>
            {preview ? <img src={preview} className="post-preview__photo" alt="მოთხოვნის ფოტო" /> : <div className="post-preview__placeholder"><Icon name="image" /></div>}
            <div className="post-preview__body"><h3>{title.trim() || "მოთხოვნის სათაური"}</h3><span className="post-preview__category">{categories[category as keyof typeof categories] || "კატეგორია"}</span><ul><li><Icon name="map-pin" />{cities[city as keyof typeof cities]}</li><li><Icon name="package" />{quantityLabel}</li></ul></div>
          </article></aside> : null}
        </fieldset>
      </form>
      <div className="post-actions">
        {error ? <p className="ma-field__error" role="alert">{error}</p> : null}
        <div>{step > 1 ? <Button variant="ghost" size="lg" disabled={pending} onClick={() => go(step - 1)}>უკან</Button> : null}
          {step === 3 && !signedIn ? <Button size="lg" className="post-actions__next" href={`/account/?next=${next}`} onClick={keepDraft}>შესვლა და გაგრძელება</Button> : <Button size="lg" className="post-actions__next" type="submit" form="post-request-form" loading={pending}>{pending ? "იგზავნება…" : step === 1 ? "შემდეგი: მიწოდება" : step === 2 ? "შემდეგი: გადახედვა" : "მოთხოვნის გამოქვეყნება"}</Button>}
        </div>
      </div>
    </>}
  </div>;
}
