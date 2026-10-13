'use client';
import { useId, useState } from 'react';
import { categories, categoryGroups, featuredCategories } from '../../lib/categories';
import { Button } from './Button';
import { CategoryIcon } from './CategoryIcon';
import { Icon } from '../Icon';
import s from './category-chips.module.css';

export type CategoryChipsProps = { id?: string; label?: string; value: string[]; onChange: (value: string[]) => void; multiple?: boolean; limit?: number; compact?: boolean; count?: string };
export function CategoryChips({ id, label = 'კატეგორიები', value, onChange, multiple = false, limit = Object.keys(categories).length, compact = false, count }: CategoryChipsProps) {
  const generated = useId(), root = id || generated;
  const [all, setAll] = useState(false);
  const visible = new Set(all ? Object.keys(categories) : [...featuredCategories, ...value]);
  const choose = (key: string) => {
    if (!multiple) { onChange([key]); return; }
    if (value.includes(key)) onChange(value.filter(v => v !== key));
    else if (value.length < limit) onChange([...value, key]);
  };
  return <div id={root} className={s.root} data-compact={compact || undefined}>
    <div role={multiple ? 'group' : 'radiogroup'} aria-label={label} className={s.groups} onKeyDown={event => {
      if (multiple || !['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
      const index = buttons.indexOf(event.target as HTMLButtonElement);
      if (index < 0) return;
      event.preventDefault();
      const next = buttons[(index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length];
      next.focus(); next.click();
    }}>
      {categoryGroups.map(group => {
        const items = group.items.filter(([key]) => visible.has(key));
        return items.length ? <div key={group.id} className={s.group}>
          <h3 className={s.heading}>{group.name}</h3>
          <div className={s.chips}>{items.map(([key, name]) => <Button key={key} variant="secondary" className={s.chip}
            role={multiple ? undefined : 'radio'} aria-checked={multiple ? undefined : value.includes(key)} aria-pressed={multiple ? value.includes(key) : undefined}
            aria-disabled={multiple && !value.includes(key) && value.length >= limit || undefined}
            tabIndex={multiple || (value.length ? value.includes(key) : key === featuredCategories[0]) ? 0 : -1}
            onClick={() => choose(key)}><CategoryIcon id={key} tile /><span>{name}</span>{value.includes(key) && <Icon name="check" />}</Button>)}</div>
        </div> : null;
      })}
    </div>
    <div className={s.footer}><Button variant="ghost" aria-expanded={all} onClick={() => setAll(!all)}><Icon name={all ? 'chevron-up' : 'chevron-down'} />{all ? 'მხოლოდ ძირითადი' : `ყველა კატეგორია (${Object.keys(categories).length})`}</Button>
      <span className={s.count} aria-live="polite">{multiple ? `არჩეულია ${value.length} / ${limit}` : count}{multiple && count && !count.startsWith('არჩეულია') ? ` · ${count}` : ''}</span></div>
  </div>;
}
