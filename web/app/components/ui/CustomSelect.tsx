"use client";

import { Children, isValidElement, useId, useLayoutEffect, useRef, useState, type ReactNode, type Ref, type SelectHTMLAttributes } from "react";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple" | "size"> & { ref?: Ref<HTMLSelectElement> };
type Option = { value: string; label: ReactNode; text: string; disabled: boolean };
function textOf(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : String(child)).join("");
}
function optionsOf(children: ReactNode, disabled = false): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; label?: string }>(child)) return [];
    const props = child.props;
    if (child.type !== "option") return optionsOf(props.children, disabled || !!props.disabled);
    const text = props.label || textOf(props.children);
    return [{ value: String(props.value ?? text), label: props.label || props.children, text, disabled: disabled || !!props.disabled }];
  });
}

/** A shared select with a top-layer menu, retaining native form values and change events. */
export function CustomSelect({ children, className = "", id, ref, value, defaultValue, disabled, required, onChange, onFocus, onBlur, onInvalid, ...props }: Props) {
  const generated = useId();
  const controlId = id || generated;
  const menuId = `${controlId}-options`;
  const trigger = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const typed = useRef({ text: "", time: 0 });
  const options = optionsOf(children);
  const [localValue, setLocalValue] = useState(String(defaultValue ?? options.find(option => !option.disabled)?.value ?? ""));
  const selectedValue = String(value ?? localValue);
  const selected = options.findIndex(option => option.value === selectedValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  function show() {
    if (disabled) return;
    setActive(selected >= 0 && !options[selected].disabled ? selected : options.findIndex(option => !option.disabled));
    setOpen(true);
  }
  function pick(index: number) {
    const option = options[index];
    if (!option || option.disabled || !native.current) return;
    native.current.value = option.value;
    native.current.dispatchEvent(new Event("change", { bubbles: true }));
    setOpen(false);
    trigger.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open || !panel.current || !trigger.current) return;
    const menu = panel.current;
    const button = trigger.current;
    function position() {
      const rect = button.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
      const below = top + height - rect.bottom - 12, above = rect.top - top - 12;
      const upwards = below < Math.min(menu.scrollHeight, 320) && above > below;
      menu.style.maxHeight = `${Math.max(48, Math.min(360, upwards ? above : below))}px`;
      menu.style.width = `${Math.min(Math.max(rect.width, 260), width - 24)}px`;
      menu.style.left = `${Math.max(left + 12, Math.min(rect.left, left + width - menu.offsetWidth - 12))}px`;
      menu.style.top = `${upwards ? rect.top - menu.offsetHeight - 6 : rect.bottom + 6}px`;
    }
    menu.showPopover();
    position();
    const dismiss = (event: PointerEvent) => {
      if (!menu.contains(event.target as Node) && !button.contains(event.target as Node)) setOpen(false);
    };
    const resize = new ResizeObserver(position);
    resize.observe(button);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    return () => {
      if (menu.matches(":popover-open")) menu.hidePopover();
      resize.disconnect();
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open && active >= 0) document.getElementById(`${menuId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, menuId]);

  return <>
    <button ref={trigger} id={controlId} type="button" role="combobox" className={`ma-select ma-custom-select ${className}`.trim()}
      disabled={disabled} style={props.style} title={props.title} tabIndex={props.tabIndex}
      aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]} aria-describedby={props["aria-describedby"]}
      aria-invalid={props["aria-invalid"]} aria-required={required} aria-expanded={open} aria-haspopup="listbox"
      aria-controls={menuId} aria-activedescendant={open && active >= 0 ? `${menuId}-${active}` : undefined}
      onClick={() => open ? setOpen(false) : show()}
      onBlur={() => { setOpen(false); if (native.current) native.current.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); }}
      onKeyDown={event => {
        if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
        if (event.key === "Tab") { setOpen(false); return; }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
          if (!enabled.length) return;
          if (!open) { show(); return; }
          const current = enabled.indexOf(active);
          setActive(event.key === "Home" ? enabled[0] : event.key === "End" ? enabled[enabled.length - 1] : enabled[(current + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length]);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (open) pick(active); else show();
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          const now = Date.now();
          typed.current.text = (now - typed.current.time < 700 ? typed.current.text : "") + event.key.toLocaleLowerCase();
          typed.current.time = now;
          const query = [...typed.current.text].every(char => char === typed.current.text[0]) ? typed.current.text[0] : typed.current.text;
          const start = query.length === 1 ? active + 1 : 0;
          const match = options.map((_, index) => (index + start) % options.length).find(index => !options[index].disabled && options[index].text.toLocaleLowerCase().startsWith(query));
          if (!open) show();
          if (match !== undefined) setActive(match);
        }
      }}><span className="ma-custom-select__value">{options[selected]?.label ?? options[0]?.label}</span></button>
    <select {...props} ref={element => {
      native.current = element;
      if (typeof ref === "function") return ref(element);
      if (ref) ref.current = element;
    }} className="ma-custom-select__native" aria-hidden="true" tabIndex={-1}
      value={value} defaultValue={defaultValue} disabled={disabled} required={required}
      onFocus={event => { trigger.current?.focus(); onFocus?.(event); }} onBlur={onBlur}
      onInvalid={event => { event.preventDefault(); trigger.current?.focus(); show(); onInvalid?.(event); }}
      onChange={event => { setLocalValue(event.target.value); onChange?.(event); }}>{children}</select>
    <span ref={panel} id={menuId} role="listbox" popover="manual" className="ma-select-menu"
      aria-label={props["aria-label"] || undefined} aria-labelledby={props["aria-label"] ? undefined : controlId}
      onPointerDown={event => event.preventDefault()}>
      {options.map((option, index) => <span key={`${option.value}-${index}`} id={`${menuId}-${index}`} role="option"
        aria-selected={index === selected} aria-disabled={option.disabled || undefined}
        data-active={index === active || undefined} className="ma-select-menu__option"
        onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={event => { event.preventDefault(); event.stopPropagation(); pick(index); }}>
        <span>{option.label}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
      </span>)}
    </span>
  </>;
}
