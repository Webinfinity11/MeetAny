"use client";
import styles from "./catalog/Catalog.module.css";
import { Modal } from "../ui/Modal";
export function MobileFilterSheet({ id, title, open, onOpenChange, children, footer, opportunity = false }: {
  opportunity?: boolean; id: string; title: string; open: boolean; onOpenChange: (open: boolean) => void;
  triggerRef?: React.RefObject<HTMLElement | null>; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return <Modal className={`${styles.filterModal} ${opportunity ? styles.opportunitySheet : ""}`} id={id} title={title} open={open} onClose={() => onOpenChange(false)} actions={footer ? <div className={styles.sheetActions}>{footer}</div> : undefined}>{children}</Modal>;
}
