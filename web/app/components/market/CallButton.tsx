import { Icon } from "../Icon";

// Every profile's phone is public (owner decision 2026-09-22, db/CONTRACT.md). tel: link,
// styled as a regular ma-btn so it keeps the same ≥44px tap target as every other button.
export function CallButton({ phone, variant = "primary" }: { phone: string; variant?: "primary" | "secondary" }) {
  return (
    <a className={`ma-btn ma-btn--${variant} ma-call`} href={`tel:${phone.replace(/[^+\d]/g, "")}`}>
      <Icon name="phone" />
      <span>დარეკვა</span><span className="ma-call__number">{phone}</span>
    </a>
  );
}
