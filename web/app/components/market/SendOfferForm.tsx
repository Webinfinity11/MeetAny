"use client";
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMarketStore } from '../../lib/market-client';
import { hasOfferTerms, readOwnOffer, setOfferTerms, termsEqual, type OfferTerms, type StoredOffer } from '../../lib/offer-terms-client';
import { flowError } from '../../lib/matching-client';
import { ListSkeleton } from './Skeletons';
import type { OfferCardData } from './OfferCard';
import { useFieldErrors, type FieldErrors } from './fieldErrors';
import { CustomSelect } from '../ui/CustomSelect';
import { Button } from '../ui/Button';
import { FileAttachments } from "./FileAttachments";
import { attachmentDraft } from "../../lib/attachment-draft";
import { money } from '../../lib/deal-client';
import { dateShort } from '../../lib/format';
import { Icon } from '../Icon';
import { DeliveryDaysField } from './offer/DeliveryDaysField';
import { PaymentTermsField } from './offer/PaymentTermsField';
import { readOfferDraft, type PendingTerms } from './offer/offer-draft';
import { toast } from '../Toasts';
import styles from './MakeOffer.module.css';

type Values = { body: string; price: string; priceType: string; vatIncluded: boolean; deliveryIncluded: boolean; deliveryDays: string; paymentTerms: string; validUntil: string; commercialTerms: string };
export type OfferFormState = {
  values: Readonly<Values>; total: number | null; pending: boolean; fileBusy: boolean; conflict: boolean;
  submitDisabled: boolean; submitLabel: string;
};
const valuesFrom = (o?: Partial<StoredOffer> | OfferCardData): Values => ({ body: o?.body || '', price: o?.price != null ? String(o.price) : '', priceType: o?.priceType || 'total', vatIncluded: !!o?.vatIncluded, deliveryIncluded: !!o?.deliveryIncluded, deliveryDays: o?.deliveryDays != null ? String(o.deliveryDays) : '', paymentTerms: o?.paymentTerms || '', validUntil: o?.validUntil || '', commercialTerms: o?.commercialTerms?.join('\n') || '' });

