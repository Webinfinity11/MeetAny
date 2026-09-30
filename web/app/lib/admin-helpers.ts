// Shared helpers for the admin panel.

type Person = { name?: string | null; company?: string | null; email?: string | null };

/** QA/demo accounts: e2e runners, local test mail and the "სატესტო" seed accounts. They stay in
 *  the database; the admin lists hide them by default so real people are not lost among them. */
export function isTestAccount(u: Person | null | undefined) {
  if (!u) return false;
  const text = `${u.name || ""} ${u.company || ""} ${u.email || ""}`;
  return /\be2e\b|e2e[:-]|@meetany\.local\b|სატესტო|\btest\b/i.test(text);
}

/** Day keys (YYYY-MM-DD, local time) for the last `days` days, oldest first. */
export function lastDays(days: number, now = new Date()) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    return dayKey(d);
  });
}

export function dayKey(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Counts per day for the given window; dates outside it are ignored. */
export function perDay(dates: (string | null | undefined)[], days: string[]) {
  const counts = new Map(days.map(d => [d, 0]));
  for (const value of dates) {
    if (!value) continue;
    const key = dayKey(value);
    if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return days.map(d => ({ day: d, count: counts.get(d) || 0 }));
}

/** Items created within the last `days` days, and in the `days` before that. */
export function windowCounts(dates: (string | null | undefined)[], days: number, now = Date.now()) {
  const span = days * 86_400_000;
  let current = 0, previous = 0;
  for (const value of dates) {
    const t = value ? Date.parse(value) : NaN;
    if (!Number.isFinite(t)) continue;
    const age = now - t;
    if (age >= 0 && age < span) current++;
    else if (age >= span && age < 2 * span) previous++;
  }
  return { current, previous };
}

/** CSV with a UTF-8 BOM so Excel opens Georgian text correctly; every cell is quoted, and text a
 *  spreadsheet would run as a formula (user-written titles starting with = + - @) gets a leading '. */
export function downloadCsv(filename: string, rows: (string | number | boolean | null | undefined)[][]) {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const text = rows.map(row => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads every page of an admin search (100 per call) for export. */
export async function readAllAdminPages<T>(search: (args: Record<string, unknown>) => Promise<{ items: T[]; hasMore: boolean; nextCursor: unknown }>, args: Record<string, unknown>, cap = 5000) {
  const items: T[] = [];
  let cursor: unknown = null;
  do {
    const page = await search({ ...args, p_cursor: cursor, p_limit: 100 });
    items.push(...page.items);
    cursor = page.hasMore ? page.nextCursor : null;
  } while (cursor && items.length < cap);
  return items;
}
