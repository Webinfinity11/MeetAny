'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMarketStore, useMarketStore } from '../../lib/market-client';
import { validateOnboardStep, stepsFor, onboardSteps, onboardDraftKey, serializeOnboardDraft, restoreOnboardDraft, onboardWrites, retainOnboardDraft, onboardError, readOnboard, readOnboardProfile, saveOnboardStep, profileInput, type OnboardProfile, type OnboardStep, type Product } from '../../lib/onboarding-client';
import { toast } from '../Toasts';
import { ConfirmSheet } from '../ui/ConfirmSheet';
import { Notice } from '../ui/Notice';
import { Button } from '../ui/Button';
import { Icon } from '../Icon';
import { Logo } from '../Logo';
import { ThemeToggle } from '../ThemeToggle';
import { DetailSkeleton, ListSkeleton } from './Skeletons';
import { OnboardPreview, OnboardSteps, stepLabels, titles, leads } from './OnboardSteps';
import s from './onboarding.module.css';

export function OnboardLoading() {
  return <div className={s.page}>
    <header className={s.header}><div><Link className={s.logo} href="/"><Logo size={24} /></Link><ThemeToggle /><Button variant="ghost" href="/account/">გასვლა</Button></div></header>
    <div className={s.shell}>
      <aside className={s.navigation}><ListSkeleton compact kind="records" label="ნაბიჯები იტვირთება…" /></aside>
      <main className={s.main}><DetailSkeleton compact label="კომპანიის პროფილი იტვირთება…" /></main>
    </div>
  </div>;
}

