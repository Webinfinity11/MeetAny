import type { HTMLAttributes } from "react";
export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: "vip" | "top" | "new" | "status"; status?: "success" | "warning" | "danger" | "info" | "neutral" | "dark" | "muted" };
/** Compact badge using the existing ma-badge variants; status selects its semantic state. */
export function Badge({ tone = "status", status = "neutral", className = "", ...props }: BadgeProps) {
  const variant = tone === "vip" ? "dark" : tone === "top" ? "info" : tone === "new" ? "success" : status;
  return <span {...props} className={`ma-badge ma-badge--${variant} ${className}`.trim()} />;
}
