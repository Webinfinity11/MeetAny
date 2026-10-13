// Category marks: Phosphor Duotone (MIT), served as a local sprite (public/icons-categories.svg; sources
// and licence alongside). Symbol ids are the group ids, the leaf category ids and "all", so every place
// that shows a category (catalog rows, mobile filter chips, onboarding, search, photo-less covers) draws
// the same mark. The duotone back layer follows --category-icon-back(-opacity); see `.category-icon`.

/** `tile`: the glyph sits in a rounded brand-tinted square (`.category-icon` in base.css). Decorative. */
export function CategoryIcon({ id, size = 18, tile = false, className }: { id: string; size?: number; tile?: boolean; className?: string }) {
  const glyph = (
    <svg className="category-glyph" width={size} height={size} aria-hidden="true" focusable="false">
      <use href={`/icons-categories.svg?v=phosphor-20261013#${id || "all"}`} />
    </svg>
  );
  return tile ? <span className={className ? `category-icon ${className}` : "category-icon"} aria-hidden="true">{glyph}</span> : glyph;
}
