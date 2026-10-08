"use client";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Modal, type ModalTone } from "./Modal";

/** Confirmation dialog for consequential actions (choose, close, delete, withdraw). */
export function ConfirmSheet({ id, open, title, children, confirmLabel, pendingLabel, danger = false, pending, error, onConfirm, onCancel, tone, icon, lead }: {
  id: string; open: boolean; title: string; children: ReactNode; confirmLabel: string;
  pendingLabel: string; danger?: boolean; pending: boolean; error?: string | null;
  onConfirm: () => void; onCancel: () => void; tone?: ModalTone; icon?: string; lead?: ReactNode;
}) {
  return <Modal id={id} open={open} onClose={onCancel} title={title} lead={lead}
    tone={tone || (danger ? "danger" : "neutral")} icon={icon || (danger ? "triangle-alert" : "circle-check")}
    actions={<><Button variant="secondary" type="button" onClick={onCancel}>გაუქმება</Button><Button variant={danger ? "danger" : "primary"} type="button" disabled={pending} onClick={onConfirm}>{pending ? pendingLabel : confirmLabel}</Button></>}>
    {children}{error ? <p className="ma-field__error" role="alert">{error}</p> : null}
  </Modal>;
}
