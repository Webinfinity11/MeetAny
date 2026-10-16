"use client";

import { useState } from "react";
import type { Store } from "../../../lib/market-client";
import type { RequestDraft } from "../../../lib/request-draft";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";

/** Explicitly replaces draft text; the original request, deal and files stay intact. */
export function RequestCopyPrompt({ store, id, ready, onCopy }: { store: Store; id: string; ready: boolean; onCopy: (draft: RequestDraft) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const request = await store.ensureRequest(id);
      if (!request || request.ownerId !== store.currentUser()?.id) throw new Error("მხოლოდ საკუთარი მოთხოვნის კოპირება შეგიძლიათ.");
      const preferences = await store.callRpc("request_preferences", { p_request_id: id });
      onCopy({ title: request.title, body: request.body || "", category: request.category, city: request.city,
        addressNote: request.addressNote || "", quantity: request.quantity == null ? "" : String(request.quantity),
        unit: request.unit || "pcs", neededByText: "", preferences });
      setOpen(false);
    } catch (err) { setError((err as { userMessage?: string }).userMessage || "მოთხოვნა ვერ დაკოპირდა. შეამოწმეთ წვდომა და სცადეთ ხელახლა."); }
    finally { setPending(false); }
  }
  return <section className="post-card"><div className="post-card__body">
    <p>ძველი მოთხოვნიდან შეგიძლიათ ახალი მონახაზის მომზადება.</p>
    <Button variant="secondary" disabled={!ready} onClick={() => setOpen(true)}>ძველი მოთხოვნის გადმოტანა</Button>
    <Modal open={open} onClose={() => { if (!pending) setOpen(false); }} title="მონახაზში გადმოტანა" actions={<Button loading={pending} onClick={() => void copy()}>გადმოტანა</Button>}>
      <p>მიმდინარე მონახაზს შეცვლის ძველი მოთხოვნის ტექსტი და პირობები. თარიღი თავიდან აირჩიეთ; საჭირო ფოტო და ფაილები ხელახლა დაამატეთ. ძველი მოთხოვნა და გარიგების ისტორია შენარჩუნდება.</p>
      {error ? <p role="alert">{error}</p> : null}
    </Modal>
  </div></section>;
}