export function SendOfferForm({ requestId, existing, onDone, onCancel, standalone = false, formId, renderLayout }: { requestId: string; existing?: OfferCardData; standalone?: boolean; onDone: (editing: boolean) => void; onCancel: () => void; formId?: string; renderLayout?: (form: ReactNode, state: OfferFormState) => ReactNode }) {
  const { store, sessionReady } = useMarketStore();
  const [fileBusy,setFileBusy]=useState(false);
  const [fileDraft,setFileDraft]=useState('');
  const [offerId,setOfferId]=useState(existing?.id||'');
  const [values, setValues] = useState<Values>(() => valuesFrom(existing));
  const [draftNotice, setDraftNotice] = useState('');
  const [restored, setRestored] = useState(false);
  const draftKey = useRef('');
  const initialValues = useRef<Values>(valuesFrom(existing));
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
  const { ensureRequest, myOffers, currentUser, callRpc } = store || {};
  useEffect(() => {
    if (!key || !ensureRequest) return;
    let active = true;
    const source = { ensureRequest, myOffers, currentUser };
    void readOwnOffer(source, requestId).then(async offer => {
      if (!active) return;
      if (offer && !hasOfferTerms(offer)) throw new Error('პირობები სრულად ვერ ჩაიტვირთა. შენახვა დროებით მიუწვდომელია.');
      let draft: Record<string, unknown> & { pendingTerms?: PendingTerms } = {};
      let stale = false;
      draftKey.current = '';
      try { const loadedDraft = readOfferDraft(localStorage, key, offer); draft = loadedDraft.draft; stale = loadedDraft.stale; draftKey.current = loadedDraft.key; } catch {}
      const next = valuesFrom(offer);
      if (!offer) {
        const preferences = await callRpc('request_preferences', { p_request_id: requestId }).catch(() => null);
        if (!active) return;
        next.paymentTerms = preferences?.payment || '';
      }
      initialValues.current = { ...next };
      {
        for (const name of Object.keys(next) as (keyof Values)[]) {
          if (typeof draft[name] === typeof next[name]) Object.assign(next, { [name]: draft[name] });
        }
        if (!['negotiable', 'unit', 'total'].includes(next.priceType)) next.priceType = 'negotiable';
      }
      const recovered = JSON.stringify(next) !== JSON.stringify(initialValues.current);
      setRestored(recovered);
      setDraftNotice(stale ? 'შეთავაზება განახლდა სხვაგან — ძველი შეუნახავი ცვლილებები გაუქმდა.' : recovered ? 'აღდგენილია შეუნახავი ცვლილებები' : '');
      setOfferId(offer?.id||'');
      setFileDraft(attachmentDraft(`meetany.offerFiles.${owner}.${requestId}`));
      baseRevision.current = offer?.updatedAt;
      setPartial(undefined);setValues(next); setEditing(!!offer); setError(''); setConflict(false);
      if (draft.pendingTerms && offer?.id === draft.pendingTerms.id) {
        const saved = draft.pendingTerms;
        setPartial(saved);
        setValues({ ...next, paymentTerms: saved.terms.paymentTerms || '', validUntil: saved.terms.validUntil || '', commercialTerms: saved.terms.commercialTerms.join('\n') });
        setConflict(!termsEqual(offer,saved.terms)&&offer.updatedAt !== saved.updatedAt);
        setError(termsEqual(offer,saved.terms)?'შეთავაზება შენახულია. დაასრულეთ ფაილების შენახვა.':'ძირითადი შეთავაზება შენახულია. დამატებითი პირობები ჯერ არ დადასტურებულა.');
      }
      setLoaded(key);
    }).catch(err => { if (active) setError(err.message?.startsWith('პირობები') ? err.message : flowError(err)); });
    return () => { active = false; };
  }, [key, ensureRequest, myOffers, currentUser, requestId, revision,owner,callRpc]);
  useEffect(() => {
    if (!key || !draftKey.current || loaded !== key || completed) return;
    if (!partial && JSON.stringify(values) === JSON.stringify(initialValues.current)) { try { localStorage.removeItem(draftKey.current); } catch {} return; }
    try { localStorage.setItem(draftKey.current, JSON.stringify({ ...values, pendingTerms: partial })); } catch {}
  }, [key, loaded, values, partial, completed]);
  function change<K extends keyof Values>(name: K, value: Values[K]) { setValues(old => ({ ...old, [name]: value })); v.clear(`of-${name}`); }
  async function reload() {
    if (busy.current) return;
    // An explicit review discards the old revision; it never retries a stale write.
    setPartial(undefined); setConflict(false); setLoaded(''); setCompleted(false);
    try { if (draftKey.current) localStorage.removeItem(draftKey.current); } catch {}
    setRevision(n => n + 1);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || fileBusy || busy.current || !key || loaded !== key || conflict || completed) return;
    const errors: FieldErrors = {};
    if (values.body.trim().length < 10 || values.body.length > 2000) errors['of-body'] = values.body.trim() ? 'აღწერა მინიმუმ 10 სიმბოლო უნდა იყოს.' : 'აღწერეთ შეთავაზება მოკლედ.';
    if (values.deliveryDays.trim() && (!Number.isInteger(Number(values.deliveryDays)) || Number(values.deliveryDays) < 0 || Number(values.deliveryDays) > 365)) errors['of-deliveryDays'] = 'ვადა 0-დან 365 დღემდე უნდა იყოს.';
    if (values.priceType !== 'negotiable' && (!/^\d+(?:[.,]\d{1,2})?$/.test(values.price.trim()) || Number(values.price.replace(',', '.')) <= 0 || Number(values.price.replace(',', '.')) > 1e9)) errors['of-price'] = values.price.trim() ? 'ფასი მიუთითეთ რიცხვით, მაგ. 1250 ან 1250,50.' : 'მიუთითეთ ფასი.';
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
        const sent: StoredOffer = await store.sendOffer(requestId, { ...values, price: values.priceType === 'negotiable' ? undefined : values.price, deliveryDays: values.deliveryDays.trim() || undefined });
        saved = { id: sent.id, updatedAt: sent.updatedAt, terms };
        setPartial(saved);
        // Persist before RPC 2: navigation or a lost reply can recover without sending RPC 1 again.
        try { localStorage.setItem(draftKey.current, JSON.stringify({ ...values, pendingTerms: saved })); } catch {}
        await setOfferTerms(store, saved, terms);
      }
      if(saved&&fileDraft)await store.callRpc('bind_draft_files',{p_kind:'offer',p_draft:fileDraft,p_target:saved.id});
      setPartial(undefined); setCompleted(true);
      try { localStorage.removeItem(draftKey.current); } catch {}
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
  const termRows = values.commercialTerms.split('\n');
  const termId = (index: number) => index ? `of-commercialTerms-${index}` : 'of-commercialTerms';
  const addTerm = () => { if (termRows.length >= 8 || !termRows.at(-1)?.trim()) return; change('commercialTerms', `${values.commercialTerms}\n`); requestAnimationFrame(() => document.getElementById(termId(termRows.length))?.focus()); };
  const validityDate = (days: number) => { const date = new Date(`${store?.todayDate()}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
  const disabled = pending || !!partial || conflict || !key || loaded !== key || completed;
  const submitDisabled = pending || fileBusy || !key || loaded !== key || conflict || completed;
  const submitLabel = partial ? 'შენახვის დასრულება' : editing ? 'შეთავაზების განახლება' : 'შეთავაზების გაგზავნა';
  const form = <form id={formId} className={`${styles.form} ${standalone ? styles.standalone : styles.embedded}`} onSubmit={submit} noValidate aria-label="შეთავაზების ფორმა">
    {draftNotice ? <div className={styles.notice} role="status"><p>{draftNotice}</p>{restored && !partial ? <Button variant="secondary" disabled={pending} onClick={() => { setValues({ ...initialValues.current }); setRestored(false); setDraftNotice('შეუნახავი ცვლილებები გაუქმდა'); }}>ცვლილებების გაუქმება</Button> : null}</div> : null}
    <fieldset disabled={disabled} className={styles.fields}>
      <section className={styles.formCard}><h2>ფასი</h2><div className={styles.chips} role="group" aria-label="ფასის ტიპი">{[['total', 'ჯამური'], ['unit', 'ერთეულის'], ['negotiable', 'შეთანხმებით']].map(([value, label]) => <Button key={value} variant="secondary" aria-pressed={values.priceType === value} onClick={() => change('priceType', value)}>{label}</Button>)}</div>
      {values.priceType !== 'negotiable' ? <><div className="ma-field"><label htmlFor="of-price">თანხა ლარში (₾) *</label><div className={styles.currency}><input className="ma-input" inputMode="decimal" required value={values.price} onChange={e => change('price', e.target.value)} {...v.control('of-price')}/><span>₾</span></div>{v.message('of-price')}{quantity > 0 && total != null ? <small>= {money(total / quantity)} / {store?.getRequest(requestId)?.unit === 'pcs' ? 'ცალი' : 'ერთეული'} · {quantity} {store?.getRequest(requestId)?.unit === 'pcs' ? 'ც.' : 'ერთ.'}</small> : null}</div><label className="ma-check"><input type="checkbox" checked={values.vatIncluded} onChange={e => change('vatIncluded', e.target.checked)}/>დღგ ფასში შედის</label></> : null}</section>
      <div className={styles.formCard}><div className={styles.two}><div className="ma-field"><label htmlFor="of-deliveryDays">შესრულების ვადა</label><DeliveryDaysField required={false} value={values.deliveryDays} onChange={value => change('deliveryDays', value)} {...v.control('of-deliveryDays')}/>{v.message('of-deliveryDays')}</div><div className="ma-field"><label htmlFor="of-validUntil">შეთავაზება ძალაშია</label><CustomSelect value={values.validUntil} onChange={e => change('validUntil', e.target.value)} {...v.control('of-validUntil')}><option value="">აირჩიეთ ვადა</option>{values.validUntil && ![14, 30, 60].some(days => validityDate(days) === values.validUntil) ? <option value={values.validUntil}>{dateShort(values.validUntil)}</option> : null}{[14, 30, 60].map(days => <option key={days} value={validityDate(days)}>{days} დღე · {dateShort(validityDate(days))}</option>)}</CustomSelect>{v.message('of-validUntil')}</div></div><label className="ma-check"><input type="checkbox" checked={values.deliveryIncluded} onChange={e => change('deliveryIncluded', e.target.checked)}/>მიწოდების ხარჯი შეთავაზებაში შედის</label></div>
      <div className={styles.formCard}><div className="ma-field"><label htmlFor="of-paymentTerms">გადახდის პირობები</label><PaymentTermsField value={values.paymentTerms} onChange={value => change('paymentTerms', value)} {...v.control('of-paymentTerms')}/>{v.message('of-paymentTerms')}</div></div>
      <section className={styles.formCard} aria-labelledby="of-terms-title">
        <h2 id="of-terms-title">დამატებითი პირობები</h2>
        <div className={styles.termRows}>{termRows.map((term, index) => <div className={styles.termRow} key={index}>
          <textarea className="ma-textarea" rows={2} maxLength={120} value={term} aria-label={`პირობა ${index + 1}`} {...v.control(termId(index))} onChange={event => { const next = [...termRows]; next[index] = event.target.value.replace(/[\r\n]+/g, ' '); change('commercialTerms', next.join('\n')); }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); if (index === termRows.length - 1) addTerm(); else document.getElementById(termId(index + 1))?.focus(); } }}/>
          {term || termRows.length > 1 ? <Button variant="ghost" aria-label={`პირობის ${index + 1} წაშლა`} onClick={() => { change('commercialTerms', termRows.filter((_, i) => i !== index).join('\n')); requestAnimationFrame(() => document.getElementById(termId(Math.max(0, index - 1)))?.focus()); }}><Icon name="x"/></Button> : null}
        </div>)}</div>
        {v.message('of-commercialTerms')}
        <Button className={styles.addTerm} variant="secondary" disabled={termRows.length >= 8 || !termRows.at(-1)?.trim()} onClick={addTerm}><Icon name="plus"/>პირობის დამატება</Button>
      </section>
      <div className={styles.formCard}><div className="ma-field"><label htmlFor="of-body">მოკლე აღწერა *</label><textarea className="ma-textarea" minLength={10} maxLength={2000} required value={values.body} onChange={e => change('body', e.target.value)} {...v.control('of-body')}/>{v.message('of-body')}<small>{values.body.length}/2000 · რეკომენდებულია 500 სიმბოლომდე.</small></div></div>
      {store&&fileDraft?<section className={styles.formCard}><FileAttachments key={offerId||fileDraft} store={store} kind={offerId?"offer":"offer_draft"} target={offerId||fileDraft} editable onBusy={setFileBusy}/>{offerId?<FileAttachments store={store} kind="offer_draft" target={fileDraft} label="მონახაზის ფაილები"/>:null}</section>:null}
    </fieldset>
    <div className={styles.submitArea}>
    {error ? <div className={styles.notice} role="alert"><p>{error}</p>{conflict || partial || loaded !== key ? <Button variant="secondary" disabled={pending} onClick={() => void reload()}>ბოლო ვერსიის ჩატვირთვა</Button> : null}</div> : null}
    {completed ? <p role="status">შეთავაზება და პირობები შენახულია.</p> : null}
    {!renderLayout ? <div className="ma-form-bar"><p className={styles.sendSummary}>{values.priceType === 'negotiable' ? 'ფასი შეთანხმებით' : total == null ? 'ფასი დასაზუსტებელია' : money(total)} · {values.deliveryDays ? `${values.deliveryDays} დღე` : 'ვადა დასაზუსტებელია'} · {values.paymentTerms || 'გადახდა დასაზუსტებელია'}</p><div className={styles.actions}><Button variant="secondary" disabled={pending||fileBusy} onClick={onCancel}>გაუქმება</Button><Button type="submit" loading={pending} disabled={submitDisabled}>{submitLabel}</Button></div></div> : null}<p className={styles.privacy}><Icon name="lock"/>თქვენი კონტაქტი მყიდველს გაეხსნება მხოლოდ არჩევის შემთხვევაში.</p></div>
  </form>;
  return renderLayout ? renderLayout(form, { values, total, pending, fileBusy, conflict, submitDisabled, submitLabel }) : form;
}
