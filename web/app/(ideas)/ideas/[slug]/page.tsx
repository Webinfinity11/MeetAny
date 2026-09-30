import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { businessIdeas } from "../../../lib/business-ideas";
import { Icon } from "../../../components/Icon";
import { siteUrl } from "../../../lib/site-url";
export function generateStaticParams(){return businessIdeas.map(i=>({slug:i.slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const idea=businessIdeas.find(i=>i.slug===slug);return idea?{title:`${idea.title} — MeetAny`,description:idea.intro,alternates:{canonical:`${siteUrl()}/ideas/${slug}/`}}:{};}
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const idea=businessIdeas.find(i=>i.slug===slug);if(!idea)notFound();
 return <article className="idea-detail"><Link className="ma-link" href="/ideas/"><Icon name="layout-grid"/>ყველა იდეა</Link><header className="idea-detail__header"><div><p>{idea.category}</p><h1>{idea.title}</h1><p>{idea.intro}</p></div><img src={`/assets/photos/${idea.photo}`} alt="" width={640} height={420}/></header><div className="idea-detail__layout"><div><section><h2>ვისთვის არის ეს მომსახურება?</h2><p>{idea.audience}</p></section><section><h2>პირველი ნაბიჯები</h2><ol className="idea-steps">{idea.steps.map((step,i)=><li key={step}><span>{String(i+1).padStart(2,'0')}</span><p>{step}</p></li>)}</ol></section><section><h2>წინასწარ გასარკვევი</h2><ul className="idea-questions">{idea.questions.map(q=><li key={q}><Icon name="message-square"/>{q}</li>)}</ul></section></div><aside className="idea-resources"><h2>ვინ დაგჭირდება?</h2><p>ნახე შესაბამისი კომპანიები და შეადარე მათი პირობები.</p>{idea.needs.map(([label,category])=><Link key={category} href={`/companies/?industry=${category}`}><Icon name="search"/>{label}</Link>)}<div><h3>უკვე იცი, რა გჭირდება?</h3><Link className="ma-btn ma-btn--primary" href={`/requests/new/?${new URLSearchParams({title:idea.needs[0][0],category:idea.needs[0][1]})}`}><Icon name="clipboard-list"/>მოთხოვნის დამატება</Link></div></aside></div><p className="idea-detail__note">ეს არის იდეის დასამუშავებელი საწყისი გეგმა. მოთხოვნა, დანახარჯები და საქმიანობის პირობები დაწყებამდე გადაამოწმე შენს კონკრეტულ გარემოში.</p></article>;
}
