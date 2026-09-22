import Link from "next/link";

export function PartnershipCTA({
  eyebrow,
  title,
  action,
  imageSrc,
}: {
  eyebrow: string;
  title: string;
  action: { label: string; href: string };
  imageSrc: string;
}) {
  return (
    <section className="r2-cta">
      <div>
        <span className="ma-eyebrow ma-eyebrow--brand">{eyebrow}</span>
        <h2 className="ma-h2">{title}</h2>
        <Link className="ma-btn ma-btn--primary" href={action.href}>
          {action.label}
        </Link>
      </div>
      <img src={imageSrc} alt="" width={640} height={420} />
    </section>
  );
}
