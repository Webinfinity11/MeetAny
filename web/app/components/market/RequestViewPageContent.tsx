"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { toast } from "../Toasts";
import { RequestFormSheet } from "./RequestFormSheet";
import { useRouter } from "next/navigation";
import { PageBand } from "./PageBand";
import { SectionHead } from "./SectionHead";
import { OfferCard, type OfferCardData } from "./OfferCard";
import { ChooseOfferSheet } from "./ChooseOfferSheet";
import { CallButton } from "./CallButton";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities, units } from "../../lib/categories";
import { fetchPhone } from "../../lib/phones";

// No price field (owner decision 2026-09-22: B2B pricing isn't a fixed number). Omitting
// price/priceType makes market-store.js's sendOffer() default to price:null,
// priceType:'negotiable' on its own — see db/CONTRACT.md "შეთავაზება ფასის გარეშე".
function SendOfferForm({ requestId, existing, onDone }: { requestId: string; existing?: OfferCardData; onDone: () => void }) {
  const { store } = useMarketStore();
  const [deliveryDays, setDeliveryDays] = useState(existing?.deliveryDays != null ? String(existing.deliveryDays) : "");
  const [body, setBody] = useState(existing?.body || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
    if (!existing) {
      try {const saved = JSON.parse(localStorage.getItem(`meetany.offerDraft.${requestId}`) || "null"); if (saved) {setBody(saved.body || ""); setDeliveryDays(saved.deliveryDays || "");}} catch {}
    }
    setDraftLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [requestId, existing]);
  useEffect(() => {
    if (!draftLoaded || existing) return;
    try {localStorage.setItem(`meetany.offerDraft.${requestId}`, JSON.stringify({body, deliveryDays}));} catch {}
  }, [requestId, body, deliveryDays, draftLoaded, existing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    setPending(true);
    setError(null);
    try {
      await store.sendOffer(requestId, { deliveryDays: deliveryDays || undefined, body });
      try { localStorage.removeItem(`meetany.offerDraft.${requestId}`); } catch {}
      toast(existing ? "შეთავაზება განახლდა." : "შეთავაზება გაიგზავნა.");
      onDone();
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "შეთავაზება ვერ გაიგზავნა. სცადე თავიდან.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="ma-form" onSubmit={submit}>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="of-days">
          მიწოდება (დღე) <span className="ma-field__opt">არასავალდებულო</span>
        </label>
        <input className="ma-input" id="of-days" inputMode="numeric" value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} />
      </div>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="of-body">
          შეთავაზების აღწერა *
        </label>
        <textarea className="ma-textarea" id="of-body" required minLength={10} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {error ? (
        <p className="ma-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="ma-btn ma-btn--primary" type="submit" disabled={pending}>
        {pending ? "იგზავნება…" : existing ? "შეთავაზების განახლება" : "შეთავაზების გაგზავნა"} <Icon name="send" />
      </button>
    </form>
  );
}

export function RequestViewPageContent() {
  const { store, ready, available } = useMarketStore();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
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
  // Mark offers received since this author last visited the request.
  const [seen, setSeen] = useState<{id: string; at: string | null} | null>(null);
  const meId = store?.currentUser()?.id;
  useEffect(() => {
    if (!ready || store?.getRequest(id)?.ownerId !== meId || !meId) return;
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
  }, [id, meId, ready]);

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
    const mapOffer = (o: { id: string; companyUserId: string; createdAt: string; deliveryDays: number | null; body: string; status: string }): OfferCardData => {
      const c = store.userById(o.companyUserId);
      const isNew = isOwner && seen?.id === id && (!seen.at || Date.parse(o.createdAt) > Date.parse(seen.at)) && o.status === "sent";
      return {
        id: o.id,
        companyName: c?.company || c?.name || "კომპანია",
        companyHref: `/companies/view/?id=${encodeURIComponent(o.companyUserId)}`,
        city: c ? cities[c.city] || c.city : "",
        createdAt: o.createdAt,
        deliveryDays: o.deliveryDays,
        body: o.body,
        status: o.status,
        isNew,
      };
    };
    const mappedOffers: OfferCardData[] = offers.map(mapOffer);
    return { r, me, owner, offers: mappedOffers, offerCount, state, isOwner, myOffer: myOffer ? mapOffer(myOffer) : null, contact };
  }, [store, ready, available, id, seen]);

  const [ownerPhone, setOwnerPhone] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (data?.r.ownerId) fetchPhone(data.r.ownerId).then((p) => !cancelled && setOwnerPhone(p));
    return () => {
      cancelled = true;
    };
  }, [data?.r.ownerId]);

  if (ready && !available) return <div className="ma-page"><p role="alert">სერვისი დროებით მიუწვდომელია. სცადე თავიდან.</p></div>;

  if (!ready) {
    return (
      <div className="ma-page">
        <div className="ma-stack" aria-busy="true">
          <p role="status">იტვირთება…</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="ma-page">
        <div className="ma-empty">
          <span className="ma-empty__icon">
            <Icon name="search" />
          </span>
          <h2 className="ma-empty__title">მოთხოვნა ვერ მოიძებნა</h2>
          <Link className="ma-btn ma-btn--secondary" href="/requests/">
            მოთხოვნებზე დაბრუნება
          </Link>
        </div>
      </div>
    );
  }

  const { r, me, owner, offers, offerCount, state, isOwner, myOffer, contact } = data;
  const closed = state !== "open";
  const orderedOffers = [...offers].sort((a,b) => offerSort === "delivery" ? (a.deliveryDays ?? Infinity) - (b.deliveryDays ?? Infinity) : Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/requests/view/?id=${encodeURIComponent(r.id)}`;
  async function action(kind: "extend" | "close" | "delete" | "withdraw") {
    if (!store || actionPending) return;
    if (kind === "delete" && !window.confirm("წავშალო მოთხოვნა და მისი შეთავაზებები?")) return;
    setActionPending(true); setActionError("");
    try {
      if (kind === "extend") await store.extendRequest(r.id);
      else if (kind === "close") await store.closeRequest(r.id);
      else if (kind === "delete") {await store.deleteRequest(r.id); router.push("/account/");}
      else if (myOffer) await store.withdrawOffer(myOffer.id);
      toast("ცვლილება შენახულია.");
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
    } catch (err) {
      setChooseError((err as { userMessage?: string })?.userMessage || "ვერ შესრულდა.");
    } finally {
      setChoosePending(false);
    }
  }

  return (
    <div className="ma-page">
      <Link className="ma-back" href="/requests/">
        <Icon name="arrow-left" />
        მოთხოვნები
      </Link>
      <PageBand eyebrow="MeetAny · საქმიანი კავშირები" title={isOwner ? "მიღებული შეთავაზებები" : r.title} description={isOwner ? r.title : categories[r.category]} />
      <div className="ma-cluster">
        {isOwner ? <span className="ma-badge ma-badge--info">შენი მოთხოვნა</span> : null}
        <span className="ma-small ma-muted">
          {cities[r.city]} · {offerCount} შეთავაზება
          {closed ? ` · ${state === "closed" ? "დახურული" : state === "chosen" ? "მომწოდებელი არჩეულია" : "ვადაგასული"}` : ""}
        </span>
      </div>
      <section className="ma-panel ma-stack" aria-label="მოთხოვნის აღწერა">
        <p className="ma-prose">{r.body}</p>
        <dl className="ma-kv">
          {r.quantity != null ? <div><dt>რაოდენობა</dt><dd>{r.quantity} {units[r.unit] || r.unit}</dd></div> : null}
          {r.neededBy ? <div><dt>საჭიროა თარიღამდე</dt><dd>{r.neededBy}</dd></div> : null}
          <div><dt>ვადა</dt><dd>{state === "open" ? `დარჩენილია ${store?.daysLeft(r)} დღე` : store?.stateLabels[state]}</dd></div>
        </dl>
        {r.photo ? <figure className="ma-photo"><a href={r.photo} target="_blank" rel="noopener noreferrer"><img src={r.photo} alt="მოთხოვნის ფოტო"/></a></figure> : null}
      </section>
      <div className="ma-share">
        <button className="ma-btn ma-btn--secondary" onClick={async () => {try {await navigator.clipboard.writeText(shareUrl); toast("ბმული დაკოპირდა.");} catch {setActionError("ბმული ვერ დაკოპირდა.");}}}>ბმულის კოპირება</button>
        <a className="ma-btn ma-btn--secondary" href={`https://wa.me/?text=${encodeURIComponent(r.title + "\n" + shareUrl)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a className="ma-btn ma-btn--secondary" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
      </div>
      {actionError ? <p role="alert" className="ma-field__error">{actionError}</p> : null}
      {owner ? (
        <div className="ma-cluster">
          <span className="ma-small ma-muted">გამომგზავნი: {owner.company || owner.name}</span>
          {ownerPhone ? <CallButton phone={ownerPhone} variant="secondary" /> : null}
        </div>
      ) : null}

      {isOwner || me?.role === "admin" ? (
        <>
          <p className="ma-note">
            <Icon name="lock" />
            შეთავაზების ტექსტს მხოლოდ შენ ხედავ.
          </p>
          {contact ? (
            <section className="ma-panel">
              <h2 className="ma-h3">საკონტაქტო ინფორმაცია</h2>
              <p>
                {contact.name} · {contact.company}
              </p>
              <p>
                {contact.phone} · {contact.email}
              </p>
            </section>
          ) : null}
          {isOwner ? <div className="ma-panel__actions">
            {offerCount === 0 && ["open", "closed", "expired"].includes(state) ? <button className="ma-btn ma-btn--secondary" onClick={() => setEditRequest(true)}>რედაქტირება</button> : null}
            {["open", "closed", "expired"].includes(state) ? <button className="ma-btn ma-btn--secondary" disabled={actionPending} onClick={() => action("extend")}>{closed ? "ხელახლა გახსნა" : "ვადის გაგრძელება"} (+7 დღე)</button> : null}
            {state === "open" ? <button className="ma-btn ma-btn--danger-quiet" disabled={actionPending} onClick={() => action("close")}>დახურვა</button> : null}
            <button className="ma-btn ma-btn--danger-quiet" disabled={actionPending} onClick={() => action("delete")}>წაშლა</button>
          </div> : null}
          <div className="ma-cluster"><label>დალაგება <select className="ma-select" value={offerSort} onChange={e => setOfferSort(e.target.value)}><option value="newest">ახალი შეთავაზებები</option><option value="delivery">მიწოდების ვადა</option></select></label><button className="ma-btn ma-btn--secondary" onClick={() => setCompare(!compare)}>{compare ? "სიის ნახვა" : "პირობების შედარება"}</button></div>
          {compare ? <div className="ma-table-wrap"><table className="ma-table"><caption>შეთავაზებების შედარება</caption><thead><tr><th>კომპანია</th><th>მიწოდება</th><th>პირობები</th></tr></thead><tbody>{orderedOffers.map(o => <tr key={o.id}><td data-label="კომპანია">{o.companyName}</td><td data-label="მიწოდება">{o.deliveryDays != null ? `${o.deliveryDays} დღე` : "დასაზუსტებელია"}</td><td data-label="პირობები">{o.body}</td></tr>)}</tbody></table></div> : null}
          <SectionHead eyebrow="მიღებული პასუხები" title="შეადარე პირობები" />
          {offers.length === 0 ? (
            <div className="ma-empty">
              <span className="ma-empty__icon">
                <Icon name="search" />
              </span>
              <h2 className="ma-empty__title">ჯერ შეთავაზება არ მიგიღია</h2>
              <p className="ma-empty__text">კომპანიების პასუხები აქ გამოჩნდება. მოთხოვნა 14 დღეა აქტიური.</p>
            </div>
          ) : (
            <div className="ma-stack">
              {orderedOffers.map((o) => (
                <OfferCard key={o.id} o={o} canChoose={isOwner && !r.chosenOfferId && state === "open"} onChoose={() => setChooseId(o.id)} />
              ))}
            </div>
          )}
        </>
      ) : me?.role === "company" ? (
        <section className="ma-panel">
          {myOffer ? (
            <>
              <h2 className="ma-h3">შენი შეთავაზება</h2>
              <OfferCard o={myOffer} canChoose={false} />
              {state === "open" && myOffer.status === "sent" ? <div className="ma-stack">
                <div className="ma-cluster"><button className="ma-btn ma-btn--secondary" onClick={() => setEditOffer(!editOffer)}>შეთავაზების რედაქტირება</button><button className="ma-btn ma-btn--danger-quiet" disabled={actionPending} onClick={() => action("withdraw")}>შეთავაზების გაუქმება</button></div>
                {editOffer ? <SendOfferForm key={myOffer.id} requestId={r.id} existing={myOffer} onDone={() => setEditOffer(false)}/> : null}
              </div> : null}
              {contact ? <section className="ma-panel"><h3>არჩეული შეთავაზება</h3><p>{contact.company || contact.name} · {contact.email}</p>{contact.phone ? <CallButton phone={contact.phone}/> : null}</section> : null}
            </>
          ) : closed ? (
            <p className="ma-note">მოთხოვნა შეთავაზებებს აღარ იღებს.</p>
          ) : (
            <>
              <h2 className="ma-h3">შეთავაზების გაგზავნა</h2>
              <p className="ma-note">შენს შეთავაზებას მხოლოდ მოთხოვნის ავტორი ნახავს.</p>
              <SendOfferForm requestId={r.id} onDone={() => undefined} />
            </>
          )}
        </section>
      ) : (
        <section className="ma-panel">
          <h2 className="ma-h3">შეთავაზების გასაგზავნად შედი როგორც კომპანია</h2>
          <p className="ma-note">შეთავაზებებს მხოლოდ მოთხოვნის ავტორი ნახავს — სხვები მხოლოდ რაოდენობას.</p>
          <div className="ma-panel__actions">
            <Link className="ma-btn ma-btn--primary" href="/account/">
              შესვლა
            </Link>
            <Link className="ma-btn ma-btn--secondary" href="/account/?tab=register&role=company">
              კომპანიის რეგისტრაცია
            </Link>
          </div>
        </section>
      )}

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
