"use client";
import { Button } from "./ui/Button";


import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
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
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => { if (open && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block: "nearest"}); }, [active, open, id]);
  const pick = (index: number) => { const item = suggestions[index]; if (item) { setOpen(false); setActive(-1); onSelect(item); } };
  return <div className="ma-field catalog-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <label className={hideLabel ? "ma-sr-only" : "ma-field__label"} htmlFor={id}>{label}</label>
    <div className="catalog-search__input">
      <Icon name="search" />
      <input ref={input} className="ma-input" id={id} name={name} type="search" role="combobox" autoComplete="off" enterKeyHint="search" maxLength={200}
        aria-autocomplete="list" aria-expanded={open && !!suggestions.length} aria-controls={`${id}-suggestions`} aria-activedescendant={open && active >= 0 && suggestions[active] ? `${id}-option-${active}` : undefined}
        placeholder={placeholder} value={value} onFocus={() => { setOpen(true); setActive(-1); }}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={e => {
          if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); setActive(-1); }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); const delta = e.key === "ArrowDown" ? 1 : -1; setActive(i => suggestions.length ? (i < 0 ? (delta > 0 ? 0 : suggestions.length - 1) : (i + delta + suggestions.length) % suggestions.length) : -1); }
          if (e.key === "Enter" && open && active >= 0) { e.preventDefault(); pick(active); }
        }} />
      {value ? <button type="button" className="catalog-search__clear" aria-label="ძიების გასუფთავება" onClick={() => { onChange(""); setActive(-1); setOpen(true); input.current?.focus(); }}><Icon name="x" /></button> : null}
    </div>
    {open && value.trim() && !suggestions.length && emptyHref ? <div className="search-suggestions search-suggestions--empty" role="status">
      <p className="search-suggestions__none"><strong>„{value.trim()}“ ვერ მოიძებნა</strong><span>აღწერე, რა გჭირდება, და კომპანიები თავად დაგიკავშირდებიან.</span></p>
      <Button variant="primary" size="sm" href={emptyHref} onMouseDown={e => e.preventDefault()}>მოთხოვნის გამოქვეყნება</Button>
    </div> : null}
    <div className="search-suggestions" hidden={!open || !suggestions.length}>
      <div role="listbox" id={`${id}-suggestions`} aria-label="ძიების შეთავაზებები">
        {suggestions.map((s, index) => {
          const heading = index === 0 || suggestions[index - 1].kind !== s.kind
            ? <p className="search-suggestions__heading" aria-hidden="true">{s.kind === "category" ? "კატეგორიები" : s.href.startsWith("/companies/") ? "კომპანიები" : "მოთხოვნები"}</p> : null;
          return <Fragment key={s.id}>{heading}<button type="button" role="option" aria-selected={active === index} id={`${id}-option-${index}`} tabIndex={-1}
            className={`search-suggestion search-suggestion--${s.kind}`} onMouseDown={e => e.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => pick(index)}>
            {s.kind === "category"
              ? <span className="search-suggestion__category-icon"><DuoIcon name={s.category} size={18} /></span>
              : s.image ? <img className="search-suggestion__thumb" src={s.image} alt="" loading="lazy" width={36} height={36} />
              : <span className="search-suggestion__thumb search-suggestion__thumb--initials" aria-hidden="true">{s.href.startsWith("/companies/") ? <DuoIcon name="building-2" size={20} /> : <DuoIcon name="file-text" size={20} />}</span>}
            <span><strong><Highlight text={s.label} query={value} /></strong><small>{s.detail}</small></span>
          </button></Fragment>;
        })}
      </div>
      {allResultsHref ? <Link className="search-suggestions__all" href={allResultsHref} onClick={() => setOpen(false)}><Icon name="search" />ყველა შედეგის ნახვა</Link> : null}
    </div>
  </div>;
}
