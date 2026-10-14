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

/** Keep complete tokens in two flex rows, reserving space for the overflow count. */
export function visibleTokenCount(widths, availableWidth, gap, summaryWidth) {
  if (availableWidth <= 0) return widths.length;
  const fits = items => {
    let row = 1, used = 0;
    for (const width of items) {
      const size = Math.min(width, availableWidth);
      if (used && used + gap + size > availableWidth + 0.5) { row++; used = size; }
      else used += (used ? gap : 0) + size;
      if (row > 2) return false;
    }
    return true;
  };
  if (fits(widths)) return widths.length;
  for (let count = widths.length - 1; count >= 0; count--) {
    if (fits([...widths.slice(0, count), summaryWidth])) return count;
  }
  return 0;
}
