"use client";
import { optimizable } from "../../lib/image";
import Image from "next/image";
import { Button } from "../ui/Button";


import { FileAttachments } from "./FileAttachments";
import { RequestPreferenceRecord } from "./RequestPreferences";
import { compareHref, dealHref, listMyDeals, selectOfferDeal, flowCode, staleReview } from "../../lib/deal-client";
import { CustomSelect } from "../ui/CustomSelect";
import { DetailSkeleton } from "./Skeletons";

import { useRequestDetail } from "../../lib/use-request-detail";
import { isUuid } from "../../lib/ids";
import { ServiceUnavailable } from "./ServiceUnavailable";
import { EmptyState } from "../ui/Structure";
import { Avatar } from "../ui/Avatar";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { toast } from "../Toasts";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { OfferCard, offerPrice, type OfferCardData } from "./OfferCard";

import { CallButton } from "./CallButton";
import { MessageButton } from "./ChatPopup";
import { ReportButton } from "./ReportButton";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { useCompanyFeatures } from "../../lib/business-client";
import { categories, cities, units } from "../../lib/categories";
import { Badge } from "../ui/Badge";
import { OpportunityCard, budgetLabel, type OpportunityRequest } from "./OpportunityCard";
import { SaveRequestButton } from "./SaveRequestButton";
import styles from "./request/RequestDetail.module.css";
import { addressLabel, dateShort, postedLabel } from "../../lib/format";


const RequestFormSheet = dynamic(() => import("./RequestFormSheet").then(m => m.RequestFormSheet));
const ChooseOfferSheet = dynamic(() => import("./ChooseOfferSheet").then(m => m.ChooseOfferSheet));

