"use client";

import { useEffect, useRef } from "react";
import styles from "./admin.module.css";

export function ModerationSheet({
  open,
  title,
  subject,
  action,
  pending,
  requireDeleteReason = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  subject: string;
  action: string;
  pending: boolean;
  requireDeleteReason?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const needsReason = action === "hide" || action === "block" || action === "removePhoto" || (requireDeleteReason && ["delete", "deleteOffer"].includes(action));
  const destructive = ["hide", "block", "delete", "deleteOffer", "unverify", "removePhoto"].includes(action);
  const consequences: Record<string, string> = {
    removePhoto: "ფოტო კომპანიის პროფილიდან და საცავიდან სამუდამოდ წაიშლება. მიზეზი მოქმედებების ჟურნალში შეინახება.",
    hide: "მოთხოვნა საჯარო სიიდან დაიმალება. მისი გამოჩენა მოგვიანებით შესაძლებელია.",
    unhide: "მოთხოვნა კვლავ გამოჩნდება საჯაროდ, მისი მიმდინარე სტატუსის შესაბამისად.",
    delete: "მოთხოვნა და მასზე მიღებული ყველა შეთავაზება სამუდამოდ წაიშლება. ამ მოქმედების გაუქმება შეუძლებელია. დროებით მოსაშორებლად გამოიყენე დამალვა.",
    deleteOffer: "შეთავაზება სამუდამოდ წაიშლება. ამ მოქმედების გაუქმება შეუძლებელია. მიზეზი მოქმედებების ჟურნალში შეინახება.",
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
    <dialog className="ma-sheet" id="moderation" ref={ref} aria-labelledby="moderation-title" tabIndex={-1} onKeyDown={event => {
      if (event.key !== "Tab") return;
      const dialog = event.currentTarget;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]'))
        .filter(element => element.tabIndex >= 0 && !element.matches(':disabled,[hidden],[inert]') && !element.closest('[inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
    }} onCancel={event => { if (pending) event.preventDefault(); }}>
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
          <textarea id="moderation-reason" className="ma-input" name="reason" required minLength={3} maxLength={500} disabled={pending} onInvalid={event => event.currentTarget.setCustomValidity("მიზეზი უნდა შეიცავდეს 3–500 სიმბოლოს.")} onInput={event => event.currentTarget.setCustomValidity("")} aria-describedby="moderation-reason-note" />
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
          {pending ? "ინახება…" : ["delete", "deleteOffer"].includes(action) ? "სამუდამოდ წაშლა" : "დადასტურება"}
        </button>
        <button className="ma-btn ma-btn--secondary" type="button" disabled={pending} onClick={() => ref.current?.close()}>
          გაუქმება
        </button>
      </footer>
      </form>
    </dialog>
  );
}
