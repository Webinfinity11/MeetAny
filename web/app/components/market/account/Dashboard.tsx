import Link from "next/link";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";
import { MatchingFeed } from "../MatchingFeed";
import { Status, type AnyUser } from "./shared";
export function Dashboard({ me }: { me: AnyUser }) {
  const fields: [string, boolean][] = [["დასახელება", !!me.company?.trim()], ["ქალაქი", !!me.city], ["მიმართულება", !!me.industry], ["აღწერა", !!me.about?.trim()], ["ლოგო", !!me.logoUrl], ["მომსახურებები", !!me.offers?.length], ["მომსახურების ქალაქები", !!me.serviceCities?.length], ["გალერეა", !!me.gallery?.length]];
  const remaining = fields.filter(([, filled]) => !filled).map(([label]) => label);
  const completion = Math.round((fields.length - remaining.length) / fields.length * 100);
  const tone = me.blocked ? "neutral" : me.verified ? "success" : "warning";
  return <>
    <section className="account-profile-status">
      <div className="account-verification">
        <span className="account-verification-icon" data-tone={tone}><Icon name={me.blocked ? "ban" : me.verified ? "circle-check" : "hourglass"}/></span>
        <div><h2>ვერიფიკაცია <Status tone={tone}>{me.blocked ? "დაბლოკილია" : me.verified ? "დადასტურებული" : "მიმდინარეობს"}</Status></h2><p>{me.blocked ? "ანგარიში დაბლოკილია." : me.verified ? "კომპანიის პროფილი დადასტურებულია." : "ჩვეულებრივ 1–2 სამუშაო დღე. მანამდე სრულად შეგიძლიათ გამოყენება."}</p></div>
      </div>
      <div><div className="account-progress-heading"><h2>პროფილი · {completion}%</h2><Link href="/account/?tab=profile">{remaining.length ? "დასრულება" : "რედაქტირება"}</Link></div><progress aria-label="პროფილის სისრულე" value={completion} max={100}/><p>{remaining.length ? `დარჩა: ${remaining.join(", ")}` : "პროფილი სრულად შევსებულია"}</p></div>
    </section>
    <div className="account-quick-actions">
      <Button href="/requests/new/"><Icon name="plus"/>მოთხოვნა</Button>
      <Button variant="secondary" href="/matching/"><Icon name="send"/>შეთავაზება</Button>
      <Button variant="secondary" href="/companies/"><Icon name="search"/>კომპანიები</Button>
      <Button variant="secondary" href="/account/?tab=saved"><Icon name="bookmark"/>შენახული</Button>
    </div>
    <section className="account-for-you"><div className="account-feed-heading"><h2>თქვენთვის</h2><Link href="/matching/">ყველა</Link></div><MatchingFeed compact/></section>
  </>;
}
