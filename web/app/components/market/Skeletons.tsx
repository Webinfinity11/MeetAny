import type { ReactNode } from "react";
import { ProgressBar } from "../ProgressBar";

type SkeletonProps = { compact?: boolean; label?: string };

function Line({ kind = "line" }: { kind?: string }) {
  return <span className={`ma-skel ma-skel--${kind}`} />;
}

function Heading({ avatar = false }: { avatar?: boolean }) {
  return <div className="ma-loading__heading">
    {avatar ? <Line kind="avatar" /> : null}
    <div className="ma-loading__copy"><Line kind="w40" /><Line kind="h1" /><Line kind="w60" /></div>
  </div>;
}

function Copy() {
  return <div className="ma-loading__copy"><Line kind="title" /><Line /><Line kind="w90" /><Line kind="w60" /></div>;
}

function Rows({ count = 3 }: { count?: number }) {
  return <div className="ma-loading__rows">{Array.from({ length: count }, (_, i) =>
    <div className="ma-loading__row" key={i}>
      <Line kind="tile" /><div className="ma-loading__copy"><Line kind="title" /><Line kind="w60" /><Line kind="w40" /></div>
    </div>,
  )}</div>;
}

function Frame({ compact, label, children }: SkeletonProps & { label: string; children: ReactNode }) {
  return <section className={`ma-loading${compact ? " ma-loading--compact" : " ma-page"}`} role="status" aria-busy="true" aria-label={label}>
    <span className="ma-sr-only">{label}</span>
    {!compact ? <ProgressBar /> : null}
    <div className="ma-loading__shapes" aria-hidden="true">{children}</div>
  </section>;
}

export function ListSkeleton({ compact, label = "სია იტვირთება…", kind = "requests" }: SkeletonProps & { kind?: "requests" | "companies" | "records" }) {
  return <Frame compact={compact} label={label}>
    {!compact ? <><Heading /><div className="ma-loading__search"><Line kind="btn" /><Line kind="w40" /></div></> : null}
    {kind === "companies" ? <div className="ma-loading__companies">{[0, 1, 2].map(i => <div className="ma-loading__panel" key={i}><Line kind="media" /><Copy /></div>)}</div> : <Rows count={kind === "records" ? 4 : 3} />}
  </Frame>;
}

export function DetailSkeleton({ compact, label = "მოთხოვნა იტვირთება…" }: SkeletonProps) {
  return <Frame compact={compact} label={label}>
    <Heading />
    <div className="ma-loading__split"><div className="ma-loading__panel"><Copy /><div className="ma-loading__facts"><Line kind="btn" /><Line kind="btn" /><Line kind="btn" /></div><Copy /></div>
      <div className="ma-loading__panel"><Line kind="avatar" /><Copy /><Line kind="btn" /></div>
    </div>
  </Frame>;
}

export function AccountSkeleton({ compact, label = "ანგარიში იტვირთება…", admin = false }: SkeletonProps & { admin?: boolean }) {
  return <Frame compact={compact} label={label}>
    {admin ? <><Heading /><Rows count={4}/></> : <div className="account-loading-shell"><aside><Line kind="btn"/>{[0, 1, 2, 3, 4].map(i => <Line key={i} kind="title"/>)}</aside><div><Heading/><div className="ma-loading__tabs"><Line kind="btn"/><Line kind="btn"/></div><Rows count={3}/></div></div>}
  </Frame>;
}

export function ProfileSkeleton({ compact, label = "კომპანიის პროფილი იტვირთება…" }: SkeletonProps) {
  return <Frame compact={compact} label={label}>
    <Heading avatar />
    <div className="ma-loading__split"><div className="ma-loading__panel"><Copy /><Rows count={2} /></div>
      <div className="ma-loading__panel"><Copy /><Line kind="btn" /><Line kind="btn" /></div>
    </div>
  </Frame>;
}
