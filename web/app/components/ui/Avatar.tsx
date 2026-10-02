"use client";

import { useState, type HTMLAttributes } from "react";
import { Icon } from "../Icon";

const LEGAL_FORMS = new Set(["შპს", "სს", "იმ", "ი/მ", "llc", "ltd", "inc"]);
/** Letters only; skips legal forms and preserves Georgian mkhedruli. */
export function avatarInitials(name: string): string {
  const words = String(name || "").split(/\s+/)
    .filter(w => !LEGAL_FORMS.has(w.toLowerCase().replace(/[.„“”"'«»]/g, "")))
    .map(w => w.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  if (!words.length) return "?";
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return letters.replace(/[a-z]/g, ch => ch.toUpperCase());
}
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
    {logoUrl && logoUrl !== failedUrl ? <img key={logoUrl} src={logoUrl} alt="" style={{ position: "absolute", inset: 0, opacity: loadedUrl === logoUrl ? 1 : 0 }} onLoad={() => setLoadedUrl(logoUrl)} onError={() => setFailedUrl(logoUrl)} /> : null}
  </span>;
}
