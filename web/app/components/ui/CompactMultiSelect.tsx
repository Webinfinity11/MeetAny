"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import styles from "./compact-multiselect.module.css";

type Option = { value: string; label: string };
type Props = {
  id?: string;
  label: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  exclusiveValue?: string;
  disabled?: boolean;
  placeholder?: string;
};

/** A compact disclosure of native checkboxes; selections remain ordinary string arrays. */
export function CompactMultiSelect({ id, label, options, value, onChange, exclusiveValue, disabled = false, placeholder = "აირჩიე ქალაქები" }: Props) {
  const generated = useId(), controlId = id || generated, panelId = `${controlId}-options`;
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.filter(option => value.includes(option.value));
  const exclusive = selected.find(option => option.value === exclusiveValue);
  const summary = exclusive?.label || (selected.length <= 2 ? selected.map(option => option.label).join(", ") : `${selected[0].label} და კიდევ ${selected.length - 1}`) || placeholder;

  useLayoutEffect(() => {
    if (!open || !panel.current || !trigger.current) return;
    const menu = panel.current, button = trigger.current;
    function position() {
      const rect = button.getBoundingClientRect(), viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
      const below = top + height - rect.bottom - 12, above = rect.top - top - 12;
      const upwards = below < Math.min(menu.scrollHeight, 240) && above > below;
      menu.style.maxHeight = `${Math.max(48, Math.min(240, upwards ? above : below))}px`;
      menu.style.width = `${Math.min(rect.width, width - 24)}px`;
      menu.style.left = `${Math.max(left + 12, Math.min(rect.left, left + width - menu.offsetWidth - 12))}px`;
      menu.style.top = `${upwards ? rect.top - menu.offsetHeight - 6 : rect.bottom + 6}px`;
    }
    menu.showPopover();
    position();
    const first = menu.querySelector<HTMLInputElement>("input:checked") || menu.querySelector<HTMLInputElement>("input");
    first?.focus({ preventScroll: true });
    first?.scrollIntoView({ block: "nearest" });
    function dismiss(event: PointerEvent | FocusEvent) {
      if (!menu.contains(event.target as Node) && !button.contains(event.target as Node)) setOpen(false);
    }
    const observer = new ResizeObserver(position);
    observer.observe(button);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    return () => {
      if (menu.matches(":popover-open")) menu.hidePopover();
      observer.disconnect();
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
    };
  }, [open]);

  function close() { setOpen(false); trigger.current?.focus(); }
  function toggle(option: Option, checked: boolean) {
    onChange(checked ? option.value === exclusiveValue ? [option.value] : [...value.filter(item => item !== exclusiveValue && item !== option.value), option.value] : value.filter(item => item !== option.value));
  }

  return <div className="ma-field">
    <label className="ma-field__label" htmlFor={controlId}>{label}</label>
    <button ref={trigger} id={controlId} type="button" className={`ma-select ma-custom-select ${styles.trigger}`}
      disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(!open)} onKeyDown={event => {
        if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setOpen(true); }
        if (event.key === "Escape" && open) { event.preventDefault(); close(); }
      }}>
      <span className="ma-custom-select__value" data-empty={!selected.length || undefined}>{summary}</span>
    </button>
    <div ref={panel} id={panelId} popover="manual" role="dialog" aria-label={label} className={`ma-select-menu ${styles.panel}`}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const inputs = [...event.currentTarget.querySelectorAll<HTMLInputElement>("input:not(:disabled)")];
        const index = inputs.indexOf(document.activeElement as HTMLInputElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? inputs.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + inputs.length) % inputs.length;
        inputs[next]?.focus({ preventScroll: true });
        inputs[next]?.scrollIntoView({ block: "nearest" });
      }}>
      {options.map(option => <label key={option.value} className={styles.option} data-exclusive={option.value === exclusiveValue || undefined}>
        <input type="checkbox" checked={value.includes(option.value)} disabled={disabled} onChange={event => toggle(option, event.target.checked)} />
        <span>{option.label}</span>
      </label>)}
    </div>
  </div>;
}
