"use client";

import { useEffect, useRef } from "react";
import { Icon } from "../Icon";

export function MobileFilterSheet({
  id,
  title,
  open,
  onOpenChange,
  triggerRef,
  children,
  footer,
}: {
  id: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClose = () => {
      onOpenChange(false);
      triggerRef?.current?.focus();
    };
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, [onOpenChange, triggerRef]);

  return (
    <dialog className="ma-sheet ma-sheet--full" id={id} ref={ref} aria-labelledby={`${id}-title`}>
      <header className="ma-sheet__header">
        <h2 className="ma-sheet__title" id={`${id}-title`}>
          {title}
        </h2>
        <button className="ma-sheet__close" aria-label="ფილტრების დახურვა" onClick={() => ref.current?.close()}>
          <Icon name="x" />
        </button>
      </header>
      <div className="ma-sheet__body">{children}</div>
      {footer ? <footer className="ma-sheet__footer">{footer}</footer> : null}
    </dialog>
  );
}
