"use client";
import { useState } from "react";
import { Button } from "../ui/Button";
import { useBusinessResource } from "../../lib/business-client";
import type { Store } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { AdminState } from "./AdminState";
import { ListSkeleton } from "./Skeletons";
import styles from "./admin.module.css";
type Metrics = { withoutOffers: number; averageFirstOfferHours: number | null; completed: number; chosen: number; chosenShare: number | null; gaps: {category:string;city:string;requests:number;companies:number}[] };
export function AdminMarketMetrics({store}:{store:Store}) {
 const [limit,setLimit]=useState(5);
 const resource=useBusinessResource<Metrics>(store.adminMarketMetrics, String(store.dataRevision()));
 const data=resource.data;
 return <section className={styles.panel} aria-labelledby="market-metrics-heading">
  <header className={styles.panelHead}><h2 id="market-metrics-heading">მოთხოვნა და მომწოდებლები</h2></header>
  {resource.error?<AdminState error title="ანალიტიკა ვერ ჩაიტვირთა" text={resource.error} onRetry={resource.reload}/>:!data?<ListSkeleton compact kind="records"/>:<>
   <div className={styles.metricStrip}>
    <div className={styles.metric}><span>უპასუხო ღია მოთხოვნები</span><strong className={styles.kpiValue}>{data.withoutOffers}</strong></div>
    <div className={styles.metric}><span>პირველ შეთავაზებამდე საშუალო დრო</span><strong className={styles.kpiValue}>{data.averageFirstOfferHours===null?'—':`${data.averageFirstOfferHours} სთ`}</strong></div>
    <div className={styles.metric}><span>მომწოდებლის არჩევის წილი</span><strong className={styles.kpiValue}>{data.chosenShare===null?'—':`${data.chosenShare}%`}</strong><small>{data.chosen} არჩევა · {data.completed} დასრულებული ან ვადაგასული მოთხოვნა</small></div>
   </div>
   <details className={styles.disclosure}><summary><span>სად არის მეტი მომწოდებელი საჭირო?</span><span className={styles.disclosureCount}>{data.gaps.length} მიმართულება</span></summary><div className={styles.disclosureBody}>
   <p className={styles.note}>დარგისა და ქალაქის მიხედვით — ჯერ ის მიმართულებები, სადაც შესაბამისი კომპანიების რაოდენობა მცირეა. შესაბამისობა ეფუძნება საქმიანობასა და მომსახურების რეგიონს.</p>
   {!data.gaps.length?<p className={styles.note}>ღია მოთხოვნები ჯერ არ არის.</p>:<div className="ma-table-wrap"><table className="ma-table"><caption className="ma-sr-only">კატეგორია და ქალაქი — ნაკლები მომწოდებლით დაწყებული</caption><thead><tr><th scope="col">დარგი · ქალაქი</th><th scope="col">ღია მოთხოვნა</th><th scope="col">შესაბამისი კომპანიები</th></tr></thead><tbody>{data.gaps.slice(0,limit).map(g=><tr key={`${g.category}:${g.city}`}><td data-label="დარგი · ქალაქი">{categories[g.category]||g.category} · {cities[g.city]||g.city}</td><td data-label="ღია მოთხოვნა">{g.requests}</td><td data-label="შესაბამისი კომპანიები"><span className={`ma-badge ma-badge--${g.companies===0?'warning':'neutral'}`}>{g.companies}</span></td></tr>)}</tbody></table></div>}
   {data.gaps.length>limit?<Button variant="secondary" onClick={()=>setLimit(n=>n+5)}>მეტის ნახვა · {data.gaps.length-limit} დარჩა</Button>:null}
   </div></details>
   <details className={styles.methodology}><summary>როგორ ითვლება ეს მაჩვენებლები?</summary><p className={styles.note}>ითვლება ხილული მოთხოვნები აქტიური ავტორებით. წილი გამოითვლება დახურული, ვადაგასული და მომწოდებლის არჩევით დასრულებული მოთხოვნებიდან; იგი არ ნიშნავს გადახდილ ან მიწოდებულ შეკვეთას. გაუქმებული შეთავაზებები არ ითვლება.</p></details>
  </>}
 </section>;
}
