"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { CategoryIcon } from "./market/CategoryIcon";
import type { SearchSuggestion } from "../lib/search-suggestions";

export function SearchCombobox({ id, label, placeholder, value, onChange, suggestions, onSelect, name, hideLabel = false }: {
  id: string; label: string; placeholder: string; value: string; onChange: (value: string) => void;
  suggestions: SearchSuggestion[]; onSelect: (item: SearchSuggestion) => void; name?: string; hideLabel?: boolean;
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
      <input ref={input} className="ma-input" id={id} name={name} type="search" role="combobox" autoComplete="off" maxLength={200}
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
    {/* Nothing to suggest → no panel; the list below already answers. */}
    <div className="search-suggestions" hidden={!open || !suggestions.length}>
      <p className="search-suggestions__heading">{value.trim() ? "ძიების შეთავაზებები" : "სწრაფი ძიება"}</p>
      <div role="listbox" id={`${id}-suggestions`} aria-label="ძიების შეთავაზებები">
        {suggestions.map((s, index) => <button type="button" role="option" aria-selected={active === index} id={`${id}-option-${index}`} key={s.id} tabIndex={-1}
          className="search-suggestion" onMouseDown={e => e.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => pick(index)}>
          <CategoryIcon id={s.category} /><span><strong>{s.label}</strong><small>{s.detail}</small></span>
        </button>)}
      </div>
    </div>
  </div>;
}
