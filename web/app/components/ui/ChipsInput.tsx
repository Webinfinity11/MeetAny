'use client';
import { useRef, useState } from 'react';
import { Button } from './Button';
import { Icon } from '../Icon';
import s from './chips-input.module.css';

export type ChipsInputProps = { id: string; label: string; values: string[]; onChange: (values: string[]) => void; suggestions?: string[]; max?: number; maxLength?: number; placeholder?: string; hint?: string; disabled?: boolean; compact?: boolean };
export function ChipsInput({ id, label, values, onChange, suggestions = [], max = 8, maxLength = 120, placeholder = 'დაამატეთ ერთი პუნქტი', hint, disabled = false, compact = false }: ChipsInputProps) {
  const [draft, setDraft] = useState(''), [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const add = (text = draft) => {
    if (disabled) return;
    const value = text.trim();
    if (!value) return;
    if (values.some(item => item.toLocaleLowerCase() === value.toLocaleLowerCase())) { setError('ეს პუნქტი უკვე დამატებულია'); return; }
    if (values.length >= max) { setError(`მაქსიმუმ ${max} პუნქტი`); return; }
    if (value.length > maxLength) { setError(`მაქსიმუმ ${maxLength} სიმბოლო`); return; }
    onChange([...values, value]); setDraft(''); setError(''); input.current?.focus();
  };
  const help = hint ?? (!compact ? `თითო პუნქტი მაქსიმუმ ${maxLength} სიმბოლო.` : '');
  return <div className={`ma-field ${s.root}`}>
    <label className="ma-field__label" htmlFor={id}>{label}<span className="ma-field__opt">{values.length} / {max}</span></label>
    <ul className={s.chips}>{values.map((value, index) => <li key={`${index}:${value}`}><Icon name="check" /><span>{value}</span><Button variant="ghost" className={s.remove} disabled={disabled} aria-label={`${value} — წაშლა`} onClick={() => { onChange(values.filter((_, i) => i !== index)); setError(''); input.current?.focus(); }}><Icon name="x" /></Button></li>)}</ul>
    {suggestions.some(value => !values.includes(value)) && <div className={s.suggestions}>{suggestions.filter(value => !values.includes(value)).map(value => <Button key={value} variant="secondary" disabled={disabled} className={s.suggestion} onClick={() => add(value)}>{value}<Icon name="plus" /></Button>)}</div>}
    <div className={s.control}><input ref={input} id={id} className="ma-input" value={draft} disabled={disabled} maxLength={maxLength} placeholder={placeholder} aria-invalid={!!error} aria-describedby={error || help ? `${id}-help` : undefined}
      onChange={event => { setDraft(event.target.value); setError(''); }} onKeyDown={event => { if (!event.nativeEvent.isComposing && ['Enter', ','].includes(event.key)) { event.preventDefault(); add(); } }} />
      <Button variant="secondary" disabled={disabled} aria-disabled={!draft.trim() || undefined} onClick={() => add()}>დამატება</Button></div>
    {error || help ? <p id={`${id}-help`} className={error ? 'ma-field__error' : 'ma-field__help'} role={error ? 'alert' : undefined}>{error || help}</p> : null}
  </div>;
}
