"use client";

import { Icon } from "../Icon";

type ContactSource = "company-list" | "company-profile" | "company-partnership" | "request-owner" | "chosen-offer";

// Future analytics can subscribe to this event; no phone number or storage is involved.
export function CallButton({ phone, variant = "primary", contactId, requestId, source }: {
  phone: string;
  variant?: "primary" | "secondary";
  contactId?: string;
  requestId?: string;
  source: ContactSource;
}) {
  const report = (action: "call") => window.dispatchEvent(new CustomEvent("meetany:contact-action", {
    detail: { action, source, contactId, requestId },
  }));
  const className = `ma-btn ma-btn--${variant} ma-call`;

  return <a className={className} data-contact-action="call" href={`tel:${phone.replace(/[^+\d]/g, "")}`} onClick={() => report("call")}>
    <Icon name="phone" /><span>დარეკვა</span><span className="ma-call__number">{phone}</span>
  </a>;
}
