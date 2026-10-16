"use client";
import { useEffect, useState } from 'react';
import { useMarketStore } from '../../lib/market-client';
import { Button } from '../ui/Button';
import { CustomSelect } from '../ui/CustomSelect';
import { dateLabel } from '../../lib/format';
import styles from './analytics.module.css';

type State = 'complete' | 'active' | 'deferred' | 'inactive' | 'unobserved';
type Data = {
 total: number; completed: number; active: number; deferred: number; inactive: number; unobserved: number;
 resumed: number; requests: number; offers: number; deals: number;
 stages: { step: string; count: number; deferred: number }[];
 recent: { id: string; company: string; last_step: string; last_activity_at: string; state: State; resume_count: number }[];
};
const steps: Record<string, string> = { type: 'ტიპი', details: 'მონაცემები', profile: 'პროფილი', provide: 'პროდუქტები', need: 'საჭიროებები', verify: 'ვერიფიკაცია', review: 'გადახედვა' };
const states: Record<State, string> = { complete: 'დასრულებულია', active: 'მიმდინარეობს', deferred: 'მოგვიანებით გააგრძელებს', inactive: '30 წუთზე მეტია უმოქმედოა', unobserved: 'ეტაპი არ აღრიცხულა' };
export function AdminOnboardingAnalytics() {
 const { store } = useMarketStore();
 const [days, setDays] = useState(30), [revision, setRevision] = useState(0);
 const [resource, setResource] = useState<{ key: string; data?: Data; error?: boolean }>();
 const key = `${days}:${revision}`, current = resource?.key === key ? resource : undefined;
 const call = store?.callRpc;
 useEffect(() => {
  if (!call) return;
  let active = true;
  void call('admin_onboarding_analytics', { p_days: days }).then((data: Data) => { if (active) setResource({ key, data }); }, () => { if (active) setResource({ key, error: true }); });
  return () => { active = false; };
 }, [call, days, key]);
 const data = current?.data;
 return <section className={styles.registration} aria-labelledby="setup-analytics-title">
  <header className={styles.sectionHead}><div><h2 id="setup-analytics-title">კომპანიის პროფილის შევსება</h2><p>რეგისტრაციის შემდეგ გავლილი ეტაპები</p></div><CustomSelect aria-label="პროფილის შევსების პერიოდი" value={days} onChange={e => setDays(Number(e.target.value))}>{[7,30,90].map(n => <option key={n} value={n}>{n} დღე</option>)}</CustomSelect></header>
  {!current ? <p role="status">იტვირთება…</p> : current.error ? <div className={styles.empty} role="alert"><p>პროგრესი ვერ ჩაიტვირთა.</p><Button variant="secondary" onClick={() => setRevision(n => n + 1)}>ხელახლა ცდა</Button></div> : data ? <>
   <div className={styles.summary}>{([['complete',data.completed],['active',data.active],['deferred',data.deferred],['inactive',data.inactive]] as [State,number][]).map(([state,count]) => <span key={state} className={`ma-badge ma-badge--${state === 'complete' ? 'success' : state === 'inactive' ? 'warning' : 'neutral'}`}>{states[state]} <strong>{count}</strong></span>)}</div>
   <p className={styles.setupNote}>დაუბრუნდა შევსებას: <strong>{data.resumed}</strong> · ეტაპი არ აღრიცხულა: <strong>{data.unobserved}</strong></p>
   <details className={styles.details}><summary>რომელ ეტაპამდე მივიდნენ</summary><div className={styles.stageRows}>{data.stages.map(row => <div key={row.step}><span>{steps[row.step]}</span><strong>{row.count}</strong><small>{row.deferred ? `${row.deferred} გადადო` : ''}</small></div>)}</div></details>
   <details className={styles.details}><summary>ბოლო აქტივობა ({data.recent.length})</summary><ul className={styles.setupActivity}>{data.recent.map(row => <li key={row.id}><Button variant="ghost" href={`/admin/?tab=companies&q=${encodeURIComponent(row.id)}`}>{row.company}</Button><span>{steps[row.last_step]} · {states[row.state]}</span><time dateTime={row.last_activity_at}>{dateLabel(row.last_activity_at)} · {new Date(row.last_activity_at).toLocaleTimeString('ka-GE',{timeZone:'Asia/Tbilisi',hour:'2-digit',minute:'2-digit',hour12:false})}</time>{row.resume_count > 0 && <small>დაბრუნდა {row.resume_count}-ჯერ</small>}</li>)}</ul></details>
   <div className={styles.summary}><span>გამოაქვეყნა მოთხოვნა <strong>{data.requests}</strong></span><span>გაგზავნა შეთავაზება <strong>{data.offers}</strong></span><span>დაიწყო გარიგება <strong>{data.deals}</strong></span></div>
   <details className={styles.details}><summary>როგორ ითვლება</summary><p>რეგისტრაცია და კომპანიის პროფილის შევსება ცალ-ცალკე ითვლება. პროდუქტის ან დოკუმენტის არქონა წარუმატებლობას არ ნიშნავს. „მოგვიანებით“ მომხმარებლის არჩევანია; უმოქმედობა — 30-წუთიანი პაუზა, არა დადასტურებული მიტოვება.</p><p>დასრულება და ბიზნესმოქმედებები ბაზაში შენახული ჩანაწერებით დასტურდება. ეტაპები ბრაუზერიდან აღირიცხება; ძველი ეტაპები არ აღდგება. თითო კომპანია ერთხელ ითვლება; აქ ჩანს ბოლო 30 აქტიური პროფილი.</p></details>
  </> : null}
 </section>;
}
