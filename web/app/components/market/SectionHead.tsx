import Link from "next/link";

export function SectionHead({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="r2-section-head">
      <div>
        <span className="ma-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action ? (
        <Link className="ma-btn ma-btn--secondary" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
