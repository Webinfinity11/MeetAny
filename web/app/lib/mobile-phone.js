// One Georgian mobile format for registration validation and profile storage.
export function normalizeMobilePhone(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  const local = digits.startsWith('995') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  if (!/^5\d{8}$/.test(local)) return null;
  return '+995 ' + local.slice(0, 3) + ' ' + local.slice(3, 6) + ' ' + local.slice(6);
}
