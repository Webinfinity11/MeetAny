"use client";

import { useEffect, useRef, useState } from "react";
import { getMarketStore } from "../../lib/market-client";
import { Icon } from "../Icon";

type ContactSource = "company-list" | "company-profile" | "company-partnership" | "request-owner" | "chosen-offer";

// UI disclosure only: phone visibility in the public API is unchanged.
// Analytics count disclosure and tel-link activation, never completed calls.
export function CallButton({ phone, variant = "primary", contactId, requestId, source }: {
  phone: string;
  variant?: "primary" | "secondary";
  contactId?: string;
  requestId?: string;
  source: ContactSource;
}) {
  const identity = `${contactId || requestId || ""}:${phone}`;
  const [revealed, setRevealed] = useState<string | null>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const visible = revealed === identity;
  useEffect(() => { if (visible) link.current?.focus({ preventScroll: true }); }, [visible]);
  const report = (action: "reveal" | "call") => {
    window.dispatchEvent(new CustomEvent("meetany:contact-action", {
      detail: { action, source, contactId, requestId },
    }));
    const targetKind = source === "request-owner" || source === "chosen-offer" ? "request" : "company";
    const targetId = targetKind === "request" ? requestId : contactId;
    if (targetId) void getMarketStore().logContactEvent(targetKind, targetId, action, source);
  };
  const className = `ma-btn ma-btn--${variant} ma-call`;

  if (!visible) return <button type="button" className={className} data-contact-action="reveal" onClick={() => {
    setRevealed(identity);
    report("reveal");
  }}><Icon name="phone" /><span>დარეკვა</span></button>;

  // Revealed: just the number — the phone icon already says "call", and the old label did not fit card footers.
  return <a ref={link} className={className} data-contact-action="call" href={`tel:${phone.replace(/[^+\d]/g, "")}`} aria-label={`დარეკვა: ${phone}`} onClick={() => report("call")}>
    <Icon name="phone" /><span className="ma-call__number">{phone}</span>
  </a>;
}
