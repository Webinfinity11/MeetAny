"use client";

import { optimizable } from "../../lib/image";
import Image from "next/image";
import { useState, type HTMLAttributes } from "react";
import { Icon } from "../Icon";

export { avatarInitials } from "../../lib/avatar-initials";
/** Stable FNV-1a name hash selects one of the six avatar token pairs. */
export function avatarTone(name: string): number {
  let hash = 0x811c9dc5;
  for (const ch of String(name || "").trim().toLowerCase()) {
    for (let i = 0; i < ch.length; i++) { hash ^= ch.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  }
  return ((hash >>> 0) % 6) + 1;
}
export type AvatarProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  name: string;
  logoUrl?: string | null;
  /** Numeric sizes are the new API; named sizes retain CompanyAvatar's existing geometry. */
  size?: 40 | 48 | 56 | "sm" | "lg" | "xl";
  symbol?: "building-2" | "user-round";
};
/** Decorative logo next to a name; failed logos use a neutral profile symbol. */
export function Avatar({ name, logoUrl, size = 40, symbol = "building-2", className = "", ...props }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const modifier = typeof size === "number" ? ` ma-avatar--${size}` : size === "sm" ? "" : ` ma-avatar--${size}`;
  return <span aria-hidden="true" {...props} className={`ma-avatar${modifier} ${className}`.trim()} data-tone="neutral" title={name}>
    {logoUrl && loadedUrl === logoUrl && failedUrl !== logoUrl ? null : <Icon name={symbol} />}
    {logoUrl && logoUrl !== failedUrl ? <Image key={logoUrl} src={logoUrl} alt="" width={128} height={128} unoptimized={!optimizable(logoUrl)} style={{ position: "absolute", inset: 0, opacity: loadedUrl === logoUrl ? 1 : 0 }} onLoad={() => setLoadedUrl(logoUrl)} onError={() => setFailedUrl(logoUrl)} /> : null}
  </span>;
}
