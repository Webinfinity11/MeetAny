"use client";
import { useEffect, useRef, useState } from 'react';
import { useMarketStore } from '../../lib/market-client';
import { hasOfferTerms, readOwnOffer, setOfferTerms, termsEqual, type OfferTerms, type StoredOffer } from '../../lib/offer-terms-client';
import { flowError } from '../../lib/matching-client';
import { ListSkeleton } from './Skeletons';
import type { OfferCardData } from './OfferCard';
import { useFieldErrors, type FieldErrors } from './fieldErrors';
import { CustomSelect } from '../ui/CustomSelect';
import { Button } from '../ui/Button';
import { money } from '../../lib/deal-client';
import { Icon } from '../Icon';
import { toast } from '../Toasts';
import styles from './MakeOffer.module.css';

type Values = { body: string; price: string; priceType: string; vatIncluded: boolean; deliveryIncluded: boolean; deliveryDays: string; paymentTerms: string; validUntil: string; commercialTerms: string };
type PendingTerms = { id: string; updatedAt: string; terms: OfferTerms };
const valuesFrom = (o?: Partial<StoredOffer> | OfferCardData): Values => ({ body: o?.body || '', price: o?.price != null ? String(o.price) : '', priceType: o?.priceType || 'total', vatIncluded: !!o?.vatIncluded, deliveryIncluded: !!o?.deliveryIncluded, deliveryDays: o?.deliveryDays != null ? String(o.deliveryDays) : '', paymentTerms: o?.paymentTerms || '', validUntil: o?.validUntil || '', commercialTerms: o?.commercialTerms?.join('\n') || '' });

