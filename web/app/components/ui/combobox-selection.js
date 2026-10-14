/** Preserve serialized values; the exclusive option cannot coexist with others. */
export function toggleSelection(values, value, limit, exclusiveValue) {
  if (values.includes(value)) return values.filter(item => item !== value);
  const next = value === exclusiveValue ? [] : values.filter(item => item !== exclusiveValue);
  return next.length < limit ? [...next, value] : values;
}
export function creationValue(query, options, values, maxLength) {
  const value = query.trim();
  const normalized = value.toLocaleLowerCase();
  return value && value.length <= maxLength && !options.some(option => option.label.toLocaleLowerCase() === normalized || option.value.toLocaleLowerCase() === normalized) && !values.some(item => item.toLocaleLowerCase() === normalized) ? value : '';
}
