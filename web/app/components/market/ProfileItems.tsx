"use client";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../Icon";
export function ProfileItems({id,label,items,disabled,onChange}:{id:string;label:string;items:string[];disabled?:boolean;onChange:(items:string[])=>void}) {
 const [draft,setDraft]=useState("");
 const [error,setError]=useState("");
 const add=()=>{
  const value=draft.trim();if(!value)return;
  if(items.length>=8){setError("შეგიძლია დაამატო მაქსიმუმ 8 პუნქტი.");return;}
  if(items.includes(value)){setError("ეს პუნქტი უკვე დამატებულია.");return;}
  onChange([...items,value]);setDraft("");setError("");
 };
 return <div className="ma-field profile-items" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))add();}}><label className="ma-field__label" htmlFor={id}>{label}<span className="ma-field__opt">{items.length}/8</span></label>
  <ul className="profile-chips">{items.map((item,index)=><li key={`${index}:${item}`}><span>{item}</span><button type="button" disabled={disabled} aria-label={`${item} — ამოღება`} onClick={()=>{onChange(items.filter((_,i)=>i!==index));setError("");}}><Icon name="x"/></button></li>)}</ul>
  <div className="profile-item-input"><input id={id} className="ma-input" value={draft} maxLength={120} disabled={disabled||items.length>=8} placeholder="დაამატე ერთი პუნქტი" aria-describedby={`${id}-help`} onChange={event=>{setDraft(event.target.value);setError("");}} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();add();}}}/><Button variant="secondary" disabled={disabled||!draft.trim()||items.length>=8} onClick={add}>დამატება</Button></div>
  <p id={`${id}-help`} className={error?"ma-field__error":"ma-field__help"} role={error?"alert":undefined}>{error||"თითო პუნქტი მაქსიმუმ 120 სიმბოლო."}</p>
 </div>;
}
