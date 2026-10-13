'use client';
import { cities } from '../../lib/categories';
import { Button } from './Button';
import { Icon } from '../Icon';
import s from './city-chips.module.css';

export type CityChipsProps = { id: string; value: string[]; onChange: (value: string[]) => void; disabled?: boolean };
export function CityChips({ id, value, onChange, disabled = false }: CityChipsProps) {
  const choose = (city: string) => {
    if (value.includes(city)) onChange(value.filter(item => item !== city));
    else onChange(city === 'georgia' ? ['georgia'] : [...value.filter(item => item !== 'georgia'), city]);
  };
  return <div id={id} className={`ma-field ${s.root}`}>
    <span id={`${id}-label`} className="ma-field__label">მომსახურების ქალაქები</span>
    <div className={s.chips} role="group" aria-labelledby={`${id}-label`} aria-describedby={`${id}-help`}>
      {Object.entries(cities).map(([key, label]) => <Button key={key} variant="secondary" className={s.chip} disabled={disabled} aria-pressed={value.includes(key)} onClick={() => choose(key)}><span>{label}</span>{value.includes(key) && <Icon name="check" />}</Button>)}
    </div>
    <p id={`${id}-help`} className="ma-field__help">იგივე სია დისტრიბუციის რეგიონებისაა</p>
  </div>;
}
