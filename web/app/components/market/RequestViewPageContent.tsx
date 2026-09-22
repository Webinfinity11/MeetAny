"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { PageBand } from "./PageBand";
import { SectionHead } from "./SectionHead";
import { OfferCard, type OfferCardData } from "./OfferCard";
import { ChooseOfferSheet } from "./ChooseOfferSheet";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities, priceTypes } from "../../lib/categories";

function SendOfferForm({ requestId, existing, onDone }: { requestId: string; existing?: OfferCardData; onDone: () => void }) {
  const { store } = useMarketStore();
  const [priceType, setPriceType] = useState(existing?.priceType || "total");
  const [price, setPrice] = useState(existing?.price != null ? String(existing.price) : "");
  const [vatIncluded, setVatIncluded] = useState(existing?.vatIncluded ?? true);
  const [deliveryDays, setDeliveryDays] = useState(existing?.deliveryDays != null ? String(existing.deliveryDays) : "");
  const [deliveryIncluded, setDeliveryIncluded] = useState(existing?.deliveryIncluded ?? false);
  const [body, setBody] = useState(existing?.body || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    setPending(true);
    setError(null);
    try {
      await store.sendOffer(requestId, { priceType, price: price || undefined, vatIncluded, deliveryDays: deliveryDays || undefined, deliveryIncluded, body });
      onDone();
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "შეთავაზება ვერ გაიგზავნა. სცადე თავიდან.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="ma-form" onSubmit={submit}>
      <div className="ma-form__row ma-form__row--2">
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="of-price-type">
            ფასის ტიპი *
          </label>
          <select className="ma-select" id="of-price-type" value={priceType} onChange={(e) => setPriceType(e.target.value)}>
            {Object.entries(priceTypes).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {priceType !== "negotiable" ? (
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="of-price">
              ფასი (₾) *
            </label>
            <input className="ma-input" id="of-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        ) : null}
      </div>
      {priceType !== "negotiable" ? (
        <label className="ma-check">
          <input type="checkbox" checked={vatIncluded} onChange={(e) => setVatIncluded(e.target.checked)} />
          <span>დღგ ჩათვლილია ფასში</span>
        </label>
      ) : null}
      <div className="ma-form__row ma-form__row--2">
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="of-days">
            მიწოდება (დღე) <span className="ma-field__opt">არასავალდებულო</span>
          </label>
          <input className="ma-input" id="of-days" inputMode="numeric" value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} />
        </div>
        <label className="ma-check">
          <input type="checkbox" checked={deliveryIncluded} onChange={(e) => setDeliveryIncluded(e.target.checked)} />
          <span>მიწოდება შედის ფასში</span>
        </label>
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
  const [chooseId, setChooseId] = useState<string | null>(null);
  const [choosePending, setChoosePending] = useState(false);
  const [chooseError, setChooseError] = useState<string | null>(null);
  // Captured once at mount: good enough for a cosmetic "new" badge, and calling Date.now()
  // during the render/useMemo body below would make this component impure.
  const [now] = useState(() => Date.now());

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
    const mapOffer = (o: { id: string; companyUserId: string; createdAt: string; price: number | null; priceType: string; vatIncluded: boolean; deliveryDays: number | null; deliveryIncluded: boolean; body: string; status: string }): OfferCardData => {
      const c = store.userById(o.companyUserId);
      const isNew = now - Date.parse(o.createdAt) < 24 * 3600e3 && o.status === "sent";
      return {
        id: o.id,
        companyName: c?.company || c?.name || "კომპანია",
        companyHref: `/companies/view/?id=${encodeURIComponent(o.companyUserId)}`,
        city: c ? cities[c.city] || c.city : "",
        createdAt: o.createdAt,
        price: o.price,
        priceType: o.priceType,
        vatIncluded: o.vatIncluded,
        deliveryDays: o.deliveryDays,
        deliveryIncluded: o.deliveryIncluded,
        body: o.body,
        status: o.status,
        isNew,
      };
    };
    const mappedOffers: OfferCardData[] = offers.map(mapOffer);
    return { r, me, owner, offers: mappedOffers, offerCount, state, isOwner, myOffer: myOffer ? mapOffer(myOffer) : null, contact };
  }, [store, ready, available, id, now]);

  if (!ready || !available) {
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

  const { r, me, offers, offerCount, state, isOwner, myOffer, contact } = data;
  const closed = state !== "open";

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

      {isOwner ? (
        <>
          <p className="ma-note">
            <Icon name="lock" />
            ფასებსა და შეთავაზებების ტექსტს მხოლოდ შენ ხედავ.
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
          {state === "open" ? (
            <div className="ma-panel__actions">
              <button
                type="button"
                className="ma-btn ma-btn--secondary"
                onClick={async () => {
                  await store?.extendRequest(r.id);
                }}
              >
                <Icon name="clock" />
                ვადის გაგრძელება (+{store?.EXTEND_DAYS ?? 7} დღე)
              </button>
              <button
                type="button"
                className="ma-btn ma-btn--danger-quiet"
                onClick={async () => {
                  await store?.closeRequest(r.id);
                }}
              >
                დახურვა
              </button>
            </div>
          ) : null}
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
              {offers.map((o) => (
                <OfferCard key={o.id} o={o} canChoose={!r.chosenOfferId && state === "open"} onChoose={() => setChooseId(o.id)} />
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
              {state === "open" && myOffer.status === "sent" ? (
                <button
                  type="button"
                  className="ma-btn ma-btn--danger-quiet"
                  onClick={async () => {
                    await store?.withdrawOffer(myOffer.id);
                  }}
                >
                  შეთავაზების გაუქმება
                </button>
              ) : null}
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
