export function PageBand({
  title,
  description,
  meta,
  avatar,
  actions,
  searchSlot,
}: {
  /** Ignored: the decorative eyebrow is no longer rendered (registry design system, 2026-09-24). */
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: React.ReactNode;
  avatar?: React.ReactNode;
  actions?: React.ReactNode;
  searchSlot?: React.ReactNode;
}) {
  return (
    <header className="ma-page-head r2-band">
      {avatar}
      <div className="ma-page-head__text">
        <h1 className="ma-h1">{title}</h1>
        {description ? <p className="ma-lead">{description}</p> : null}
        {meta ? <div className="ma-page-head__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="ma-page-head__actions">{actions}</div> : null}
      {searchSlot ? <div className="r2-search">{searchSlot}</div> : null}
    </header>
  );
}
