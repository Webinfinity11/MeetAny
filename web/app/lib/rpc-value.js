/** PostgreSQL arrays and JSON arrays have different wire representations. */
export function rpcValue(value, type) {
  if (value === null) return null;
  if (type === 'json' || type === 'jsonb') return JSON.stringify(value);
  return typeof value === 'object' && !Array.isArray(value) ? JSON.stringify(value) : value;
}
