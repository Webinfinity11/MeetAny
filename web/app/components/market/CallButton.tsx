"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";

type ContactSource = "company-list" | "company-profile" | "company-partnership" | "request-owner" | "chosen-offer";

// UI disclosure only: phone visibility in the public API is unchanged.
// Future analytics can subscribe to this event; no phone number or storage is involved.
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
  const report = (action: "reveal" | "call") => window.dispatchEvent(new CustomEvent("meetany:contact-action", {
    detail: { action, source, contactId, requestId },
  }));
  const className = `ma-btn ma-btn--${variant} ma-call`;

  if (!visible) return <button type="button" className={className} data-contact-action="reveal" onClick={() => {
    setRevealed(identity);
    report("reveal");
  }}><Icon name="phone" /><span>ნომრის ნახვა</span></button>;

  return <a ref={link} className={className} data-contact-action="call" href={`tel:${phone.replace(/[^+\d]/g, "")}`} onClick={() => report("call")}>
    <Icon name="phone" /><span>დარეკვა</span><span className="ma-call__number">{phone}</span>
  </a>;
}
