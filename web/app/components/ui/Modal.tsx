"use client";
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { Icon } from "../Icon";
import { trapDialogFocus } from "./dialog-focus";
import styles from "./Modal.module.css";

export type ModalTone = "neutral" | "success" | "warning" | "danger" | "info";
export type ModalProps = {
  open: boolean; onClose: () => void; title: ReactNode; lead?: ReactNode; icon?: string;
  tone?: ModalTone; width?: number; actions?: ReactNode; children?: ReactNode;
  closeLabel?: string; className?: string; id?: string;
};
export function Modal({ open, onClose, title, lead, icon, tone = "neutral", width, actions, children, closeLabel = "დახურვა", className = "", id }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const backdropPress = useRef(false);
  const generatedId = useId();
  const titleId = `${id || generatedId}-title`;
  const leadId = `${id || generatedId}-lead`;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      if (opener.current?.isConnected) opener.current.focus();
    }
  }, [open]);
  useEffect(() => () => { if (opener.current?.isConnected) opener.current.focus(); }, []);
  return <dialog id={id} ref={ref} className={`${styles.modal} ${className}`.trim()} data-tone={tone}
    style={width ? { "--modal-width": `${width}px` } as CSSProperties : undefined}
    aria-labelledby={titleId} aria-describedby={lead ? leadId : undefined} tabIndex={-1}
    onKeyDown={trapDialogFocus} onCancel={event => { event.preventDefault(); onClose(); }}
    onPointerDown={event => { const r = event.currentTarget.getBoundingClientRect(); backdropPress.current = event.target === event.currentTarget && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom); }}
    onClick={event => { const r = event.currentTarget.getBoundingClientRect(); if (backdropPress.current && event.target === event.currentTarget && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) onClose(); backdropPress.current = false; }}>
    <header className={styles.header}>
      <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}><Icon name="x" /></button>
      {icon ? <span className={styles.icon}><Icon name={icon} /></span> : null}
      <h2 id={titleId} className={styles.title}>{title}</h2>
      {lead ? <p id={leadId} className={styles.lead}>{lead}</p> : null}
    </header>
    {children ? <div className={styles.body}>{children}</div> : null}
    {actions ? <footer className={styles.actions}>{actions}</footer> : null}
  </dialog>;
}
