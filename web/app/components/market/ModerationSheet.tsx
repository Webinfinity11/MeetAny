"use client";
import { Button } from "../ui/Button";


import { useEffect, useRef } from "react";
import styles from "./admin.module.css";

/** A choice made together with the reason, e.g. the new deal stage or the issue outcome. */
export type ModerationChoice = { label: string; options: [string, string][]; value?: string };

/** What each action does, said once, in the admin's words. */
export const moderationActions: Record<string, { title: string; confirm: string; consequence: string; reason?: boolean; destructive?: boolean }> = {
  "reportHide.request": { title: "საჩივრის დაკმაყოფილება · მოთხოვნის დამალვა", confirm: "მოთხოვნის დამალვა", reason: true, destructive: true, consequence: "მოთხოვნა საჯარო სიიდან დაიმალება, ამ მოთხოვნის ყველა ახალი საჩივარი დამუშავებულად მოინიშნება და ავტორებს შეტყობინება გაეგზავნებათ." },
  "reportHide.offer": { title: "საჩივრის დაკმაყოფილება · შეთავაზების წაშლა", confirm: "სამუდამოდ წაშლა", reason: true, destructive: true, consequence: "შეთავაზება სამუდამოდ წაიშლება, მისი ყველა ახალი საჩივარი დამუშავებულად მოინიშნება და ავტორებს შეტყობინება გაეგზავნებათ." },
  "reportHide.company": { title: "საჩივრის დაკმაყოფილება · კომპანიის დაბლოკვა", confirm: "კომპანიის დაბლოკვა", reason: true, destructive: true, consequence: "კომპანია დაიბლოკება, მისი ყველა ახალი საჩივარი დამუშავებულად მოინიშნება და ავტორებს შეტყობინება გაეგზავნებათ. განბლოკვა მოგვიანებით შესაძლებელია." },
  "roleClient": { title: "როლის შეცვლა · კლიენტი", confirm: "როლის შეცვლა", consequence: "კომპანია კლიენტი გახდება და ვერიფიკაცია მოეხსნება.", reason: true, destructive: false },
  "roleCompany": { title: "როლის შეცვლა · კომპანია", confirm: "როლის შეცვლა", consequence: "მომხმარებელი კომპანიის ონბორდინგზე გადავა.", reason: true, destructive: false },
  "anonymize": { title: "ანგარიშის ანონიმიზაცია", confirm: "ანონიმიზაცია", consequence: "პირადი მონაცემები შეუქცევადად წაიშლება, ღია მოთხოვნები დაიმალება და გაგზავნილი შეთავაზებები გაუქმდება. მიმოწერა შენარჩუნდება. ავტორიზაციის ანგარიში რჩება დაბლოკილი.", reason: true, destructive: true },
  "hideCompany": { title: "კატალოგიდან დამალვა", confirm: "დამალვა", consequence: "კომპანია კატალოგში აღარ გამოჩნდება; ანგარიშსა და შეთავაზებების გაგზავნაზე წვდომა შეუნარჩუნდება.", reason: true, destructive: true },
  "showCompany": { title: "კატალოგში დაბრუნება", confirm: "კატალოგში დაბრუნება", consequence: "კომპანია კატალოგში მიმდინარე ვერიფიკაციის სტატუსის შესაბამისად გამოჩნდება.", reason: true, destructive: false },
  "reportHide.review": { title: "საჩივრის დაკმაყოფილება · შეფასების დამალვა", confirm: "შეფასების დამალვა", consequence: "შეფასება საჯარო პროფილიდან დაიმალება და საჩივრის ავტორს შედეგი გაეგზავნება.", reason: true, destructive: true },
  "reportHide.conversation": { title: "საჩივრის დაკმაყოფილება · მომხმარებლის დაბლოკვა", confirm: "მომხმარებლის დაბლოკვა", consequence: "საჩივრის ავტორის მეორე მხარე დაიბლოკება და საჩივრის ავტორს შედეგი გაეგზავნება.", reason: true, destructive: true },
  reportReject: { title: "საჩივრის უარყოფა", confirm: "საჩივრის უარყოფა", reason: true, consequence: "საჩივარი დაიხურება, შინაარსი უცვლელი დარჩება. ავტორს შეტყობინება გაეგზავნება." },
  removePhoto: { title: "ფოტოს წაშლა", confirm: "ფოტოს წაშლა", reason: true, destructive: true, consequence: "ფოტო კომპანიის პროფილიდან და საცავიდან სამუდამოდ წაიშლება. მიზეზი ისტორიაში შეინახება." },
  hide: { title: "მოთხოვნის დამალვა", confirm: "დამალვა", reason: true, destructive: true, consequence: "მოთხოვნა საჯარო სიიდან დაიმალება. მისი გამოჩენა მოგვიანებით შესაძლებელია." },
  unhide: { title: "მოთხოვნის გამოჩენა", confirm: "გამოჩენა", consequence: "მოთხოვნა კვლავ გამოჩნდება საჯაროდ, მისი მიმდინარე სტატუსის შესაბამისად." },
  delete: { title: "მოთხოვნის წაშლა", confirm: "სამუდამოდ წაშლა", destructive: true, consequence: "მოთხოვნა და მასზე მიღებული ყველა შეთავაზება სამუდამოდ წაიშლება. ამ მოქმედების გაუქმება შეუძლებელია. დროებით მოსაშორებლად გამოიყენეთ დამალვა." },
  deleteOffer: { title: "შეთავაზების წაშლა", confirm: "სამუდამოდ წაშლა", destructive: true, consequence: "შეთავაზება სამუდამოდ წაიშლება. ამ მოქმედების გაუქმება შეუძლებელია. მიზეზი ისტორიაში შეინახება." },
  block: { title: "ანგარიშის დაბლოკვა", confirm: "დაბლოკვა", reason: true, destructive: true, consequence: "ანგარიში ვეღარ შეასრულებს მოქმედებებს პლატფორმაზე. განბლოკვა მოგვიანებით შესაძლებელია." },
  unblock: { title: "ანგარიშის განბლოკვა", confirm: "განბლოკვა", consequence: "ანგარიშს პლატფორმაზე მოქმედებების შესრულება კვლავ შეეძლება." },
  verify: { title: "კომპანიის ვერიფიკაცია", confirm: "ვერიფიცირება", consequence: "თუ კომპანია დაბლოკილი არ არის, საჯარო კატალოგში გამოჩნდება და შეთავაზებების გაგზავნას შეძლებს. დოკუმენტების სტატუსი „ვერიფიცირებული“ გახდება და კომპანიას შეტყობინება გაეგზავნება." },
  unverify: { title: "ვერიფიკაციის მოხსნა", confirm: "ვერიფიკაციის მოხსნა", reason: true, destructive: true, consequence: "კომპანია კატალოგიდან დაიმალება და ახალ შეთავაზებებს ვეღარ გაგზავნის. დოკუმენტები შესწორებისთვის დაუბრუნდება; მიზეზს კომპანია დაინახავს." },
  approveDocs: { title: "დოკუმენტების დადასტურება", confirm: "ვერიფიცირება", consequence: "კომპანია ვერიფიცირებული გახდება და შეტყობინებას მიიღებს." },
  returnDocs: { title: "დოკუმენტების დაბრუნება", confirm: "დოკუმენტების დაბრუნება", reason: true, destructive: true, consequence: "დოკუმენტები შესწორებისთვის დაუბრუნდება. მიზეზს კომპანია დაინახავს და ხელახლა გამოგზავნის." },
  hideReview: { title: "შეფასების დამალვა", confirm: "შეფასების დამალვა", reason: true, destructive: true, consequence: "შეფასება კომპანიის პროფილიდან დაიმალება. აღდგენა მოგვიანებით შესაძლებელია." },
  publishReview: { title: "შეფასების აღდგენა", confirm: "შეფასების აღდგენა", consequence: "შეფასება კვლავ გამოჩნდება კომპანიის პროფილზე." },
  dealStage: { title: "გარიგების ეტაპის შეცვლა", confirm: "ეტაპის შეცვლა", reason: true, consequence: "ეტაპი ორივე მხარისთვის შეიცვლება და ისინი შეტყობინებას მიიღებენ. მიზეზი ისტორიაში შეინახება." },
  dealCancel: { title: "გარიგების გაუქმება", confirm: "გარიგების გაუქმება", reason: true, destructive: true, consequence: "გარიგება გაუქმდება ორივე მხარისთვის და ისინი შეტყობინებას მიიღებენ. გაუქმებული გარიგება აღარ გაგრძელდება." },
  resolveIssue: { title: "პრობლემის განხილვის დასრულება", confirm: "განხილვის დასრულება", reason: true, consequence: "შედეგი და კომენტარი ორივე მხარეს გამოუჩნდება. „გარიგება გაუქმდა“ გარიგებასაც გააუქმებს." },
};

