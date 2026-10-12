// Keep only text in this tab across navigation and sign-in. Never store photos or credentials.
const key = "meetany.requestDraft";
export type RequestDraft = {
  preferences?: import("../components/market/RequestPreferences").RequestPreferences; attachmentDraft?:string;
  title: string; category: string; city: string; addressNote: string;
  quantity: string; unit: string; neededByText: string; body: string;
};
export function hasRequestDraftContent(draft: RequestDraft) {
  // City and unit have defaults even when the user has not started a request.
  return [draft.title, draft.category, draft.addressNote, draft.quantity, draft.neededByText, draft.body].some(value => value.trim()) || Object.values(draft.preferences||{}).some(value=>Array.isArray(value)?value.length>0:typeof value==='string'?!!value.trim()&&value!=='negotiable':typeof value==='number'?value>0:value===true);
}
export function saveRequestDraft(draft: RequestDraft) {
  if (!hasRequestDraftContent(draft)) { clearRequestDraft(); return; }
  try { sessionStorage.setItem(key, JSON.stringify({ ...draft, at: Date.now() })); } catch { /* Storage may be disabled. */ }
}
export function readRequestDraft(): RequestDraft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) || "null");
    if (!draft || typeof draft.at !== "number" || Date.now() - draft.at > 30 * 60_000) return null;
    const fields = ["title", "category", "city", "addressNote", "quantity", "unit", "neededByText", "body"] as const;
    if (!fields.every(field => typeof draft[field] === "string")) return null;
    if (!hasRequestDraftContent(draft)) return null;
    return draft;
  } catch { return null; }
}
export function clearRequestDraft() {
  try { sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
}
