"use client";
import { useEffect, useState } from "react";
import { AuthModal } from "./modals/AuthModal";
import { useMarketStore } from "../../lib/market-client";
import { toast, toastError } from "../Toasts";
import { useSessionReady } from "./ChatPopup";
import { Button } from "../ui/Button";

// Own key: the store's "meetany.saveIntent" is consumed as a company save during engagement refresh.
const INTENT_KEY = "meetany.saveRequestIntent";

/** Save/unsave logic shared by the detail-page button and the catalog cards (one AuthModal per page). */
export function useRequestSaving() {
 const { store, ready } = useMarketStore();
 const [authId, setAuthId] = useState<string | null>(null);
 const [pendingId, setPendingId] = useState<string | null>(null);
 // Read on click, not during render: the server has no location, and a differing prop breaks hydration.
 const [next, setNext] = useState("/requests/");
 const sessionReady = useSessionReady(store);
 const me = store?.currentUser();
 const state = store?.engagement();
 const savedIds: string[] = state?.savedRequestIds || [];
 const isSaved = (id: string) => savedIds.includes(id);
 const disabled = !ready || !sessionReady || !!me?.blocked;

 async function run(id: string, saved: boolean) {
  if (!store) return;
  setPendingId(id);
  try { await store.setSavedRequest(id, saved); toast(saved ? "მოთხოვნა შენახულია." : "მოთხოვნა შენახულებიდან ამოიშალა."); }
  catch (err) { toastError((err as { userMessage?: string }).userMessage || "შენახვა ვერ შესრულდა."); }
  finally { setPendingId(null); }
 }
 // A guest who pressed "save" is sent to log in and back here; finish the save once they return.
 useEffect(() => {
  if (authId || !store || !me || me.blocked || state?.status !== "ready") return;
  let intent: { id?: string; at?: number } | null = null;
  try { intent = JSON.parse(sessionStorage.getItem(INTENT_KEY) || "null"); } catch {}
  if (!intent?.id || Date.now() - (intent.at || 0) > 30 * 60000) return;
  try { sessionStorage.removeItem(INTENT_KEY); } catch {}
  if (!savedIds.includes(intent.id)) store.setSavedRequest(intent.id, true).then(() => toast("მოთხოვნა შენახულია."), (err: { userMessage?: string }) => toastError(err.userMessage || "შენახვა ვერ შესრულდა."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [store, me, state?.status, authId]);

 function toggle(id: string) {
  if (!store || pendingId) return;
  if (!me) {
   try { sessionStorage.setItem(INTENT_KEY, JSON.stringify({ id, at: Date.now() })); } catch { toast("შენახვისთვის შედით ანგარიშში."); }
   setNext(window.location.pathname + window.location.search);
   setAuthId(id); return;
  }
  if (state?.status !== "ready") { toastError("შენახვა დროებით მიუწვდომელია. სცადეთ მოგვიანებით."); return; }
  void run(id, !isSaved(id));
 }
 const authModal = <AuthModal open={!!authId} onClose={() => { setAuthId(null); try { sessionStorage.removeItem(INTENT_KEY); } catch {} }}
  onSuccess={() => { const id = authId; try { sessionStorage.removeItem(INTENT_KEY); } catch {} if (id && store && !store.currentUser()?.blocked) void run(id, true); }}
  intent="save-request" context={(authId && store?.getRequest(authId)?.title) || "მოთხოვნა"}
  next={next} />;
 return { isSaved, toggle, disabled, pendingId, authModal };
}

/** Labelled save toggle; the detail page shows it with the other quiet actions (ghost, small). */
export function SaveRequestButton({ id }: { id: string }) {
 const saving = useRequestSaving();
 const saved = saving.isSaved(id);
 return <>
  <Button variant="ghost" size="sm" aria-pressed={saved} aria-label={saved ? "შენახვის გაუქმება" : "მოთხოვნის შენახვა"} disabled={saving.disabled} loading={saving.pendingId === id} onClick={() => saving.toggle(id)}>
   <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15l-6.5-4-6.5 4V5A1.5 1.5 0 0 1 7 3.5Z" fill={saved ? "currentColor" : "none"} /></svg>
   <span>{saved ? "შენახულია" : "შენახვა"}</span>
  </Button>
  {saving.authModal}
 </>;
}
