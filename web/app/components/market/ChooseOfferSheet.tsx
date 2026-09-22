"use client";

import { useEffect, useRef } from "react";

export function ChooseOfferSheet({
  open,
  companyName,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  companyName: string;
  pending: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClose = () => onCancel();
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, [onCancel]);

  return (
    <dialog id="choose" className="ma-sheet" ref={ref} aria-labelledby="choose-title">
      <header className="ma-sheet__header">
        <h2 id="choose-title" className="ma-sheet__title">
          შეთავაზების არჩევა
        </h2>
        <button className="ma-sheet__close" aria-label="დახურვა" onClick={() => ref.current?.close()}>
          ✕
        </button>
      </header>
      <div className="ma-sheet__body">
        <p>
          არჩევის შემდეგ <b>{companyName}</b>-ს გაეზიარება შენი ელფოსტა. საბოლოო პირობებს კომპანიასთან
          შეათანხმებ.
        </p>
        {error ? (
          <p className="ma-field__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <footer className="ma-sheet__footer">
        <button className="ma-btn ma-btn--primary" type="button" disabled={pending} onClick={onConfirm}>
          {pending ? "ირჩევა…" : "შეთავაზების არჩევა"}
        </button>
        <button className="ma-btn ma-btn--secondary" type="button" onClick={() => ref.current?.close()}>
          გაუქმება
        </button>
      </footer>
    </dialog>
  );
}
