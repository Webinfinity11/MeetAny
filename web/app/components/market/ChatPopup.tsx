"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/Button";
import { Icon } from "../Icon";
import { toast } from "../Toasts";
import { useMarketStore, type Store } from "../../lib/market-client";
import { useUnreadMessageCount, type ChatTarget } from "../../lib/chat-client";

const ChatPopupContent = dynamic(() => import("./ChatPopupContent").then(m => m.ChatPopupContent), { ssr: false });

export type { Conversation } from "../../lib/chat-client";

export function openChat(target: ChatTarget) {
  window.dispatchEvent(new CustomEvent("meetany:chat-open", { detail: target }));
}

/** True once the stored session has been checked; before that a signed-in user must not be drawn as a guest. */
export function useSessionReady(store: { ready?: () => Promise<unknown> } | null | undefined) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    if (store?.ready) store.ready().then(() => { if (active) setDone(true); }, () => { if (active) setDone(true); });
    return () => { active = false; };
  }, [store]);
  return done;
}

export function MessageButton({ companyId, requestId, variant = "secondary" }: { companyId: string; requestId?: string; variant?: "secondary" | "ghost" }) {
  const { store, ready } = useMarketStore();
  const router = useRouter();
  const sessionReady = useSessionReady(store);
  const me = ready && sessionReady ? store?.currentUser() : null;
  if (me?.role === "admin" || (me?.id === companyId && !requestId)) return null;
  return <Button type="button" variant={variant} disabled={!ready || !sessionReady || !!me?.blocked} onClick={() => {
    if (!me) {
      const next = window.location.pathname + window.location.search + window.location.hash;
      toast("მისაწერად შედით ანგარიშში.");
      router.push(`/account/?next=${encodeURIComponent(next)}`);
      return;
    }
    openChat({ companyId, requestId });
  }}><Icon name={me || !sessionReady ? "message-square" : "user-round"}/>{me || !sessionReady ? "მიწერა" : "შედით და მიწერეთ"}</Button>;
}

export function ChatUnreadLink() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  const unread = useUnreadMessageCount(store, me?.id, !!me && !me.blocked);
  if (!me || me.blocked) return null;
  const count = unread ?? 0;
  return <button type="button" className="ma-chat-unread" onClick={() => window.dispatchEvent(new Event("meetany:chat-list"))} aria-label={`მიმოწერები${count ? `, ${count} წაუკითხავი` : ""}`}><Icon name="message-square"/>{count ? <span className="ma-chat-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}</button>;
}

export function ChatPopup() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  if (!store || !me || me.blocked || me.role === "admin") return null;
  return <DeferredChat key={me.id} store={store} owner={me.id} role={me.role} />;
}

// Header/message buttons stay small and keep the unread badge. Load the dialog,
// messages and file controls only after the first request to open the chat.
function DeferredChat({ store, owner, role }: { store: Store; owner: string; role: string }) {
  const [initial, setInitial] = useState<{ target?: ChatTarget } | null>(null);
  useEffect(() => {
    const open = (event: Event) => {
      const target = (event as CustomEvent<ChatTarget>).detail;
      if (target?.companyId) setInitial({ target });
    };
    const list = () => setInitial({});
    window.addEventListener("meetany:chat-open", open);
    window.addEventListener("meetany:chat-list", list);
    return () => { window.removeEventListener("meetany:chat-open", open); window.removeEventListener("meetany:chat-list", list); };
  }, []);
  return initial ? <ChatPopupContent store={store} owner={owner} role={role} initial={initial} /> : null;
}
