// Shared helpers for the admin panel.
import { dateLabel, money } from "./format";

/** "8 ოქტომბერი 2026 · 14:08" in Tbilisi time — the one date-time format of the admin. */
export function adminDateTime(value: string) {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  return `${dateLabel(value)} · ${time}`;
}

/** "1 920 ₾" (lib/format money); no amount is "შეთანხმებით". */
export const adminMoney = (value: number | string | null | undefined) =>
  money(value == null || value === "" ? null : Number(value));

/** Verification has one term and four states, read from the documents status (and the verified flag). */
export const verificationLabels: Record<string, string> = {
  not_submitted: "დოკუმენტები არ არის", pending: "განსახილველი", approved: "ვერიფიცირებული", rejected: "დაბრუნებული",
};
type CompanyState = { catalog_hidden?: boolean; role?: string; verified?: boolean; blocked?: boolean; verification_documents_status?: string | null };
export function companyStatus(u: CompanyState): { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" } {
  if (u.blocked) return { label: "დაბლოკილი", tone: "danger" };
  if (u.role !== "company") return { label: "აქტიური", tone: "info" };
  if (u.catalog_hidden) return { label: "დამალული", tone: "neutral" };
  if (u.verified) return { label: verificationLabels.approved, tone: "success" };
  const docs = u.verification_documents_status || "not_submitted";
  return docs === "pending" ? { label: verificationLabels.pending, tone: "warning" }
    : docs === "rejected" ? { label: verificationLabels.rejected, tone: "neutral" }
    : { label: verificationLabels.not_submitted, tone: "neutral" };
}

export const accountIntentLabels: Record<string, string> = { buy: "ყიდულობს", sell: "ყიდის", both: "ყიდულობს და ყიდის" };

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

/** Result text shared by single-record and bulk moderation feedback. */
export function adminActionResult(action: string, company = false): string {
  const results: Record<string, string> = {
    "reportHide.request": "მოთხოვნა დაიმალა; საჩივრები დამუშავდა",
    "reportHide.offer": "შეთავაზება წაიშალა; საჩივრები დამუშავდა",
    "reportHide.company": "კომპანია დაიბლოკა; საჩივრები დამუშავდა",
    reportReject: "მომართვა უარყოფილია", removePhoto: "ფოტო წაიშალა",
    hide: "მოთხოვნა დაიმალა", unhide: "მოთხოვნა გამოჩნდა", delete: "მოთხოვნა წაიშალა",
    deleteOffer: "შეთავაზება წაიშალა",
    block: company ? "კომპანია დაიბლოკა" : "ანგარიში დაიბლოკა",
    unblock: company ? "კომპანია განიბლოკა" : "ანგარიში განიბლოკა",
    verify: "კომპანია ვერიფიცირებულია", unverify: "ვერიფიკაცია მოიხსნა",
    approveDocs: "დოკუმენტები დადასტურდა; კომპანია ვერიფიცირებულია",
    returnDocs: "დოკუმენტები შესწორებისთვის დაბრუნდა",
    hideReview: "შეფასება დაიმალა", publishReview: "შეფასება აღდგა",
    dealStage: "გარიგების ეტაპი შეიცვალა", dealCancel: "გარიგება გაუქმდა",
    resolveIssue: "პრობლემის განხილვა დასრულდა",
  };
  return results[action] || "მოქმედება შესრულდა";
}
