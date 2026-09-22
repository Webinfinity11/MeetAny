"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { PhotoField } from "./PhotoField";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities, units } from "../../lib/categories";

export function RequestFormSheet({
  open,
  initialCategory = "",
  onClose,
  triggerRef,
}: {
  open: boolean;
  initialCategory?: string;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}) {
  const { store } = useMarketStore();
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [city, setCity] = useState("tbilisi");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [neededBy, setNeededBy] = useState("");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
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
      triggerRef?.current?.focus();
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
      await (store.createRequest as (input: unknown) => Promise<unknown>)({
        title,
        category,
        city,
        quantity: quantity || undefined,
        unit: quantity ? unit : undefined,
        neededBy: neededBy || undefined,
        body,
        photo,
      });
      setTitle("");
      setCategory("");
      setQuantity("");
      setNeededBy("");
      setBody("");
      setPhoto(null);
      ref.current?.close();
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "რაღაც ვერ შესრულდა. სცადე თავიდან.");
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog className="ma-sheet ma-sheet--wide ma-sheet--full" id="new-request" ref={ref} aria-labelledby="request-title">
      <header className="ma-sheet__header">
        <div>
          <span className="ma-eyebrow ma-eyebrow--brand">ახალი მოთხოვნა</span>
          <h2 id="request-title" className="ma-sheet__title">
            რა გჭირდება?
          </h2>
        </div>
        <button className="ma-sheet__close" aria-label="ფორმის დახურვა" onClick={() => ref.current?.close()}>
          <Icon name="x" />
        </button>
      </header>
      <div className="ma-sheet__body">
        <p className="ma-lead">მოკლედ აღწერე საჭიროება. შეთავაზებებს მხოლოდ შენ ნახავ.</p>
        <form className="ma-form" id="new-request-form" onSubmit={submit}>
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
              <label className="ma-field__label" htmlFor="quantity">
                რაოდენობა <span className="ma-field__opt">არასავალდებულო</span>
              </label>
              <div className="ma-form__row ma-form__row--2">
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
          <PhotoField file={photo} onChange={setPhoto} />
          <p className="ma-note">
            <Icon name="clock" />
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
        <button className="ma-btn ma-btn--secondary" type="button" onClick={() => ref.current?.close()}>
          გაუქმება
        </button>
        <button className="ma-btn ma-btn--primary" type="submit" form="new-request-form" disabled={pending}>
          {pending ? "იგზავნება…" : "გამოქვეყნება"} <Icon name="arrow-right" />
        </button>
      </footer>
    </dialog>
  );
}
