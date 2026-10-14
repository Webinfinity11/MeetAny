'use client';
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { Icon } from '../Icon';
import { creationValue, toggleSelection, visibleTokenCount } from './combobox-selection';
import s from './combobox.module.css';

/** Tokens take part in layout; a hidden measuring row determines overflow after two rows. */
function SelectedTokens({ items, disabled, onRemove }: { items: { value: string; label: string }[]; disabled: boolean; onRemove: (value: string) => void }) {
  const measure = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(items.length);
  const signature = JSON.stringify(items);
  useLayoutEffect(() => {
    const node = measure.current;
    if (!node) return;
    const update = () => {
      const tokens = Array.from(node.querySelectorAll<HTMLElement>('[data-token]'));
      const summary = node.querySelector<HTMLElement>('[data-summary]');
      const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
      setVisible(visibleTokenCount(tokens.map(token => token.getBoundingClientRect().width), node.clientWidth, gap, summary?.getBoundingClientRect().width || 0));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    return () => observer.disconnect();
  }, [signature]);
  return <div className={s.tokenArea}>
    <div ref={measure} className={`${s.tokens} ${s.measure}`} aria-hidden="true" inert>
      {items.map(item => <span key={item.value} data-token className={s.token}><span>{item.label}</span><span className={s.tokenRemove}><Icon name="x" /></span></span>)}
      <span className={s.more} data-summary>+{items.length}</span>
    </div>
    <div className={s.tokens}>
      {items.slice(0, visible).map(item => <span key={item.value} className={s.token}><span>{item.label}</span><Button variant="ghost" className={s.tokenRemove} disabled={disabled} aria-label={`${item.label} — წაშალეთ`} onClick={() => onRemove(item.value)}><Icon name="x" /></Button></span>)}
      {items.length > visible && <span className={s.more}>+{items.length - visible}</span>}
    </div>
  </div>;
}

export type ComboboxOption = { value: string; label: string; group?: string; icon?: ReactNode; disabled?: boolean };
export type ComboboxCommonProps = {
  id?: string; label: string; options: ComboboxOption[]; placeholder?: string; disabled?: boolean;
  hint?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; required?: boolean;
};
export type ComboboxProps = ComboboxCommonProps & { value: string; onChange: (value: string) => void };
export function Combobox({ value, onChange, ...props }: ComboboxProps) {
  return <Selection {...props} values={value ? [value] : []} onChange={values => onChange(values[0] || '')} />;
}
export type SelectionProps = ComboboxCommonProps & {
  values: string[]; onChange: (values: string[]) => void; multiple?: boolean; limit?: number;
  exclusiveValue?: string; creatable?: boolean; maxLength?: number;
};
export function Selection({ id, label, options, values, onChange, multiple = false, limit = Infinity, exclusiveValue, creatable = false, maxLength = 120, placeholder = 'აირჩიეთ', disabled = false, hint, required, ...aria }: SelectionProps) {
  const generated = useId(), controlId = id || generated, listId = `${controlId}-list`;
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [mobile, setMobile] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const available: ComboboxOption[] = [...options, ...values.filter(value => !options.some(option => option.value === value)).map(value => ({ value, label: value }))];
  const filtered = available.filter(option => `${option.label} ${option.group || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const created = creatable ? creationValue(query, available, values, maxLength) : '';
  const entries: ComboboxOption[] = created ? [...filtered, { value: created, label: `დაამატეთ „${created}“` }] : filtered;
  const activeIndex = Math.min(active, entries.length - 1);
  const blocked = (option: ComboboxOption) => !!option.disabled || (multiple && !values.includes(option.value) && option.value !== exclusiveValue && values.filter(value => value !== exclusiveValue).length >= limit);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const show = (text = '') => {
    if (disabled || trigger.current?.matches(':disabled')) return;
    setMobile(window.matchMedia('(max-width: 600px)').matches); setQuery(text); setActive(0); setOpen(true);
  };
  const choose = (option: ComboboxOption) => {
    if (disabled || blocked(option)) return;
    onChange(multiple ? toggleSelection(values, option.value, limit, exclusiveValue) : [option.value]);
    if (!multiple) close();
    else { setQuery(''); setActive(0); search.current?.focus(); }
  };
  useLayoutEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => search.current?.focus());
    if (mobile) return () => cancelAnimationFrame(frame);
    const menu = panel.current, button = trigger.current;
    if (!menu || !button) return () => cancelAnimationFrame(frame);
    menu.showPopover();
    function position() {
      if (!menu || !button) return;
      const rect = button.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 24);
      menu.style.width = `${width}px`;
      menu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
      const below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
      const upwards = below < Math.min(menu.scrollHeight, 420) && above > below;
      menu.style.maxHeight = `${Math.max(120, upwards ? above : below)}px`;
      menu.style.top = `${upwards ? Math.max(12, rect.top - menu.offsetHeight - 6) : rect.bottom + 6}px`;
    }
    position();
    const resize = new ResizeObserver(position); resize.observe(menu); resize.observe(button);
    const dismiss = (event: PointerEvent) => { if (!menu.contains(event.target as Node) && !button.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss); window.addEventListener('resize', position); window.addEventListener('scroll', position, true);
    return () => { cancelAnimationFrame(frame); if (menu.matches(':popover-open')) menu.hidePopover(); resize.disconnect(); document.removeEventListener('pointerdown', dismiss); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open, mobile]);
  useLayoutEffect(() => { if (open) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' }); }, [open, activeIndex, listId]);
  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const enabled = entries.map((option, index) => blocked(option) ? -1 : index).filter(index => index >= 0);
      if (!enabled.length) return;
      const current = enabled.indexOf(activeIndex);
      setActive(event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1)! : enabled[(current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]);
    }
    if (event.key === 'Enter') { event.preventDefault(); if (entries[activeIndex]) choose(entries[activeIndex]); }
  }
  const helpId = hint ? `${controlId}-help` : undefined;
  const describedBy = [aria['aria-describedby'], helpId].filter(Boolean).join(' ') || undefined;
  const content = <div className={s.content} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <div className={s.search}><input ref={search} className="ma-input" role="combobox" aria-label={`${label} — ძიება`} aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} value={query} placeholder="მოძებნეთ…" maxLength={creatable ? maxLength : undefined} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={keys} /></div>
    <div id={listId} role="listbox" aria-label={label} aria-multiselectable={multiple || undefined} className={s.list}>
      {entries.map((option, index) => <div key={option.value} role="presentation">
        {option.group && option.group !== entries[index - 1]?.group && <div className={s.group} role="presentation">{option.group}</div>}
        <div id={`${listId}-${index}`} role="option" aria-selected={values.includes(option.value)} aria-disabled={blocked(option) || undefined} className={s.option} data-active={index === activeIndex || undefined} onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()} onClick={() => choose(option)}>
          {multiple && <span className={s.check} aria-hidden="true">{values.includes(option.value) && <Icon name="check" />}</span>}{option.icon}<span>{option.label}</span>{!multiple && values.includes(option.value) && <Icon name="check" />}
        </div>
      </div>)}
    </div>
    {!entries.length && <p className={s.empty} role="status">შედეგი ვერ მოიძებნა</p>}
    {multiple && <div className={s.footer}><span role="status">{values.length}{Number.isFinite(limit) ? ` / ${limit}` : ' არჩეული'}</span><Button variant="ghost" disabled={!values.length || disabled} onClick={() => { onChange([]); search.current?.focus(); }}>გასუფთავება</Button><Button onClick={close}>მზადაა</Button></div>}
  </div>;
  return <div className={`ma-field ${s.root}`}>
    {multiple && <label htmlFor={controlId} className="ma-field__label">{label}</label>}
    <div className={s.control}>
      <Button variant="base" ref={trigger} id={controlId} className={`ma-select ma-custom-select ${s.trigger}`} role="combobox" disabled={disabled} aria-label={values.length ? `${label}: ${values.map(value => available.find(option => option.value === value)?.label || value).join(", ")}` : label} data-tokens={multiple && values.length > 0 || undefined} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? listId : undefined} aria-describedby={describedBy} aria-invalid={aria['aria-invalid']} aria-required={required}
        onClick={() => open ? close() : show()} onKeyDown={event => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); show(); }
          else if (event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); show(event.key); }
        }}>
        {!(multiple && values.length > 0) && <span className={s.value}>{values.length ? <>{available.find(option => option.value === values[0])?.icon}{available.find(option => option.value === values[0])?.label || values[0]}</> : <span className={s.placeholder}>{placeholder}</span>}</span>}
        <Icon name="chevron-down" className={s.arrow} />
      </Button>
      {multiple && values.length > 0 && <SelectedTokens items={values.map(value => ({ value, label: available.find(option => option.value === value)?.label || value }))} disabled={disabled} onRemove={value => { onChange(values.filter(item => item !== value)); trigger.current?.focus(); }} />}
    </div>
    {hint && <p id={helpId} className="ma-field__help">{hint}</p>}
    {mobile ? <Sheet open={open} onClose={close} title={label} className={s.sheet}>{content}</Sheet> : <div ref={panel} popover="manual" className={s.popover} onBlur={event => { if (open && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>{open && content}</div>}
  </div>;
}
