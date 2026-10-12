import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "../Icon";

export type NoticeTone = "error" | "info" | "warning";
export type NoticeProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  tone?: NoticeTone;
  /** Optional trailing action, e.g. <Button variant="secondary" size="sm">ხელახლა ცდა</Button>. */
  action?: ReactNode;
  children: ReactNode;
};
const ICONS: Record<NoticeTone, string> = { error: "circle-alert", warning: "triangle-alert", info: "info" };
/** One inline message for load failures and page-level notes; errors are announced. */
export function Notice({ tone = "info", action, children, className = "", ...props }: NoticeProps) {
  return <div role={tone === "error" ? "alert" : undefined} {...props} className={`ma-notice ma-notice--${tone} ${className}`.trim()}>
    <Icon name={ICONS[tone]} />
    <div className="ma-notice__body">{children}</div>
    {action ? <div className="ma-notice__action">{action}</div> : null}
  </div>;
}
