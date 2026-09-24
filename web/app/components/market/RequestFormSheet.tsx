"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "../Toasts";
import { Icon } from "../Icon";
import { PhotoField } from "./PhotoField";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities, units } from "../../lib/categories";

export function RequestFormSheet({
  open,
  existing,
  initialCategory = "",
  onClose,
  triggerRef,
}: {
  open: boolean;
  existing?: {id: string; title: string; category: string; city: string; quantity: number | null; unit: string | null; neededBy: string | null; body: string; photo: string | null; addressNote?: string | null};
  initialCategory?: string;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}) {
  const { store } = useMarketStore();
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(existing?.title || "");
  const [category, setCategory] = useState(existing?.category || initialCategory);
  const [city, setCity] = useState(existing?.city || "tbilisi");
  const [addressNote, setAddressNote] = useState(existing?.addressNote || "");
  const [quantity, setQuantity] = useState(existing?.quantity != null ? String(existing.quantity) : "");
  const [unit, setUnit] = useState(existing?.unit || "pcs");
  const [neededBy, setNeededBy] = useState(existing?.neededBy || "");
  const [body, setBody] = useState(existing?.body || "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !store) return;
    setPending(true);
    setError(null);
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
      setNeededBy("");
      setAddressNote("");
      setBody("");
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
  return (
    <dialog className="ma-sheet ma-sheet--wide ma-sheet--full request-form" id="new-request" ref={ref} aria-labelledby="request-title" onCancel={e => {e.preventDefault(); close();}}>
      <header className="ma-sheet__header">
        <h2 id="request-title" className="ma-sheet__title">
          {existing ? "მოთხოვნის რედაქტირება" : "ახალი მოთხოვნა"}
        </h2>
        <button className="ma-sheet__close" aria-label="ფორმის დახურვა" onClick={close}>
          <Icon name="x" />
        </button>
      </header>
      <div className="ma-sheet__body">
        {store?.isReady() && !store.currentUser() ? <p className="ma-note">გამოქვეყნებისთვის <Link className="ma-link" href="/account/">შედი ანგარიშში</Link> ან დარეგისტრირდი.</p> : null}
        <p className="request-form__hint">მოკლედ აღწერე საჭიროება. შეთავაზებებს მხოლოდ შენ ნახავ.</p>
        <form className="ma-form" id="new-request-form" onSubmit={submit} onChange={() => {dirty.current = true;}}>
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="title">
              სათაური *
            </label>
            <input
              ref={titleRef}
              className="ma-input"
              id="title"
              required
              minLength={5}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="ma-form__row ma-form__row--2">
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="category">
                კატეგორია *
              </label>
              <select className="ma-select" id="category" required value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="" disabled>
                  აირჩიე კატეგორია
                </option>
                {Object.entries(categories).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="city">
                ქალაქი *
              </label>
              <select className="ma-select" id="city" required value={city} onChange={(e) => setCity(e.target.value)}>
                {Object.entries(cities).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="ma-form__row ma-form__row--2">
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="neededBy">
                საჭიროა თარიღამდე <span className="ma-field__opt">არასავალდებულო</span>
              </label>
              <input
                className="ma-input"
                id="neededBy"
                type="date"
                min={today}
                max={max}
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
              />
            </div>
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="addressNote">
                რაიონი / ორიენტირი <span className="ma-field__opt">არასავალდებულო</span>
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
          </div>
          <div className="ma-form__row ma-form__row--2">
            <div className="ma-field">
              <label className="ma-field__label" htmlFor="quantity">
                რაოდენობა <span className="ma-field__opt">არასავალდებულო</span>
              </label>
              <div className="request-form__qty" role="group" aria-label="რაოდენობა და ერთეული">
                <input
                  id="quantity"
                  className="ma-input"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <select className="ma-select" aria-label="რაოდენობის ერთეული" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {Object.entries(units).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="body">
              აღწერა *
            </label>
            <textarea
              className="ma-textarea"
              id="body"
              required
              minLength={10}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          {!existing ? <PhotoField file={photo} onChange={setPhoto} /> : existing.photo ? <p className="ma-note">არსებული ფოტო შენარჩუნდება.</p> : null}
          <p className="request-form__hint">
            მოთხოვნა 14 დღე იქნება აქტიური. ვადის გაგრძელება შეგიძლია მოთხოვნის გვერდიდან.
          </p>
          {error ? (
            <p className="ma-field__error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </div>
      <footer className="ma-sheet__footer">
        <button className="request-form__cancel" type="button" onClick={close}>
          გაუქმება
        </button>
        <button className="ma-btn ma-btn--primary" type="submit" form="new-request-form" disabled={pending || !store?.currentUser()}>
          {pending ? "იგზავნება…" : existing ? "შენახვა" : "გამოქვეყნება"}
        </button>
      </footer>
    </dialog>
  );
}
