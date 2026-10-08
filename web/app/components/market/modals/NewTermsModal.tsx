"use client";
import { useEffect, useState } from "react";
import { Modal } from "../../ui/Modal";
import { toast } from "../../Toasts";
import { DealTermsForm } from "../DealTermsForm";
import type { Deal, DealTermsInput } from "../../../lib/deal-client";
import type { Store } from "../../../lib/market-client";
import { chatChanged, type Conversation } from "../../../lib/chat-client";
export function NewTermsModal({ deal, store, pending, onClose, onSubmit }: { deal: Deal; store: Store; pending: boolean; onClose: () => void; onSubmit: (args: DealTermsInput) => Promise<boolean> }) {
  const [conversation, setConversation] = useState<string>();
  const [sending, setSending] = useState(false);
  useEffect(() => { let active = true; void store.listConversations().then((items: Conversation[]) => { if (active) setConversation(items.find(c => c.requestId === deal.request_id && c.companyId === deal.supplier_id)?.id); }).catch(() => {}); return () => { active = false; }; }, [store, deal.request_id, deal.supplier_id]);
  const busy = pending || sending;
  return <Modal open onClose={() => { if (!busy) onClose(); }} width={560} title="ახალი პირობები" lead="შეცვალეთ მხოლოდ საჭირო ველები. მეორე მხარე მიიღებს ან უარყოფს.">
    <DealTermsForm deal={deal} pending={busy} commentAvailable={!!conversation} onCancel={onClose} onSubmit={async (args, comment) => {
      setSending(true);
      try {
        if (!await onSubmit(args)) return false;
        if (comment && conversation) {
          try { await store.sendMessage(conversation, comment); chatChanged(); }
          catch { toast({ title: "პირობები განახლდა, კომენტარი ვერ გაიგზავნა", sub: "კომენტარი ხელახლა გაგზავნეთ მიმოწერიდან.", tone: "warning" }); onClose(); return true; }
        }
        toast({ title: "ახალი პირობები გაიგზავნა", tone: "success" }); onClose(); return true;
      } finally { setSending(false); }
    }}/>
  </Modal>;
}
