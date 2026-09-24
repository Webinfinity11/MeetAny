"use client";
import { Icon } from "../Icon";
import { useEffect, useId, useRef, type ReactNode } from "react";
export type SheetProps = { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; className?: string };
/** Modal dialog with an explicit Tab trap, native Escape/focus restoration, and a scrollable body. */
export function Sheet({ open, onClose, title, children, footer, className = "" }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className={`ma-sheet ${className}`.trim()} aria-labelledby={titleId} tabIndex={-1} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const dialog = event.currentTarget;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]'))
      .filter(element => element.tabIndex >= 0 && !element.matches(':disabled,[hidden],[inert]') && !element.closest('[inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); dialog.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
  }} onCancel={event => { event.preventDefault(); onClose(); }} onClose={() => { if (open) onClose(); }}><header className="ma-sheet__header"><h2 className="ma-sheet__title" id={titleId}>{title}</h2><button type="button" className="ma-sheet__close" aria-label="დახურვა" onClick={onClose}><Icon name="x" /></button></header><div className="ma-sheet__body">{children}</div>{footer && <footer className="ma-sheet__footer">{footer}</footer>}</dialog>;
}
