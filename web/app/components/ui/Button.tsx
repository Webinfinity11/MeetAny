"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";

type Common = {
  variant?: "base" | "primary" | "secondary" | "ghost" | "danger" | "danger-quiet" | "outline" | "accent" | "tint";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
};
export type ButtonProps = Common & (
  | (ButtonHTMLAttributes<HTMLButtonElement> & { href?: never; ref?: Ref<HTMLButtonElement> })
  | (AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; disabled?: boolean; ref?: Ref<HTMLAnchorElement> })
);

/** Shared ma-btn styling; href renders Next Link. Loading preserves label width and disables activation. */
export function Button({ variant = "primary", size = "md", icon, loading = false, children, className = "", ...props }: ButtonProps) {
  const cls = `ma-btn${variant === "base" ? "" : ` ma-btn--${variant}`}${size === "md" ? "" : ` ma-btn--${size}`} ${className}`.trim();
  if (props.href !== undefined) {
    const { disabled, onClick, ...link } = props;
    const inactive = disabled || loading;
    return <Link {...link} className={cls} aria-busy={loading || undefined} aria-disabled={inactive || undefined} tabIndex={inactive ? -1 : link.tabIndex} onClick={e => { if (inactive) e.preventDefault(); else onClick?.(e); }}>{icon}{children}</Link>;
  }
  return <button type="button" {...props} className={cls} disabled={props.disabled || loading} aria-busy={loading || undefined}>{icon}{children}</button>;
}
