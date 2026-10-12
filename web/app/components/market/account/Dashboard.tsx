"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";
import { MatchingFeed } from "../MatchingFeed";
import { useMarketStore, type Store } from "../../../lib/market-client";
import { readOnboard } from "../../../lib/onboarding-client";
import { Status, type AnyUser, type OfferItem } from "./shared";
import { useAccountDeals } from "./MyDeals";
import styles from "./account.module.css";

/** Same criteria as the onboarding steps; provide/need only apply to the sides the account uses. */
type Checks = [string, boolean][];
async function loadChecks(store: Store, intent: string | undefined): Promise<Checks> {
  const { profile: p, products } = await readOnboard(store);
  const side = intent || p.account_intent;
  const checks: Checks = [
    ["რეკვიზიტები", !!(p.legal_name?.trim() && p.registration_code?.trim() && p.legal_form?.trim() && p.founded_year && p.employee_band && p.name?.trim() && p.city)],
    ["პროფილი", !!(p.company?.trim() && p.industry && p.about?.trim())],
  ];
  if (side !== "buy") checks.push(["მიწოდება", !!p.provide_categories.length && !!(p.offers.length || products.some(product => product.name.trim() && product.photoUrl))]);
  if (side !== "sell") checks.push(["საჭიროებები", !!p.need_categories.length]);
  checks.push(["დოკუმენტები", ["pending", "approved"].includes(p.verification_documents_status)], ["ლოგო", !!p.logo_url]);
  return checks;
}
function Stat({ value, label, href, attention }: { value: number | string; label: string; href: string; attention?: boolean }) {
  return <li><Link className={styles.stat} href={href} data-attention={attention || undefined}><strong>{value}</strong><span>{label}</span></Link></li>;
}
function DashboardBody({ me, store }: { me: AnyUser; store: Store }) {
  const [loaded, setLoaded] = useState<{ actor: string; checks: Checks | null }>();
  const deals = useAccountDeals(store, me.id);
  useEffect(() => {
    let alive = true;
    loadChecks(store, me.accountIntent).then(checks => { if (alive) setLoaded({ actor: me.id, checks }); }, () => { if (alive) setLoaded({ actor: me.id, checks: null }); });
    return () => { alive = false; };
  }, [store, me.id, me.accountIntent]);
  const legacy: Checks = [["დასახელება", !!me.company?.trim()], ["ქალაქი", !!me.city], ["მიმართულება", !!me.industry], ["აღწერა", !!me.about?.trim()], ["ლოგო", !!me.logoUrl], ["მომსახურებები", !!me.offers?.length], ["მომსახურების ქალაქები", !!me.serviceCities?.length], ["გალერეა", !!me.gallery?.length]];
  const fields = loaded?.actor === me.id && loaded.checks ? loaded.checks : legacy;
  const remaining = fields.filter(([, filled]) => !filled).map(([label]) => label);
  const completion = Math.round((fields.length - remaining.length) / fields.length * 100);
  const tone = me.blocked ? "neutral" : me.verified ? "success" : "warning";
  const documents = me.verificationDocumentsStatus;
  const verifyText = me.blocked ? "ანგარიში დაბლოკილია."
    : me.verified ? "კომპანიის პროფილი დადასტურებულია."
    : documents === "rejected" ? "დოკუმენტები უარყოფილია — ატვირთე ხელახლა."
    : documents === "pending" ? "დოკუმენტები განხილვაშია. დადასტურების შემდეგ შეთავაზებების გაგზავნა გახსნილია."
    : "კომპანიის პროფილს ადმინისტრატორი ამოწმებს. მანამდე შეგიძლიათ პროფილის შევსება და მოთხოვნების დათვალიერება. შეთავაზებებს დადასტურების შემდეგ გაგზავნით.";
  const verifyLabel = me.blocked ? "დაბლოკილია" : me.verified ? "დადასტურებული" : documents === "pending" ? "დოკუმენტები განხილვაშია" : documents === "rejected" ? "უარყოფილია" : "დასადასტურებელია";
  const openRequests = store.listRequests({ ownerId: me.id }) as { id: string }[];
  const freshOffers = openRequests.reduce((n, request) => n + (store.visibleOffers(request.id, me) as OfferItem[]).filter(offer => offer.status === "sent" && !offer.viewedAt).length, 0);
  const waiting = (store.myOffers(me) as OfferItem[]).filter(offer => offer.status === "sent").length;
  const activeDeals = deals?.error ? "—" : deals ? deals.items.filter(deal => !["complete", "cancelled"].includes(deal.stage)).length : "…";
  const engagement = store.engagement();
  const unread = engagement?.status === "ready" ? engagement.unread : 0;
  return <>
    {me.onboardingCompletedAt === null && !me.blocked ? <section className={styles.setup}>
      <div><h2>რეგისტრაცია დაუსრულებელია</h2><p>დაასრულე კომპანიის პროფილის შევსება, რომ შეთავაზებები და მოთხოვნები სრულად გამოჩნდეს.</p></div>
      <Button href="/onboarding/">გაგრძელება</Button>
    </section> : null}
    <section className="account-profile-status">
      <div className="account-verification">
        <span className="account-verification-icon" data-tone={tone}><Icon name={me.blocked ? "ban" : me.verified ? "circle-check" : "hourglass"}/></span>
        <div><h2>ვერიფიკაცია <Status tone={documents === "rejected" ? "danger" : tone}>{verifyLabel}</Status></h2><p>{verifyText}{documents === "rejected" && !me.verified ? <> <Link href="/onboarding/?step=verify">ატვირთვა</Link></> : null}</p></div>
      </div>
      <div><div className="account-progress-heading"><h2>პროფილი · {completion}%</h2><Link href="/account/?tab=profile">{remaining.length ? "დასრულება" : "რედაქტირება"}</Link></div><progress aria-label="პროფილის სისრულე" value={completion} max={100}/><p>{remaining.length ? `დარჩა: ${remaining.join(", ")}` : "პროფილი სრულად შევსებულია"}</p></div>
    </section>
    <ul className={styles.stats} aria-label="რიცხვები">
      <Stat value={openRequests.length} label="ღია მოთხოვნები" href="/account/?space=buy&tab=requests"/>
      <Stat value={freshOffers} label="ახალი შეთავაზებები ჩემს მოთხოვნებზე" href="/account/?space=buy&tab=requests" attention={freshOffers > 0}/>
      <Stat value={waiting} label="ჩემი შეთავაზებები მოლოდინში" href="/account/?tab=offers"/>
      <Stat value={activeDeals} label="აქტიური გარიგებები" href="/account/?tab=deals"/>
      <Stat value={unread} label="შეტყობინებები" href="/account/?tab=notifications" attention={unread > 0}/>
    </ul>
    <div className="account-quick-actions">
      <Button href="/requests/new/"><Icon name="plus"/>მოთხოვნა</Button>
      <Button variant="secondary" href="/matching/"><Icon name="send"/>შეთავაზება</Button>
      <Button variant="secondary" href="/companies/"><Icon name="search"/>კომპანიები</Button>
      <Button variant="secondary" href="/account/?tab=saved"><Icon name="bookmark"/>შენახული</Button>
    </div>
    <section className="account-for-you"><div className="account-feed-heading"><h2>თქვენთვის</h2><Link href="/matching/">ყველა</Link></div><MatchingFeed compact/></section>
  </>;
}
export function Dashboard({ me }: { me: AnyUser }) {
  const { store } = useMarketStore();
  return store ? <DashboardBody key={me.id} me={me} store={store}/> : null;
}
