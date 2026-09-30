import type { Metadata } from "next";
import { BusinessIdeas } from "../../components/BusinessIdeas";
import { siteUrl } from "../../lib/site-url";
export const metadata:Metadata={alternates:{canonical:`${siteUrl()}/ideas/`}};
export default function Page(){return <div className="ideas-page"><header className="ideas-heading"><p>იდეიდან პირველ შეკვეთამდე</p><h1>რას დაიწყებ შემდეგ?</h1><span>შეარჩიე მიმართულება, გაეცანი პირველ ნაბიჯებს და მოძებნე საჭირო პარტნიორები.</span></header><BusinessIdeas/></div>;}
