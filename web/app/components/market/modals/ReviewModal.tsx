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
      {criteria.map((title, i) => <fieldset key={title} className={styles.reviewCriterion} disabled={pending}><legend>{title}</legend><div className={styles.reviewStars} role="radiogroup" aria-label={title}>{[1, 2, 3, 4, 5].map(n => <label key={n} data-filled={n <= scores[i]}><input type="radio" name={`${id}-${i}`} required value={n} checked={scores[i] === n} onChange={() => setScores(old => old.map((v, j) => j === i ? n : v))} aria-label={`${n} ვარსკვლავი`}/><Icon name="star"/></label>)}</div></fieldset>)}
      <fieldset disabled={pending}><legend>კვლავ ითანამშრომლებდით?</legend><div className={styles.issueChoices}>{["დიახ", "არა"].map(value => <label key={value}><input type="radio" name={`${id}-again`} required checked={again === value} onChange={() => setAgain(value)}/>{value}</label>)}</div></fieldset>
      <label>კომენტარი (არასავალდებულო)<textarea className="ma-textarea" disabled={pending} maxLength={2000 - summary.length} value={comment} onChange={e => setComment(e.target.value)}/></label>
    </form>
  </Modal>;
}
