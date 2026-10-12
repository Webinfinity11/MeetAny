const MONTHS = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
];

const SHORT_MONTHS = ["იანვ.", "თებ.", "მარტი", "აპრ.", "მაისი", "ივნ.", "ივლ.", "აგვ.", "სექტ.", "ოქტ.", "ნოემ.", "დეკ."];
// Non-breaking space: "1 920 ₾" and "8 ოქტ. 2026" never wrap mid-value.
const NBSP = " ";
// Asia/Tbilisi is UTC+4 all year (no DST since 2005), so a fixed offset is exact and needs no ICU.
const TBILISI_OFFSET_MS = 4 * 3600000;

type DateParts = { y: number; m: number; d: number; time: string | null };
// Accepts a plain "YYYY-MM-DD" (taken as-is) or a full ISO timestamp (shown in Tbilisi time).
function dateParts(value: string | null | undefined): DateParts | null {
  const text = String(value || "").trim();
  const plain = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plain) return { y: Number(plain[1]), m: Number(plain[2]), d: Number(plain[3]), time: null };
  const t = Date.parse(text);
  if (!text || Number.isNaN(t)) return null;
  const local = new Date(t + TBILISI_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(), time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}` };
}

/** "8 ოქტ. 2026"; "" when the value is missing or not a date. */
export function dateShort(value: string | null | undefined): string {
  const p = dateParts(value);
  return p ? `${p.d}${NBSP}${SHORT_MONTHS[p.m - 1]}${NBSP}${p.y}` : "";
}

/** "8 ოქტომბერი 2026"; "" when the value is missing or not a date. */
export function dateLong(value: string | null | undefined): string {
  const p = dateParts(value);
  return p ? `${p.d}${NBSP}${MONTHS[p.m - 1]}${NBSP}${p.y}` : "";
}

/** "8 ოქტ. 2026, 14:08" in Tbilisi time; a plain date has no time and reads as dateShort. */
export function dateTime(value: string | null | undefined): string {
  const p = dateParts(value);
  return !p ? "" : p.time ? `${dateShort(value)}, ${p.time}` : dateShort(value);
}

/** @deprecated Use dateLong. */
export const dateLabel: (value: string) => string = dateLong;

const SINCE_MONTHS = ["იანვრიდან", "თებერვლიდან", "მარტიდან", "აპრილიდან", "მაისიდან", "ივნისიდან", "ივლისიდან", "აგვისტოდან", "სექტემბრიდან", "ოქტომბრიდან", "ნოემბრიდან", "დეკემბრიდან"];

// "2026 წლის სექტემბრიდან" — month and year of a timestamp, for "on the site since".
export function sinceMonthLabel(value: string): string | null {
  const [y, m] = String(value || "").slice(0, 7).split("-").map(Number);
  return y && m ? `${y} წლის ${SINCE_MONTHS[m - 1]}` : null;
}

// "დღეს" / "გუშინ" / "3 დღის წინ" — calendar days between a timestamp and `now` (local time).
export function postedLabel(value: string, now: number): string | null {
  const created = Date.parse(value);
  if (!now || Number.isNaN(created)) return null;
  const day = (t: number) => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  const days = Math.max(0, Math.round((day(now) - day(created)) / 86400000));
  return days === 0 ? "დღეს" : days === 1 ? "გუშინ" : `${days} დღის წინ`;
}

// "2 000" / "1 250.5" — deterministic digit grouping (non-breaking space) for numbers that render on the server too.
// toLocaleString("ka-GE") differs between Node's ICU and the browser (2000 vs 2,000) and breaks hydration.
export function formatNumber(value: number, maxFractionDigits = 2): string {
  if (!Number.isFinite(value)) return "";
  const factor = 10 ** maxFractionDigits;
  const rounded = Math.round(Math.abs(value) * factor) / factor;
  const [whole, fraction = ""] = String(rounded).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${value < 0 && rounded ? "-" : ""}${grouped}${fraction ? "." + fraction : ""}`;
}

/** "1 920 ₾" / "1 250.5 ₾"; `empty` when there is no amount. */
export function money(value: number | null | undefined, empty = "შეთანხმებით"): string {
  return value == null || !Number.isFinite(value) ? empty : `${formatNumber(value)}${NBSP}₾`;
}

// Keeps a street abbreviation with its number: "გორგილაძის ქ. 31" never breaks after "ქ.".
export function addressLabel(value: string): string {
  return value.replace(/(ქ\.|გამზ\.|ჩიხი|შესახ\.)\s+(?=\d)/g, "$1 ");
}
