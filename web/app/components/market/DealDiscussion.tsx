"use client";
import { Fragment, useMemo, useState } from "react";
import type { Store } from "../../lib/market-client";
import type { Deal } from "../../lib/deal-client";
import { useChatThread } from "../../lib/chat-client";
import { Button } from "../ui/Button";
import { Icon } from "../Icon";
import { ListSkeleton } from "./Skeletons";
import styles from "./deals.module.css";

export function DealDiscussion({ store, deal, actor }: { store: Store; deal: Deal; actor: string }) {
  const target = useMemo(() => ({ companyId: deal.supplier_id, requestId: deal.request_id }), [deal.supplier_id, deal.request_id]);
  const chat = useChatThread(store, target);
  const [body, setBody] = useState("");
  return <section className={`${styles.card} ${styles.discussion}`} aria-label="მიმოწერა"><div className={styles.chatLog} role="log" aria-label="გარიგების მიმოწერა" aria-live="polite">
    {!chat.loaded ? chat.failed ? <p role="status">მიმოწერა ვერ ჩაიტვირთა.</p> : <ListSkeleton compact kind="records" label="მიმოწერა იტვირთება…" /> : !chat.messages.length ? <p className={styles.note}>დააზუსტეთ ფასი, მიწოდება და გადახდის პირობები.</p> : chat.messages.map((m, i) => {
      const name = store.getCompany(m.senderId)?.company || store.getCompany(m.senderId)?.name || (m.senderId === actor ? "შენ" : "პარტნიორი");
      const day = (at: string) => new Date(at).toLocaleDateString("ka-GE", { timeZone: "Asia/Tbilisi", day: "numeric", month: "long" });
      return <Fragment key={m.id}>{i === 0 || day(chat.messages[i - 1].createdAt) !== day(m.createdAt) ? <p className={styles.chatDate}>{day(m.createdAt)}</p> : null}<div className={styles.messageRow} data-mine={m.senderId === actor}>{m.senderId !== actor ? <span className={styles.chatAvatar}>{name.slice(0, 2)}</span> : null}<div className={styles.bubble} data-mine={m.senderId === actor}><small>{name} · {new Date(m.createdAt).toLocaleTimeString("ka-GE", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit" })}</small>{m.body}</div></div></Fragment>;
    })}
  </div>{chat.failed ? <Button variant="secondary" onClick={chat.retry}>მიმოწერის ხელახლა ჩატვირთვა</Button> : null}
    <form className={styles.compose} onSubmit={async e => { e.preventDefault(); if (await chat.send(body)) setBody(""); }}><label className="ma-sr-only" htmlFor="deal-message">შეტყობინება</label><input id="deal-message" className="ma-input" value={body} onChange={e => setBody(e.target.value)} maxLength={2000} placeholder="შეტყობინება…" readOnly={chat.pending}/><Button type="submit" loading={chat.pending} disabled={!chat.loaded || !body.trim()} aria-label="გაგზავნა"><Icon name="send"/></Button></form>{chat.sendError ? <p role="alert">{chat.sendError}</p> : null}
  </section>;
}
