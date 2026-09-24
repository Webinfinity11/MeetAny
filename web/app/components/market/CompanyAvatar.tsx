export function initials(name: string): string {
  const clean = String(name || "?").replace(/[„""]/g, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : clean.slice(0, 2)).toUpperCase();
}

// One of six calm tones per name (FNV-1a over UTF-16 code units), stable across pages.
export function avatarTone(name: string): number {
  let hash = 0x811c9dc5;
  for (const ch of String(name || "").trim().toLowerCase()) {
    for (let i = 0; i < ch.length; i++) { hash ^= ch.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  }
  return ((hash >>> 0) % 6) + 1;
}

export function CompanyAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" | "xl" }) {
  const cls = size === "xl" ? "ma-avatar ma-avatar--xl" : size === "lg" ? "ma-avatar ma-avatar--lg" : "ma-avatar";
  return (
    <span className={cls} data-tone={avatarTone(name)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
