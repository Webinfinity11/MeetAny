'use client';
import { useId, useState, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../Icon';
import { categories } from '../../lib/categories';
import s from './onboarding.module.css';

// Lucide shopping-cart from the artboard source; absent from the shared sprite.
export function OnboardIcon({ name }: { name: string }) {
  if (name !== 'shopping-cart') return <Icon name={name} />;
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>;
}

export function OnboardCard({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return <section className={s.card}><div className={s.cardHeading}><h2>{title}</h2>{hint && <span className={hint === 'არასავალდებულო' ? s.optionalHint : undefined}>{hint}</span>}</div><div className={s.stack}>{children}</div></section>;
}
export function OnboardField({ label, value, onChange, required, maxLength, type = 'text', options, readOnly, multiline, min, max }: {
  label: string; value: string; onChange?: (value: string) => void; required?: boolean; maxLength?: number;
  type?: string; options?: Record<string, string>; readOnly?: boolean; multiline?: boolean; min?: number; max?: number;
}) {
  const id = useId();
  const [error, setError] = useState('');
  const validation = (field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => field.validity.valid ? '' : field.validity.valueMissing ? 'შეავსეთ სავალდებულო ველი.' : field.validity.rangeUnderflow || field.validity.rangeOverflow ? 'მიუთითეთ წელი დასაშვებ დიაპაზონში.' : 'შეამოწმეთ ველის ფორმატი.';
  const common = { id, value, required, 'aria-invalid': !!error, 'aria-describedby': error ? id + '-error' : undefined, onInvalid: (e: React.InvalidEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setError(validation(e.currentTarget)), onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setError(validation(e.currentTarget)), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setError(''); onChange?.(e.target.value); } };
  return <div className={s.field}><label htmlFor={id}>{label}{required && <span> *</span>}</label>
    {options ? <select {...common}><option value="">აირჩიეთ</option>{Object.entries(options).map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select>
      : multiline ? <textarea {...common} maxLength={maxLength} rows={3} readOnly={readOnly} />
      : <input {...common} type={type} maxLength={maxLength} readOnly={readOnly} min={min} max={max} />}
    {error && <small id={id + '-error'} className={s.fieldError}>{error}</small>}
  </div>;
}
export function OnboardItems({ label, values, onChange, suggestions = [], checkboxes = false }: { label: string; values: string[]; onChange: (values: string[]) => void; suggestions?: string[]; checkboxes?: boolean }) {
  const id = useId(), [text, setText] = useState(''), [adding, setAdding] = useState(false);
  const [customOptions, setCustomOptions] = useState(values);
  const add = () => { const value = text.trim(); if (value && values.length < 8 && !values.includes(value)) { onChange([...values, value]); setCustomOptions(previous => [...new Set([...previous, value])]); setText(''); } };
  const customButton = <button type="button" className={s.customAdd} aria-label={`${label} — საკუთარი`} aria-expanded={adding} disabled={values.length >= 8} onClick={() => setAdding(!adding)}><Icon name="plus" />საკუთარი</button>;
  return <div className={s.items} role="group" aria-label={label}>
    {!checkboxes && <div className={s.cardHeading}><label htmlFor={id}>{label}</label><span>{values.length} / 8</span></div>}
    {checkboxes ? <div className={s.checkboxes}>{[...new Set([...suggestions, ...customOptions, ...values])].map(value => <label key={value}><input type="checkbox" checked={values.includes(value)} disabled={!values.includes(value) && values.length >= 8} onChange={() => onChange(values.includes(value) ? values.filter(item => item !== value) : [...values, value])} />{value}</label>)}{customButton}</div>
      : <div className={s.chips}>{values.map((value, index) => <button type="button" className={s.selected} key={index} onClick={() => onChange(values.filter((_, i) => i !== index))} aria-label={`${value} — წაშლა`}>{value}<Icon name="x" /></button>)}
      {suggestions.filter(value => !values.includes(value)).map(value => <button key={value} type="button" disabled={values.length >= 8} onClick={() => onChange([...values, value])}>{value}<Icon name="plus" /></button>)}{customButton}</div>}
    {adding && <div className={s.addItem}><input id={id} aria-label={label} autoFocus value={text} maxLength={120} placeholder="საკუთარი ჩანაწერი" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} /><Button variant="secondary" disabled={!text.trim() || values.length >= 8 || values.includes(text.trim())} onClick={add}>დამატება</Button></div>}
    {adding && text.trim() && <small>ჩანაწერის შესანახად დააჭირეთ „დამატებას“.</small>}
  </div>;
}
const featured = ['catering', 'food_fresh', 'beverages', 'packaging', 'wholesale', 'building_materials', 'software_web', 'textiles', 'freight', 'advertising', 'cleaning', 'other'];
const shortLabels: Record<string, string> = { catering: 'HoReCa', food_fresh: 'საკვები', beverages: 'სასმელები', packaging: 'შეფუთვა', wholesale: 'საბითუმო', building_materials: 'მშენებლობა', software_web: 'IT', textiles: 'ტექსტილი', freight: 'ლოგისტიკა', advertising: 'მარკეტინგი', cleaning: 'დასუფთავება', other: 'სხვა' };
export function OnboardCategories({ values, onChange, compact = false, limit = 34 }: { values: string[]; onChange: (values: string[]) => void; compact?: boolean; limit?: number }) {
  const [all, setAll] = useState(false);
  const keys = all ? Object.keys(categories) : [...new Set([...featured, ...values])];
  return <><div className={compact ? s.chips : s.categoryGrid}>{keys.map(key => <button type="button" key={key} aria-label={categories[key as keyof typeof categories]} title={categories[key as keyof typeof categories]} aria-pressed={values.includes(key)} className={values.includes(key) ? s.selected : ''} disabled={!values.includes(key) && values.length >= limit} onClick={() => onChange(values.includes(key) ? values.filter(v => v !== key) : [...values, key])}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><use href={`/icons-categories.svg#${key}`} /></svg><span>{shortLabels[key] || categories[key as keyof typeof categories] || key}</span>{!compact && values.includes(key) && <Icon name="check" />}
  </button>)}</div><Button variant="ghost" onClick={() => setAll(!all)}>{all ? 'ნაკლები კატეგორია' : 'ყველა კატეგორია'}</Button></>;
}