export function RequestViewPageContent({ initial }: { initial?: PublicSnapshot }) {
  const { store, ready, sessionReady, available } = useMarketStore(initial);
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const detail = useRequestDetail(store, sessionReady, available, id);
  const business = useCompanyFeatures(store, ready && available);
  const router = useRouter();
  const [editRequest, setEditRequest] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [offerSort, setOfferSort] = useState("newest");
  const [chooseVersion, setChooseVersion] = useState<string | null>(null);
  const [chooseId, setChooseId] = useState<string | null>(null);
  const [choosePending, setChoosePending] = useState(false);
  const [chooseError, setChooseError] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<"extend" | "close" | "delete" | "withdraw" | null>(null);
  const [now, setNow] = useState(0);
  // Share links need the page origin, which only exists in the browser; set after hydration.
  const [origin, setOrigin] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { setNow(Date.now()); setOrigin(window.location.origin); }, 0); return () => window.clearTimeout(timer); }, []);
  // Mark offers received since this author last visited the request.
  const [seen, setSeen] = useState<{id: string; at: string | null} | null>(null);
  const meId = store?.currentUser()?.id;
  useEffect(() => {
    if (!ready || detail.loading || seen?.id === id || store?.getRequest(id)?.ownerId !== meId || !meId) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      let map: Record<string, string> = {};
      try {map = JSON.parse(localStorage.getItem("meetany.seen") || "{}");} catch {}
      setSeen({id, at: map[id] || null});
      map[id] = new Date().toISOString();
      try {localStorage.setItem("meetany.seen", JSON.stringify(map));} catch {}
    });
    return () => {active = false;};
    // Only capture the previous visit once, not after each offer refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, meId, ready, detail.loading]);

  const data = useMemo(() => {
    if (!store || !ready || !available || !id) return null;
    const r = store.getRequest(id);
    if (!r) return null;
    const me = store.currentUser();
    const owner = store.userById(r.ownerId);
    const offers = store.visibleOffers(id, me);
    const offerCount = store.offerCount(id);
    const state = store.requestState(r);
    const isOwner = !!me && r.ownerId === me.id;
    const myOffer = me?.role === "company" ? offers.find((o: { companyUserId: string }) => o.companyUserId === me.id) : null;
    const contact = store.contactFor(r, me);
    const mapOffer = (o: { id: string; companyUserId: string; createdAt: string; updatedAt?: string; paymentTerms?: string | null; validUntil?: string | null; commercialTerms?: string[]; deliveryDays: number | null; price: number | null; priceType: string; vatIncluded: boolean; deliveryIncluded: boolean; body: string; status: string }): OfferCardData => {
      const c = store.userById(o.companyUserId);
      const isNew = isOwner && seen?.id === id && (!seen.at || Date.parse(o.createdAt) > Date.parse(seen.at)) && o.status === "sent";
      return {
        id: o.id,
        logoUrl: c?.logoUrl,
        companyId: o.companyUserId,
        companyName: c?.company || c?.name || "კომპანია",
        companyHref: `/companies/view/?id=${encodeURIComponent(o.companyUserId)}`,
        city: c ? cities[c.city] || c.city : "",
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        paymentTerms: o.paymentTerms,
        validUntil: o.validUntil,
        commercialTerms: o.commercialTerms,
        deliveryDays: o.deliveryDays,
        price:o.price,priceType:o.priceType,vatIncluded:o.vatIncluded,deliveryIncluded:o.deliveryIncluded,
        body: o.body,
        status: o.status,
        isNew,
      };
    };
    const mappedOffers: OfferCardData[] = offers.map(mapOffer);
    return { r, me, owner, offers: mappedOffers, offerCount, state, isOwner, myOffer: myOffer ? mapOffer(myOffer) : null, contact };
  }, [store, ready, available, id, seen]);

  // The author's chosen offer already has a deal: link to it instead of reopening the choice sheet.
  const chosenOfferId: string | null = data?.isOwner ? data.r.chosenOfferId || null : null;
  const [deal, setDeal] = useState<{ offer: string; id: string } | null>(null);
  useEffect(() => {
    if (!store || !chosenOfferId) return;
    let active = true;
    listMyDeals(store).then(items => {
      const found = items.find(item => item.offer_id === chosenOfferId);
      if (active && found) setDeal({ offer: chosenOfferId, id: found.id });
    }, () => undefined);
    return () => { active = false; };
  }, [store, chosenOfferId]);
  const dealId = deal && deal.offer === chosenOfferId ? deal.id : null;

  const validId = isUuid(id);
  const notFound = !validId || (ready && available && !detail.error && sessionReady && !detail.loading && !data);
  const pageTitle = data ? `${data.r.title} — MeetAny` : notFound ? "მოთხოვნა ვერ მოიძებნა — MeetAny" : "";
  // Private and just-published requests are not in the server snapshot, so the tab title is set here too.
  useEffect(() => { if (pageTitle) document.title = pageTitle; }, [pageTitle]);

  if (notFound) {
    return (
      <div className="ma-page">
        <EmptyState icon="search" title="მოთხოვნა ვერ მოიძებნა" text="შესაძლოა წაიშალა ან ვადა გაუვიდა." action={<Button variant="secondary" href="/requests/">ყველა მოთხოვნა</Button>} />
      </div>
    );
  }

  if ((ready && !available) || detail.error) return <div className="ma-page"><ServiceUnavailable /></div>;

  if (!ready || !data) return <DetailSkeleton />;

  const { r, me, owner, offers: plainOffers, offerCount, state, isOwner, myOffer: plainMyOffer, contact } = data;
  const withPlan = (o: OfferCardData): OfferCardData => ({ ...o, feature: business.data?.find(f => f.id === o.companyId) });
  const offers = plainOffers.map(withPlan);
  const myOffer = plainMyOffer ? withPlan(plainMyOffer) : null;
  const closed = state !== "open";
  const chosenCompanyId = store?.visibleOffers(r.id).find((o: { id: string; companyUserId: string }) => o.id === r.chosenOfferId)?.companyUserId;
  const orderedOffers = [...offers].sort((a,b) => {
    if (a.status === "chosen" || b.status === "chosen") return Number(b.status === "chosen") - Number(a.status === "chosen");
    return offerSort === "delivery" ? (a.deliveryDays ?? Infinity) - (b.deliveryDays ?? Infinity) : Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
  const daysLeft: number = state === "open" ? store?.daysLeft(r) ?? 0 : 0;
  const statusText = state === "open" ? (daysLeft <= 0 ? "დღეს იწურება" : `კიდევ ${daysLeft} დღე`) : state === "closed" ? "დახურულია" : state === "chosen" ? "მომწოდებელი არჩეულია" : state === "expired" ? "ვადაგასულია" : store?.stateLabels[state] || "";
  // Keep the same fact order as a request card: category, city, quantity, deadline.
  const posted = postedLabel(r.createdAt, now);
  // The buyer's exact address opens together with the contact, after an offer is chosen (owner, admin and the chosen company).
  const showAddress = !!r.addressNote && (isOwner || me?.role === "admin" || !!contact);
  const cityLabel = cities[r.city] || r.city;
  const facts: [string, string, string][] = [
    ["briefcase-business", "კატეგორია", categories[r.category] || r.category],
    ["map-pin", "ქალაქი", cityLabel],
    ...(r.quantity != null ? [["package", "რაოდენობა", `${r.quantity} ${units[r.unit] || r.unit || ""}`.trim()] as [string, string, string]] : []),
    ["calendar", "შეთავაზებების მიღება", statusText],
  ];
  const lockNote = isOwner ? (r.chosenOfferId ? "" : "კომპანიის კონტაქტი იხსნება შეთავაზების არჩევის შემდეგ")
    : contact ? "" : "მყიდველის კონტაქტი და მისამართი იხსნება შეთავაზების არჩევის შემდეგ";
  const similar: OpportunityRequest[] = (store?.listRequests({ category: r.category }) || []).filter((item: OpportunityRequest) => item.id !== r.id).slice(0, 3).map((item: OpportunityRequest) => ({ ...item, daysLeft: store?.daysLeft(item) ?? 0 }));
  const offerHref = `/offers/new/?requestId=${encodeURIComponent(r.id)}`;
  const offerAction = !sessionReady || isOwner || closed || myOffer || me?.role === "admin" ? null
    : !me ? { label: "შედით, რომ გაგზავნოთ შეთავაზება", href: `/account/?${new URLSearchParams({ next: offerHref, intent: "offer", context: r.title })}`, hint: "შეთავაზების გაგზავნა ვერიფიცირებული კომპანიის ანგარიშით შეგიძლიათ." }
    : me.role !== "company" ? { label: "შეთავაზების გასაგზავნად გახდით კომპანია", href: "/account/?tab=profile", hint: "პროფილი გადაიქცევა კომპანიის ანგარიშად. შეთავაზების გაგზავნამდე საჭიროა ვერიფიკაცია." }
    : !me.verified ? { label: "ვერიფიკაციის დასრულება", href: "/onboarding/?step=verify", hint: "შეთავაზების გასაგზავნად ატვირთეთ კომპანიის დოკუმენტები და დაასრულეთ ვერიფიკაცია." }
    : { label: "შეთავაზების გაგზავნა", href: offerHref, hint: "თქვენს შეთავაზებას მხოლოდ მოთხოვნის ავტორი ნახავს." };
  const shareUrl = origin ? `${origin}/requests/view/?id=${encodeURIComponent(r.id)}` : "";
  async function action(kind: "extend" | "close" | "delete" | "withdraw") {
    if (!store || actionPending) return;
    setActionPending(true); setActionError("");
    try {
      if (kind === "extend") await store.extendRequest(r.id);
      else if (kind === "close") await store.closeRequest(r.id);
      else if (kind === "delete") {await store.deleteRequest(r.id); router.push("/account/");}
      else if (myOffer) await store.withdrawOffer(myOffer.id);
      toast({extend: closed ? "მოთხოვნა ხელახლა გაიხსნა 7 დღით." : "ვადა გაგრძელდა 7 დღით.", close: "მოთხოვნა დაიხურა.", delete: "მოთხოვნა წაიშალა.", withdraw: "შეთავაზება გაუქმდა."}[kind]);
      setConfirmKind(null);
    } catch(err) {setActionError((err as {userMessage?: string}).userMessage || "ვერ შესრულდა.");}
    finally {setActionPending(false);}
  }

  const chosenCard: OfferCardData | undefined = offers.find((o: OfferCardData) => o.id === chooseId);

  async function confirmChoose() {
    if (!chooseId || !store || choosePending) return;
    setChoosePending(true);
    setChooseError(null);
    try {
      const deal = await selectOfferDeal(store, chooseId, chooseVersion);
      setChooseId(null);
      router.push(dealHref(deal.id));
    } catch (err) {
      if (flowCode(err) === "MA904") {
        setChooseId(null); setActionError(staleReview);
        await store.ensureRequest(r.id).catch(() => undefined);
      } else setChooseError((err as { userMessage?: string })?.userMessage || "ვერ შესრულდა.");
    } finally {
      setChoosePending(false);
    }
  }

  const choose = (offerId: string) => {
    setChooseVersion(store?.visibleOffers(r.id).find((o: { id: string }) => o.id === offerId)?.updatedAt || null);
    setChooseError(null); setChooseId(offerId);
  };

  const responsePanel = (!sessionReady ? <section className="request-session-note" role="status"><Icon name="user-round"/><p>ანგარიში მოწმდება…</p></section> : isOwner || me?.role === "admin" ? (
        <>
          <div className="request-offers-header">
            <div><h2 className="request-offers__title" id="request-offers-title">შეთავაზებები <span className="request-offers-count">{offers.length}</span>
              {offers.some(o => o.isNew) ? <span className="request-offers__new">{offers.filter(o => o.isNew).length} ახალი</span> : null}
            </h2><p className="request-offers-privacy"><Icon name="lock" />შეთავაზებებს ხედავთ მხოლოდ თქვენ და MeetAny-ის ადმინისტრატორი.</p></div>
            {offers.length > 1 ? <div className="request-offers-tools"><label className="ma-sr-only" htmlFor="offer-sort">შეთავაზებების დალაგება</label><CustomSelect id="offer-sort" value={offerSort} onChange={e => setOfferSort(e.target.value)}><option value="newest">ახალი შეთავაზებები</option><option value="delivery">მიწოდების ვადა</option></CustomSelect></div> : null}
          </div>
          {isOwner && r.chosenOfferId ? dealId ? <Button variant="primary" href={dealHref(dealId)}>გარიგების ნახვა</Button> : <Button variant="primary" disabled={choosePending} onClick={() => choose(r.chosenOfferId)}>გარიგების ჩანაწერის შექმნა</Button> : null}
          {contact ? (
            <section className="ma-panel">
              <h2 className="ma-h3">საკონტაქტო ინფორმაცია</h2>
              <p>
                {contact.name} · {contact.company}
              </p>
              <p>{contact.email}</p>
              {contact.phone ? <CallButton variant="secondary" phone={contact.phone} requestId={r.id} contactId={chosenCompanyId} source="chosen-offer" /> : null}
              {isOwner && chosenCompanyId ? <MessageButton companyId={chosenCompanyId} requestId={r.id}/> : null}
            </section>
          ) : null}
          {offers.length === 0 ? (
            <EmptyState icon="inbox" title="შეთავაზება ჯერ არ მიღებულა" text="კომპანიების პასუხები აქ გამოჩნდება. მეტი გამოხმაურებისთვის გააზიარეთ მოთხოვნა." />
          ) : (
            <div className="ma-stack request-offer-list">
              {orderedOffers.map((o) => (
                <OfferCard store={store!} key={o.id} o={o} messageTarget={isOwner && o.companyId ? { companyId: o.companyId, requestId: r.id } : undefined} canReport={isOwner} canChoose={isOwner && !r.chosenOfferId && state === "open"} onChoose={() => choose(o.id)} />
              ))}
            </div>
          )}
        </>
      ) : me?.role === "company" ? (
        <section className="detail-aside__block">
          {myOffer ? (
            <>
              <h2 className="ma-h3">თქვენი შეთავაზება</h2>
              <OfferCard store={store!} o={myOffer} canChoose={false} messageTarget={{ companyId: me.id, requestId: r.id }} />
              {me.verified && state === "open" && myOffer.status === "sent" ? <div className="ma-stack">
                <div className="ma-cluster"><Button variant="secondary" href={offerHref} aria-label="შეთავაზების რედაქტირება"><Icon name="pencil"/>რედაქტირება</Button><Button variant="danger-quiet" type="submit" disabled={actionPending} aria-label="შეთავაზების გაუქმება" onClick={() => setConfirmKind("withdraw")}><Icon name="x"/>გაუქმება</Button></div>
              </div> : null}
              {contact ? <section className="ma-panel"><h3>არჩეული შეთავაზება</h3><p>{contact.company || contact.name} · {contact.email}</p>{contact.phone ? <CallButton phone={contact.phone} requestId={r.id} source="chosen-offer"/> : null}</section> : null}
            </>
          ) : closed ? (
            <p className="ma-note">მოთხოვნა შეთავაზებებს აღარ იღებს.</p>
          ) : (
            <>
              <h2 className="ma-h3" id="send-offer" tabIndex={-1}>შეთავაზების გაგზავნა</h2>
              <p className="ma-note">თქვენს შეთავაზებას მხოლოდ მოთხოვნის ავტორი ნახავს.</p>
              <Button variant="primary" href={`/offers/new/?requestId=${encodeURIComponent(r.id)}`}>შეთავაზების გაგზავნა</Button>
            </>
          )}
        </section>
      ) : closed ? (<p className="detail-aside__text">მოთხოვნა შეთავაზებებს აღარ იღებს. <Link className="detail-link" href="/requests/">ღია მოთხოვნების ნახვა</Link></p>) : null);

  return (
    <div className="ma-page request-detail detail-page request-workspace" data-owner={isOwner || undefined}>
      <nav className={`detail-breadcrumb ${styles.breadcrumbs}`} aria-label="ნავიგაცია">{isOwner ? <Link href="/account/?tab=requests">ჩემი მოთხოვნები</Link> : <><Link href="/requests/">მოთხოვნები</Link><span>/</span><Link href={`/requests/?category=${encodeURIComponent(r.category)}`}>{categories[r.category] || r.category}</Link></>}<span>/</span><span>{r.title}</span></nav>
      <header className="detail-hero">
        <div className={styles.titleRow}><h1 className="detail-hero__title" tabIndex={-1}>{r.title}</h1><span className="detail-status" data-tone={state === "chosen" ? "chosen" : state !== "open" ? "closed" : daysLeft <= 0 ? "urgent" : undefined}>{state === "open" ? "ღიაა" : statusText}</span></div>
        <ul className={styles.facts} aria-label="მოთხოვნის ფაქტები">{facts.map(([icon, label, value]) => <li key={label}><Icon name={icon}/><span><span className="ma-sr-only">{label}: </span>{value}</span></li>)}</ul>
        {posted ? <p className={styles.posted}>გამოქვეყნდა {posted}</p> : null}
      </header>
      <div className="request-detail-grid">
        <div className="request-detail-main">
          <section className="request-description" aria-label="მოთხოვნის აღწერა">
            <div className="request-description-brief"><h2><Icon name="file-text"/>მოთხოვნის აღწერა</h2><div className="request-description-content">
            <p className="ma-prose">{r.body}</p>{r.neededBy ? <p className={styles.note}><Icon name="calendar"/>მიწოდების ვადა: {dateShort(r.neededBy)}</p> : null}{showAddress ? <p className={styles.note}><Icon name="map-pin"/>{cityLabel}, {addressLabel(r.addressNote)}</p> : null}{/* Once the caller is known: earlier, the SSR preview store and then the signed-out singleton each read them anonymously. */}{sessionReady ? <><RequestPreferenceRecord key={`${r.id}:${me?.id||"guest"}`} store={store!} id={r.id} editable={isOwner&&!closed} hideBudget={!!budgetLabel(r)}/><FileAttachments key={`files:${r.id}:${me?.id||"guest"}`} store={store!} kind="request" target={r.id} editable={isOwner&&!closed} optional/></> : null}

            </div></div>
          </section>
          {r.photo ? <section className="detail-media-card"><h2 className="detail-section-title">ფოტო</h2>
            <a className="request-photo-file" href={r.photo} target="_blank" rel="noopener noreferrer" download aria-label="ფოტოს ჩამოტვირთვა — მყიდველის მაგალითი">
              <Image src={r.photo} alt="" width={112} height={70} sizes="112px" unoptimized={!optimizable(r.photo)}/>
              <span><strong>მოთხოვნის ფოტო</strong><small>მყიდველის მაგალითი</small></span>
              <Icon name="download"/>
            </a>
          </section> : null}
          {isOwner || me?.role === "admin" ? <section className="request-responses" id="request-responses" aria-labelledby="request-offers-title">{responsePanel}</section> : null}

          {actionError ? <p role="alert" className="ma-field__error">{actionError}</p> : null}
        </div>
        <aside className="request-detail-aside" id="request-contact" aria-label={isOwner ? "მოთხოვნის მართვა" : "კონტაქტი და შეთავაზება"}>

          <section className="request-submit-card"><dl className="request-summary-facts">
            <div className={styles.budget}><dt>ბიუჯეტი</dt><dd>{budgetLabel(r) || "შეთანხმებით"}</dd></div>
            <div><dt>{state === "open" ? "მიღება სრულდება" : "სტატუსი"}</dt><dd>{state === "open" ? (daysLeft > 0 ? `${daysLeft} დღეში` : "დღეს") : statusText}</dd>{state === "open" ? <dd className="request-summary-facts__date">{dateShort(r.expiresAt)}</dd> : null}</div>
            <div><dt>შეთავაზებები</dt><dd>{offerCount ? `${offerCount} მიღებულია` : "ჯერ არ არის"}</dd></div>
          </dl>
          {offerAction ? <><Button variant="primary" className="request-submit-cta" href={offerAction.href}><Icon name="send"/>{offerAction.label}</Button><p className={styles.note}>{offerAction.hint}</p></> : null}{isOwner && offerCount > 0 ? <Button variant={r.chosenOfferId ? "secondary" : "primary"} className="request-submit-cta" href={compareHref(r.id)}>შეთავაზებების შედარება</Button> : null}{lockNote ? <p className={styles.note}><Icon name="lock"/>{lockNote}</p> : null}</section>
          {owner && !isOwner ? (
            <section className="request-author"><p className="detail-label">მყიდველი</p>
              <div className="request-author-identity"><Avatar className="detail-buyer-avatar" name={owner.company || owner.name || "მყიდველი"} logoUrl={owner.logoUrl} size={48} symbol={owner.role === "company" ? "building-2" : "user-round"} /><div><h2 className="detail-author__name">{owner.company || owner.name || "მყიდველი"}</h2><p>{cities[owner.city] || owner.city}</p>{owner.verified ? <Badge status="success"><Icon name="shield-check"/>ვერიფიცირებული</Badge> : null}</div></div>
              {owner.role === "company" ? <Button variant="secondary" style={{ width: "100%" }} href={`/companies/view/?id=${encodeURIComponent(owner.id)}`}>პროფილის ნახვა</Button> : null}
            </section>
          ) : null}
          {closed && me?.role !== "company" && !isOwner && me?.role !== "admin" ? responsePanel : null}

          {isOwner ? <section className="request-management"><h2><Icon name="settings"/>მოთხოვნის მართვა</h2><p className="request-management-note">{state === "open" ? "მოთხოვნა აქტიურია და კომპანიების პასუხებს იღებს." : statusText}</p>
            {offerCount === 0 && ["open", "closed", "expired"].includes(state) ? <Button type="button" variant="secondary" onClick={() => setEditRequest(true)}><Icon name="pencil"/>რედაქტირება</Button> : null}
            {["open", "closed", "expired"].includes(state) ? <Button type="button" variant="secondary" disabled={actionPending} onClick={() => setConfirmKind("extend")}><Icon name="calendar"/>{closed ? "ხელახლა გახსნა" : "ვადის გაგრძელება"}<span className="request-action-detail">+7 დღე</span></Button> : null}
            <details className="request-manage-more"><summary><Icon name="ellipsis"/>სხვა მოქმედებები</summary><div>
              {state === "open" ? <Button type="button" variant="secondary" disabled={actionPending} onClick={() => setConfirmKind("close")}><Icon name="lock"/>მოთხოვნის დახურვა</Button> : null}
              <Button type="button" variant="danger-quiet" disabled={actionPending} onClick={() => setConfirmKind("delete")}><Icon name="trash-2"/>მოთხოვნის წაშლა</Button>
            </div></details>
            {offerCount > 0 && state === "open" ? <p className="request-owner-note">რედაქტირება შეთავაზების მიღების შემდეგ შეზღუდულია.</p> : null}
          </section> : null}
          {/* Quiet actions: share and save side by side in one style; reporting is the one text link under them. */}
          <div className="request-secondary-actions">
            <div className="request-secondary-actions__row" role="group" aria-label="სხვა მოქმედებები">
              <Button variant="ghost" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); toast({ title: "ბმული დაკოპირდა.", tone: "success" }); } catch { setActionError("ბმული ვერ დაკოპირდა."); } }}><Icon name="copy"/>გაზიარება</Button>
              {!isOwner ? <SaveRequestButton id={r.id} /> : null}
            </div>
            {!isOwner && me?.role !== "admin" ? <ReportButton kind="request" targetId={r.id} /> : null}
          </div>
        </aside>
        {!isOwner && me?.role === "company" && (myOffer || closed) ? <div className="request-company-response">{responsePanel}</div> : null}
        {similar.length > 0 && <section className={styles.similar}><header className={styles.similarHead}><h2>მსგავსი მოთხოვნები</h2><Link href={`/requests/?category=${encodeURIComponent(r.category)}`}>ყველა მოთხოვნა</Link></header><div>{similar.map(item => <OpportunityCard key={item.id} request={item} compact />)}</div></section>}
      </div>

      {offerAction ? <div className="detail-actionbar"><Button variant="primary" href={offerAction.href}><Icon name="send"/>{offerAction.label}</Button></div> : null}
      {isOwner && offerCount > 0 ? <div className="detail-actionbar">{r.chosenOfferId && dealId ? <Button variant="primary" href={dealHref(dealId)}>გარიგების ნახვა</Button> : <Button variant="primary" href={compareHref(r.id)}>შეთავაზებების შედარება</Button>}</div> : null}

      <ConfirmSheet
        id="request-confirm"
        open={!!confirmKind}
        title={confirmKind === "extend" ? (closed ? "მოთხოვნის ხელახლა გახსნა" : "ვადის გაგრძელება") : confirmKind === "delete" ? "მოთხოვნის წაშლა" : confirmKind === "close" ? "მოთხოვნის დახურვა" : "შეთავაზების გაუქმება"}
        confirmLabel={confirmKind === "extend" ? (closed ? "ხელახლა გახსნა" : "ვადის გაგრძელება") : confirmKind === "delete" ? "მოთხოვნის წაშლა" : confirmKind === "close" ? "მოთხოვნის დახურვა" : "შეთავაზების გაუქმება"}
        pendingLabel="სრულდება…"
        danger={confirmKind !== "extend"}
        pending={actionPending}
        error={actionError || null}
        onConfirm={() => confirmKind && action(confirmKind)}
        onCancel={() => { setConfirmKind(null); setActionError(""); }}
      >
        <p>{confirmKind === "extend" ? (closed ? "მოთხოვნა ხელახლა გაიხსნება და შეთავაზებებს 7 დღე მიიღებს." : "შეთავაზებების მიღების ვადა 7 დღით გაგრძელდება.") : confirmKind === "delete" ? "მოთხოვნა და მისი ყველა შეთავაზება სამუდამოდ წაიშლება." : confirmKind === "close" ? "მოთხოვნა ახალ შეთავაზებებს აღარ მიიღებს. მოგვიანებით შეგიძლიათ ხელახლა გახსნა." : "მყიდველი თქვენს შეთავაზებას ვეღარ ნახავს. ხელახლა გაგზავნა შესაძლებელია, სანამ მოთხოვნა ღიაა."}</p>
      </ConfirmSheet>
      {editRequest ? <RequestFormSheet key={r.id} open existing={r} onClose={() => setEditRequest(false)} /> : null}
      <ChooseOfferSheet
        open={!!chooseId}
        companyName={chosenCard?.companyName || ""}
        offer={chosenCard ? { logoUrl: chosenCard.logoUrl, priceLabel: offerPrice(chosenCard), deliveryDays: chosenCard.deliveryDays } : undefined}
        request={{ title: r.title }}
        othersCount={offers.filter((o: OfferCardData) => o.id !== chooseId && o.status !== "declined").length}
        pending={choosePending}
        error={chooseError}
        onConfirm={confirmChoose}
        onCancel={() => {
          setChooseId(null);
          setChooseError(null);
        }}
      />
    </div>
  );
}
