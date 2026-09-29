"use client";

import { trapDialogFocus } from "../ui/dialog-focus";

import { CustomSelect } from "../ui/CustomSelect";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "../Toasts";
import { Icon } from "../Icon";
import { PhotoField } from "./PhotoField";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities, currentCategory, units } from "../../lib/categories";
import { categoryOptions } from "./CategoryOptions";
import { useFieldErrors, type FieldErrors } from "./fieldErrors";

// Needed-by dates: typed "დდ.თთ.წწწწ" in the field, ISO "YYYY-MM-DD" in state and on submit.
const pad = (n: number) => String(n).padStart(2, "0");
const isoToText = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join(".") : "");
function textToIso(text: string): string | null {
  const t = text.trim();
  const m = /^(\d{1,2})[.\/\- ](\d{1,2})[.\/\- ](\d{4})$/.exec(t) || /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}
function addDay(iso: string, days = 1) {
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function DateField({ id, text, onText, min, max, field }: { id: string; text: string; onText: (text: string) => void; min?: string; max?: string; field: Record<string, unknown> }) {
  const native = useRef<HTMLInputElement>(null);
  function open() {
    const input = native.current;
    if (!input) return;
    input.value = textToIso(text) || "";
    try {input.showPicker();} catch {input.focus(); input.click();}
  }
  return (
    <div className="request-date">
      <input className="ma-input ma-input--num" id={id} inputMode="numeric" autoComplete="off" placeholder="დღ.თთ.წწწწ" maxLength={10} value={text} onChange={(e) => onText(e.target.value)} onBlur={() => {const iso = textToIso(text); if (iso) onText(isoToText(iso));}} {...field} />
      <button type="button" className="request-date__button" aria-label="კალენდრის გახსნა" onClick={open}>
        <Icon name="calendar" />
      </button>
      <input ref={native} className="request-date__native" type="date" tabIndex={-1} aria-hidden="true" min={min} max={max} onChange={(e) => {if (e.target.value) onText(isoToText(e.target.value));}} />
    </div>
  );
}

export function RequestFormSheet({
  open,
  existing,
  initialCategory = "",
  initialTitle = "",
  initialCity = "",
  onClose,
  triggerRef,
}: {
  open: boolean;
  existing?: {id: string; title: string; category: string; city: string; quantity: number | null; unit: string | null; neededBy: string | null; body: string; photo: string | null; addressNote?: string | null};
  initialCategory?: string;
  initialTitle?: string;
  initialCity?: string;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}) {
  const { store } = useMarketStore();
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(existing?.title || initialTitle.slice(0,120));
  const [category, setCategory] = useState(existing?.category || (Object.hasOwn(categories, currentCategory(initialCategory)) ? currentCategory(initialCategory) : ""));
  // "" = not chosen yet: the author's profile city is the default (fallback Tbilisi).
  const [cityChoice, setCity] = useState(existing?.city || (Object.hasOwn(cities, initialCity) ? initialCity : ""));
  const [addressNote, setAddressNote] = useState(existing?.addressNote || "");
  const [quantity, setQuantity] = useState(existing?.quantity != null ? String(existing.quantity) : "");
  const [unit, setUnit] = useState(existing?.unit || "pcs");
  const [neededByText, setNeededByText] = useState(isoToText(existing?.neededBy || ""));
  const [body, setBody] = useState(existing?.body || "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const v = useFieldErrors();
  // Session known: the first full load (auth included) has finished. Until then the body is a
  // skeleton, so a signed-in author never sees the guest note or a disabled button.
  const [checked, setChecked] = useState(false);
  const hasStore = !!store;
  useEffect(() => {
    if (!hasStore || checked) return;
    let cancelled = false;
    store?.ready().then(() => {if (!cancelled) setChecked(true);});
    return () => {cancelled = true;};
  }, [hasStore, checked, store]);
  useEffect(() => {
    if (open && checked) titleRef.current?.focus();
  }, [open, checked]);
  // Session present but the profile did not load (first refresh failed): keep the skeleton, retry once.
  const sessionPending = checked && !store?.currentUser() && !!store?.hasSession?.();
  const retried = useRef(false);
  useEffect(() => {
    if (!sessionPending || retried.current) return;
    retried.current = true;
    void store?.refresh();
  }, [sessionPending, store]);
  const user = checked ? (store?.currentUser() as {city?: string} | null) : null;
  const city = cityChoice || (user?.city && Object.hasOwn(cities, user.city) ? user.city : "tbilisi");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement;
      d.showModal();
      titleRef.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCloseEvent = () => {
      onClose();
      (triggerRef?.current || opener.current)?.focus();
    };
    d.addEventListener("close", onCloseEvent);
    return () => d.removeEventListener("close", onCloseEvent);
  }, [onClose, triggerRef]);

  const today = store?.todayDate ? (store.todayDate as () => string)() : undefined;
  const max = store?.maxNeededBy ? (store.maxNeededBy as () => string)() : undefined;
  const tomorrow = today ? addDay(today) : undefined;

  function chooseDeadline(days: number | "month") {
    if (!today) return;
    let date: string;
    if (days === "month") {
      const [year, month, day] = today.split("-").map(Number);
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const next = new Date(Date.UTC(year, month, Math.min(day, lastDay)));
      date = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
    } else date = addDay(today, days);
    setNeededByText(isoToText(max && date > max ? max : date));
    v.clear("neededBy");
    dirty.current = true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !store) return;
    setError(null);
    const errors: FieldErrors = {};
    const t = title.trim(), b = body.trim();
    if (t.length < 5) errors.title = t ? "სათაური მინიმუმ 5 სიმბოლოა" : "მიუთითე სათაური";
    if (!category) errors.category = "აირჩიე კატეგორია";
    if (!city) errors.city = "აირჩიე ქალაქი";
    if (b.length < 10) errors.body = b ? "აღწერა მინიმუმ 10 სიმბოლოა" : "აღწერე, რა გჭირდება";
    const neededBy = neededByText.trim() ? textToIso(neededByText) : "";
    if (neededBy === null) errors.neededBy = "მიუთითე თარიღი დღ.თთ.წწწწ ფორმატით";
    else if (neededBy && neededBy !== existing?.neededBy && tomorrow && neededBy < tomorrow) errors.neededBy = "თარიღი ხვალიდან უნდა იყოს";
    else if (neededBy && neededBy !== existing?.neededBy && max && neededBy > max) errors.neededBy = `თარიღი არაუგვიანეს ${isoToText(max)}`;
    if (!v.check(errors, ["title", "category", "city", "body", "neededBy"])) return;
    setPending(true);
    try {
      const input = {
        title,
        category,
        city,
        addressNote: addressNote.trim() || null,
        quantity: quantity || undefined,
        unit: quantity ? unit : undefined,
        neededBy: neededBy || undefined,
        body,
        photo,
      };
      if (existing) await store.updateRequest(existing.id, input);
      else await store.createRequest(input);
      dirty.current = false;
      toast(existing ? "მოთხოვნა განახლდა." : "მოთხოვნა გამოქვეყნდა.");
      setTitle("");
      setCategory("");
      setQuantity("");
      setNeededByText("");
      setAddressNote("");
      setBody("");
      setCity("");
      setPhoto(null);
      ref.current?.close();
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "რაღაც ვერ შესრულდა. სცადე თავიდან.");
    } finally {
      setPending(false);
    }
  }

  function close() {
    if (pending) return;
    if (!dirty.current || window.confirm("შეყვანილი ტექსტი არ შეინახება. დავხურო?")) ref.current?.close();
  }
  const signedIn = checked && !!store?.currentUser();
  const next = encodeURIComponent(`/requests/new/?${new URLSearchParams({title, category, city})}`);
  return (
    <dialog onKeyDown={trapDialogFocus} className="ma-sheet ma-sheet--wide ma-sheet--full request-form" id="new-request" ref={ref} aria-labelledby="request-title" onCancel={e => {e.preventDefault(); close();}}>
      <header className="ma-sheet__header">
        <h2 id="request-title" className="ma-sheet__title">
          {existing ? "მოთხოვნის რედაქტირება" : "ახალი მოთხოვნა"}
        </h2>
        <button className="ma-sheet__close" aria-label="ფორმის დახურვა" onClick={close}>
          <Icon name="x" />
        </button>
      </header>
      <div className="ma-sheet__body">
        {!checked || sessionPending ? (
          <div className="request-form__skeleton" role="status" aria-label="ფორმა იტვირთება…">
            <span className="ma-skel ma-skel--line" />
            <span className="ma-skel ma-skel--line" />
            <span className="ma-skel ma-skel--line" />
          </div>
        ) : <>
        {!signedIn ? <p className="request-form__guest">გამოქვეყნებისთვის <Link className="ma-link" href={`/account/?next=${next}`}>შედი ანგარიშში</Link> ან <Link className="ma-link" href={`/account/?tab=register&next=${next}`}>დარეგისტრირდი</Link>.</p> : null}
        <form className="ma-form" id="new-request-form" onSubmit={submit} noValidate onChange={() => {dirty.current = true;}}>
          <section className="request-form__group" aria-labelledby="request-group-main">
            <h3 className="request-form__group-title" id="request-group-main">რა გჭირდება</h3>
            <div className="request-form__grid">
              <div className="ma-field request-form__wide">
                <label className="ma-field__label" htmlFor="title">
                  სათაური *
                </label>
                <input
                  ref={titleRef}
                  className="ma-input"
                  placeholder="მაგ. 100 კომპლექტი თეთრეული სასტუმროსთვის"
                  maxLength={120}
                  value={title}
                  onChange={(e) => {setTitle(e.target.value); v.clear("title");}}
                  {...v.control("title")}
                />
                {v.message("title")}
              </div>
              <div className="ma-field">
                <label className="ma-field__label" htmlFor="category">
                  კატეგორია *
                </label>
                <CustomSelect className="ma-select" value={category} onChange={(e) => {setCategory(e.target.value); v.clear("category");}} {...v.control("category")}>
                  <option value="" disabled>
                    აირჩიე კატეგორია
                  </option>
                  {categoryOptions()}
                </CustomSelect>
                {v.message("category")}
              </div>
              <div className="ma-field">
                <label className="ma-field__label" htmlFor="city">
                  ქალაქი *
                </label>
                <CustomSelect className="ma-select" value={city} onChange={(e) => {setCity(e.target.value); v.clear("city");}} {...v.control("city")}>
                  {Object.entries(cities).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </CustomSelect>
                {v.message("city")}
              </div>
              <div className="ma-field request-form__wide">
                <label className="ma-field__label" htmlFor="body">
                  აღწერა *
                </label>
                <textarea
                  className="ma-textarea"
                  placeholder="რა გჭირდება, რამდენი, როდისთვის და სად"
                  maxLength={2000}
                  value={body}
                  onChange={(e) => {setBody(e.target.value); v.clear("body");}}
                  {...v.control("body")}
                />
                {v.message("body")}
              </div>
            </div>
          </section>
          <section className="request-form__group" aria-labelledby="request-group-details">
            <h3 className="request-form__group-title" id="request-group-details">
              დეტალები <span className="request-form__group-opt">არასავალდებულო</span>
            </h3>
            <div className="request-form__grid">
              <div className="ma-field">
                <label className="ma-field__label" htmlFor="quantity">
                  რაოდენობა
                </label>
                <div className="request-form__qty" role="group" aria-label="რაოდენობა და ერთეული">
                  <input
                    id="quantity"
                    className="ma-input ma-input--num"
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <CustomSelect className="ma-select" aria-label="რაოდენობის ერთეული" value={unit} onChange={(e) => setUnit(e.target.value)}>
                    {Object.entries(units).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </CustomSelect>
                </div>
              </div>
              <div className="ma-field">
                <label className="ma-field__label" htmlFor="neededBy">
                  საჭიროა თარიღამდე
                </label>
                <DateField id="neededBy" text={neededByText} onText={(text) => {setNeededByText(text); v.clear("neededBy");}} min={tomorrow} max={max} field={v.control("neededBy")} />
                <div className="ma-chips" role="group" aria-label="ვადის სწრაფი არჩევანი">
                  <button type="button" className="ma-btn ma-btn--ghost ma-btn--sm" disabled={!today} onClick={() => chooseDeadline(7)}>ერთ კვირაში</button>
                  <button type="button" className="ma-btn ma-btn--ghost ma-btn--sm" disabled={!today} onClick={() => chooseDeadline(14)}>ორ კვირაში</button>
                  <button type="button" className="ma-btn ma-btn--ghost ma-btn--sm" disabled={!today} onClick={() => chooseDeadline("month")}>ერთ თვეში</button>
                </div>
                {v.message("neededBy")}
              </div>
              <div className="ma-field">
                <label className="ma-field__label" htmlFor="addressNote">
                  რაიონი / ორიენტირი
                </label>
                <input
                  className="ma-input"
                  id="addressNote"
                  maxLength={120}
                  placeholder="მაგ. საბურთალო, ვაჟა-ფშაველას გამზ."
                  value={addressNote}
                  onChange={(e) => setAddressNote(e.target.value)}
                />
              </div>
              {!existing ? <PhotoField file={photo} onChange={setPhoto} /> : existing.photo ? <p className="ma-note">არსებული ფოტო შენარჩუნდება.</p> : null}
            </div>
          </section>
        </form>
        </>}
      </div>
      <footer className="ma-sheet__footer">
        {error ? (
          <p className="ma-field__error request-form__note" role="alert">
            {error}
          </p>
        ) : (
          <p className="request-form__note">
            მოთხოვნა 14 დღე იქნება აქტიური.<span className="request-form__note-more"> ვადის გაგრძელება შეგიძლია მოთხოვნის გვერდიდან.</span>
          </p>
        )}
        <button className="request-form__cancel" type="button" onClick={close}>
          გაუქმება
        </button>
        {checked && !sessionPending ? (
          <button className="ma-btn ma-btn--primary" type="submit" form="new-request-form" disabled={pending || !signedIn}>
            {pending ? "იგზავნება…" : existing ? "შენახვა" : "გამოქვეყნება"}
          </button>
        ) : null}
      </footer>
    </dialog>
  );
}
