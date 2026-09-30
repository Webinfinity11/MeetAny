"use client";
import { useState } from "react";
import Link from "next/link";
import { businessIdeas } from "../lib/business-ideas";
import { Icon } from "./Icon";
export function BusinessIdeas(){
 const [category,setCategory]=useState('ყველა');
 const choices=['ყველა',...new Set(businessIdeas.map(i=>i.category))];
 const rows=businessIdeas.filter(i=>category==='ყველა'||i.category===category);
 return <><div className="ideas-filters" role="group" aria-label="იდეების მიმართულება">{choices.map(c=><button key={c} type="button" aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="ideas-grid">{rows.map((idea)=><article className="idea-card" key={idea.slug}><Link href={`/ideas/${idea.slug}/`} className="idea-card__image" tabIndex={-1} aria-hidden="true"><img src={`/assets/photos/${idea.photo}`} alt="" width={640} height={420} loading="lazy"/></Link><div className="idea-card__body"><p><Icon name={idea.icon}/>{idea.category}</p><h2><Link href={`/ideas/${idea.slug}/`}>{idea.title}</Link></h2><p>{idea.intro}</p><Link className="ma-link" href={`/ideas/${idea.slug}/`}><Icon name="file-text"/>გეგმის ნახვა</Link></div></article>)}</div></>;
}
