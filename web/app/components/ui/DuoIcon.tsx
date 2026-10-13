import { CategoryIcon } from "./CategoryIcon";

// Meaningful icons (search tabs, empty states): Solar "linear" set, served as a local
// sprite (public/icons-solar.svg, generated from Iconify — symbol ids are the /icons.svg names used
// elsewhere). Owner chose style D on 2026-09-30: line icon in a soft blue circle.
// Small meta icons (city, deadline) stay on the thin /icons.svg sprite.
// Categories have their own duotone marks (ui/CategoryIcon); family="category" forwards there.

/** `tile`: the icon sits in a soft brand-blue circle (see `.icon-tile` in base.css). Decorative: aria-hidden. */
export function DuoIcon({ name, size = 24, className, tile = false, family = "solar" }: { name: string; size?: number; className?: string; tile?: boolean; family?: "solar" | "category" }) {
  if (family === "category") return <CategoryIcon id={name} size={size} tile={tile} className={className} />;
  const glyph = (
    <svg className={!tile && className ? `duo-icon ${className}` : "duo-icon"} width={size} height={size} aria-hidden="true" focusable="false">
      <use href={`/icons-solar.svg#${name}`} />
    </svg>
  );
  return tile ? <span className={className ? `icon-tile ${className}` : "icon-tile"} aria-hidden="true">{glyph}</span> : glyph;
}
