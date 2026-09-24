// "5 ოქტომბრამდე" — the "-მდე" (until) declension of each Georgian month name, used for a
// request's neededBy date. Kept separate from any nominative month list.
const UNTIL_MONTHS = [
  "იანვრამდე",
  "თებერვლამდე",
  "მარტამდე",
  "აპრილამდე",
  "მაისამდე",
  "ივნისამდე",
  "ივლისამდე",
  "აგვისტომდე",
  "სექტემბრამდე",
  "ოქტომბრამდე",
  "ნოემბრამდე",
  "დეკემბრამდე",
];

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

export function neededByLabel(value: string): string {
  const [, m, d] = value.split("-").map(Number);
  return `${d} ${UNTIL_MONTHS[m - 1]}`;
}

export function dateLabel(value: string): string {
  // Accepts a plain "YYYY-MM-DD" or a full ISO timestamp (e.g. profiles' created_at/verified_at).
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}, ${y}`;
}

// "დღეს" / "გუშინ" / "3 დღის წინ" — calendar days between a timestamp and `now` (local time).
export function postedLabel(value: string, now: number): string | null {
  const created = Date.parse(value);
  if (!now || Number.isNaN(created)) return null;
  const day = (t: number) => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  const days = Math.max(0, Math.round((day(now) - day(created)) / 86400000));
  return days === 0 ? "დღეს" : days === 1 ? "გუშინ" : `${days} დღის წინ`;
}

// Keeps a street abbreviation with its number: "გორგილაძის ქ. 31" never breaks after "ქ.".
export function addressLabel(value: string): string {
  return value.replace(/(ქ\.|გამზ\.|ჩიხი|შესახ\.)\s+(?=\d)/g, "$1 ");
}
