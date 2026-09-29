"use client";

import { trapDialogFocus } from "./dialog-focus";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "../Icon";

/** Confirmation dialog for consequential actions (choose, close, delete, withdraw). */
export function ConfirmSheet({
  id,
  open,
  title,
  children,
  confirmLabel,
  pendingLabel,
  danger = false,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  id: string;
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  danger?: boolean;
  pending: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {opener.current = document.activeElement as HTMLElement; d.showModal();}
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClose = () => {onCancel(); if (opener.current?.isConnected) opener.current.focus();};
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, [onCancel]);

  return (
    <dialog onKeyDown={trapDialogFocus} id={id} className="ma-sheet ma-sheet--confirm" ref={ref} aria-labelledby={`${id}-title`}>
      <header className="ma-sheet__header">
        <h2 id={`${id}-title`} className="ma-sheet__title">{title}</h2>
        <button className="ma-sheet__close" aria-label="დახურვა" onClick={() => ref.current?.close()}><Icon name="x" /></button>
      </header>
      <div className="ma-sheet__body">
        {children}
        {error ? (
          <p className="ma-field__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <footer className="ma-sheet__footer">
        <button className="ma-btn ma-btn--secondary" type="button" onClick={() => ref.current?.close()}>
          გაუქმება
        </button>
        <button className={`ma-btn ${danger ? "ma-btn--danger" : "ma-btn--primary"}`} type="button" disabled={pending} onClick={onConfirm}>
          {pending ? pendingLabel : confirmLabel}
        </button>
      </footer>
    </dialog>
  );
}
