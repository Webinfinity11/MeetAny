function initials(name: string): string {
  const clean = String(name || "?").replace(/[„""]/g, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : clean.slice(0, 2)).toUpperCase();
}

export function CompanyAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" | "xl" }) {
  const cls = size === "xl" ? "ma-avatar ma-avatar--xl" : size === "lg" ? "ma-avatar ma-avatar--lg" : "ma-avatar";
  return (
    <span className={cls} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
