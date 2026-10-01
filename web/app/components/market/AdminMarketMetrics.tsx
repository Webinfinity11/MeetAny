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
 const [limit,setLimit]=useState(8);
 const resource=useBusinessResource<Metrics>(store.adminMarketMetrics, String(store.dataRevision()));
 const data=resource.data;
 return <section className={styles.panel} aria-labelledby="market-metrics-heading">
  <header className={styles.panelHead}><h2 id="market-metrics-heading">მიწოდება და მოთხოვნა</h2></header>
  {resource.error?<AdminState error title="მეტრიკები ვერ ჩაიტვირთა" text={resource.error} onRetry={resource.reload}/>:!data?<ListSkeleton compact kind="records"/>:<>
   <div className={styles.kpis}>
    <div className={styles.kpi}><span>ღია მოთხოვნა შეთავაზების გარეშე</span><strong className={styles.kpiValue}>{data.withoutOffers}</strong></div>
    <div className={styles.kpi}><span>პირველი შეთავაზების საშუალო დრო</span><strong className={styles.kpiValue}>{data.averageFirstOfferHours===null?'—':`${data.averageFirstOfferHours} სთ`}</strong></div>
    <div className={styles.kpi}><span>არჩევით დასრულებული მოთხოვნები</span><strong className={styles.kpiValue}>{data.chosenShare===null?'—':`${data.chosenShare}%`}</strong><small>{data.chosen} / {data.completed} დასრულებული</small></div>
   </div>
   <p className={styles.note}>ხილული მოთხოვნები აქტიური ავტორებით. დასრულებული მოიცავს დახურულ, ვადაგასულ და არჩევით დასრულებულ მოთხოვნებს. გაუქმებული შეთავაზებები გამორიცხულია.</p>
   {!data.gaps.length?<p className={styles.note}>ღია მოთხოვნები ჯერ არ არის.</p>:<div className="ma-table-wrap"><table className="ma-table"><caption className="ma-sr-only">კატეგორია და ქალაქი — ნაკლები მომწოდებლით დაწყებული</caption><thead><tr><th scope="col">კატეგორია · ქალაქი</th><th scope="col">ღია მოთხოვნა</th><th scope="col">შესაბამისი კომპანია</th></tr></thead><tbody>{data.gaps.slice(0,limit).map(g=><tr key={`${g.category}:${g.city}`}><td data-label="კატეგორია · ქალაქი">{categories[g.category]||g.category} · {cities[g.city]||g.city}</td><td data-label="ღია მოთხოვნა">{g.requests}</td><td data-label="შესაბამისი კომპანია"><span className={`ma-badge ma-badge--${g.companies===0?'warning':'neutral'}`}>{g.companies}</span></td></tr>)}</tbody></table></div>}
   {data.gaps.length>limit?<Button variant="secondary" onClick={()=>setLimit(n=>n+8)}>მეტის ნახვა · {data.gaps.length-limit} დარჩა</Button>:null}
  </>}
 </section>;
}
