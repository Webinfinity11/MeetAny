"use client";
import { Button } from "../ui/Button";

import { CustomSelect } from "../ui/CustomSelect";
import { useState } from "react";
import { useMarketStore } from "../../lib/market-client";
import { categories, categoryGroups, cities } from "../../lib/categories";
import styles from "./engagement.module.css";

// Whole groups read as the group name in the summary.
const summary = (keys: string[]) => categoryGroups.flatMap(g => {
  const own = g.items.map(([k]) => k).filter(k => keys.includes(k));
  return own.length === g.items.length && own.length > 1 ? [g.name] : own.map(k => categories[k]);
}).join(" · ");
type Preferences = { enabled: boolean; categories: string[]; cities: string[]; emailMode: string };
export function RequestAlertSettings({ initial, emailDelivery, profile }: { initial: Preferences; emailDelivery: boolean; profile?: { industry?: string; city?: string; serviceCities?: string[] } }) {
 const { store } = useMarketStore();
 const [draft, setDraft] = useState<Preferences>(() => ({ ...initial,
  categories: initial.categories.length ? initial.categories : profile?.industry ? [profile.industry] : [],
  cities: initial.cities.length ? initial.cities : profile?.serviceCities?.length ? profile.serviceCities : profile?.city ? [profile.city] : [],
 }));
 const [editing, setEditing] = useState(false);
 const [dirty, setDirty] = useState(false);
 const [pending, setPending] = useState(false);
 const [message, setMessage] = useState("");
 const [error, setError] = useState(false);
 function change(patch: Partial<Preferences>) { setDraft(d => ({...d,...patch}));setDirty(true);setMessage(""); }
 function toggle(field: "categories" | "cities", value: string) {
  let next = draft[field].includes(value) ? draft[field].filter(x => x !== value) : [...draft[field],value];
  if (field === "cities" && !draft.cities.includes(value)) next = value === "georgia" ? [value] : next.filter(x => x !== "georgia");
  change({[field]:next});
 }
 function toggleGroup(keys: string[]) {
  const all = keys.every(k => draft.categories.includes(k));
  change({categories: all ? draft.categories.filter(k => !keys.includes(k)) : [...new Set([...draft.categories, ...keys])]});
 }
 async function save(e: React.FormEvent) {
  e.preventDefault();setPending(true);setMessage("");setError(false);
  try {
   const saved = await store?.setRequestAlertPreferences(draft);
   if (!saved) throw new Error("unavailable");
   setDraft(saved);setDirty(false);setEditing(false);setMessage(saved.enabled ? "შენახულია — ახალ შესაბამის მოთხოვნებზე შეგატყობინებთ." : "ახალი მოთხოვნების შეტყობინებები გამორთულია.");
  } catch {setError(true);setMessage("პარამეტრები ვერ შეინახა. სცადე ხელახლა.");}
  finally {setPending(false);}
 }
 return <form className={styles.alertSettings} onSubmit={save} aria-label="ახალი მოთხოვნების შეტყობინებები">
  <div><h2 className="ma-h3">ახალი მოთხოვნები შენი დარგიდან</h2><p className={styles.meta}>შესაბამის ახალ მოთხოვნაზე ზარის ნიშნით შეგატყობინებთ.</p></div>
  <label className={styles.alertChoice}><input type="checkbox" checked={draft.enabled} disabled={pending} onChange={e => {change({enabled:e.target.checked});setEditing(e.target.checked);}}/> ახალ მოთხოვნებზე შემატყობინე</label>
  {draft.enabled && !editing ? <div className={styles.alertSummary}><p>{summary(draft.categories)}<br/>{draft.cities.map(key => cities[key]).join(" · ")}</p><Button type="button" variant="secondary" onClick={() => setEditing(true)}>პარამეტრების შეცვლა</Button></div> : null}
  {draft.enabled && editing ? <>
   <fieldset className={styles.alertFieldset} disabled={pending}><legend>კატეგორიები</legend><div className={styles.alertChoices}>{categoryGroups.map(g => { const keys = g.items.map(([k]) => k); return <div key={g.id}>
    {keys.length > 1 ? <label className={styles.alertChoice}><input type="checkbox" checked={keys.every(k => draft.categories.includes(k))} onChange={() => toggleGroup(keys)}/><strong>{g.name}</strong></label> : null}
    {g.items.map(([key,label]) => <label className={styles.alertChoice} key={key}><input type="checkbox" checked={draft.categories.includes(key)} onChange={() => toggle("categories",key)}/>{label}</label>)}
  </div>; })}</div></fieldset>
   <fieldset className={styles.alertFieldset} disabled={pending}><legend>სად შეგიძლია მომსახურება?</legend><div className={styles.alertChoices}>{Object.entries(cities).map(([key,label]) => <label className={styles.alertChoice} key={key}><input type="checkbox" checked={draft.cities.includes(key)} onChange={() => toggle("cities",key)}/>{label}</label>)}</div><p className={styles.meta}>მთელ საქართველოზე გამოქვეყნებული მოთხოვნებიც გამოჩნდება.</p></fieldset>
   <label className={styles.alertEmail}>ელფოსტით შეტყობინება<CustomSelect value={draft.emailMode} disabled={pending || !emailDelivery} onChange={e => change({emailMode:e.target.value})}><option value="off">მხოლოდ საიტზე</option><option value="instant">ყოველი ახალი მოთხოვნისას</option><option value="daily">დღეში ერთხელ — 20:00 საათზე</option></CustomSelect></label>
   {!emailDelivery ? <p className={styles.meta}>ელფოსტით გაგზავნა ჯერ არ არის ჩართული. საიტზე შეტყობინებებს მიიღებ.</p> : draft.emailMode === "daily" ? <p className={styles.meta}>შეჯამება თბილისის დროით მოვა, მხოლოდ ახალი მოთხოვნების არსებობისას.</p> : null}
   {(!draft.categories.length || !draft.cities.length) ? <p className={styles.meta}>აირჩიე მინიმუმ ერთი კატეგორია და ერთი ქალაქი.</p> : null}
  </> : null}
  <div className={styles.alertActions}>{dirty || editing ? <Button type="submit" variant="primary" disabled={pending || !dirty || (draft.enabled && (!draft.categories.length || !draft.cities.length))}>{pending ? "ინახება…" : "პარამეტრების შენახვა"}</Button> : null}{message ? <p role={error ? "alert" : "status"}>{message}</p> : null}</div>
 </form>;
}
