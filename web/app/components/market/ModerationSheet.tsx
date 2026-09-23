"use client";

import { useEffect, useRef } from "react";
import styles from "./admin.module.css";

export function ModerationSheet({
  open,
  title,
  subject,
  action,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  subject: string;
  action: string;
  pending: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const needsReason = action === "hide" || action === "block";
  const destructive = ["hide", "block", "delete", "unverify"].includes(action);
  const consequences: Record<string, string> = {
    hide: "მოთხოვნა საჯარო სიიდან დაიმალება. მისი გამოჩენა მოგვიანებით შესაძლებელია.",
    unhide: "მოთხოვნა კვლავ გამოჩნდება საჯაროდ, მისი მიმდინარე სტატუსის შესაბამისად.",
    delete: "მოთხოვნა და მასზე მიღებული ყველა შეთავაზება სამუდამოდ წაიშლება. ამ მოქმედების გაუქმება შეუძლებელია. დროებით მოსაშორებლად გამოიყენე დამალვა.",
    block: "მომხმარებელი ვეღარ შეასრულებს მოქმედებებს პლატფორმაზე. განბლოკვა მოგვიანებით შესაძლებელია.",
    unblock: "მომხმარებელს პლატფორმაზე მოქმედებების შესრულება კვლავ შეეძლება.",
    verify: "კომპანიის ადმინისტრაციული დადასტურების სტატუსი ჩაირთვება.",
    unverify: "კომპანიას ადმინისტრაციული დადასტურების სტატუსი მოეხსნება.",
  };
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {form.current?.reset(); opener.current = document.activeElement as HTMLElement; d.showModal();}
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
    <dialog className="ma-sheet" id="moderation" ref={ref} aria-labelledby="moderation-title" onCancel={event => { if (pending) event.preventDefault(); }}>
      <form className={styles.moderationForm} ref={form} onSubmit={event => {
        event.preventDefault();
        if (pending) return;
        const reason = String(new FormData(event.currentTarget).get("reason") || "").trim();
        const input = event.currentTarget.elements.namedItem("reason") as HTMLTextAreaElement | null;
        if (needsReason && reason.length < 3) { input?.setCustomValidity("მიზეზი უნდა შეიცავდეს მინიმუმ 3 სიმბოლოს."); input?.reportValidity(); return; }
        onConfirm(reason);
      }}>
      <header className="ma-sheet__header">
        <h2 id="moderation-title" className="ma-sheet__title">
          მოქმედების დადასტურება
        </h2>
        <button type="button" disabled={pending} className="ma-sheet__close" aria-label="დახურვა" onClick={() => ref.current?.close()}>
          ✕
        </button>
      </header>
      <div className="ma-sheet__body">
        <p>
          {title}: <b>{subject}</b>
        </p>
        <p className={styles.consequence}>{consequences[action]}</p>
        {needsReason ? <div className={styles.reason}><label htmlFor="moderation-reason">მიზეზი</label>
          <textarea id="moderation-reason" className="ma-input" name="reason" required minLength={3} maxLength={500} disabled={pending} onInput={event => event.currentTarget.setCustomValidity("")} aria-describedby="moderation-reason-note" />
          <span id="moderation-reason-note">3–500 სიმბოლო. მიუთითე კონკრეტული მიზეზი, პირადი მონაცემების გარეშე.</span>
        </div> : null}
        {error ? (
          <p className="ma-field__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <footer className="ma-sheet__footer">
        <button className={`ma-btn ma-btn--${destructive ? "danger" : "primary"}`} type="submit" disabled={pending}>
          {pending ? "ინახება…" : action === "delete" ? "სამუდამოდ წაშლა" : "დადასტურება"}
        </button>
        <button className="ma-btn ma-btn--secondary" type="button" disabled={pending} onClick={() => ref.current?.close()}>
          გაუქმება
        </button>
      </footer>
      </form>
    </dialog>
  );
}
