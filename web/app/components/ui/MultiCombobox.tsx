'use client';
import { Selection, type SelectionProps } from './Combobox';
export type MultiComboboxProps = Omit<SelectionProps, 'multiple' | 'values'> & { value: string[] };
export function MultiCombobox({ value, ...props }: MultiComboboxProps) {
  return <Selection {...props} values={value} multiple />;
}
