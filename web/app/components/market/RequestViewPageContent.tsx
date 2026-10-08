"use client";
import { Button } from "../ui/Button";


import { SendOfferForm } from "./SendOfferForm";
import { compareHref, dealHref, selectOfferDeal, flowCode, staleReview } from "../../lib/deal-client";
import { CustomSelect } from "../ui/CustomSelect";
import { DetailSkeleton } from "./Skeletons";

import { useRequestDetail } from "../../lib/use-request-detail";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { toast } from "../Toasts";
import { RequestFormSheet } from "./RequestFormSheet";
import { useRouter } from "next/navigation";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { OfferCard, type OfferCardData } from "./OfferCard";
import { ChooseOfferSheet } from "./ChooseOfferSheet";
import { CallButton } from "./CallButton";
import { MessageButton } from "./ChatPopup";
import { ReportButton } from "./ReportButton";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { useCompanyFeatures } from "../../lib/business-client";
import { categories, cities, units } from "../../lib/categories";
import { AuthModal } from "./modals/AuthModal";
import { Badge } from "../ui/Badge";
import { OpportunityCard, type OpportunityRequest } from "./OpportunityCard";
import styles from "./request/RequestDetail.module.css";
import { addressLabel, dateLabel, postedLabel } from "../../lib/format";

