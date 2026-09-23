import { useRef } from "react";
import { Icon } from "../Icon";

export function CatalogSearch({ id, label, placeholder, value, onChange }: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="ma-field catalog-search">
      <label className="ma-field__label" htmlFor={id}>{label}</label>
      <div className="catalog-search__input">
        <Icon name="search" />
        <input ref={input} className="ma-input" id={id} type="search" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
        {value ? <button type="button" className="catalog-search__clear" aria-label="ძიების გასუფთავება" onClick={() => { onChange(""); input.current?.focus(); }}><Icon name="x" /></button> : null}
      </div>
    </div>
  );
}
