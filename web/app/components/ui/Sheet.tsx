"use client";
import type { ReactNode } from "react";
import { Modal } from "./Modal";
export type SheetProps = { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; className?: string };
/** Compatibility wrapper for the shared responsive modal. */
export function Sheet({ footer, ...props }: SheetProps) {
  return <Modal {...props} actions={footer} />;
}