type Model = { profile: OnboardProfile; products: Product[] };
// Storage can be unavailable in private mode or when the quota is exhausted.
function storeDraft(id: string, value: string | null) {
  try { if (value) localStorage.setItem(onboardDraftKey(id), value); else localStorage.removeItem(onboardDraftKey(id)); } catch { /* Server saving remains available. */ }
}
export function OnboardPage() {
  const { store, sessionReady, available } = useMarketStore();
  const router = useRouter(), params = useSearchParams();
  const candidate = params.get('step');
  const user = sessionReady ? store?.currentUser() : null;
  const actor = user?.id as string | undefined;
  const role = user?.role as string | undefined;
  const blocked = !!user?.blocked;
  const [savedAt, setSavedAt] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [model, setModel] = useState<Model | null>(null);
  const [persisted, setPersisted] = useState<Model | null>(null);
  // The step list follows the intent being edited, so choosing one on "type" reshapes it at once.
  const steps = stepsFor(model?.profile.account_intent ?? persisted?.profile.account_intent);
  const step: OnboardStep = steps.find(value => value === candidate) || 'type';
  const index = steps.indexOf(step);
  const last = steps.length - 1;
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [pending, setPending] = useState(false), [retry, setRetry] = useState(0);
  const [errorStep, setErrorStep] = useState<OnboardStep | null>(null);
  const dirty = useRef(new Set<OnboardStep>()), lock = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftWrite = useRef<{ id: string; value: string | null } | null>(null);
  const flushDraft = () => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = null;
    if (draftWrite.current) { storeDraft(draftWrite.current.id, draftWrite.current.value); draftWrite.current = null; }
  };
  const persistDraft = (next: Model, changed: Iterable<OnboardStep>, immediately = false) => {
    const steps = [...changed];
    setHasChanges(steps.length > 0);
    draftWrite.current = { id: next.profile.id, value: steps.length ? serializeOnboardDraft(next, steps) : null };
    if (draftTimer.current) clearTimeout(draftTimer.current);
    if (immediately) flushDraft(); else draftTimer.current = setTimeout(flushDraft, 500);
  };
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!sessionReady || !actor || role !== 'company' || blocked) return;
    let active = true;
    readOnboard(getMarketStore()).then(result => { if (active) {
      let raw: string | null = null;
      try { raw = localStorage.getItem(onboardDraftKey(result.profile.id)); } catch { /* Storage is optional. */ }
      let restored = restoreOnboardDraft(result, raw);
      dirty.current = new Set(restored !== result ? onboardSteps.filter(value => JSON.parse(raw!).dirtySteps.includes(value) &&
        JSON.stringify(retainOnboardDraft(result, restored, [value])) !== JSON.stringify(result)) : []);
      const fromDraft = restored !== result;
      if (!fromDraft) storeDraft(result.profile.id, null);
      if (!dirty.current.has('type') && !dirty.current.has('provide') && restored.profile.account_intent !== 'buy' && !restored.profile.provide_categories.length && restored.profile.industry) { restored = { ...restored, profile: { ...restored.profile, provide_categories: [restored.profile.industry] } }; dirty.current.add('type'); }
      setHasChanges(dirty.current.size > 0); setModel(restored); setPersisted(result); setRestoredDraft(fromDraft); setSavedAt(''); setError('');
    } }, err => { if (active) setError(onboardError(err)); });
    return () => { active = false; };
  }, [sessionReady, actor, role, blocked, retry]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { flushDraft(); if (dirty.current.size || lock.current) event.preventDefault(); };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('pagehide', flushDraft);
    return () => { flushDraft(); window.removeEventListener('beforeunload', unload); window.removeEventListener('pagehide', flushDraft); };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const patch = (value: Partial<OnboardProfile>) => {
    if (!model) return;
    dirty.current.add(step); setNotice(''); setSavedAt('');
    const next = { ...model, profile: { ...model.profile, ...value } };
    setModel(next); persistDraft(next, dirty.current);
  };
  const setProducts = (products: Product[]) => {
    if (!model) return;
    dirty.current.add('provide'); setNotice(''); setSavedAt('');
    const next = { ...model, products };
    setModel(next); persistDraft(next, dirty.current);
  };
  const discardDraft = () => {
    if (!persisted || pending) return;
    dirty.current.clear(); persistDraft(persisted, [], true);
    setModel(persisted); setRestoredDraft(false); setSavedAt(''); setError(''); setErrorStep(null);
  };
  async function save(destination?: OnboardStep | 'account' | 'home', completing = false) {
    if (!model || !store || pending || lock.current) return;
    const leaving = !completing && (destination === 'account' || destination === 'home');
    if (!leaving && !form.current?.checkValidity()) { form.current?.querySelector<HTMLElement>('[aria-invalid=true]')?.focus(); return; }
    persistDraft(model, dirty.current, true);
    lock.current = true; setPending(true); setError(''); setErrorStep(null); setNotice('');
    let writeTarget = step;
    try {
      let result = model;
      const writes = onboardWrites(step, dirty.current, leaving || completing, steps).filter(target => !leaving || !validateOnboardStep(target, model.profile, model.products));
      for (const target of writes) {
        writeTarget = target;
        const invalid = validateOnboardStep(target, model.profile, model.products);
        if (invalid) throw new Error(invalid);
        result = await saveOnboardStep(getMarketStore(), target, model.profile, model.products);
        // Supplied categories are chosen on type; save them with the existing RPC
        // without saving unrelated product/profile drafts.
        if (target === 'type' && dirty.current.has('type')) {
          if (model.profile.provide_categories.length > 5) throw new Error('აირჩიეთ მაქსიმუმ 5 დარგი.');
          const source = getMarketStore();
          const current = await readOnboardProfile(source);
          if (current.id !== model.profile.id) throw new Error('ანგარიში შეიცვალა. განაახლეთ გვერდი.');
          const categories = await source.callRpc('set_matching_categories', { p_provide: model.profile.provide_categories, p_need: current.need_categories });
          if (!Array.isArray(categories?.provide) || !Array.isArray(categories?.need)) throw new Error('კატეგორიების შენახვა ვერ დადასტურდა.');
          result = await readOnboard(source);
        }
        dirty.current.delete(target);
        const remainingModel = retainOnboardDraft(result, model, [...dirty.current]);
        setPersisted(result); setModel(remainingModel); persistDraft(remainingModel, dirty.current, true);
      }
      if(completing)await store.mutateRpc('complete_onboarding',{});
      const remaining = [...dirty.current];
      setModel(retainOnboardDraft(result, model, remaining)); setPersisted(result);
      dirty.current = new Set(remaining);
      if (!remaining.length) setRestoredDraft(false);
      setSavedAt(remaining.length ? '' : new Date().toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit', hour12: false }));
      if (destination === 'home') router.push('/');
      else if (destination === 'account') { toast({ title: remaining.length ? 'შეუნახავი ცვლილებები ამ მოწყობილობაზე შენარჩუნებულია' : 'პროფილი შენახულია' }); router.push('/account/'); }
      else if (destination) router.push('/onboarding/?step=' + destination);
    } catch (err) { const message = onboardError(err); setError(message); setErrorStep(writeTarget); toast({ title: message, tone: 'danger' }); if (leaving) router.push(destination === 'home' ? '/' : '/account/'); }
    finally { lock.current = false; setPending(false); }
  }
  async function upload(file: File | null, kind: 'logo' | 'gallery') {
    if (!model || !store || lock.current) return;
    lock.current = true; setPending(true); setError(''); setNotice('');
    try {
      const source = getMarketStore();
      const current = await readOnboardProfile(source);
      if (current.id !== model.profile.id) throw new Error('ანგარიში შეიცვალა. განაახლეთ გვერდი.');
      if (kind === 'logo') {
        const uploaded = file ? await source.uploadLogo(file) : { url: '' };
        const result = await source.updateProfile({ ...profileInput(current), logoUrl: uploaded.url });
        if (result?.id !== current.id || (result.logoUrl || '') !== uploaded.url) throw new Error('ლოგოს შენახვა ვერ დადასტურდა.');
      } else {
        if (!file) return;
        if (current.gallery.length >= 8) throw new Error('გალერეაში მაქსიმუმ 8 ფოტოა.');
        const result = await source.setGallery([...current.gallery, file]);
        if (result?.id !== current.id || !result.gallery?.length || result.gallery.length <= current.gallery.length) throw new Error('ფოტოს შენახვა ვერ დადასტურდა.');
      }
      const saved = await readOnboardProfile(source);
      setModel(previous => previous ? { ...previous, profile: { ...previous.profile, logo_url: saved.logo_url, gallery: saved.gallery } } : previous);
      setPersisted(previous => previous ? { ...previous, profile: { ...previous.profile, logo_url: saved.logo_url, gallery: saved.gallery } } : previous);
      setNotice('ფოტო შენახულია.');
      return kind === 'logo' ? saved.logo_url || undefined : saved.gallery[saved.gallery.length - 1];
    } catch (err) { const message = onboardError(err); setError(message); toast({ title: message, tone: 'danger' }); }
    finally { lock.current = false; setPending(false); }
  }
  const shell = (content: React.ReactNode) => <div className={s.page}><header className={s.header}><div><Link className={s.logo} href="/"><Logo size={24} /></Link><ThemeToggle /><Button variant="ghost" href="/account/">გასვლა</Button></div></header>{content}</div>;
  if (!sessionReady) return <OnboardLoading />;
  if (!available) return shell(<main className={s.state}><h1>მონაცემები მიუწვდომელია</h1><Button onClick={() => { void store?.revalidate(); }}>ხელახლა ცდა</Button></main>);
  if (!actor) return shell(<main className={s.state}><h1>კომპანიის პროფილის შექმნა</h1><p>გააგრძელეთ თქვენი კომპანიის ანგარიშით.</p><Button href="/account/?tab=register&role=company&next=%2Fonboarding%2F">რეგისტრაცია</Button><Button variant="secondary" href="/account/?next=%2Fonboarding%2F">შესვლა</Button></main>);
  if (blocked || role !== 'company') return shell(<main className={s.state}><h1>{blocked ? 'ანგარიში შეზღუდულია' : 'კომპანიის ანგარიშის გვერდი'}</h1><p>{role === 'admin' ? 'ადმინისტრატორის ანგარიში კომპანიის პროფილად არ იცვლება.' : 'ამ პროფილის შევსება მხოლოდ კომპანიის ანგარიშით არის შესაძლებელი.'}</p><Button href={role === 'admin' ? '/admin/' : '/account/'}>ჩემს ანგარიშზე დაბრუნება</Button></main>);
  if (!model || model.profile.id !== actor) return error ? shell(<main className={s.state}><p role="alert">{error}</p><Button onClick={() => setRetry(value => value + 1)}>ხელახლა ცდა</Button></main>) : <OnboardLoading />;
  // Completion reflects confirmed server data, never unsaved input or position alone.
  const saved = persisted?.profile.id === actor ? persisted : null;
  const p = saved?.profile;
  const completed: Record<OnboardStep, boolean> = {
    type: !!p && ['buy', 'sell', 'both'].includes(p.account_intent),
    details: !!(p?.name?.trim() && p.city),
    profile: !!p && p.company.trim().length >= 2,
    // Steps 4–5 are done once something is saved there; products need no photo to count.
    provide: p?.account_intent === 'buy' || !!(p?.offers.length || saved?.products.some(product => product.name.trim())),
    need: p?.account_intent === 'sell' || !!(p?.need_categories.length || p?.seeks.length),
    verify: !!p&&['pending','approved'].includes(p.verification_documents_status),
    review: !!p?.onboarding_completed_at,
  };
  // ✓ marks every step with saved data, before or after the current one; the current step shows its number.
  const isComplete = (key: OnboardStep) => key !== step && completed[key];
  const go = (target: OnboardStep) => {
    if(pending)return;
    // Backward navigation keeps the draft in this mounted page. Required fields
    // must block progression, but must not trap the user on an unfinished step.
    if (steps.indexOf(target) < index) {
      setError(''); setErrorStep(null); setNotice(''); router.push('/onboarding/?step=' + target);
      return;
    }
    void save(target);
  };
  return <div className={s.page}>
    <header className={s.header}><div><Link className={s.logo} href="/" onClick={event => { if (dirty.current.size || pending) { event.preventDefault(); void save('home'); } }}><Logo size={24} /></Link><ThemeToggle /><Button variant="ghost" disabled={pending} onClick={() => { void save('account'); }}>შენახვა და გასვლა</Button></div></header>
    <div className={s.shell}><nav className={s.navigation} aria-label="პროფილის ნაბიჯები"><p>კომპანიის ანგარიში</p><ol>{steps.map((key, i) => <li key={key}><button type="button" disabled={pending} data-complete={isComplete(key) || undefined} aria-current={key === step ? 'step' : undefined} onClick={() => go(key)}><span>{isComplete(key) ? <Icon name="check" /> : i + 1}</span>{stepLabels[key]}</button></li>)}</ol></nav>
      <main className={s.main}><nav className={s.mobileProgress} aria-label="მობილური ნაბიჯები"><div><strong>{stepLabels[step]}</strong><span>ნაბიჯი {index + 1} / {steps.length}</span></div><ol>{steps.map((key, i) => <li key={key}><button type="button" disabled={pending} data-complete={isComplete(key) || undefined} aria-label={`${i + 1}. ${stepLabels[key]}`} aria-current={key === step ? "step" : undefined} onClick={() => go(key)}><span /></button></li>)}</ol></nav>
        <h1 ref={heading} tabIndex={-1}>{titles[step]}</h1><p className={s.lead}>{leads[step]}</p>
        <p className={s.draftStatus} role="status">{hasChanges ? 'შეუნახავი ცვლილებები' : savedAt ? 'შენახულია ' + savedAt : ''}</p>
        {restoredDraft && <Notice tone="info" className={s.draftNotice} action={<Button variant="ghost" size="sm" disabled={pending} onClick={discardDraft}>გაუქმება</Button>}>აღდგენილია შეუნახავი ცვლილებები</Notice>}
        <form noValidate ref={form} onSubmit={event => { event.preventDefault(); void save(index === last ? 'account' : steps[index + 1], index === last); }}>
          <fieldset disabled={pending} className={s.formFieldset}><div className={s.columns}><div className={s.content}><OnboardSteps store={store!} onBusy={setPending} key={step} step={step} profile={model.profile} patch={patch} products={model.products} setProducts={setProducts} upload={upload} go={go} /></div>{!['details', 'review'].includes(step) && <aside className={s.aside}><OnboardPreview profile={model.profile} products={model.products} step={step} /></aside>}</div></fieldset>
          {error && <div className={s.error} role="alert"><p>{error}</p>{errorStep && errorStep !== step && <Button variant="secondary" onClick={() => { setError(''); setErrorStep(null); router.push('/onboarding/?step=' + errorStep); }}>{stepLabels[errorStep]} — შესწორება</Button>}</div>}{notice && <p className={s.notice} role="status">{notice}</p>}
          <Button variant="ghost" disabled={!hasChanges || pending} onClick={() => setConfirmDiscard(true)}>ცვლილებების გაუქმება</Button>
          <div className={s.actions}><span className={s.autosave} role="status">{pending ? 'ინახება…' : savedAt ? 'შენახულია ' + savedAt : ''}</span>{index > 0 && <Button variant="secondary" disabled={pending} onClick={() => go(steps[index - 1])}>უკან</Button>}<Button type="submit" loading={pending}>{index === last ? 'დასრულება' : step === 'verify' ? 'გადახედვა' : 'შემდეგი'}</Button></div>
        </form>
      </main>
    </div>
    <ConfirmSheet id="onboard-discard" open={confirmDiscard} title="ცვლილებების გაუქმება" confirmLabel="ცვლილებების გაუქმება" pendingLabel="უქმდება…" pending={pending} danger onCancel={() => setConfirmDiscard(false)} onConfirm={() => { discardDraft(); setConfirmDiscard(false); }}><p>შეუნახავი ცვლილებები წაიშლება. შენახული მონაცემები დარჩება.</p></ConfirmSheet>
  </div>;
}
