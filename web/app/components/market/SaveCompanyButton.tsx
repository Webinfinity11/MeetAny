"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMarketStore } from "../../lib/market-client";
import { toast } from "../Toasts";
import styles from "./engagement.module.css";

export function SaveCompanyButton({ id }: { id: string }) {
 const { store, ready } = useMarketStore();
 const router = useRouter();
 const [pending, setPending] = useState(false);
 const me = store?.currentUser();
 const state = store?.engagement();
 const saved = !!state?.savedIds?.includes(id);
 async function toggle() {
  if (!store || pending) return;
  if (!me) {
   try { sessionStorage.setItem("meetany.saveIntent", JSON.stringify({ id, at: Date.now() })); } catch { toast("შენახვისთვის შედი ანგარიშში."); }
   router.push("/account/?tab=saved");return;
  }
  if (state?.status !== "ready") { toast("შენახვა დროებით მიუწვდომელია. სცადე მოგვიანებით.");return; }
  setPending(true);
  try { await store.setSavedCompany(id, !saved); toast(saved ? "კომპანია შენახულებიდან ამოიშალა." : "კომპანია შენახულია."); }
  catch (err) { toast((err as {userMessage?: string}).userMessage || "შენახვა ვერ შესრულდა."); }
  finally { setPending(false); }
 }
 return <button type="button" className={`${styles.save} ${styles.saveLabel}`} aria-pressed={saved} aria-label={saved ? "შენახვის გაუქმება" : "კომპანიის შენახვა"} title={saved ? "შენახულია" : "შენახვა"} disabled={!ready || pending || !!me?.blocked} onClick={toggle}>
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15l-6.5-4-6.5 4V5A1.5 1.5 0 0 1 7 3.5Z" fill={saved ? "currentColor" : "none"}/></svg><span>{saved ? "შენახულია" : "შენახვა"}</span>
 </button>;
}
