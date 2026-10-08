"use client";
import { useId, useState } from "react";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";
import { toast } from "../../Toasts";
import styles from "../deals.module.css";
const criteria = ["ხარისხი", "ვადების დაცვა", "კომუნიკაცია", "საიმედოობა"];
export function ReviewModal({ supplier, request, pending, onClose, onRate }: { supplier: string; request: string; pending: boolean; onClose: () => void; onRate: (rating: number, review: string) => Promise<boolean> }) {
  const id = useId(); const [scores, setScores] = useState([0, 0, 0, 0]); const [again, setAgain] = useState(""); const [comment, setComment] = useState("");
  const summary = `${scores.map((n, i) => `${i === 1 ? "ვადები" : criteria[i]} ${n}`).join(" · ")} · კვლავ: ${again}. `;
  return <Modal open width={520} title="როგორ ჩაიარა თანამშრომლობამ?" lead={`${supplier} · ${request}. შეფასება ჩანს მხარეებისთვის.`} onClose={() => { if (!pending) onClose(); }} actions={<><Button variant="secondary" disabled={pending} onClick={onClose}>მოგვიანებით</Button><Button type="submit" form={id} loading={pending} disabled={pending || scores.some(n => !n) || !again}>შეფასების გაგზავნა</Button></>}>
    <form id={id} className={styles.form} onSubmit={async e => { e.preventDefault(); if (scores.some(n => !n) || !again) return; if (await onRate(Math.round(scores.reduce((a, b) => a + b, 0) / 4), (summary + comment.trim()).slice(0, 2000))) { toast({title: "შეფასება გაიგზავნა", tone: "success"}); onClose(); } }}>
      <div className={styles.reviewCriteria}>{criteria.map((title, i) => <div key={title} className={styles.reviewCriterion}><span>{title}</span><div className={styles.reviewStars} role="group" aria-label={title}>{[1, 2, 3, 4, 5].map(n => <button type="button" disabled={pending} key={n} data-filled={n <= scores[i]} aria-label={`${n} ვარსკვლავი`} aria-pressed={scores[i] === n} onClick={() => setScores(old => old.map((v, j) => j === i ? n : v))}><Icon name="star"/></button>)}</div></div>)}</div>
      <fieldset disabled={pending}><legend>კვლავ ითანამშრომლებდით?</legend><div className={styles.againChoices}>{["დიახ", "არა"].map(value => <Button key={value} variant={again === value ? "primary" : "secondary"} aria-pressed={again === value} onClick={() => setAgain(value)}>{value}</Button>)}</div></fieldset>
      <label><span className={styles.labelLine}>კომენტარი<small>არასავალდებულო</small></span><textarea className="ma-textarea" placeholder="რა მოგეწონათ, რა შეიძლება გაუმჯობესდეს?" disabled={pending} maxLength={2000 - summary.length} value={comment} onChange={e => setComment(e.target.value)}/></label>
    </form>
  </Modal>;
}
