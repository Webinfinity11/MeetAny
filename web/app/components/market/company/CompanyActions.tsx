"use client";
import { useState } from "react";
import { useMarketStore } from "../../../lib/market-client";
import { openChat } from "../ChatPopup";
import { AuthModal } from "../modals/AuthModal";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";

/** „მიწერა“: signed-in users open the chat; guests get the shared sign-in modal (registration without a preset role). */
export function CompanyActions({ companyId, name }: { companyId: string; name: string }) {
  const { store, ready, sessionReady } = useMarketStore();
  const [open, setOpen] = useState(false);
  const me = store?.currentUser();
  if (me?.role === "admin" || me?.id === companyId) return null;
  return <><Button variant="secondary" disabled={!ready || !sessionReady || !!me?.blocked} onClick={() => me ? openChat({ companyId }) : setOpen(true)}><Icon name="message-square"/>მიწერა</Button>
    <AuthModal open={open} onClose={() => setOpen(false)} onSuccess={() => { if (store?.currentUser() && !store.currentUser()?.blocked) openChat({ companyId }); }}
      intent="message" context={name} next={`/companies/view/?id=${encodeURIComponent(companyId)}`} />
  </>;
}
