"use client";
import { useMemo, useState } from "react";
import type { Store } from "../../lib/market-client";
import type { Deal } from "../../lib/deal-client";
import { useChatThread } from "../../lib/chat-client";
import { chatDate } from "./ChatPopup";
import { Button } from "../ui/Button";
import { Icon } from "../Icon";
import styles from "./deals.module.css";

export function DealDiscussion({ store, deal, actor }: { store: Store; deal: Deal; actor: string }) {
  const target = useMemo(() => ({ companyId: deal.supplier_id, requestId: deal.request_id }), [deal.supplier_id, deal.request_id]);
  const chat = useChatThread(store, target);
  const [body, setBody] = useState("");
  return <section className={styles.card}><h2>მიმოწერა</h2><div className={styles.chatLog} role="log" aria-label="გარიგების მიმოწერა" aria-live="polite">
    {!chat.loaded ? <p role="status">{chat.failed ? "მიმოწერა ვერ ჩაიტვირთა." : "მიმოწერა იტვირთება…"}</p> : !chat.messages.length ? <p className={styles.note}>დააზუსტეთ ფასი, მიწოდება და გადახდის პირობები.</p> : chat.messages.map(m => <div key={m.id} className={styles.bubble} data-mine={m.senderId === actor}><small>{m.senderId === actor ? "შენ" : "პარტნიორი"} · {chatDate(m.createdAt)}</small>{m.body}</div>)}
  </div>{chat.failed ? <Button variant="secondary" onClick={chat.retry}>მიმოწერის ხელახლა ჩატვირთვა</Button> : null}
    <form className={styles.compose} onSubmit={async e => { e.preventDefault(); if (await chat.send(body)) setBody(""); }}><label className="ma-sr-only" htmlFor="deal-message">შეტყობინება</label><textarea id="deal-message" className="ma-textarea" value={body} onChange={e => setBody(e.target.value)} rows={2} maxLength={2000} placeholder="შეტყობინება…" readOnly={chat.pending}/><Button type="submit" loading={chat.pending} disabled={!chat.loaded || !body.trim()} aria-label="გაგზავნა"><Icon name="send"/></Button></form>{chat.sendError ? <p role="alert">{chat.sendError}</p> : null}
  </section>;
}
