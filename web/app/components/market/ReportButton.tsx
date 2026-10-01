"use client";
import { Button } from "../ui/Button";


import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { Sheet } from "../ui/Sheet";
import { toast } from "../Toasts";
import { useMarketStore } from "../../lib/market-client";

export type ReportKind = "request" | "company" | "offer";
const reasons = [
  { key: "spam", label: "სპამი ან რეკლამა" },
  { key: "fake", label: "ყალბი ან შეცდომაში შემყვანი" },
  { key: "offensive", label: "შეურაცხმყოფელი შინაარსი" },
  { key: "other", label: "სხვა მიზეზი" },
];
const questions: Record<ReportKind, string> = {
  request: "რა არის არასწორი ამ მოთხოვნაში?",
  company: "რა არის არასწორი ამ კომპანიის გვერდზე?",
  offer: "რა არის არასწორი ამ შეთავაზებაში?",
};
const TEXT_MAX = 500;

/** Quiet „შეატყობინე“ action: guests go to sign-in first, users pick a reason in a small sheet. */
export function ReportButton({ kind, targetId }: { kind: ReportKind; targetId: string }) {
  const { store } = useMarketStore();
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  async function start() {
    // A click right after page load must not treat a signed-in user as a guest.
    if (store) await store.ready();
    if (!store?.currentUser()) {
      router.push(`/account/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setOpen(true);
  }
  function close() {
    setOpen(false);
    button.current?.focus();
  }
  return <>
    <button ref={button} type="button" className="detail-link report-link" onClick={start}><Icon name="flag" />შეატყობინე</button>
    {open ? <ReportSheet kind={kind} targetId={targetId} onClose={close} /> : null}
  </>;
}

function ReportSheet({ kind, targetId, onClose }: { kind: ReportKind; targetId: string; onClose: () => void }) {
  const { store } = useMarketStore();
  const formId = useId();
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsText = reason === "other";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!store || pending) return;
    if (!reason) { setError("აირჩიე მიზეზი."); return; }
    if (needsText && text.trim().length < 3) { setError("„სხვა მიზეზისთვის“ მოკლედ აღწერე პრობლემა."); return; }
    setPending(true);
    setError(null);
    try {
      await store.reportContent(kind, targetId, reason, text);
      toast("მადლობა. შეტყობინებას გუნდი განიხილავს.");
      onClose();
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "შეტყობინება ვერ გაიგზავნა. სცადე თავიდან.");
    } finally {
      setPending(false);
    }
  }

  return <Sheet open className="report-sheet" onClose={() => { if (!pending) onClose(); }} title="შეტყობინება"
    footer={<>
      <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>გაუქმება</Button>
      <Button type="submit" form={formId} variant="primary" disabled={pending}>{pending ? "იგზავნება…" : "გაგზავნა"}</Button>
    </>}>
    <form id={formId} className="ma-form" onSubmit={submit} noValidate>
      <fieldset className="report-reasons">
        <legend className="ma-field__label">{questions[kind]}</legend>
        {reasons.map(r => <label key={r.key} className="ma-check">
          <input type="radio" name="report-reason" value={r.key} checked={reason === r.key} disabled={pending} onChange={() => { setReason(r.key); setError(null); }} />
          {r.label}
        </label>)}
      </fieldset>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor={`${formId}-text`}>
          დეტალები {needsText ? null : <span className="ma-field__opt">არასავალდებულო</span>}
        </label>
        <textarea id={`${formId}-text`} className="ma-textarea" maxLength={TEXT_MAX} value={text} disabled={pending} required={needsText}
          aria-describedby={`${formId}-help`} onChange={e => { setText(e.target.value); setError(null); }} />
        <span className="ma-field__help" id={`${formId}-help`}>{text.length}/{TEXT_MAX} · შეტყობინებას მხოლოდ MeetAny-ის გუნდი ნახავს.</span>
      </div>
      {error ? <p className="ma-field__error" role="alert">{error}</p> : null}
    </form>
  </Sheet>;
}
