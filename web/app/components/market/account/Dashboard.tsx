import Link from "next/link";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";
import { MatchingFeed } from "../MatchingFeed";
import { Status, type AnyUser } from "./shared";
export function Dashboard({ me }: { me: AnyUser }) {
  const fields: [string, boolean][] = [["დასახელება", !!me.company?.trim()], ["ქალაქი", !!me.city], ["მიმართულება", !!me.industry], ["აღწერა", !!me.about?.trim()], ["ლოგო", !!me.logoUrl], ["მომსახურებები", !!me.offers?.length], ["მომსახურების ქალაქები", !!me.serviceCities?.length], ["გალერეა", !!me.gallery?.length]];
  const remaining = fields.filter(([, filled]) => !filled).map(([label]) => label);
  const completion = Math.round((fields.length - remaining.length) / fields.length * 100);
  return <><section className="account-profile-status"><div><h2>დადასტურება <Status tone={me.blocked ? "neutral" : me.verified ? "success" : "warning"}>{me.blocked ? "დაბლოკილია" : me.verified ? "დადასტურებული" : "მიმდინარეობს"}</Status></h2><p>{me.verified ? "კომპანიის პროფილი დადასტურებულია." : "კომპანიის მონაცემებს ადმინისტრატორი ამოწმებს."}</p></div><div><div className="account-progress-heading"><h2>პროფილი · {completion}%</h2><Link href="/account/?tab=profile">{remaining.length ? "დასრულება" : "რედაქტირება"}</Link></div><progress aria-label="პროფილის სისრულე" value={completion} max={100}/><p>{remaining.length ? `დარჩა: ${remaining.join(", ")}` : "პროფილი სრულად შევსებულია"}</p></div></section><div className="account-quick-actions"><Button href="/requests/new/"><Icon name="plus"/>ახალი მოთხოვნა</Button><Button variant="secondary" href="/matching/"><Icon name="inbox"/>შესაძლებლობები</Button><Button variant="secondary" href="/account/?space=sell&tab=saved"><Icon name="bookmark"/>შენახული</Button><Button variant="secondary" href="/account/?space=sell&tab=profile"><Icon name="building-2"/>კომპანიის პროფილი</Button></div><section><h2>თქვენთვის</h2><MatchingFeed compact/></section></>;
}
