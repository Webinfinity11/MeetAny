// Meaningful icons (categories, search tabs, empty states): Solar "linear" set, served as a local
// sprite (public/icons-solar.svg, generated from Iconify — symbol ids are our category ids and the
// /icons.svg names used elsewhere). Owner chose style D on 2026-09-30: line icon in a soft blue circle.
// Small meta icons (city, deadline) stay on the thin /icons.svg sprite.
// Categories use ready-made Lucide outline SVGs. Their original geometry, source revision
// and licence are recorded alongside the local sprite; stroke width is presentation styling.

/** `tile`: the icon sits in a soft brand-blue circle (see `.icon-tile` in base.css). Decorative: aria-hidden. */
export function DuoIcon({ name, size = 24, className, tile = false, family = "solar" }: { name: string; size?: number; className?: string; tile?: boolean; family?: "solar" | "category" }) {
  const glyph = (
    <svg className={!tile && className ? `duo-icon ${className}` : "duo-icon"} width={size} height={size} viewBox={family === "category" ? "0 0 24 24" : undefined} fill={family === "category" ? "none" : undefined} aria-hidden="true" focusable="false">
      <use href={family === "category" ? `/icons-categories.svg?v=lucide-20261002#${name}` : `/icons-solar.svg#${name}`} />
    </svg>
  );
  return tile ? <span className={className ? `icon-tile ${className}` : "icon-tile"} aria-hidden="true">{glyph}</span> : glyph;
}