export function SendOfferForm({ requestId, existing, onDone, onCancel, standalone = false }: { requestId: string; existing?: OfferCardData; standalone?: boolean; onDone: (editing: boolean) => void; onCancel: () => void }) {
  const { store, sessionReady } = useMarketStore();
  const [values, setValues] = useState<Values>(() => valuesFrom(existing));
  const [customTerm, setCustomTerm] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [otherDelivery, setOtherDelivery] = useState(false);
  const [otherPayment, setOtherPayment] = useState(false);
  const [loaded, setLoaded] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState<PendingTerms>();
  const [conflict, setConflict] = useState(false);
  const [editing, setEditing] = useState(!!existing);
  const [completed, setCompleted] = useState(false);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  const baseRevision = useRef<string | undefined>(undefined);
  const v = useFieldErrors();
  const owner = sessionReady ? store?.currentUser()?.id : undefined;
  const key = owner ? `meetany.offerDraft.${owner}.${requestId}` : '';
  const { ensureRequest, myOffers, currentUser } = store || {};
  useEffect(() => {
    if (!key || !ensureRequest) return;
    let active = true;
    const source = { ensureRequest, myOffers, currentUser };
    void readOwnOffer(source, requestId).then(offer => {
      if (!active) return;
      if (offer && !hasOfferTerms(offer)) throw new Error('პირობები სრულად ვერ ჩაიტვირთა. შენახვა დროებით მიუწვდომელია.');
      let draft: Partial<Values> & { pendingTerms?: PendingTerms } = {};
      try { draft = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
      const next = valuesFrom(offer);
      if (!offer) {
        for (const name of Object.keys(next) as (keyof Values)[]) {
          if (typeof draft[name] === typeof next[name]) Object.assign(next, { [name]: draft[name] });
        }
        if (!['negotiable', 'unit', 'total'].includes(next.priceType)) next.priceType = 'negotiable';
      }
      baseRevision.current = offer?.updatedAt;
      setValues(next); setEditing(!!offer); setError(''); setConflict(false);
      if (draft.pendingTerms && offer?.id === draft.pendingTerms.id) {
        const saved = draft.pendingTerms;
        if (termsEqual(offer, saved.terms)) {
          localStorage.removeItem(key);
        } else {
          setPartial(saved);
          setValues({ ...next, paymentTerms: saved.terms.paymentTerms || '', validUntil: saved.terms.validUntil || '', commercialTerms: saved.terms.commercialTerms.join('\n') });
          setConflict(offer.updatedAt !== saved.updatedAt);
          setError('ძირითადი შეთავაზება შენახულია. დამატებითი პირობები ჯერ არ დადასტურებულა.');
        }
      }
      setLoaded(key);
    }).catch(err => { if (active) setError(err.message?.startsWith('პირობები') ? err.message : flowError(err)); });
    return () => { active = false; };
  }, [key, ensureRequest, myOffers, currentUser, requestId, revision]);
  useEffect(() => {
    if (!key || loaded !== key || completed) return;
    try { localStorage.setItem(key, JSON.stringify({ ...values, pendingTerms: partial })); } catch {}
  }, [key, loaded, values, partial, completed]);
  function change<K extends keyof Values>(name: K, value: Values[K]) { setValues(old => ({ ...old, [name]: value })); v.clear(`of-${name}`); }
  async function reload() {
    if (busy.current) return;
    // An explicit review discards the old revision; it never retries a stale write.
    setPartial(undefined); setConflict(false); setLoaded(''); setCompleted(false);
    try { if (key) localStorage.setItem(key, JSON.stringify(values)); } catch {}
    setRevision(n => n + 1);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || busy.current || !key || loaded !== key || conflict || completed) return;
    const errors: FieldErrors = {};
    if (values.body.trim().length < 10 || values.body.length > 2000) errors['of-body'] = 'აღწერა უნდა შეიცავდეს 10–2000 სიმბოლოს.';
    if (!values.deliveryDays.trim() || (!Number.isInteger(Number(values.deliveryDays)) || Number(values.deliveryDays) < 0 || Number(values.deliveryDays) > 365)) errors['of-deliveryDays'] = 'მიუთითეთ 0–365 დღე.';
    if (values.priceType !== 'negotiable' && (!/^\d+(?:[.,]\d{1,2})?$/.test(values.price.trim()) || Number(values.price.replace(',', '.')) <= 0 || Number(values.price.replace(',', '.')) > 1e9)) errors['of-price'] = 'მიუთითეთ დადებითი ფასი, მაქსიმუმ ორი ათწილადი ნიშნით.';
    const terms: OfferTerms = { paymentTerms: values.paymentTerms.trim() || null, validUntil: values.validUntil || null, commercialTerms: values.commercialTerms.split('\n').map(t => t.trim()).filter(Boolean) };
    if (values.paymentTerms.length > 500) errors['of-paymentTerms'] = 'მაქსიმუმ 500 სიმბოლო.';
    if (terms.commercialTerms.length > 8 || terms.commercialTerms.some(t => t.length > 120)) errors['of-commercialTerms'] = 'მაქსიმუმ 8 პირობა, თითოეული 120 სიმბოლომდე.';
    if (terms.validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(terms.validUntil)) errors['of-validUntil'] = 'მიუთითეთ თარიღი.';
    if (!v.check(errors, ['of-price', 'of-deliveryDays', 'of-validUntil', 'of-body', 'of-paymentTerms', 'of-commercialTerms'])) return;
    busy.current = true; setPending(true); setError('');
    let saved = partial;
    try {
      const fresh = await readOwnOffer(store, requestId);
      if (fresh && !hasOfferTerms(fresh)) throw new Error('პირობები სრულად ვერ ჩაიტვირთა.');
      if (saved) {
        if (!fresh || fresh.id !== saved.id) { setConflict(true); throw new Error('MA904'); }
        if (!termsEqual(fresh, saved.terms) && fresh.updatedAt !== saved.updatedAt) { setConflict(true); throw new Error('MA904'); }
        if (!termsEqual(fresh, saved.terms)) await setOfferTerms(store, saved, saved.terms);
      } else {
        if (fresh?.updatedAt !== baseRevision.current) { setConflict(true); throw new Error('MA904'); }
        const sent: StoredOffer = await store.sendOffer(requestId, { ...values, price: values.priceType === 'negotiable' ? undefined : values.price, deliveryDays: values.deliveryDays || undefined });
        saved = { id: sent.id, updatedAt: sent.updatedAt, terms };
        setPartial(saved);
        // Persist before RPC 2: navigation or a lost reply can recover without sending RPC 1 again.
        try { localStorage.setItem(key, JSON.stringify({ ...values, pendingTerms: saved })); } catch {}
        await setOfferTerms(store, saved, terms);
      }
      setPartial(undefined); setCompleted(true);
      try { localStorage.removeItem(key); } catch {}
      await store.refresh();
      if (editing) toast({ title: 'შეთავაზება განახლდა', tone: 'success' });
      onDone(editing);
    } catch (err) {
      const stale = /MA904/.test(String((err as Error)?.message) + String((err as { code?: string })?.code));
      if (stale) { setConflict(true); await readOwnOffer(store, requestId).catch(() => undefined); }
      // RPC 1 may have committed even if its reply was lost: require a fresh review.
      if (!saved) setConflict(true);
      setError(`${saved ? 'ძირითადი შეთავაზება შენახულია; დამატებითი პირობების შენახვა ვერ დადასტურდა. ' : ''}${flowError(err)}`);
    } finally { busy.current = false; setPending(false); }
  }
  if ((!key || loaded !== key) && !error) return <ListSkeleton compact kind="records" label="შეთავაზების პირობები იტვირთება…"/>;
  const quantity = Number(store?.getRequest(requestId)?.quantity) || 0;
  const price = Number(values.price.replace(',', '.'));
  const total = values.priceType === 'negotiable' || !values.price || !Number.isFinite(price) ? null : values.priceType === 'unit' ? quantity > 0 ? price * quantity : null : price;
  const selectedTerms = values.commercialTerms.split('\n').map(t => t.trim()).filter(Boolean);
  const presets = ['ნიმუში წარმოებამდე', 'გარანტია', 'შეფუთვა შედის'];
  const payments = ['წინასწარ', 'მიწოდებისას', '30%–70%'];
  const toggleTerm = (term: string) => change('commercialTerms', (selectedTerms.includes(term) ? selectedTerms.filter(t => t !== term) : [...selectedTerms, term]).join('\n'));
  const deliveryOptions = ['3', '5', '7', '10', '14', '21', '30'];
  const validityDate = (days: number) => { const date = new Date(`${store?.todayDate()}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
  const disabled = pending || !!partial || conflict || !key || loaded !== key || completed;
  return <form className={`${styles.form} ${standalone ? styles.standalone : styles.embedded}`} onSubmit={submit} noValidate aria-label="შეთავაზების ფორმა">
    <fieldset disabled={disabled} className={styles.fields}>
      <section className={styles.formCard}><h2>ფასი</h2><div className={styles.chips} role="group" aria-label="ფასის ტიპი">{[['total', 'ჯამური'], ['unit', 'ერთეულის'], ['negotiable', 'შეთანხმებით']].map(([value, label]) => <Button key={value} variant={values.priceType === value ? 'primary' : 'secondary'} aria-pressed={values.priceType === value} onClick={() => change('priceType', value)}>{label}</Button>)}</div>
      {values.priceType !== 'negotiable' ? <><div className="ma-field"><label htmlFor="of-price">თანხა ლარში (₾) *</label><div className={styles.currency}><input className="ma-input" inputMode="decimal" required value={values.price} onChange={e => change('price', e.target.value)} {...v.control('of-price')}/><span>₾</span></div>{v.message('of-price')}{quantity > 0 && total != null ? <small>= {money(total / quantity)} / {store?.getRequest(requestId)?.unit === 'pcs' ? 'ცალი' : 'ერთეული'} · {quantity} {store?.getRequest(requestId)?.unit === 'pcs' ? 'ც.' : 'ერთ.'}</small> : null}</div><label className="ma-check"><input type="checkbox" checked={values.vatIncluded} onChange={e => change('vatIncluded', e.target.checked)}/>დღგ ფასში შედის</label></> : null}</section>
      <section className={styles.formCard}><h2>მიწოდების ვადა</h2><div className={styles.two}><div className="ma-field"><label htmlFor="of-deliveryDays">მიწოდება (დღე) *</label><CustomSelect required value={otherDelivery || (values.deliveryDays && !deliveryOptions.includes(values.deliveryDays)) ? 'other' : values.deliveryDays} onChange={e => { setOtherDelivery(e.target.value === 'other'); if (e.target.value !== 'other') change('deliveryDays', e.target.value); }} {...v.control('of-deliveryDays')}><option value="" disabled>აირჩიეთ ვადა</option>{deliveryOptions.map(days => <option key={days} value={days}>{days} სამუშაო დღე</option>)}<option value="other">სხვა</option></CustomSelect>{otherDelivery || (values.deliveryDays && !deliveryOptions.includes(values.deliveryDays)) ? <input className="ma-input" aria-label="მიწოდების დღეების რაოდენობა" inputMode="numeric" value={values.deliveryDays} onChange={e => change('deliveryDays', e.target.value)}/> : null}{v.message('of-deliveryDays')}</div><div className="ma-field"><label htmlFor="of-validUntil">შეთავაზება ძალაშია</label><CustomSelect value={values.validUntil} onChange={e => change('validUntil', e.target.value)} {...v.control('of-validUntil')}><option value="">აირჩიეთ ვადა</option>{values.validUntil && ![14, 30, 60].some(days => validityDate(days) === values.validUntil) ? <option value={values.validUntil}>{values.validUntil}</option> : null}{[14, 30, 60].map(days => <option key={days} value={validityDate(days)}>{days} დღე</option>)}</CustomSelect>{v.message('of-validUntil')}</div></div><label className="ma-check"><input type="checkbox" checked={values.deliveryIncluded} onChange={e => change('deliveryIncluded', e.target.checked)}/>მიწოდების ხარჯი შეთავაზებაში შედის</label></section>
      <section className={styles.formCard}><h2>გადახდის პირობები</h2><div className={styles.chips} role="group" aria-label="გადახდის პირობები">{payments.map(term => <Button key={term} variant={values.paymentTerms === term && !otherPayment ? 'primary' : 'secondary'} aria-pressed={values.paymentTerms === term && !otherPayment} onClick={() => { change('paymentTerms', term); setOtherPayment(false); }}>{term}</Button>)}<Button variant={otherPayment || !!values.paymentTerms && !payments.includes(values.paymentTerms) ? 'primary' : 'secondary'} onClick={() => setOtherPayment(true)}>სხვა</Button></div>{otherPayment || !!values.paymentTerms && !payments.includes(values.paymentTerms) ? <div className="ma-field"><label htmlFor="of-paymentTerms">სხვა პირობები</label><input className="ma-input" maxLength={500} value={values.paymentTerms} onChange={e => change('paymentTerms', e.target.value)} {...v.control('of-paymentTerms')}/></div> : null}{v.message('of-paymentTerms')}</section>
      <section className={styles.formCard}><h2>კომერციული პირობები</h2><div className={styles.chips} role="group" aria-label="კომერციული პირობები">{Array.from(new Set([...presets, ...selectedTerms])).map(term => <Button key={term} variant={selectedTerms.includes(term) ? 'primary' : 'secondary'} aria-pressed={selectedTerms.includes(term)} disabled={!selectedTerms.includes(term) && selectedTerms.length >= 8} onClick={() => toggleTerm(term)}>{selectedTerms.includes(term) ? <Icon name="check"/> : null}{term}</Button>)}<Button variant="secondary" aria-expanded={showCustom} onClick={() => setShowCustom(v => !v)}><Icon name="plus"/>საკუთარი</Button></div>{showCustom ? <div className="ma-field"><label htmlFor="of-commercialTerms">საკუთარი პირობა</label><div className={styles.addTerm}><input className="ma-input" maxLength={120} value={customTerm} onChange={e => setCustomTerm(e.target.value)} {...v.control('of-commercialTerms')}/><Button variant="secondary" disabled={!customTerm.trim() || selectedTerms.length >= 8} onClick={() => { if (!selectedTerms.includes(customTerm.trim())) toggleTerm(customTerm.trim()); setCustomTerm(''); }}>დამატება</Button></div>{v.message('of-commercialTerms')}<small>მაქსიმუმ 8 პირობა, თითოეული 120 სიმბოლომდე.</small></div> : null}</section>
      <section className={styles.formCard}><h2>მოკლე აღწერა</h2><div className="ma-field"><label htmlFor="of-body">მოკლე აღწერა *</label><textarea className="ma-textarea" minLength={10} maxLength={2000} required value={values.body} onChange={e => change('body', e.target.value)} {...v.control('of-body')}/>{v.message('of-body')}<small>{values.body.length}/2000 · რეკომენდებულია 500 სიმბოლომდე.</small></div></section>
    </fieldset>
    <div className={styles.submitArea}>
    {error ? <div className={styles.notice} role="alert"><p>{error}</p>{conflict || partial || loaded !== key ? <Button variant="secondary" disabled={pending} onClick={() => void reload()}>ბოლო ვერსიის ჩატვირთვა</Button> : null}</div> : null}
    {completed ? <p role="status">შეთავაზება და პირობები შენახულია.</p> : null}
    <div className={styles.actions}><Button variant="secondary" disabled={pending} onClick={onCancel}>გაუქმება</Button><Button type="submit" loading={pending} disabled={!key || loaded !== key || conflict || completed}>{partial ? 'პირობების შენახვის გამეორება' : editing ? 'შეთავაზების განახლება' : 'შეთავაზების გაგზავნა'}</Button></div><p className={styles.privacy}><Icon name="lock"/>თქვენი კონტაქტი მყიდველს გაეხსნება მხოლოდ არჩევის შემთხვევაში.</p></div>
  </form>;
}
