"use client";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./analytics.module.css";

const months=["იან","თებ","მარ","აპრ","მაი","ივნ","ივლ","აგვ","სექ","ოქტ","ნოე","დეკ"];
const dayLabel=(day:string)=>{const [,month,date]=day.split("-");return `${Number(date)} ${months[Number(month)-1]||""}`;};
// This page-session ledger prevents a background refresh or remount from replaying the entrance.
const animatedCharts=new Set<string>();
export function AdminActivityChart({title,rows,previousTotal}:{title:string;rows:{day:string;count:number}[];previousTotal?:number}) {
 const id=useId(),figure=useRef<HTMLElement>(null);
 const [active,setActive]=useState<number|null>(null);
 const animationKey=`${title}:${rows[0]?.day}:${rows.at(-1)?.day}`;
 const [phase,setPhase]=useState<"waiting"|"animate"|"settled">(()=>animatedCharts.has(animationKey)?"settled":"waiting");
 const [reduced,setReduced]=useState(false);
 useEffect(()=>{
  const element=figure.current;if(!element)return;
  const preference=matchMedia("(prefers-reduced-motion: reduce)");
  let timeout:ReturnType<typeof setTimeout>|undefined;
  const settle=()=>{setReduced(preference.matches);if(preference.matches){animatedCharts.add(animationKey);setPhase("settled");}};
  preference.addEventListener("change",settle);
  const observer=new IntersectionObserver(entries=>{
   if(!entries.some(entry=>entry.isIntersecting))return;
   setReduced(preference.matches);
   if(preference.matches||animatedCharts.has(animationKey)){setPhase("settled");observer.disconnect();return;}
   animatedCharts.add(animationKey);setPhase("animate");observer.disconnect();
   timeout=setTimeout(()=>setPhase("settled"),1200);
  },{threshold:.2});observer.observe(element);
  return()=>{observer.disconnect();if(timeout)clearTimeout(timeout);preference.removeEventListener("change",settle);};
 },[animationKey]);
 const peak=Math.max(0,...rows.map(row=>row.count));
 const ceiling=peak<=4?Math.max(1,peak):Math.ceil(peak/4)*4;
 const total=rows.reduce((sum,row)=>sum+row.count,0),average=rows.length?Number((total/rows.length).toFixed(1)):0;
 const width=600,height=164,base=height-4,top=12,step=width/Math.max(1,rows.length);
 const points=rows.map((row,index)=>({x:(index+.5)*step,y:base-row.count/ceiling*(base-top)}));
 const line=points.map((point,index)=>`${index?"L":"M"}${point.x},${point.y}`).join(" ");
 const area=points.length?`${line} L${points.at(-1)!.x},${base} L${points[0].x},${base} Z`:"";
 const ticks=ceiling===1?[1,0]:[ceiling,Math.floor(ceiling/2),0];
 const delta=previousTotal===undefined?null:total-previousTotal;
 const comparisonLabel=delta===null?null:delta>0?`${delta}-ით მეტი`:delta<0?`${Math.abs(delta)}-ით ნაკლები`:"იგივე რაოდენობა";
 return <figure ref={figure} className={styles.chart} aria-labelledby={id} data-chart-phase={phase} data-reduced-motion={reduced||undefined}>
  <figcaption id={id}><div><span>{title}</span><div className={styles.chartHeadline}><strong>{total}</strong>{comparisonLabel!==null?<div className={styles.comparison}><span>წინა {rows.length} დღეში: <strong>{previousTotal}</strong></span><span className={styles.comparisonChange} data-up={delta!>0||undefined} data-down={delta!<0||undefined}>{comparisonLabel}</span></div>:null}</div></div><small>{rows.length} დღეში</small></figcaption>
  <div className={styles.plot} onMouseLeave={()=>setActive(null)}>
   <div className={styles.scale} aria-hidden="true">{ticks.map(tick=><span key={tick} style={{top:`${(base-tick/ceiling*(base-top))/height*100}%`}}>{tick}</span>)}</div>
   <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--action)" stopOpacity=".2"/><stop offset="100%" stopColor="var(--action)" stopOpacity=".015"/></linearGradient></defs>
    {ticks.map(tick=><line key={tick} x1={0} x2={width} y1={base-tick/ceiling*(base-top)} y2={base-tick/ceiling*(base-top)} className={styles.gridLine}/>)}
    {total>0?<><path d={area} className={styles.area} fill={`url(#${id}-fill)`}/><path d={line} className={styles.trend} pathLength={1}/>{points.map((point,index)=>rows[index].count>0?<circle key={rows[index].day} cx={point.x} cy={point.y} r={rows.length<=7?3.5:2.5} className={styles.dayPoint}/>:null)}</>:<line x1={step/2} x2={width-step/2} y1={base} y2={base} className={styles.zeroLine}/>}
    {active!==null&&points[active]?<g><line x1={points[active].x} x2={points[active].x} y1={top} y2={base} className={styles.cursorLine}/><circle cx={points[active].x} cy={points[active].y} r={4.5} className={styles.cursorDot}/></g>:null}
   </svg>
   <div className={styles.hitAreas}>{rows.map((row,index)=><button key={row.day} type="button" tabIndex={index===(active??0)?0:-1} aria-label={`${dayLabel(row.day)}: ${row.count}`} aria-describedby={active===index?`${id}-tip`:undefined} onFocus={()=>setActive(index)} onMouseEnter={()=>setActive(index)} onClick={()=>setActive(index)} onKeyDown={event=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();
    const next=event.key==="Home"?0:event.key==="End"?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(event.key==="ArrowRight"?1:-1)));
    (event.currentTarget.parentElement?.children[next] as HTMLButtonElement|undefined)?.focus();
   }}/>)}</div>
   {active!==null&&rows[active]?<output id={`${id}-tip`} className={styles.tip} data-edge={active<rows.length*.22?"start":active>rows.length*.78?"end":undefined} style={{left:`${(active+.5)/rows.length*100}%`}}><span>{dayLabel(rows[active].day)}</span><strong>{rows[active].count}</strong></output>:null}
  </div>
  <div className={styles.axis} aria-hidden="true"><span>{rows[0]?dayLabel(rows[0].day):"—"}</span>{rows.length>7?<span>{dayLabel(rows[Math.floor(rows.length/2)].day)}</span>:null}<span>{rows.at(-1)?dayLabel(rows.at(-1)!.day):"—"}</span></div>
  <div className={styles.chartSummary}><span>საშ. დღეში <strong>{average}</strong></span><span>{total===0?"აქტივობა არ არის":<>პიკური დღე <strong>{peak}</strong></>}</span></div>
  <div className="ma-sr-only"><table><caption>{title} — დღიური რაოდენობა</caption><tbody>{rows.map(row=><tr key={row.day}><th scope="row">{dayLabel(row.day)}</th><td>{row.count}</td></tr>)}</tbody></table></div>
 </figure>;
}
