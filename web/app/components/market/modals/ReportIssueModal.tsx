"use client";
import { useId, useRef, useState } from "react";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { toast } from "../../Toasts";
import type { Store } from "../../../lib/market-client";
import styles from "../deals.module.css";
const reasons = ["ხარისხი / დეფექტი", "რაოდენობა", "დაგვიანება", "სხვა"];
export function ReportIssueModal({ store, targetId, kind, onClose }: { store: Store; targetId: string; kind: "offer" | "company"; onClose: () => void }) {
  const id = useId(); const flight = useRef(false);
  const [reason, setReason] = useState(""); const [text, setText] = useState("");
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  return <Modal open width={540} icon="triangle-alert" tone="warning" title="პრობლემის შეტყობინება" lead="აღწერეთ, რა არ შეესაბამება შეთანხმებას." onClose={() => { if (!pending) onClose(); }} actions={<><Button variant="secondary" disabled={pending} onClick={onClose}>გაუქმება</Button><Button type="submit" form={id} loading={pending}>გაგზავნა</Button></>}>
    <form id={id} className={styles.form} onSubmit={async e => { e.preventDefault(); if (flight.current) return; if (!reason || text.trim().length < 3) { setError("აირჩიეთ მიზეზი და აღწერეთ პრობლემა (მინიმუმ 3 სიმბოლო)."); return; } flight.current = true; setPending(true); setError(""); try { await store.reportContent(kind, targetId, "other", `${reason}: ${text.trim()}`); toast({title: "შეტყობინება გაიგზავნა", tone: "success"}); onClose(); } catch (err) { setError((err as { userMessage?: string }).userMessage || "შეტყობინება ვერ გაიგზავნა. სცადეთ ხელახლა."); } finally { flight.current = false; setPending(false); } }}>
      <fieldset disabled={pending}><legend className="ma-sr-only">პრობლემის მიზეზი</legend><div className={styles.issueChoices}>{reasons.map(r => <label key={r}><input className="ma-check" type="radio" name="reason" required checked={reason === r} onChange={() => { setReason(r); setText(t => t.slice(0, 500 - r.length - 2)); }}/>{r}</label>)}</div></fieldset>
      <label>აღწერა<textarea className="ma-textarea" required minLength={3} maxLength={500 - reason.length - 2} disabled={pending} value={text} onChange={e => setText(e.target.value)}/></label>
      <p className={styles.modalInfo}>MeetAny-ს გუნდი განიხილავს და დაუკავშირდება ორივე მხარეს.</p>{error ? <p role="alert">{error}</p> : null}
    </form>
  </Modal>;
}
