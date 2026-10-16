"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../../ui/Modal";
import { toast } from "../../Toasts";
import { DealTermsForm } from "../DealTermsForm";
import type { Deal, DealTermsInput } from "../../../lib/deal-client";
import type { Store } from "../../../lib/market-client";
import { chatChanged, type Conversation } from "../../../lib/chat-client";
export function NewTermsModal({ deal, defaults, store, pending, onClose, onSubmit }: { deal: Deal; defaults?: DealTermsInput; store: Store; pending: boolean; onClose: () => void; onSubmit: (args: DealTermsInput) => Promise<boolean> }) {
  const [conversation, setConversation] = useState<string>();
  const [sending, setSending] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  useEffect(() => { let active = true; void store.listConversations().then((items: Conversation[]) => { if (active) setConversation(items.find(c => c.requestId === deal.request_id && c.companyId === deal.supplier_id)?.id); }).catch(() => {}); return () => { active = false; }; }, [store, deal.request_id, deal.supplier_id]);
  const busy = pending || sending;
  return <Modal open onClose={() => { if (!busy) cancelRef.current?.(); }} width={560} title={deal.stage === "terms" ? "ცვლილების შეთავაზება" : "ახალი პირობები"} lead="ცვლილებას მეორე მხარის თანხმობა სჭირდება.">
    <DealTermsForm deal={deal} defaults={defaults} pending={busy} commentAvailable={!!conversation} onCancel={onClose} cancelRef={cancelRef} onSubmit={async (args, comment) => {
      setSending(true);
      try {
        if (!await onSubmit(args)) return false;
        if (comment && conversation) {
          try { await store.sendMessage(conversation, comment); chatChanged(); }
          catch { toast({ title: "პირობები გაიგზავნა, კომენტარი ვერ გაიგზავნა", sub: "კომენტარი ხელახლა გაგზავნეთ მიმოწერიდან.", tone: "warning" }); onClose(); return true; }
        }
        toast({ title: "პირობების ცვლილება გაიგზავნა", sub: "მეორე მხარე მიიღებს შეტყობინებას.", tone: "success" }); onClose(); return true;
      } finally { setSending(false); }
    }}/>
  </Modal>;
}
