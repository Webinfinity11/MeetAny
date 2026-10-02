"use client";
import { Button } from "../ui/Button";


import { useFieldErrors, type FieldErrors } from "./fieldErrors";
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
import { CompanyAvatar } from "./CompanyAvatar";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { offerPrice, OfferCard, type OfferCardData } from "./OfferCard";
import { ChooseOfferSheet } from "./ChooseOfferSheet";
import { CallButton } from "./CallButton";
import { MessageButton } from "./ChatPopup";
import { ReportButton } from "./ReportButton";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { useCompanyFeatures } from "../../lib/business-client";
import { categories, cities, units } from "../../lib/categories";
import { usePublicPhone } from "../../lib/phones";
import { addressLabel, dateLabel, postedLabel } from "../../lib/format";

// Price is optional; existing API supports agreed, unit and total terms in GEL.
function SendOfferForm({ requestId, existing, onDone }: { requestId: string; existing?: OfferCardData; onDone: () => void }) {
  const { store } = useMarketStore();
  const [deliveryDays, setDeliveryDays] = useState(existing?.deliveryDays != null ? String(existing.deliveryDays) : "");
  const [body, setBody] = useState(existing?.body || "");
  const [priceType,setPriceType]=useState(existing?.priceType || "negotiable");
  const [price,setPrice]=useState(existing?.price!=null?String(existing.price):"");
  const [vatIncluded,setVatIncluded]=useState(!!existing?.vatIncluded);
  const [deliveryIncluded,setDeliveryIncluded]=useState(!!existing?.deliveryIncluded);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const v = useFieldErrors();
  const draftOwner = store?.currentUser()?.id;
  const draftKey = draftOwner ? `meetany.offerDraft.${draftOwner}.${requestId}` : null;
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  useEffect(() => {
    if (!draftKey || existing) return;
    const timer = setTimeout(() => {
    if (!existing && draftKey) {
      try {const saved = JSON.parse(localStorage.getItem(draftKey) || "null"); if (saved) {setBody(saved.body || ""); setDeliveryDays(saved.deliveryDays || "");setPriceType(["negotiable","unit","total"].includes(saved.priceType)?saved.priceType:"negotiable");setPrice(saved.price || "");setVatIncluded(!!saved.vatIncluded);setDeliveryIncluded(!!saved.deliveryIncluded);}} catch {}
    }
    setLoadedDraftKey(draftKey);
    }, 0);
    return () => clearTimeout(timer);
  }, [draftKey, existing]);
  useEffect(() => {
    if (loadedDraftKey !== draftKey || existing || !draftKey) return;
    try {localStorage.setItem(draftKey, JSON.stringify({body, deliveryDays,priceType,price,vatIncluded,deliveryIncluded}));} catch {}
  }, [draftKey, body, deliveryDays, priceType, price, vatIncluded, deliveryIncluded, loadedDraftKey, existing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    const errors: FieldErrors = {};
    if (body.trim().length < 10) errors["of-body"] = body.trim() ? "აღწერა მინიმუმ 10 სიმბოლოა" : "აღწერე შენი შეთავაზება";
    const days = Number(deliveryDays);
    if (deliveryDays.trim() && (!Number.isInteger(days) || days < 0 || days > 365)) errors["of-days"] = "მიწოდების ვადა უნდა იყოს 0-დან 365 დღემდე";
    if(priceType!=="negotiable") {
      const amount=Number(price.trim().replace(",","."));
      if(!/^\d+(?:[.,]\d{1,2})?$/.test(price.trim()) || amount<=0 || amount>1000000000)errors["of-price"]="მიუთითე ფასი ლარში, მაქსიმუმ ორი ათწილადი ნიშნით";
    }
    if (!v.check(errors, ["of-price", "of-days", "of-body"])) return;
    setPending(true);
    setError(null);
    try {
      await store.sendOffer(requestId, { deliveryDays: deliveryDays || undefined, body, priceType, price:priceType==="negotiable"?undefined:price, vatIncluded, deliveryIncluded });
      try { if(draftKey)localStorage.removeItem(draftKey); } catch {}
      toast(existing ? "შეთავაზება განახლდა." : "შეთავაზება გაიგზავნა.");
      onDone();
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "შეთავაზება ვერ გაიგზავნა. სცადე თავიდან.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="ma-form" onSubmit={submit} noValidate>
      <div className="ma-field"><label className="ma-field__label" htmlFor="of-price-type">ფასი</label><CustomSelect id="of-price-type" className="ma-select" value={priceType} onChange={e=>{setPriceType(e.target.value);v.clear("of-price");}}><option value="negotiable">შეთანხმებით</option><option value="total">ჯამური ფასი</option><option value="unit">ერთეულის ფასი</option></CustomSelect></div>
      {priceType!=="negotiable"?<><div className="ma-field"><label className="ma-field__label" htmlFor="of-price">თანხა ლარში (₾) *</label><input className="ma-input" inputMode="decimal" value={price} onChange={e=>{setPrice(e.target.value);v.clear("of-price");}} {...v.control("of-price")}/>{v.message("of-price")}<small className="ma-note">ერთეულის ფასის შემთხვევაში აღწერაში მიუთითე ერთეული.</small></div><label className="ma-check"><input type="checkbox" checked={vatIncluded} onChange={e=>setVatIncluded(e.target.checked)}/>დღგ ფასში შედის</label></>:null}
      <label className="ma-check"><input type="checkbox" checked={deliveryIncluded} onChange={e=>setDeliveryIncluded(e.target.checked)}/>მიწოდების ხარჯი შეთავაზებაში შედის</label>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="of-days">
          მიწოდება (დღე) <span className="ma-field__opt">არასავალდებულო</span>
        </label>
        <input className="ma-input" inputMode="numeric" value={deliveryDays} onChange={(e) => {setDeliveryDays(e.target.value); v.clear("of-days");}} {...v.control("of-days")} />
        {v.message("of-days")}
      </div>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="of-body">
          შეთავაზების აღწერა *
        </label>
        <textarea className="ma-textarea" placeholder="რა შედის შეთავაზებაში, გადახდის პირობები, გარანტია და სხვა დეტალები" required minLength={10} maxLength={2000} value={body} onChange={(e) => {setBody(e.target.value); v.clear("of-body");}} {...v.control("of-body")} />
        {v.message("of-body")}
      </div>
      {error ? (
        <p className="ma-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <Button variant="primary" type="submit" disabled={pending}>
        {pending ? "იგზავნება…" : existing ? "შეთავაზების განახლება" : "შეთავაზების გაგზავნა"} <Icon name="send" />
      </Button>
    </form>
  );
}

export function RequestViewPageContent({ initial }: { initial?: PublicSnapshot }) {
  const { store, ready, sessionReady, available } = useMarketStore(initial);
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const detail = useRequestDetail(store, sessionReady, available, id);
  const business = useCompanyFeatures(store, ready && available);
  const router = useRouter();
  const [editRequest, setEditRequest] = useState(false);
  const [editOffer, setEditOffer] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [offerSort, setOfferSort] = useState("newest");
  const [compare, setCompare] = useState(false);
  const [chooseId, setChooseId] = useState<string | null>(null);
  const [choosePending, setChoosePending] = useState(false);
  const [chooseError, setChooseError] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<"close" | "delete" | "withdraw" | null>(null);
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
    const mapOffer = (o: { id: string; companyUserId: string; createdAt: string; deliveryDays: number | null; price: number | null; priceType: string; vatIncluded: boolean; deliveryIncluded: boolean; body: string; status: string }): OfferCardData => {
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

  const ownerPhone = usePublicPhone(store, data?.r.ownerId);

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
    if (!chooseId || !store) return;
    setChoosePending(true);
    setChooseError(null);
    try {
      await store.chooseOffer(chooseId);
      setChooseId(null);
      toast("შეთავაზება არჩეულია. კომპანიის კონტაქტი ქვემოთ ჩანს.");
    } catch (err) {
      setChooseError((err as { userMessage?: string })?.userMessage || "ვერ შესრულდა.");
    } finally {
      setChoosePending(false);
    }
  }

  const responsePanel = (!sessionReady ? <section className="request-session-note" role="status"><Icon name="user-round"/><p>ანგარიში მოწმდება…</p></section> : isOwner || me?.role === "admin" ? (
        <>
          <div className="request-offers-header">
            <div><h2 className="request-offers__title" id="request-offers-title">შეთავაზებები <span className="request-offers-count">{offers.length}</span>
              {offers.some(o => o.isNew) ? <span className="request-offers__new">{offers.filter(o => o.isNew).length} ახალი</span> : null}
            </h2><p className="request-offers-privacy"><Icon name="lock" />შეთავაზებები მხოლოდ შენ და ადმინისტრატორს გეჩვენებათ.</p></div>
            {offers.length > 1 ? <div className="request-offers-tools"><label className="ma-sr-only" htmlFor="offer-sort">შეთავაზებების დალაგება</label><CustomSelect id="offer-sort" value={offerSort} onChange={e => setOfferSort(e.target.value)}><option value="newest">ახალი შეთავაზებები</option><option value="delivery">მიწოდების ვადა</option></CustomSelect><Button variant="secondary" type="submit" aria-pressed={compare} onClick={() => setCompare(!compare)}><Icon name={compare ? "layout-grid" : "list-filter"}/>{compare ? "სია" : "შედარება"}</Button></div> : null}
          </div>
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
          {compare && offers.length > 1 ? <section className="offer-comparison" aria-label="შეთავაზებების შედარება">{orderedOffers.map(o=><article className="offer-comparison__card" key={o.id}><header><h3><Link href={o.companyHref}>{o.companyName}</Link></h3>{o.status==="chosen"?<span className="ma-badge ma-badge--success">არჩეულია</span>:null}</header><dl className="offer-terms"><div><dt>ფასი</dt><dd>{offerPrice(o)}</dd></div><div><dt>მიწოდება</dt><dd>{o.deliveryDays!=null?`${o.deliveryDays} დღე`:"დასაზუსტებელია"}</dd></div><div><dt>დღგ</dt><dd>{o.price==null?"დასაზუსტებელია":o.vatIncluded?"ფასში შედის":"ფასში არ შედის"}</dd></div><div><dt>მიწოდების ხარჯი</dt><dd>{o.deliveryIncluded?"შედის":"დასაზუსტებელია"}</dd></div></dl><details><summary>სრული პირობები</summary><p>{o.body}</p></details><footer>{isOwner && o.companyId ? <MessageButton companyId={o.companyId} requestId={r.id} variant="ghost" /> : null}<Button variant="secondary" href={o.companyHref}>კომპანიის ნახვა</Button>{isOwner&&!r.chosenOfferId&&state==="open"&&o.status==="sent"?<Button variant="primary" onClick={()=>setChooseId(o.id)}>შეთავაზების არჩევა</Button>:null}</footer></article>)}</section> : null}
          {offers.length === 0 ? (
            <div className="ma-empty">
              <h2 className="ma-empty__title">ჯერ შეთავაზება არ მიგიღია</h2>
              <p className="ma-empty__text">კომპანიების პასუხები აქ გამოჩნდება. მეტი გამოხმაურებისთვის გააზიარე მოთხოვნა.</p>
            </div>
          ) : !compare || offers.length < 2 ? (
            <div className="ma-stack request-offer-list">
              {orderedOffers.map((o) => (
                <OfferCard key={o.id} o={o} messageTarget={isOwner && o.companyId ? { companyId: o.companyId, requestId: r.id } : undefined} canReport={isOwner} canChoose={isOwner && !r.chosenOfferId && state === "open"} onChoose={() => setChooseId(o.id)} />
              ))}
            </div>
          ) : null}
        </>
      ) : me?.role === "company" ? (
        <section className="detail-aside__block">
          {myOffer ? (
            <>
              <h2 className="ma-h3">შენი შეთავაზება</h2>
              <OfferCard o={myOffer} canChoose={false} messageTarget={{ companyId: me.id, requestId: r.id }} />
              {me.verified && state === "open" && myOffer.status === "sent" ? <div className="ma-stack">
                <div className="ma-cluster"><Button variant="secondary" type="submit" aria-label="შეთავაზების რედაქტირება" onClick={() => setEditOffer(!editOffer)}><Icon name="pencil"/>რედაქტირება</Button><Button variant="danger-quiet" type="submit" disabled={actionPending} aria-label="შეთავაზების გაუქმება" onClick={() => setConfirmKind("withdraw")}><Icon name="x"/>გაუქმება</Button></div>
                {editOffer ? <SendOfferForm key={myOffer.id} requestId={r.id} existing={myOffer} onDone={() => setEditOffer(false)}/> : null}
              </div> : null}
              {contact ? <section className="ma-panel"><h3>არჩეული შეთავაზება</h3><p>{contact.company || contact.name} · {contact.email}</p>{contact.phone ? <CallButton phone={contact.phone} requestId={r.id} source="chosen-offer"/> : null}</section> : null}
            </>
          ) : !me.verified ? (
            <div className="ma-stack" id="send-offer"><h2 className="ma-h3">კომპანია დასადასტურებელია</h2><p className="ma-note">შენი განაცხადი ადმინთანაა. დადასტურების შემდეგ შეძლებ შეთავაზების გაგზავნას.</p><Button variant="secondary" href="/account/?tab=profile">ჩემი პროფილის რედაქტირება</Button></div>
          ) : closed ? (
            <p className="ma-note">მოთხოვნა შეთავაზებებს აღარ იღებს.</p>
          ) : (
            <>
              <h2 className="ma-h3" id="send-offer">შეთავაზების გაგზავნა</h2>
              <p className="ma-note">შენს შეთავაზებას მხოლოდ მოთხოვნის ავტორი ნახავს.</p>
              <SendOfferForm requestId={r.id} onDone={() => undefined} />
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
      ) : (
        <section className="detail-aside__block" aria-label="შეთავაზების გაგზავნა">
          <h2 className="ma-h3">გაქვს შესაბამისი მომსახურება?</h2>
          <p className="detail-aside__text">შედი კომპანიის ანგარიშით და გაუგზავნე ავტორს შენი პირობები.</p>
          <Button variant="primary" className="detail-aside__primary" href={`/account/?next=${encodeURIComponent(`/requests/view/?id=${encodeURIComponent(r.id)}`)}`}>
            შესვლა და შეთავაზება
          </Button>
          <Link className="detail-link" href={`/account/?tab=register&role=company&next=${encodeURIComponent(`/requests/view/?id=${encodeURIComponent(r.id)}`)}`}>
            კომპანიის რეგისტრაცია
          </Link>
        </section>
      ));

  return (
    <div className="ma-page request-detail detail-page request-workspace" data-owner={isOwner || undefined}>
      <div className="request-topline"><Link className="ma-back" href={isOwner ? "/account/?tab=requests" : "/requests/"}><Icon name="clipboard-list"/>{isOwner ? "ჩემი მოთხოვნები" : "მოთხოვნები"}</Link><span className="request-state" data-state={state}><Icon name={state === "open" ? "clock" : state === "chosen" ? "circle-check" : "lock"}/>{state === "open" ? `ღიაა · ${statusText}` : statusText}</span></div>
      {/* Each fact appears once: context line, title, then a plain fact list next to the text. */}
      <header className="detail-hero">
        <p className="detail-hero__context">{categories[r.category] || r.category}{posted ? ` · გამოქვეყნდა ${posted}` : ""}</p>
        <h1 className="detail-hero__title">{r.title}</h1>
        {isOwner && offers.length ? <a className="request-offer-shortcut" href="#request-responses"><Icon name="inbox"/>{offers.length} შეთავაზების ნახვა</a> : null}
      </header>
      <div className="request-detail-grid">
        <div className="request-detail-main">
          <section className="request-description" aria-label="მოთხოვნის აღწერა">
            <dl className="request-detail-facts">
              <div><dt><Icon name="map-pin"/>ადგილი</dt><dd>{[cities[r.city] || r.city, r.addressNote ? addressLabel(r.addressNote) : null].filter(Boolean).join(" · ")}</dd></div>
              {r.quantity != null ? <div><dt><Icon name="package"/>რაოდენობა</dt><dd>{r.quantity} {units[r.unit] || r.unit}</dd></div> : null}
              {r.neededBy ? <div><dt><Icon name="calendar"/>საჭიროა</dt><dd>{dateLabel(r.neededBy)}-მდე</dd></div> : null}
              {state === "open" ? <div><dt><Icon name="clock"/>შეთავაზებების მიღება</dt><dd>{dateLabel(r.expiresAt)}-მდე</dd></div> : null}
            </dl>
            <div className="request-description-brief"><h2><Icon name="file-text"/>მოთხოვნის აღწერა</h2><div className="request-description-content">
            <p className="ma-prose">{r.body}</p>
            {r.photo ? <figure className="detail-photo"><a href={r.photo} target="_blank" rel="noopener noreferrer"><img src={r.photo} alt="მოთხოვნის ფოტო"/></a></figure> : null}
            </div></div>
          </section>
          {isOwner || me?.role === "admin" ? <section className="request-responses" id="request-responses" aria-labelledby="request-offers-title">{responsePanel}</section> : null}
          {!isOwner && me?.role === "company" ? responsePanel : null}
          {actionError ? <p role="alert" className="ma-field__error">{actionError}</p> : null}
        </div>
        <aside className="request-detail-aside" id="request-contact" aria-label={isOwner ? "მოთხოვნის მართვა" : "კონტაქტი და შეთავაზება"}>

          {owner && !isOwner ? (
            <section className="request-author">
              <div className="request-author-identity"><CompanyAvatar name={owner.company || owner.name} logoUrl={owner.logoUrl} /><div><h2 className="detail-author__name">{owner.company || owner.name}</h2><p>მოთხოვნის ავტორი</p></div></div>
              {ownerPhone ? <CallButton phone={ownerPhone} variant="secondary" contactId={r.ownerId} requestId={r.id} source="request-owner" /> : null}
              {!isOwner && me?.role === "company" ? <MessageButton companyId={me.id} requestId={r.id}/> : null}
            </section>
          ) : null}
          {!isOwner && me?.role !== "admin" && me?.role !== "company" ? responsePanel : null}
          {sessionReady && !isOwner && me?.role !== "admin" ? <p className="request-offer-privacy">{offerCount} შეთავაზება · პასუხებს მხოლოდ მოთხოვნის ავტორი ხედავს.</p> : null}
          {isOwner ? <section className="request-management"><h2><Icon name="settings"/>მოთხოვნის მართვა</h2><p className="request-management-note">{state === "open" ? "მოთხოვნა აქტიურია და კომპანიების პასუხებს იღებს." : statusText}</p>
            {offerCount === 0 && ["open", "closed", "expired"].includes(state) ? <Button type="button" variant="secondary" onClick={() => setEditRequest(true)}><Icon name="pencil"/>რედაქტირება</Button> : null}
            {["open", "closed", "expired"].includes(state) ? <Button type="button" variant="secondary" disabled={actionPending} onClick={() => action("extend")}><Icon name="calendar"/>{closed ? "ხელახლა გახსნა" : "ვადის გაგრძელება"}<span className="request-action-detail">+7 დღე</span></Button> : null}
            <details className="request-manage-more"><summary><Icon name="ellipsis"/>სხვა მოქმედებები</summary><div>
              {state === "open" ? <Button type="button" variant="secondary" disabled={actionPending} onClick={() => setConfirmKind("close")}><Icon name="lock"/>მოთხოვნის დახურვა</Button> : null}
              <Button type="button" variant="danger-quiet" disabled={actionPending} onClick={() => setConfirmKind("delete")}><Icon name="trash-2"/>მოთხოვნის წაშლა</Button>
              {offerCount > 0 && state === "open" ? <p className="request-owner-note">რედაქტირება შეთავაზების მიღების შემდეგ შეზღუდულია.</p> : null}
            </div></details>
          </section> : null}
          <div className="detail-share" role="group" aria-labelledby="detail-share-label">
            <span className="detail-label" id="detail-share-label">გაზიარება</span>
            <div className="detail-share__links">
              <button type="button" className="detail-link" onClick={async () => {try {await navigator.clipboard.writeText(shareUrl); toast("ბმული დაკოპირდა.");} catch {setActionError("ბმული ვერ დაკოპირდა.");}}}><Icon name="copy"/>ბმულის კოპირება</button>
              <a className="detail-link" href={`https://wa.me/?text=${encodeURIComponent(r.title + "\n" + shareUrl)}`} target="_blank" rel="noopener noreferrer"><Icon name="message-square"/>WhatsApp</a>
            </div>
          </div>
          {!isOwner && me?.role !== "admin" ? <ReportButton kind="request" targetId={r.id} /> : null}
        </aside>
      </div>

      {sessionReady && !isOwner && state === "open" && (!me || (me.role === "company" && !myOffer)) ? <div className="detail-actionbar">
        {me ? <Button variant="primary" href={me.verified ? "#send-offer" : "/account/?tab=profile"}><Icon name={me.verified ? "send" : "building-2"}/>{me.verified ? "შეთავაზების გაგზავნა" : "ჩემი პროფილის რედაქტირება"}</Button>
          : <Button variant="primary" href={`/account/?next=${encodeURIComponent(`/requests/view/?id=${encodeURIComponent(r.id)}`)}`}><Icon name="send"/>შედი და გაგზავნე შეთავაზება</Button>}
      </div> : null}
      <ConfirmSheet
        id="request-confirm"
        open={!!confirmKind}
        title={confirmKind === "delete" ? "მოთხოვნის წაშლა" : confirmKind === "close" ? "მოთხოვნის დახურვა" : "შეთავაზების გაუქმება"}
        confirmLabel={confirmKind === "delete" ? "წაშლა" : confirmKind === "close" ? "დახურვა" : "გაუქმება"}
        pendingLabel="სრულდება…"
        danger
        pending={actionPending}
        error={actionError || null}
        onConfirm={() => confirmKind && action(confirmKind)}
        onCancel={() => { setConfirmKind(null); setActionError(""); }}
      >
        <p>{confirmKind === "delete" ? "მოთხოვნა და მისი ყველა შეთავაზება სამუდამოდ წაიშლება." : confirmKind === "close" ? "მოთხოვნა ახალ შეთავაზებებს აღარ მიიღებს. მოგვიანებით შეგიძლია ხელახლა გახსნა." : "კომპანია შენს შეთავაზებას ვეღარ ნახავს. ხელახლა გაგზავნა შესაძლებელია, სანამ მოთხოვნა ღიაა."}</p>
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