export function RequestViewPageContent({ initial }: { initial?: PublicSnapshot }) {
  const { store, ready, sessionReady, available } = useMarketStore(initial);
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const detail = useRequestDetail(store, sessionReady, available, id);
  const business = useCompanyFeatures(store, ready && available);
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [editRequest, setEditRequest] = useState(false);
  const [editOffer, setEditOffer] = useState(false);
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



  if ((ready && !available) || detail.error) return <div className="ma-page"><ServiceUnavailable /></div>;

  if (!ready || (!data && (!sessionReady || detail.loading))) return <DetailSkeleton />;
  if (!data) {
    return (
      <div className="ma-page">
        <div className="ma-empty">
          <h2 className="ma-empty__title">მოთხოვნა ვერ მოიძებნა</h2>
          <Button variant="secondary" href="/requests/">
            მოთხოვნებზე დაბრუნება
          </Button>
        </div>
      </div>
    );
  }

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
  // The deadline lives in the facts and the aside; the meta says what, where and when it was posted.
  const posted = postedLabel(r.createdAt, now);
  const similar: OpportunityRequest[] = (store?.listRequests({ category: r.category }) || []).filter((item: OpportunityRequest) => item.id !== r.id).slice(0, 3).map((item: OpportunityRequest) => ({ ...item, daysLeft: store?.daysLeft(item) ?? 0 }));
  const offerHref = `/offers/new/?requestId=${encodeURIComponent(r.id)}`;
  const offerAction = !me ? { onClick: () => setAuthOpen(true) } : { href: me.verified ? offerHref : "/account/?tab=profile" };
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
            </h2><p className="request-offers-privacy"><Icon name="lock" />შეთავაზებები მხოლოდ შენ და ადმინისტრატორს გეჩვენებათ.</p></div>
            {offers.length > 1 ? <div className="request-offers-tools"><label className="ma-sr-only" htmlFor="offer-sort">შეთავაზებების დალაგება</label><CustomSelect id="offer-sort" value={offerSort} onChange={e => setOfferSort(e.target.value)}><option value="newest">ახალი შეთავაზებები</option><option value="delivery">მიწოდების ვადა</option></CustomSelect></div> : null}
          </div>
          {isOwner && r.chosenOfferId ? <Button variant="primary" disabled={choosePending} onClick={() => choose(r.chosenOfferId)}>გარიგების გახსნა</Button> : null}
          {contact ? (
            <section className="ma-panel">
              <h2 className="ma-h3">საკონტაქტო ინფორმაცია</h2>
              <p>
                {contact.name} · {contact.company}
              </p>
              <p>{contact.email}</p>
              {contact.phone ? <CallButton phone={contact.phone} requestId={r.id} contactId={chosenCompanyId} source="chosen-offer" /> : null}
              {isOwner && chosenCompanyId ? <MessageButton companyId={chosenCompanyId} requestId={r.id}/> : null}
            </section>
          ) : null}
          {offers.length === 0 ? (
            <div className="ma-empty">
              <h2 className="ma-empty__title">ჯერ შეთავაზება არ მიგიღია</h2>
              <p className="ma-empty__text">კომპანიების პასუხები აქ გამოჩნდება. მეტი გამოხმაურებისთვის გააზიარე მოთხოვნა.</p>
            </div>
          ) : (
            <div className="ma-stack request-offer-list">
              {orderedOffers.map((o) => (
                <OfferCard key={o.id} o={o} messageTarget={isOwner && o.companyId ? { companyId: o.companyId, requestId: r.id } : undefined} canReport={isOwner} canChoose={isOwner && !r.chosenOfferId && state === "open"} onChoose={() => choose(o.id)} />
              ))}
            </div>
          )}
        </>
      ) : me?.role === "company" ? (
        <section className="detail-aside__block">
          {myOffer ? (
            <>
              <h2 className="ma-h3">შენი შეთავაზება</h2>
              <OfferCard o={myOffer} canChoose={false} messageTarget={{ companyId: me.id, requestId: r.id }} />
              {me.verified && state === "open" && myOffer.status === "sent" ? <div className="ma-stack">
                <div className="ma-cluster"><Button variant="secondary" type="submit" aria-label="შეთავაზების რედაქტირება" onClick={() => setEditOffer(!editOffer)}><Icon name="pencil"/>რედაქტირება</Button><Button variant="danger-quiet" type="submit" disabled={actionPending} aria-label="შეთავაზების გაუქმება" onClick={() => setConfirmKind("withdraw")}><Icon name="x"/>გაუქმება</Button></div>
                {editOffer ? <SendOfferForm key={myOffer.id} requestId={r.id} existing={myOffer} onDone={() => setEditOffer(false)} onCancel={() => setEditOffer(false)}/> : null}
              </div> : null}
              {contact ? <section className="ma-panel"><h3>არჩეული შეთავაზება</h3><p>{contact.company || contact.name} · {contact.email}</p>{contact.phone ? <CallButton phone={contact.phone} requestId={r.id} source="chosen-offer"/> : null}</section> : null}
            </>
          ) : !me.verified ? (
            <div className="ma-stack" id="send-offer"><h2 className="ma-h3">კომპანია დასადასტურებელია</h2><p className="ma-note">შენი განაცხადი ადმინთანაა. დადასტურების შემდეგ შეძლებ შეთავაზების გაგზავნას.</p><Button variant="secondary" href="/account/?tab=profile">ჩემი პროფილის რედაქტირება</Button></div>
          ) : closed ? (
            <p className="ma-note">მოთხოვნა შეთავაზებებს აღარ იღებს.</p>
          ) : (
            <>
              <h2 className="ma-h3" id="send-offer" tabIndex={-1}>შეთავაზების გაგზავნა</h2>
              <p className="ma-note">შენს შეთავაზებას მხოლოდ მოთხოვნის ავტორი ნახავს.</p>
              <Button variant="primary" href={`/offers/new/?requestId=${encodeURIComponent(r.id)}`}>შეთავაზების მომზადება</Button>
            </>
          )}
        </section>
      ) : closed ? (<p className="detail-aside__text">მოთხოვნა შეთავაზებებს აღარ იღებს. <Link className="detail-link" href="/requests/">ღია მოთხოვნების ნახვა</Link></p>) : me ? (
        <section className="detail-aside__block" aria-label="შეთავაზებები">
          <p className="detail-aside__text">შენც გჭირდება მსგავსი რამ?</p>
          <Button variant="secondary" className="detail-aside__primary" href={`/requests/new/?${new URLSearchParams({ category: r.category, city: r.city })}`}>
            მოთხოვნის დამატება
          </Button>
        </section>
      ) : null);

  return (
    <div className="ma-page request-detail detail-page request-workspace" data-owner={isOwner || undefined}>
      <nav className="detail-breadcrumb" aria-label="ნავიგაცია"><Link href="/requests/">შესაძლებლობები</Link><span>/</span><Link href={`/requests/?category=${encodeURIComponent(r.category)}`}>{categories[r.category] || r.category}</Link><span>/</span><span>{r.title}</span></nav>
      <div className="request-detail-grid">
        <div className="request-detail-main">
          <section className="request-description" aria-label="მოთხოვნის აღწერა">
            <header className="detail-hero">
              <div className="detail-brief-meta"><Badge status={state === "open" || state === "chosen" ? "success" : "neutral"}>{state === "open" ? "ღიაა" : statusText}</Badge><span className="detail-category">{categories[r.category] || r.category}</span><span>{posted ? `გამოქვეყნდა ${posted}` : ""}</span></div>
              <h1 className="detail-hero__title" tabIndex={-1}>{r.title}</h1>
            </header>
            <dl className="request-detail-facts">
              <div><dt><Icon name="package"/>რაოდენობა</dt><dd>{r.quantity != null ? `${r.quantity} ${units[r.unit] || r.unit || ""}` : "არ არის მითითებული"}</dd></div>
              <div><dt><Icon name="map-pin"/>მიწოდება</dt><dd>{cities[r.city] || r.city}</dd></div>
              <div><dt><Icon name="calendar"/>მიწოდების ვადა</dt><dd>{r.neededBy ? dateLabel(r.neededBy) : "არ არის მითითებული"}</dd></div>
              <div><dt><Icon name="clock"/>შეთავაზებების ბოლო ვადა</dt><dd>{dateLabel(r.expiresAt)}</dd></div>
            </dl>
            <div className="request-description-brief"><h2><Icon name="file-text"/>მოთხოვნის აღწერა</h2><div className="request-description-content">
            <p className="ma-prose">{r.body}</p>

            </div></div>
          </section>
          <section className={styles.specs}><h2 className="detail-section-title">სპეციფიკაცია</h2><dl>
            <div><dt>კატეგორია</dt><dd>{categories[r.category] || r.category}</dd></div>
            {r.quantity != null && <div><dt>რაოდენობა / ერთეული</dt><dd>{r.quantity} {units[r.unit] || r.unit}</dd></div>}
            <div><dt>ქალაქი</dt><dd>{cities[r.city] || r.city}</dd></div>
            {r.addressNote && <div><dt>მისამართი</dt><dd>{addressLabel(r.addressNote)}</dd></div>}
            {r.neededBy && <div><dt>საჭირო თარიღი</dt><dd>{dateLabel(r.neededBy)}</dd></div>}
            {r.photo && <div><dt>ფოტო</dt><dd><a href={r.photo} target="_blank" rel="noopener noreferrer">მოთხოვნის ფოტოს ნახვა</a></dd></div>}
          </dl></section>
          {r.photo ? <section className="detail-media-card"><h2 className="detail-section-title">ფაილები</h2>
            <a href={r.photo} target="_blank" rel="noopener noreferrer" download aria-label="ფოტოს ჩამოტვირთვა — მყიდველის მაგალითი" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3)", border: "var(--size-1) solid var(--border)", borderRadius: "var(--radius-md)", color: "inherit" }}>
              <img src={r.photo} alt="" width={110} height={70} style={{ width: 110, height: 70, flex: "none", objectFit: "cover", borderRadius: "var(--radius-sm)" }}/>
              <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", fontSize: "var(--size-13)" }}>ფოტო</strong><span style={{ fontSize: "var(--size-12)", color: "var(--ink-500)" }}>მყიდველის მაგალითი</span></span>
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none", color: "var(--ink-500)" }}><path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/></svg>
            </a>
          </section> : null}
          {isOwner || me?.role === "admin" ? <section className="request-responses" id="request-responses" aria-labelledby="request-offers-title">{responsePanel}</section> : null}

          {actionError ? <p role="alert" className="ma-field__error">{actionError}</p> : null}
        </div>
        <aside className="request-detail-aside" id="request-contact" aria-label={isOwner ? "მოთხოვნის მართვა" : "კონტაქტი და შეთავაზება"}>

          <section className="request-submit-card"><dl className="request-summary-facts"><div><dt>მიღება სრულდება</dt><dd>{state === "open" ? (daysLeft > 0 ? `${daysLeft} დღეში` : "დღეს") : statusText}</dd></div><div><dt>მიღებულია</dt><dd>{offerCount} შეთავაზება</dd></div></dl>
          {sessionReady && !isOwner && state === "open" && (!me || (me.role === "company" && !myOffer)) ? <Button variant="primary" className="request-submit-cta" {...offerAction}><Icon name="send"/>შეთავაზების გაგზავნა</Button> : null}{isOwner ? <Button variant="primary" className="request-submit-cta" href={compareHref(r.id)}>შეთავაზებების შედარება</Button> : null}<p className={styles.note}><Icon name="lock"/>კონტაქტი იხსნება არჩევის შემდეგ</p></section>
          {owner ? (
            <section className="request-author"><p className="detail-label">მყიდველი</p>
              <div className="request-author-identity"><span className="detail-buyer-avatar">{owner.logoUrl ? <img src={owner.logoUrl} alt=""/> : (owner.company || owner.name || "მყიდველი").slice(0, 2)}</span><div><h2 className="detail-author__name">{owner.company || owner.name || "მყიდველი"}</h2><p>{cities[owner.city] || owner.city}</p>{owner.verified ? <Badge status="success"><Icon name="shield-check"/>ვერიფიცირებული</Badge> : null}</div></div>
              {owner.role === "company" ? <Button variant="secondary" style={{ width: "100%" }} href={`/companies/view/?id=${encodeURIComponent(owner.id)}`}>კომპანიის პროფილი</Button> : null}
            </section>
          ) : null}
          {me && !isOwner && me.role !== "admin" && me.role !== "company" ? responsePanel : null}

          {isOwner ? <section className="request-management"><h2><Icon name="settings"/>მოთხოვნის მართვა</h2><p className="request-management-note">{state === "open" ? "მოთხოვნა აქტიურია და კომპანიების პასუხებს იღებს." : statusText}</p>
            {offerCount === 0 && ["open", "closed", "expired"].includes(state) ? <Button type="button" variant="secondary" onClick={() => setEditRequest(true)}><Icon name="pencil"/>რედაქტირება</Button> : null}
            {["open", "closed", "expired"].includes(state) ? <Button type="button" variant="secondary" disabled={actionPending} onClick={() => setConfirmKind("extend")}><Icon name="calendar"/>{closed ? "ხელახლა გახსნა" : "ვადის გაგრძელება"}<span className="request-action-detail">+7 დღე</span></Button> : null}
            <details className="request-manage-more"><summary><Icon name="ellipsis"/>სხვა მოქმედებები</summary><div>
              {state === "open" ? <Button type="button" variant="secondary" disabled={actionPending} onClick={() => setConfirmKind("close")}><Icon name="lock"/>მოთხოვნის დახურვა</Button> : null}
              <Button type="button" variant="danger-quiet" disabled={actionPending} onClick={() => setConfirmKind("delete")}><Icon name="trash-2"/>მოთხოვნის წაშლა</Button>
              {offerCount > 0 && state === "open" ? <p className="request-owner-note">რედაქტირება შეთავაზების მიღების შემდეგ შეზღუდულია.</p> : null}
            </div></details>
          </section> : null}
          <Button variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); toast({ title: "ბმული დაკოპირდა.", tone: "success" }); } catch { setActionError("ბმული ვერ დაკოპირდა."); } }}><Icon name="copy"/>გაზიარება</Button>
          {!isOwner && me?.role !== "admin" ? <ReportButton kind="request" targetId={r.id} /> : null}
        </aside>
        {!isOwner && me?.role === "company" && (myOffer || !me.verified || closed) ? <div className="request-company-response">{responsePanel}</div> : null}
      </div>

      {sessionReady && !isOwner && state === "open" && (!me || (me.role === "company" && !myOffer)) ? <div className="detail-actionbar">
        {me ? <Button variant="primary" href={me.verified ? `/offers/new/?requestId=${encodeURIComponent(r.id)}` : "/account/?tab=profile"}><Icon name={me.verified ? "send" : "building-2"}/>{me.verified ? "შეთავაზების გაგზავნა" : "ჩემი პროფილის რედაქტირება"}</Button>
          : <Button variant="primary" onClick={() => setAuthOpen(true)}><Icon name="send"/>შეთავაზების გაგზავნა</Button>}
      </div> : null}
      {isOwner ? <div className="detail-actionbar"><Button variant="primary" href={compareHref(r.id)}>შეთავაზებების შედარება</Button></div> : null}
      {similar.length > 0 && <section className={styles.similar}><header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}><h2 style={{ margin: 0 }}>მსგავსი შესაძლებლობები</h2><Link href={`/requests/?category=${encodeURIComponent(r.category)}`} style={{ flexShrink: 0, fontSize: "var(--size-13)", fontWeight: "var(--fw-semibold)" }}>ყველას ნახვა</Link></header><div>{similar.map(item => <OpportunityCard key={item.id} request={item} compact />)}</div></section>}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={() => { const user = store?.currentUser(); if (user?.role === "company") router.push(user.verified ? offerHref : "/account/?tab=profile"); else if (user?.role === "admin") router.push("/admin/"); }} intent="offer" context={r.title} next={offerHref} />
      <ConfirmSheet
        id="request-confirm"
        open={!!confirmKind}
        title={confirmKind === "extend" ? "ვადის გაგრძელება" : confirmKind === "delete" ? "მოთხოვნის წაშლა" : confirmKind === "close" ? "მოთხოვნის დახურვა" : "შეთავაზების გაუქმება"}
        confirmLabel={confirmKind === "extend" ? "გაგრძელება" : confirmKind === "delete" ? "წაშლა" : confirmKind === "close" ? "დახურვა" : "გაუქმება"}
        pendingLabel="სრულდება…"
        danger={confirmKind !== "extend"}
        pending={actionPending}
        error={actionError || null}
        onConfirm={() => confirmKind && action(confirmKind)}
        onCancel={() => { setConfirmKind(null); setActionError(""); }}
      >
        <p>{confirmKind === "extend" ? "შეთავაზებების მიღების ვადა 7 დღით გაგრძელდება." : confirmKind === "delete" ? "მოთხოვნა და მისი ყველა შეთავაზება სამუდამოდ წაიშლება." : confirmKind === "close" ? "მოთხოვნა ახალ შეთავაზებებს აღარ მიიღებს. მოგვიანებით შეგიძლია ხელახლა გახსნა." : "კომპანია შენს შეთავაზებას ვეღარ ნახავს. ხელახლა გაგზავნა შესაძლებელია, სანამ მოთხოვნა ღიაა."}</p>
      </ConfirmSheet>
      {editRequest ? <RequestFormSheet key={r.id} open existing={r} onClose={() => setEditRequest(false)} /> : null}
      <ChooseOfferSheet
        open={!!chooseId}
        companyName={offers.find((o: OfferCardData) => o.id === chooseId)?.companyName || ""}
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
