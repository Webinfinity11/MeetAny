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

// Signed-in accounts also keep one draft on the server (public.save_request_draft). It has no expiry.
export type ServerDraft = RequestDraft & { updatedAt?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DraftStore = Record<string, any>; // market Store: only callRpc(name, args) is used
const textFields = ["title", "category", "city", "addressNote", "quantity", "unit", "neededByText", "body"] as const;
export function readRequestDraftAt(): number {
  try {
    const at = JSON.parse(sessionStorage.getItem(key) || "null")?.at;
    return typeof at === "number" ? at : 0;
  } catch { return 0; }
}
export async function loadServerDraft(store: DraftStore): Promise<ServerDraft | null> {
  const row = await store.callRpc("my_request_draft", {}) as { data?: Record<string, unknown>; updatedAt?: string } | null;
  const data = row?.data;
  if (!data || typeof data !== "object") return null;
  const text = (field: string, fallback = "") => typeof data[field] === "string" ? data[field] as string : fallback;
  const draft: ServerDraft = {
    title: text("title"), category: text("category"), city: text("city", "tbilisi"), addressNote: text("addressNote"),
    quantity: text("quantity"), unit: text("unit", "pcs"), neededByText: text("neededByText"), body: text("body"),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
  };
  if (data.preferences && typeof data.preferences === "object") draft.preferences = data.preferences as RequestDraft["preferences"];
  if (typeof data.attachmentDraft === "string") draft.attachmentDraft = data.attachmentDraft;
  return hasRequestDraftContent(draft) ? draft : null;
}
export async function saveServerDraft(store: DraftStore, draft: RequestDraft): Promise<string | undefined> {
  const data: Record<string, unknown> = {};
  for (const field of textFields) data[field] = draft[field];
  if (draft.preferences) data.preferences = draft.preferences;
  if (draft.attachmentDraft) data.attachmentDraft = draft.attachmentDraft;
  const row = await store.callRpc("save_request_draft", { p_data: data }) as { updatedAt?: string } | null;
  return row?.updatedAt;
}
export async function deleteServerDraft(store: DraftStore) {
  await store.callRpc("delete_request_draft", {});
}
