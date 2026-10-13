"use client";
import { useState } from 'react';
import { CustomSelect } from '../../ui/CustomSelect';
import { paymentPresets, paymentPreset } from './payment-presets';

export function PaymentTermsField({ value, onChange, name, id, required = false, ...aria }: { value: string; onChange: (value: string) => void; name?: string; id: string; required?: boolean; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) {
  const [other, setOther] = useState(false);
  const preset = paymentPreset(value);
  const custom = other || !!value && !preset;
  return <><CustomSelect id={id} {...aria} required={required} value={custom ? 'other' : preset || ''} onChange={e => { setOther(e.target.value === 'other'); onChange(e.target.value === 'other' ? '' : e.target.value); }}>
    <option value="">აირჩიეთ გადახდის პირობები</option>{paymentPresets.map(term => <option key={term} value={term}>{term}</option>)}<option value="other">სხვა</option>
  </CustomSelect>{custom ? <input className="ma-input" aria-label="გადახდის სხვა პირობები" {...aria} required={required} maxLength={500} value={value} onChange={e => onChange(e.target.value)}/> : null}{name ? <input type="hidden" name={name} value={value}/> : null}</>;
}
