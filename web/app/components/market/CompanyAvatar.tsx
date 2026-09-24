"use client";

import { useState } from "react";

// The approved home page keeps its own initials; catalogs and profiles use avatarInitials below.
export function initials(name: string): string {
  const clean = String(name || "?").replace(/[„""]/g, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : clean.slice(0, 2)).toUpperCase();
}

// Letters only: legal forms ("შპს"), digits and quotes are skipped, so "ვებსტუდია 7" reads "ვე", never "Ვ7".
// Georgian stays mkhedruli (toUpperCase would turn it into mtavruli); Latin is upper-cased.
const LEGAL_FORMS = new Set(["შპს", "სს", "იმ", "ი/მ", "llc", "ltd", "inc"]);
export function avatarInitials(name: string): string {
  const words = String(name || "").split(/\s+/)
    .filter(w => !LEGAL_FORMS.has(w.toLowerCase().replace(/[.„“”"'«»]/g, "")))
    .map(w => w.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  if (!words.length) return "?";
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return letters.replace(/[a-z]/g, ch => ch.toUpperCase());
}

// One of six calm tones per name (FNV-1a over UTF-16 code units), stable across pages.
export function avatarTone(name: string): number {
  let hash = 0x811c9dc5;
  for (const ch of String(name || "").trim().toLowerCase()) {
    for (let i = 0; i < ch.length; i++) { hash ^= ch.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  }
  return ((hash >>> 0) % 6) + 1;
}

export function CompanyAvatar({ name, logoUrl, size = "sm" }: { name: string; logoUrl?: string | null; size?: "sm" | "lg" | "xl" }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const cls = size === "xl" ? "ma-avatar ma-avatar--xl" : size === "lg" ? "ma-avatar ma-avatar--lg" : "ma-avatar";
  return (
    <span className={cls} data-tone={avatarTone(name)} aria-hidden="true">
      {logoUrl && logoUrl !== failedUrl ? <img key={logoUrl} src={logoUrl} alt="" onError={() => setFailedUrl(logoUrl)} /> : avatarInitials(name)}
    </span>
  );
}
