export function PageBand({
  eyebrow,
  title,
  description,
  avatar,
  actions,
  searchSlot,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  avatar?: React.ReactNode;
  actions?: React.ReactNode;
  searchSlot?: React.ReactNode;
}) {
  return (
    <div className="ma-page-head r2-band">
      {avatar}
      <div className="ma-page-head__text">
        <span className="ma-eyebrow">{eyebrow}</span>
        <h1 className="ma-h1">{title}</h1>
        {description ? <p className="ma-lead">{description}</p> : null}
      </div>
      <div className="ma-page-head__actions">{actions}</div>
      {searchSlot ? <div className="r2-search">{searchSlot}</div> : null}
    </div>
  );
}
