"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMarketStore } from "../../../lib/market-client";
import { openChat } from "../ChatPopup";
import { LoginForm } from "../AuthForms";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Icon } from "../../Icon";

/** Same in-context login flow as saving, with a message-specific reason. */
export function CompanyActions({ companyId, name }: { companyId: string; name: string }) {
  const { store, ready, sessionReady } = useMarketStore();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const me = store?.currentUser();
  if (me?.role === "admin" || me?.id === companyId) return null;
  const next = `/companies/view/?id=${encodeURIComponent(companyId)}`;
  const query = encodeURIComponent(next);
  return <><Button variant="primary" disabled={!ready || !sessionReady || !!me?.blocked} onClick={() => me ? openChat({ companyId }) : setOpen(true)}><Icon name="message-square"/>შეტყობინება</Button>
    <Modal open={open} onClose={() => setOpen(false)} title="შედი, რომ მისწერო კომპანიას" lead={`${name} — შესვლის შემდეგ მიმოწერა გაიხსნება`} width={460}>
      {open ? <LoginForm onReset={() => router.push(`/account/?tab=reset&next=${query}`)} onSuccess={() => { setOpen(false); if (store?.currentUser() && !store.currentUser()?.blocked) openChat({ companyId }); }}/> : null}
      <p>ჯერ არ გაქვს ანგარიში? <Link href={`/account/?tab=register&role=company&next=${query}`}>კომპანიის რეგისტრაცია</Link></p>
      <p>ერთი ანგარიში — ყიდვაც და გაყიდვაც</p>
    </Modal>
  </>;
}
