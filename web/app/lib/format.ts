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
  const [y, m, d] = value.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}, ${y}`;
}
