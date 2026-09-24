import Link from "next/link";
import type { ReactNode } from "react";
export type ListRowProps = { media?: ReactNode; body: ReactNode; meta?: ReactNode; aside?: ReactNode; className?: string } & ({ href: string; linkLabel: string } | { href?: never; linkLabel?: never });
/** Registry row with slots and an optional named stretched link; aside actions remain clickable. */
export function ListRow({ media, body, meta, aside, href, linkLabel, className = "" }: ListRowProps) {
  return <div className={`ma-list-row ${className}`.trim()}>{media && <div className="ma-list-row__media">{media}</div>}<div className="ma-list-row__body">{body}{href && <Link href={href} className="ma-list-row__link" aria-label={linkLabel}><span className="ma-sr-only">{linkLabel}</span></Link>}{meta && <div className="ma-list-row__meta">{meta}</div>}</div>{aside && <div className="ma-list-row__aside">{aside}</div>}</div>;
}
export type SectionProps = { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string };
/** Section heading uses the shared mtavruli role; action remains in its own slot. */
export function Section({ title, action, children, className = "" }: SectionProps) {
  return <section className={`ma-section ${className}`.trim()}><div className="ma-section__head"><h2 className="ma-section__title">{title}</h2>{action}</div>{children}</section>;
}
export type EmptyStateProps = { text: string; action?: ReactNode; className?: string };
/** One explanatory sentence and one optional recovery action, without decorative icons. */
export function EmptyState({ text, action, className = "" }: EmptyStateProps) {
  return <div className={`ma-empty ${className}`.trim()}><p className="ma-empty__text">{text}</p>{action && <div className="ma-empty__actions">{action}</div>}</div>;
}
