// Keep only text in this tab across navigation and sign-in. Never store photos or credentials.
const key = "meetany.requestDraft";
export type RequestDraft = {
  title: string; category: string; city: string; addressNote: string;
  quantity: string; unit: string; neededByText: string; body: string;
};
export function saveRequestDraft(draft: RequestDraft) {
  try { sessionStorage.setItem(key, JSON.stringify({ ...draft, at: Date.now() })); } catch { /* Storage may be disabled. */ }
}
export function readRequestDraft(): RequestDraft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) || "null");
    if (!draft || typeof draft.at !== "number" || Date.now() - draft.at > 30 * 60_000) return null;
    const fields = ["title", "category", "city", "addressNote", "quantity", "unit", "neededByText", "body"] as const;
    if (!fields.every(field => typeof draft[field] === "string")) return null;
    return draft;
  } catch { return null; }
}
export function clearRequestDraft() {
  try { sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
}
