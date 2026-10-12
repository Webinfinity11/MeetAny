"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";
import { MatchingFeed } from "../MatchingFeed";
import { useMarketStore, type Store } from "../../../lib/market-client";
import { useUnreadMessageCount } from "../../../lib/chat-client";
import { readOnboard, verificationAction, verificationHint, verificationLabel, verificationState, verificationTone } from "../../../lib/onboarding-client";
import { Status, type AnyUser, type OfferItem } from "./shared";
import { useAccountDeals } from "./MyDeals";
import type { Space } from "./nav";
import styles from "./account.module.css";

/** Same criteria as the onboarding steps; provide/need only apply to the sides the account uses. */
type Checks = [string, boolean][];
async function loadChecks(store: Store, intent: string | undefined, verified: boolean): Promise<Checks> {
  const { profile: p, products } = await readOnboard(store);
  const side = intent || p.account_intent;
  const checks: Checks = [
    ["რეკვიზიტები", !!(p.legal_name?.trim() && p.registration_code?.trim() && p.legal_form?.trim() && p.founded_year && p.employee_band && p.name?.trim() && p.city)],
    ["პროფილი", !!(p.company?.trim() && p.industry && p.about?.trim())],
  ];
  if (side !== "buy") checks.push(["მიწოდება", !!p.provide_categories.length && !!(p.offers.length || products.some(product => product.name.trim() && product.photoUrl))]);
  if (side !== "sell") checks.push(["საჭიროებები", !!p.need_categories.length]);
  // A verified company has nothing left to send, whatever the document row says.
  checks.push(["დოკუმენტები", verified || ["pending", "approved"].includes(p.verification_documents_status)], ["ლოგო", !!p.logo_url]);
  return checks;
}
function Stat({ value, label, href, attention }: { value: number | string; label: string; href: string; attention?: boolean }) {
  return <li><Link className={styles.stat} href={href} data-attention={attention || undefined}><strong>{value}</strong><span>{label}</span></Link></li>;
}
/** Verification and profile completeness of a company, from one status source. */
function CompanyStatus({ me, store }: { me: AnyUser; store: Store }) {
  const [loaded, setLoaded] = useState<{ actor: string; checks: Checks | null }>();
  useEffect(() => {
    let alive = true;
    loadChecks(store, me.accountIntent, me.verified).then(checks => { if (alive) setLoaded({ actor: me.id, checks }); }, () => { if (alive) setLoaded({ actor: me.id, checks: null }); });
    return () => { alive = false; };
  }, [store, me.id, me.accountIntent, me.verified]);
  const legacy: Checks = [["დასახელება", !!me.company?.trim()], ["ქალაქი", !!me.city], ["დარგი", !!me.industry], ["აღწერა", !!me.about?.trim()], ["ლოგო", !!me.logoUrl], ["მომსახურებები", !!me.offers?.length], ["მომსახურების ქალაქები", !!me.serviceCities?.length], ["გალერეა", !!me.gallery?.length]];
  const fields = loaded?.actor === me.id && loaded.checks ? loaded.checks : legacy;
  const remaining = fields.filter(([, filled]) => !filled).map(([label]) => label);
  const completion = Math.round((fields.length - remaining.length) / fields.length * 100);
  // One verification vocabulary with onboarding and the company pages (lib/onboarding-client).
  const status = me.verificationDocumentsStatus, state = verificationState(status, me.verified);
  const verification = me.blocked ? { label: "დაბლოკილი", tone: "neutral" as const, text: "ანგარიში დაბლოკილია.", link: null }
    : { label: verificationLabel(status, me.verified), tone: verificationTone(status, me.verified), text: verificationHint(status, me.verified), link: verificationAction(status, me.verified) };
  // Registration is unfinished only for a company that has not completed onboarding and is not verified yet.
  const registering = me.onboardingCompletedAt === null && !me.verified && !me.blocked;
  return <section className="account-profile-status" aria-label="კომპანიის სტატუსი">
    <div className="account-verification">
      <span className="account-verification-icon" data-tone={verification.tone}><Icon name={me.blocked ? "ban" : state === "approved" ? "circle-check" : state === "returned" ? "circle-alert" : "hourglass"}/></span>
      <div><h2>ვერიფიკაცია <Status tone={verification.tone}>{verification.label}</Status></h2><p>{verification.text}{verification.link ? <> <Link href={verification.link.href}>{verification.link.label}</Link></> : null}</p></div>
    </div>
    <div>
      <div className="account-progress-heading"><h2>{registering ? "რეგისტრაცია" : "პროფილი"} · {completion}%</h2><Link href={registering ? "/onboarding/" : "/account/?tab=profile"}>{registering ? "რეგისტრაციის გაგრძელება" : remaining.length ? "პროფილის შევსება" : "პროფილის რედაქტირება"}</Link></div>
      <progress aria-label={registering ? "რეგისტრაციის სისრულე" : "პროფილის სისრულე"} value={completion} max={100} data-complete={completion === 100 || undefined}/>
      <p>{remaining.length ? `დარჩა: ${remaining.join(", ")}` : "პროფილი სრულად არის შევსებული."}</p>
    </div>
  </section>;
}
function DashboardBody({ me, store, space }: { me: AnyUser; store: Store; space: Space }) {
  const deals = useAccountDeals(store, me.id);
  const unread = useUnreadMessageCount(store, me.id, !me.blocked) ?? 0;
  const company = me.role === "company";
  const side = space === "buy" ? "buyer_id" : "supplier_id";
  const activeDeals = deals?.error ? "—" : deals ? deals.items.filter(deal => deal[side] === me.id && !["complete", "cancelled"].includes(deal.stage)).length : "…";
  const messages = <Stat value={unread} label="წაუკითხავი მიმოწერები" href={`/account/?space=${space}&tab=messages`} attention={unread > 0}/>;
  const dealsStat = <Stat value={activeDeals} label="აქტიური გარიგებები" href={`/account/?space=${space}&tab=deals`}/>;
  let stats;
  if (space === "buy") {
    const openRequests = store.listRequests({ ownerId: me.id }) as { id: string }[];
    const freshOffers = openRequests.reduce((n, request) => n + (store.visibleOffers(request.id, me) as OfferItem[]).filter(offer => offer.status === "sent" && !offer.viewedAt).length, 0);
    stats = <><Stat value={openRequests.length} label="ღია მოთხოვნები" href="/account/?space=buy&tab=requests"/><Stat value={freshOffers} label="ახალი შეთავაზებები" href="/account/?space=buy&tab=requests" attention={freshOffers > 0}/>{dealsStat}{messages}</>;
  } else {
    const offers = store.myOffers(me) as OfferItem[];
    stats = <><Stat value={offers.filter(offer => offer.status === "sent").length} label="შეთავაზებები მოლოდინში" href="/account/?space=sell&tab=offers"/><Stat value={offers.filter(offer => offer.status === "chosen").length} label="არჩეული შეთავაზებები" href="/account/?space=sell&tab=offers"/>{dealsStat}{messages}</>;
  }
  return <>
    {company ? <CompanyStatus me={me} store={store}/> : null}
    <ul className={styles.stats} aria-label="მიმოხილვა">{stats}</ul>
    <div className="account-quick-actions">
      {space === "buy" ? <>
        <Button href="/requests/new/"><Icon name="plus"/>მოთხოვნის განთავსება</Button>
        <Button variant="secondary" href="/companies/"><Icon name="search"/>კომპანიების ძიება</Button>
      </> : <>
        <Button href="/matching/"><Icon name="inbox"/>შესაძლებლობების ნახვა</Button>
        <Button variant="secondary" href={`/companies/view/?id=${encodeURIComponent(me.id)}`}><Icon name="building-2"/>საჯარო პროფილის ნახვა</Button>
      </>}
      <Button variant="secondary" href={`/account/?space=${space}&tab=saved`}><Icon name="bookmark"/>შენახულის ნახვა</Button>
    </div>
    <section className="account-for-you" aria-labelledby="account-for-you-title"><div className="account-feed-heading"><h2 id="account-for-you-title">თქვენთვის</h2><Link href={space === "buy" ? "/companies/" : "/matching/"}>{space === "buy" ? "ყველა კომპანია" : "ყველა შესაძლებლობა"}</Link></div><MatchingFeed compact kind={space === "buy" ? "suppliers" : "recommended"}/></section>
  </>;
}
export function Dashboard({ me, space }: { me: AnyUser; space: Space }) {
  const { store } = useMarketStore();
  return store ? <DashboardBody key={me.id} me={me} store={store} space={space}/> : null;
}