export function ModerationSheet({
  open,
  subject,
  action,
  pending,
  reviewBody,
  requireDeleteReason = false,
  error,
  choice,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  subject: string;
  reviewBody?: string;
  action: string;
  pending: boolean;
  requireDeleteReason?: boolean;
  error?: string | null;
  choice?: ModerationChoice;
  onConfirm: (reason: string, choice?: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const meta = moderationActions[action];
  const needsReason = !!meta?.reason || (requireDeleteReason && ["delete", "deleteOffer"].includes(action));
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
        const data = new FormData(event.currentTarget);
        const reason = String(data.get("reason") || "").trim();
        const input = event.currentTarget.elements.namedItem("reason") as HTMLTextAreaElement | null;
        if (needsReason && reason.length < 3) { input?.setCustomValidity("მიუთითეთ მიზეზი — მინიმუმ 3 სიმბოლო."); input?.reportValidity(); return; }
        onConfirm(reason, choice ? String(data.get("choice") || "") : undefined);
      }}>
      <header className="ma-sheet__header">
        <h2 id="moderation-title" className="ma-sheet__title">
          {meta?.title || "მოქმედება"}
        </h2>
        <button type="button" disabled={pending} className="ma-sheet__close" aria-label="დახურვა" onClick={() => ref.current?.close()}>
          ✕
        </button>
      </header>
      <div className="ma-sheet__body">
        <p className={styles.subject}>{subject}</p>
        {reviewBody ? <section aria-label="შეფასების სრული ტექსტი"><h3>შეფასება</h3><p className={styles.reviewBody}>{reviewBody}</p></section> : null}
        {meta?.consequence ? <p className={styles.consequence}>{meta.consequence}</p> : null}
        {choice ? <div className={styles.reason}><label htmlFor="moderation-choice">{choice.label}</label>
          <select id="moderation-choice" className="ma-select" name="choice" required defaultValue={choice.value || choice.options[0]?.[0]} disabled={pending}>
            {choice.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div> : null}
        {needsReason ? <div className={styles.reason}><label htmlFor="moderation-reason">მიზეზი</label>
          <textarea id="moderation-reason" className="ma-input" name="reason" required minLength={3} maxLength={500} disabled={pending} onInvalid={event => event.currentTarget.setCustomValidity("მიუთითეთ მიზეზი — 3–500 სიმბოლო.")} onInput={event => event.currentTarget.setCustomValidity("")} aria-describedby="moderation-reason-note" />
          <span id="moderation-reason-note">3–500 სიმბოლო. მიუთითეთ კონკრეტული მიზეზი, პირადი მონაცემების გარეშე.</span>
        </div> : null}
        {error ? (
          <p className="ma-field__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <footer className="ma-sheet__footer">
        <Button variant={meta?.destructive ? "danger" : "primary"} type="submit" disabled={pending}>
          {pending ? "ინახება…" : meta?.confirm || "შესრულება"}
        </Button>
        <Button variant="secondary" type="button" disabled={pending} onClick={() => ref.current?.close()}>
          დაბრუნება
        </Button>
      </footer>
      </form>
    </dialog>
  );
}
