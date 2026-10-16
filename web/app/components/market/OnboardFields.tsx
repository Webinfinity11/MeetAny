'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MultiCombobox } from '../ui/MultiCombobox';
import { categoryOptions } from '../ui/combobox-options';
import { CustomSelect } from '../ui/CustomSelect';
import { Button } from '../ui/Button';
import { Icon } from '../Icon';
import { normalizeOnboardItems, onboardItemsError } from '../../lib/onboarding-client';
import s from './onboarding.module.css';

// Lucide shopping-cart from the artboard source; absent from the shared sprite.
export function OnboardIcon({ name }: { name: string }) {
  if (name === 'hash') return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9h16M3 15h16M10 3 8 21M16 3l-2 18" /></svg>;
  if (name !== 'shopping-cart') return <Icon name={name} />;
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>;
}

export function OnboardCard({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return <section className={s.card}><div className={s.cardHeading}><h2>{title}</h2>{hint && hint !== 'არასავალდებულო' && <span>{hint}</span>}</div><div className={s.stack}>{children}</div></section>;
}
/** `invalid` is a form-level rule (e.g. a duplicate name): it blocks submit like any other validity error. */
export function OnboardField({ label, value, onChange, required, requiredMarker = required, maxLength, type = 'text', options, readOnly, multiline, min, max, icon, hint, help, autoComplete, invalid = '' }: {
  label: string; value: string; onChange?: (value: string) => void; required?: boolean; maxLength?: number;
  autoComplete?: string; type?: string; options?: Record<string, string>; readOnly?: boolean; multiline?: boolean; min?: number; max?: number; icon?: string; hint?: string; help?: string; invalid?: string; requiredMarker?: boolean;
}) {
  const id = useId();
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.setCustomValidity(invalid); }, [invalid]);
  const validation = (field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => field.validity.valid ? '' : field.validity.customError ? field.validationMessage : field.validity.valueMissing ? 'შეავსეთ სავალდებულო ველი.' : field.validity.rangeUnderflow || field.validity.rangeOverflow ? 'მიუთითეთ წელი დასაშვებ დიაპაზონში.' : 'შეამოწმეთ ველის ფორმატი.';
  const shown = error || invalid;
  const common = { id, value, required, autoComplete, 'aria-invalid': !!shown, 'aria-describedby': [help && id + '-help', shown && id + '-error'].filter(Boolean).join(' ') || undefined, onInvalid: (e: React.InvalidEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.preventDefault(); setError(validation(e.currentTarget)); e.currentTarget.closest('details')?.setAttribute('open', ''); e.currentTarget.focus(); }, onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setError(validation(e.currentTarget)), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setError(''); onChange?.(e.target.value); } };
  return <div className={s.field}><label htmlFor={id}>{label}{requiredMarker && <span> *</span>}{hint && <small>{hint}</small>}</label>
    <div className={icon ? s.inputIcon : s.inputControl}>{icon && <OnboardIcon name={icon} />}
    {options ? <CustomSelect {...common}><option value="">აირჩიეთ</option>{Object.entries(options).map(([key, text]) => <option value={key} key={key}>{text}</option>)}</CustomSelect>
      : multiline ? <textarea {...common} maxLength={maxLength} rows={3} readOnly={readOnly} />
      : <input {...common} ref={input} type={type} maxLength={maxLength} readOnly={readOnly} min={min} max={max} />}</div>
    {help && <p id={id + '-help'} className={s.fieldHelp}>{help}</p>}
    {shown && <small id={id + '-error'} className={s.fieldError}>{shown}</small>}
  </div>;
}
type ItemsProps = { label: string; values: string[]; onChange: (values: string[]) => void; rows?: boolean; limit?: number; maxLength?: number };
export function OnboardItems(props: ItemsProps) {
  return <OnboardItemRows {...props} />;
}

/** Every entered character is part of the profile draft, including before pressing Done or Next. */
function OnboardItemRows({ label, values, onChange, limit = 8, maxLength = 120 }: ItemsProps) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [limitError, setLimitError] = useState('');
  const invalid = onboardItemsError(values, { limit, maxLength });
  const error = invalid || limitError;
  useEffect(() => { input.current?.focus(); }, [editing]);
  useEffect(() => { input.current?.setCustomValidity(invalid); }, [invalid, editing]);
  function remove(index: number) {
    onChange(values.filter((_, i) => i !== index));
    setEditing(null); setLimitError('');
  }
  function finish(index: number) {
    if (onboardItemsError(values, { limit, maxLength })) { input.current?.focus(); return; }
    if (!values[index].trim()) remove(index);
    else setEditing(null);
  }
  function add() {
    const empty = values.findIndex(value => !value.trim());
    if (empty >= 0) { setEditing(empty); input.current?.focus(); return; }
    if (normalizeOnboardItems(values).length >= limit) { setLimitError(`შეგიძლიათ დაამატოთ მაქსიმუმ ${limit} ჩანაწერი.`); return; }
    setLimitError(''); onChange([...values, '']); setEditing(values.length);
  }
  return <section className={s.itemRows} aria-labelledby={`${id}-label`}>
    <header><h3 id={`${id}-label`}>{label}</h3><Button variant="secondary" onClick={add}>დამატება</Button></header>
    {values.length > 0 && <ul>{values.map((value, index) => <li key={index} className={editing === index ? s.itemRowEditing : undefined}>
      {editing === index ? <>
        <textarea ref={input} rows={2} maxLength={maxLength} aria-label={`${label} — ჩანაწერი ${index + 1}`} aria-invalid={!!invalid} aria-describedby={error ? `${id}-error` : undefined} value={value}
          onChange={event => { onChange(values.map((item, i) => i === index ? event.target.value : item)); setLimitError(''); }}
          onInvalid={event => { event.preventDefault(); event.currentTarget.focus(); }}
          onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setEditing(null); } else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); finish(index); } }} />
        <div className={s.itemRowActions}><Button variant="ghost" aria-label={`${value || 'ჩანაწერი'} — წაშლა`} onClick={() => remove(index)}><Icon name="trash-2" /></Button><Button variant="secondary" onClick={() => finish(index)}><Icon name="check" />მზადაა</Button></div>
      </> : <><Button variant="ghost" className={s.itemRowName} aria-label={`${value || 'ჩანაწერი'} — შეცვლა`} onClick={() => setEditing(index)}><span>{value.trim() || 'ახალი ჩანაწერი'}</span><Icon name="pencil" /></Button><Button variant="ghost" className={s.itemRowDelete} aria-label={`${value || 'ჩანაწერი'} — წაშლა`} onClick={() => remove(index)}><Icon name="trash-2" /></Button></>}
    </li>)}</ul>}
    {error && <p id={`${id}-error`} className={s.fieldError} role="alert">{error}</p>}
  </section>;
}
export function OnboardCategories({ values, onChange, limit, count }: { values: string[]; onChange: (values: string[]) => void; compact?: boolean; limit?: number; count?: string }) {
  return <MultiCombobox label="კატეგორიები" options={categoryOptions} value={values} onChange={onChange} limit={limit} hint={count} />;
}
