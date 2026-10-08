'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMarketStore, useMarketStore } from '../../lib/market-client';
import { onboardSteps, onboardError, readOnboard, readOnboardProfile, saveOnboardStep, profileInput, type OnboardProfile, type OnboardStep, type Product } from '../../lib/onboarding-client';
import { toast } from '../Toasts';
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
export function OnboardPage() {
  const { store, sessionReady, available } = useMarketStore();
  const router = useRouter(), params = useSearchParams();
  const candidate = params.get('step');
  const step: OnboardStep = onboardSteps.find(value => value === candidate) || 'type';
  const index = onboardSteps.indexOf(step);
  const user = sessionReady ? store?.currentUser() : null;
  const actor = user?.id as string | undefined;
  const role = user?.role as string | undefined;
  const blocked = !!user?.blocked;
  const [unsaved, setUnsaved] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [model, setModel] = useState<Model | null>(null);
  const [persisted, setPersisted] = useState<Model | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [pending, setPending] = useState(false), [retry, setRetry] = useState(0);
  const dirty = useRef(new Set<OnboardStep>()), lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!sessionReady || !actor || role !== 'company' || blocked) return;
    let active = true;
    readOnboard(getMarketStore()).then(result => { if (active) { setModel(result); setPersisted(result); setError(''); dirty.current.clear(); setUnsaved(false); } }, err => { if (active) setError(onboardError(err)); });
    return () => { active = false; };
  }, [sessionReady, actor, role, blocked, retry]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (dirty.current.size || lock.current) event.preventDefault(); };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const patch = (value: Partial<OnboardProfile>) => { dirty.current.add(step); setUnsaved(true); setNotice(''); setModel(previous => previous ? { ...previous, profile: { ...previous.profile, ...value } } : previous); };
  const setProducts = (products: Product[]) => { dirty.current.add('provide'); setUnsaved(true); setNotice(''); setModel(previous => previous ? { ...previous, products } : previous); };
  async function save(destination?: OnboardStep | 'account' | 'home') {
    if (!model || !store || lock.current || !form.current?.reportValidity()) return;
    if (step === 'review' && destination === 'account' && !accepted) { toast({ title: 'დაეთანხმეთ გამოყენების წესებს', tone: 'danger' }); return; }
    lock.current = true; setPending(true); setError(''); setNotice('');
    try {
      let result = model;
      const writes = onboardSteps.filter(value => dirty.current.has(value) || value === step);
      for (const target of writes) result = await saveOnboardStep(getMarketStore(), target, model.profile, model.products);
      setModel(result); setPersisted(result); dirty.current.clear(); setUnsaved(false);
      setSavedAt(new Date().toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit', hour12: false }));
      if (destination === 'home') router.push('/');
      else if (destination === 'account') { toast({ title: 'პროფილი შენახულია' }); router.push('/account/'); }
      else if (destination) router.push('/onboarding/?step=' + destination);
    } catch (err) { const message = onboardError(err); setError(message); toast({ title: message, tone: 'danger' }); }
    finally { lock.current = false; setPending(false); }
  }
  async function upload(file: File, kind: 'logo' | 'gallery') {
    if (!model || !store || lock.current) return;
    lock.current = true; setPending(true); setError(''); setNotice('');
    try {
      const source = getMarketStore();
      const current = await readOnboardProfile(source);
      if (current.id !== model.profile.id) throw new Error('ანგარიში შეიცვალა. განაახლეთ გვერდი.');
      if (kind === 'logo') {
        const uploaded = await source.uploadLogo(file);
        const result = await source.updateProfile({ ...profileInput(current), logoUrl: uploaded.url });
        if (result?.id !== current.id || result.logoUrl !== uploaded.url) throw new Error('ლოგოს შენახვა ვერ დადასტურდა.');
      } else {
        if (current.gallery.length >= 8) throw new Error('გალერეაში მაქსიმუმ 8 ფოტოა.');
        const result = await source.setGallery([...current.gallery, file]);
        if (result?.id !== current.id || result.gallery?.length <= current.gallery.length) throw new Error('ფოტოს შენახვა ვერ დადასტურდა.');
      }
      const saved = await readOnboardProfile(source);
      setModel(previous => previous ? { ...previous, profile: { ...previous.profile, logo_url: saved.logo_url, gallery: saved.gallery } } : previous);
      setNotice('ფოტო შენახულია.');
    } catch (err) { const message = onboardError(err); setError(message); toast({ title: message, tone: 'danger' }); }
    finally { lock.current = false; setPending(false); }
  }
  const shell = (content: React.ReactNode) => <div className={s.page}><header className={s.header}><div><Link className={s.logo} href="/"><Logo size={24} /></Link><span className={s.saveHint}>ინახება ნაბიჯის შეცვლისას</span><ThemeToggle /><Button variant="ghost" href="/account/">გასვლა</Button></div></header>{content}</div>;
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
    details: !!(p?.legal_name?.trim() && p.registration_code?.trim() && p.legal_form?.trim() && p.founded_year && p.employee_band && p.name?.trim() && p.city),
    profile: !!(p?.company?.trim() && p.industry && p.about?.trim()),
    provide: !!p?.provide_categories.length && !!(p.offers.length || saved?.products.some(product => product.name.trim() && product.photoUrl)),
    need: !!p?.need_categories.length,
    verify: p?.verification_documents_status === 'approved',
    review: false,
  };
  const isComplete = (key: OnboardStep, position: number) => position < index && completed[key];
  const go = (target: OnboardStep) => { void save(target); };
  return <div className={s.page}>
    <header className={s.header}><div><Link className={s.logo} href="/" onClick={event => { if (dirty.current.size || pending) { event.preventDefault(); void save('home'); } }}><Logo size={24} /></Link><span className={s.saveHint} role="status">{pending ? 'ინახება…' : unsaved ? 'ინახება ნაბიჯის შეცვლისას' : savedAt ? 'შენახულია ' + savedAt : 'ინახება ნაბიჯის შეცვლისას'}</span><ThemeToggle /><Button variant="ghost" disabled={pending} onClick={() => { void save('account'); }}>გასვლა</Button></div></header>
    <div className={s.shell}><nav className={s.navigation} aria-label="პროფილის ნაბიჯები"><p>კომპანიის ანგარიში</p><ol>{onboardSteps.map((key, i) => <li key={key}><button type="button" disabled={pending} data-complete={isComplete(key, i) || undefined} aria-current={key === step ? 'step' : undefined} onClick={() => go(key)}><span>{isComplete(key, i) ? <Icon name="check" /> : i + 1}</span>{stepLabels[key]}</button></li>)}</ol></nav>
      <main className={s.main}><nav className={s.mobileProgress} aria-label="მობილური ნაბიჯები"><div><strong>{stepLabels[step]}</strong><span>ნაბიჯი {index + 1} / 7</span></div><ol>{onboardSteps.map((key, i) => <li key={key}><button type="button" disabled={pending} data-complete={isComplete(key, i) || undefined} aria-label={`${i + 1}. ${stepLabels[key]}`} aria-current={key === step ? "step" : undefined} onClick={() => go(key)}><span /></button></li>)}</ol></nav>
        <h1 ref={heading} tabIndex={-1}>{titles[step]}</h1><p className={s.lead}>{leads[step]}</p>
        <form ref={form} onSubmit={event => { event.preventDefault(); void save(index === 6 ? 'account' : onboardSteps[index + 1]); }}>
          <fieldset disabled={pending} className={s.formFieldset}><div className={s.columns}><div className={s.content}><OnboardSteps key={step} accepted={accepted} setAccepted={setAccepted} step={step} profile={model.profile} patch={patch} products={model.products} setProducts={setProducts} upload={upload} go={go} /></div>{!['details', 'review'].includes(step) && <aside className={s.aside}><div className={s.desktopPreview}><OnboardPreview profile={model.profile} products={model.products} step={step} /></div><details className={s.mobilePreview}><summary>პროფილის გადახედვა</summary><OnboardPreview profile={model.profile} products={model.products} step={step} /></details></aside>}</div></fieldset>
          {error && <p className={s.error} role="alert">{error} ცვლილებების შესანახად სცადეთ ხელახლა.</p>}{notice && <p className={s.notice} role="status">{notice}</p>}
          <div className={s.actions}>{index > 0 && <Button variant="secondary" disabled={pending} onClick={() => go(onboardSteps[index - 1])}>უკან</Button>}<Button type="submit" loading={pending}>{index === 6 ? 'დასრულება' : 'შემდეგი'}</Button></div>
        </form>
      </main>
    </div>
  </div>;
}
