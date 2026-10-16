"use client";
import { optimizable } from "../lib/image";
import Image from "next/image";
import { Button } from "./ui/Button";


import { Fragment, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { CategoryIcon } from "./ui/CategoryIcon";
import { DuoIcon } from "./ui/DuoIcon";
import type { SearchSuggestion } from "../lib/search-suggestions";

/** Bold the part of `text` that matches the query (case-insensitive, first occurrence). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const at = q ? text.toLocaleLowerCase("ka").indexOf(q.toLocaleLowerCase("ka")) : -1;
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + q.length)}</mark>{text.slice(at + q.length)}</>;
}

export function SearchCombobox({ id, label, placeholder, value, onChange, suggestions, onSelect, name, hideLabel = false, emptyHref, allResultsHref }: {
  id: string; label: string; placeholder: string; value: string; onChange: (value: string) => void;
  suggestions: SearchSuggestion[]; onSelect: (item: SearchSuggestion) => void; name?: string; hideLabel?: boolean;
  /** Where "nothing found" points (usually a prefilled new request); omit to hide the panel instead. */
  emptyHref?: string;
  /** Full catalog destination, retaining the current query and city. */
  allResultsHref?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const empty = !!value.trim() && !suggestions.length && !!emptyHref;
  const visible = open && (suggestions.length > 0 || empty);
  useLayoutEffect(() => {
    const menu = panel.current, anchor = input.current;
    if (!visible || !menu || !anchor) return;
    menu.showPopover();
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
      const headerBottom = document.querySelector('[data-site-header]')?.getBoundingClientRect().bottom || top;
      const upper = Math.max(top + 8, headerBottom + 8), lower = top + height - 8;
      if (rect.bottom <= upper || rect.top >= lower) { setOpen(false); return; }
      const panelWidth = Math.min(Math.max(rect.width, 280), width - 16);
      menu.style.width = `${panelWidth}px`;
      menu.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - panelWidth - 8))}px`;
      const below = Math.max(0, lower - rect.bottom - 6), above = Math.max(0, rect.top - upper - 6);
      const upwards = below < Math.min(menu.scrollHeight, 360) && above > below;
      menu.style.maxHeight = `${Math.min(360, upwards ? above : below)}px`;
      menu.style.top = `${upwards ? rect.top - menu.offsetHeight - 6 : rect.bottom + 6}px`;
    };
    position();
    const resize = new ResizeObserver(position); resize.observe(anchor); resize.observe(menu);
    const dismiss = (event: PointerEvent) => { if (!menu.contains(event.target as Node) && !anchor.closest('.catalog-search')?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('resize', position); window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position); window.visualViewport?.addEventListener('scroll', position);
    return () => {
      if (menu.matches(':popover-open')) menu.hidePopover(); resize.disconnect();
      document.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position); window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [visible]);
  // Scroll only the suggestion panel. scrollIntoView also moves the page and detaches the anchor.
  useLayoutEffect(() => {
    const menu = panel.current, option = document.getElementById(`${id}-option-${active}`);
    if (!visible || !menu || !option || active < 0) return;
    const bounds = menu.getBoundingClientRect(), item = option.getBoundingClientRect();
    if (item.top < bounds.top) menu.scrollTop -= bounds.top - item.top;
    else if (item.bottom > bounds.bottom) menu.scrollTop += item.bottom - bounds.bottom;
  }, [active, visible, id]);
  const pick = (index: number) => { const item = suggestions[index]; if (item) { setOpen(false); setActive(-1); onSelect(item); } };
  return <div className="ma-field catalog-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <label className={hideLabel ? "ma-sr-only" : "ma-field__label"} htmlFor={id}>{label}</label>
    <div className="catalog-search__input">
      <Icon name="search" />
      <input ref={input} className="ma-input" id={id} name={name} type="search" role="combobox" autoComplete="off" enterKeyHint="search" maxLength={200}
        aria-autocomplete="list" aria-expanded={visible} aria-controls={visible ? `${id}-suggestions` : undefined} aria-activedescendant={visible && active >= 0 && suggestions[active] ? `${id}-option-${active}` : undefined}
        placeholder={placeholder} value={value} onFocus={() => { setOpen(true); setActive(-1); }}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); setActive(-1); }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); const delta = e.key === "ArrowDown" ? 1 : -1; setActive(i => suggestions.length ? (i < 0 ? (delta > 0 ? 0 : suggestions.length - 1) : (i + delta + suggestions.length) % suggestions.length) : -1); }
          if (e.key === "Enter" && open && active >= 0) { e.preventDefault(); pick(active); }
        }} />
      {value ? <button type="button" className="catalog-search__clear" aria-label="ძიების გასუფთავება" onClick={() => { onChange(""); setActive(-1); setOpen(true); input.current?.focus(); }}><Icon name="x" /></button> : null}
    </div>
    <div ref={panel} popover="manual" className={`search-suggestions${empty ? ' search-suggestions--empty' : ''}`} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); input.current?.focus(); setOpen(false); } }}>
    {empty ? <div id={`${id}-suggestions`} role="status">
      <p className="search-suggestions__none"><strong>„{value.trim()}“ ვერ მოიძებნა</strong><span>აღწერეთ, რა გჭირდებათ, და კომპანიები თავად დაგიკავშირდებიან.</span></p>
      <Button variant="primary" size="sm" href={emptyHref} onMouseDown={e => e.preventDefault()}>მოთხოვნის გამოქვეყნება</Button>
    </div> : <>
      <div role="listbox" id={`${id}-suggestions`} aria-label="ძიების შეთავაზებები">
        {suggestions.map((s, index) => {
          const heading = index === 0 || suggestions[index - 1].kind !== s.kind
            ? <p className="search-suggestions__heading" aria-hidden="true">{s.kind === "category" ? "კატეგორიები" : s.href.startsWith("/companies/") ? "კომპანიები" : "მოთხოვნები"}</p> : null;
          return <Fragment key={s.id}>{heading}<button type="button" role="option" aria-selected={active === index} id={`${id}-option-${index}`} tabIndex={-1}
            className={`search-suggestion search-suggestion--${s.kind}`} onMouseDown={e => e.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => pick(index)}>
            {s.kind === "category"
              ? <span className="search-suggestion__category-icon"><CategoryIcon id={s.category} size={18} /></span>
              : s.image ? <Image className="search-suggestion__thumb" src={s.image} alt="" loading="lazy" width={36} height={36} unoptimized={!optimizable(s.image)} />
              : <span className="search-suggestion__thumb search-suggestion__thumb--initials" aria-hidden="true">{s.href.startsWith("/companies/") ? <DuoIcon name="building-2" size={20} /> : <DuoIcon name="file-text" size={20} />}</span>}
            <span><strong><Highlight text={s.label} query={value} /></strong><small>{s.detail}</small></span>
          </button></Fragment>;
        })}
      </div>
      {allResultsHref ? <Link className="search-suggestions__all" href={allResultsHref} onClick={() => setOpen(false)}><Icon name="search" />ყველა შედეგის ნახვა</Link> : null}
    </>}
    </div>
  </div>;
}
