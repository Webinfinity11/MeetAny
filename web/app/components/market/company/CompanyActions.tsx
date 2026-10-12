"use client";
import { useState } from "react";
import { useMarketStore } from "../../../lib/market-client";
import { openChat } from "../ChatPopup";
import { AuthModal } from "../modals/AuthModal";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";

type AuthIntent = Parameters<typeof AuthModal>[0]["intent"];
// "message" is the shared AuthModal's intent for writing to a company (owned by the shared UI stream);
// the cast keeps this file compiling until that intent lands in AuthModal's union.
const MESSAGE_INTENT = "message" as AuthIntent;

/** „მიწერა“: signed-in users open the chat; guests get the shared sign-in modal (registration without a preset role). */
export function CompanyActions({ companyId, name }: { companyId: string; name: string }) {
  const { store, ready, sessionReady } = useMarketStore();
  const [open, setOpen] = useState(false);
  const me = store?.currentUser();
  if (me?.role === "admin" || me?.id === companyId) return null;
  return <><Button variant="secondary" disabled={!ready || !sessionReady || !!me?.blocked} onClick={() => me ? openChat({ companyId }) : setOpen(true)}><Icon name="message-square"/>მიწერა</Button>
    <AuthModal open={open} onClose={() => setOpen(false)} onSuccess={() => { if (store?.currentUser() && !store.currentUser()?.blocked) openChat({ companyId }); }}
      intent={MESSAGE_INTENT} context={name} next={`/companies/view/?id=${encodeURIComponent(companyId)}`} />
  </>;
}
