import Link from "next/link";

export function MobileActionBar({ label, href }: { label: string; href: string }) {
  return (
    <div className="r2-sticky">
      <Link className="ma-btn ma-btn--primary" href={href}>
        {label}
      </Link>
    </div>
  );
}
