"use client";

import { useEffect, useRef } from "react";

export function ModerationSheet({
  open,
  title,
  subject,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  subject: string;
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
    <dialog className="ma-sheet" id="moderation" ref={ref} aria-labelledby="moderation-title">
      <header className="ma-sheet__header">
        <h2 id="moderation-title" className="ma-sheet__title">
          მოქმედების დადასტურება
        </h2>
        <button className="ma-sheet__close" aria-label="დახურვა" onClick={() => ref.current?.close()}>
          ✕
        </button>
      </header>
      <div className="ma-sheet__body">
        <p>
          {title}: <b>{subject}</b>
        </p>
        {error ? (
          <p className="ma-field__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <footer className="ma-sheet__footer">
        <button className="ma-btn ma-btn--danger" type="button" disabled={pending} onClick={onConfirm}>
          {pending ? "…" : "დადასტურება"}
        </button>
        <button className="ma-btn ma-btn--secondary" type="button" onClick={() => ref.current?.close()}>
          გაუქმება
        </button>
      </footer>
    </dialog>
  );
}
