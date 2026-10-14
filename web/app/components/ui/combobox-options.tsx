import { categories, categoryGroups, cities } from '../../lib/categories';
import { CategoryIcon } from './CategoryIcon';
import type { ComboboxOption } from './Combobox';

export const categoryOptions: ComboboxOption[] = categoryGroups.flatMap(group => group.items.map(([value, label]) => ({ value, label, group: group.name, icon: <CategoryIcon id={value} /> })));
export const categoryTextOptions: ComboboxOption[] = categoryOptions.map(option => ({ ...option, value: option.label }));
export const cityOptions: ComboboxOption[] = Object.entries(cities).map(([value, label]) => ({ value, label }));
export const textOptions = (values: string[]): ComboboxOption[] => [...new Set(values)].map(value => ({ value, label: value }));
export const categoryLimit = Object.keys(categories).length;
