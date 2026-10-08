"use client";
import { useEffect, useEffectEvent, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "../../ui/Modal";
import { Icon } from "../../Icon";
import { LoginForm } from "../AuthForms";
import styles from "./AuthModal.module.css";

export function AuthModal({ open, onClose, onSuccess, intent, context, next }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
  intent: "offer" | "save" | "post"; context: string; next: string;
}) {
  const router = useRouter();
  const historyId = useId();
  const closeFromHistory = useEffectEvent(() => onClose());
  useEffect(() => {
    if (!open) return;
    const previousState = window.history.state;
    window.history.pushState({ ...previousState, meetanyAuthModal: historyId }, "");
    const close = () => closeFromHistory();
    window.addEventListener("popstate", close);
    return () => {
      window.removeEventListener("popstate", close);
      if (window.history.state?.meetanyAuthModal === historyId) window.history.replaceState(previousState, "");
    };
  }, [open, historyId]);
  const title = intent === "save" ? "შედით, რომ შეინახოთ კომპანია" : intent === "post" ? "შედით, რომ განათავსოთ მოთხოვნა" : "შედით, რომ გაგზავნოთ შეთავაზება";
  const query = encodeURIComponent(next);
  return <Modal className={styles.auth} open={open} onClose={onClose} title={title} lead={`${context} — შესვლის შემდეგ მოქმედება გაგრძელდება`} width={460}>
    {open && <LoginForm onReset={() => router.push(`/account/?tab=reset&next=${query}`)} onSuccess={() => { onClose(); onSuccess(); }} />}
    <div className={styles.registration}>ჯერ არ გაქვთ ანგარიში? <Link href={`/account/?tab=register&role=company&next=${query}`}>კომპანიის რეგისტრაცია</Link><br /><Link href={`/account/?tab=register&role=client&next=${query}`}>კლიენტის რეგისტრაცია</Link></div>
    <p className={styles.note}><Icon name="shield-check" />ერთი ანგარიში — ყიდვაც და გაყიდვაც</p>
  </Modal>;
}
