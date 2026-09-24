"use client";

import { Avatar } from "../ui/Avatar";
export { avatarInitials, avatarTone } from "../ui/Avatar";

// The approved home page keeps its own initials; catalogs and profiles use avatarInitials below.
export function initials(name: string): string {
  const clean = String(name || "?").replace(/[„""]/g, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : clean.slice(0, 2)).toUpperCase();
}

/** Compatibility wrapper: retains the existing classes and geometry until T13.3. */
export function CompanyAvatar({ name, logoUrl, size = "sm" }: { name: string; logoUrl?: string | null; size?: "sm" | "lg" | "xl" }) {
  return <Avatar name={name} logoUrl={logoUrl} size={size} />;
}
