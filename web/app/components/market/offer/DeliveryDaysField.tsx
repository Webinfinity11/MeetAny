"use client";
import { useState } from 'react';
import { CustomSelect } from '../../ui/CustomSelect';

const presets = ['3', '5', '7', '10', '14', '21', '30'];
export function DeliveryDaysField({ value, onChange, name, id, ...aria }: { value: string; onChange: (value: string) => void; name?: string; id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) {
  const [other, setOther] = useState(false);
  const custom = other || !!value && !presets.includes(value);
  return <><CustomSelect id={id} {...aria} required value={custom ? 'other' : value} onChange={e => { setOther(e.target.value === 'other'); onChange(e.target.value === 'other' ? '' : e.target.value); }}>
    <option value="" disabled>აირჩიეთ ვადა</option>{presets.map(days => <option key={days} value={days}>{days} დღე</option>)}<option value="other">სხვა</option>
  </CustomSelect>{custom ? <input className="ma-input" type="number" min="0" max="365" step="1" required aria-label="მიწოდების დღეების რაოდენობა" {...aria} value={value} onChange={e => onChange(e.target.value)}/> : null}{name ? <input type="hidden" name={name} value={value}/> : null}</>;
}
