"use client";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import { registrationToken } from "../../lib/registration-telemetry";
import styles from "./analytics.module.css";
type Data = { enabled: boolean; trackingStartedAt?: string; sessions: number; started: number; submitted: number; completed: number; active: number; stalled: number; lastStages: {stage:string;count:number;stalled:number}[];sources?:{source:string;sessions:number;completed:number}[];devices?:{device:string;sessions:number;completed:number}[] };
const labels: Record<string,string> = { form_open:"ფორმა გახსნა",form_started:"შევსება დაიწყო",form_submitted:"ფორმა გაგზავნა",email_pending:"ელფოსტას ადასტურებს",profile_created:"პროფილი შეიქმნა" };
const sourceLabels:Record<string,string>={direct:"პირდაპირ",header:"მთავარი მენიუ",request:"მოთხოვნიდან",company:"კომპანიის გვერდიდან",account:"ანგარიშიდან",unknown:"უცნობი"};
const deviceLabels:Record<string,string>={mobile:"მობილური",tablet:"ტაბლეტი",desktop:"კომპიუტერი",unknown:"უცნობი"};

export function AdminRegistrationAnalytics() {
  const [role,setRole] = useState("all");
  const [days,setDays] = useState(30);
  const [revision,setRevision] = useState(0);
  const [resource,setResource] = useState<{key:string;data?:Data;error?:boolean}>({key:""});
  const key = `${role}:${days}:${revision}`;
  const current = resource.key === key ? resource : null;
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const token = await registrationToken();
      if (!token) throw new Error("authentication");
      const response = await fetch(`/api/analytics/registration?days=${days}&role=${role}`, { cache:"no-store",signal:controller.signal,headers:{Authorization:`Bearer ${token}`} });
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json() as Data;
      if (!controller.signal.aborted) setResource({key,data});
    };
    void load().catch(() => { if (!controller.signal.aborted) setResource({key,error:true}); });
    return () => controller.abort();
  }, [role,days,key]);
  const data = current?.data;
  const conversion = data?.sessions ? Math.round(data.completed/data.sessions*100) : null;
  return <section className={styles.registration} aria-labelledby="registration-analytics-title">
    <header className={styles.sectionHead}><div><h2 id="registration-analytics-title">რეგისტრაციის გზა</h2><p>გახსნიდან დასრულებამდე</p></div><div className={styles.filters}>
      <label><span className="ma-sr-only">ანგარიშის ტიპი</span><CustomSelect aria-label="ანგარიშის ტიპი" value={role} onChange={event=>setRole(event.target.value)}><option value="all">ყველა ტიპი</option><option value="company">კომპანია</option><option value="client">კლიენტი</option></CustomSelect></label>
      <label><span className="ma-sr-only">პერიოდი</span><CustomSelect aria-label="პერიოდი" value={days} onChange={event=>setDays(Number(event.target.value))}><option value={7}>7 დღე</option><option value={30}>30 დღე</option><option value={90}>90 დღე</option></CustomSelect></label>
    </div></header>
    {!current ? <div className={styles.empty} role="status">ანალიტიკა იტვირთება…</div> : current.error ? <div className={styles.empty} role="alert"><span>ანალიტიკა ვერ ჩაიტვირთა.</span><Button variant="secondary" onClick={()=>setRevision(value=>value+1)}>ხელახლა ცდა</Button></div> : !data?.enabled ? <div className={styles.empty}><strong>ეტაპების აღრიცხვა ჯერ არ არის ჩართული</strong><span>აქტივაციის შემდეგ აქ გამოჩნდება, რომელ ეტაპზე ჩერდება რეგისტრაცია.</span></div> : <>
      <div className={styles.funnel}>{([['form_open',data.sessions],['form_started',data.started],['form_submitted',data.submitted],['profile_created',data.completed]] as [string,number][]).map(([stage,count],index)=><div className={styles.step} key={stage}><span className={styles.stepNumber}>{index+1}</span><span>{labels[stage]}</span><strong>{count}</strong><div className={styles.track} aria-hidden="true"><span style={{width:`${data.sessions ? Math.min(100,count/data.sessions*100) : 0}%`}}/></div></div>)}</div>
      <div className={styles.summary}><span>დასრულდა <strong>{conversion === null ? "—" : `${conversion}%`}</strong></span><span>მიმდინარეობს <strong>{data.active}</strong></span><span>შეჩერებულია <strong>{data.stalled}</strong></span></div>
      <details className={styles.details}><summary>ბოლო გავლილი ეტაპი</summary><div className={styles.stageRows}>{data.lastStages.map(row=><div key={row.stage}><span>{labels[row.stage]}</span><strong>{row.count}</strong><small>{row.stalled ? `${row.stalled} შეჩერებული` : "—"}</small></div>)}</div></details>
      <details className={styles.details}><summary>საიდან და რომელი მოწყობილობით</summary><div className={styles.attribution}>{[["საწყისი",data.sources||[],"source",sourceLabels],["მოწყობილობა",data.devices||[],"device",deviceLabels]].map(([title,rows,key,names])=><div key={String(title)}><h3>{String(title)}</h3>{(rows as {source?:string;device?:string;sessions:number;completed:number}[]).length?(rows as {source?:string;device?:string;sessions:number;completed:number}[]).map(row=><div key={row[key as "source"|"device"]}><span>{(names as Record<string,string>)[row[key as "source"|"device"]||"unknown"]}</span><strong>{row.sessions}</strong><small>{row.completed} დასრულდა</small></div>):<p>მონაცემები ჯერ არ არის.</p>}</div>)}</div></details>
      <details className={styles.details}><summary>აღრიცხვის წესები</summary><p>ითვლება რეგისტრაციის მცდელობები, მომხმარებლების რაოდენობის ნაცვლად. შეჩერებულია მცდელობა, რომელსაც 30 წუთია ახალი ეტაპი არ გაუვლია; დაბრუნება შესაძლებელია. დასრულება სერვერზე შექმნილი პროფილით დასტურდება. ელფოსტა, ტელეფონი და ფორმის შიგთავსი არ ინახება.</p><p>ბრაუზერის ეტაპები მიახლოებითი მონაცემია და შეიძლება არ აღირიცხოს. ძველი რეგისტრაციების ნაბიჯები არ არის აღდგენილი. {data.trackingStartedAt ? `აღრიცხვის დასაწყისი: ${new Date(data.trackingStartedAt).toLocaleDateString("ka-GE",{timeZone:"Asia/Tbilisi"})}.` : ""}</p></details>
    </>}
  </section>;
}
