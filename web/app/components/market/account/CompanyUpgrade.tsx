"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../ui/Button';
import { CustomSelect } from '../../ui/CustomSelect';
import { useMarketStore } from '../../../lib/market-client';
import { categories } from '../../../lib/categories';
import { intents, type AccountIntent } from '../../../lib/onboarding-client';
import { useFieldErrors, type FieldErrors } from '../fieldErrors';
import { categoryOptions } from '../CategoryOptions';
import { Icon } from '../../Icon';
import type { AnyUser } from './shared';
import styles from './CompanyUpgrade.module.css';

/** Adds company capabilities to the existing account; verification remains moderated. */
export function CompanyUpgrade({ user }: { user: AnyUser }) {
  const { store } = useMarketStore();
  const router = useRouter();
  const [company, setCompany] = useState(user.company || '');
  const [industry, setIndustry] = useState('');
  const [intent, setIntent] = useState<AccountIntent>('both');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fields = useFieldErrors();
  // The form opens on demand, or directly when a link points at it (#company-upgrade).
  // Account content mounts after the client session check, so the hash is readable here.
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.location.hash === '#company-upgrade');
  if (user.role !== 'client' || user.blocked) return null;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!store || busy) return;
    const errors: FieldErrors = {};
    if (company.trim().length < 2) errors['upgrade-company'] = 'მიუთითეთ კომპანიის დასახელება.';
    if (!Object.hasOwn(categories, industry)) errors['upgrade-industry'] = 'დარგი სავალდებულოა.';
    if (!fields.check(errors, ['upgrade-company', 'upgrade-industry'])) return;
    setBusy(true); setError('');
    try {
      const result = await store.mutateRpc('become_company', { p_company: company.trim(), p_industry: industry, p_account_intent: intent });
      if (result?.id !== user.id || result.role !== 'company') throw new Error('კომპანიის პროფილის შექმნა ვერ დადასტურდა.');
      router.push('/onboarding/?step=type');
    } catch (failure) {
      setError((failure as { userMessage?: string; message?: string })?.userMessage || (failure as Error)?.message || 'პროფილი ვერ შეიქმნა. სცადეთ ხელახლა.');
    } finally { setBusy(false); }
  }
  return <section className={`account-section ${styles.panel}`} id="company-upgrade" aria-labelledby="company-upgrade-title">
    <div className={styles.intro}><span className={styles.icon} aria-hidden="true"><Icon name="building-2"/></span><div><h2 className="account-section__title" id="company-upgrade-title">კომპანიის პროფილი</h2><p>ამავე ანგარიშით გაყიდეთ პროდუქტები და მომსახურება — მოთხოვნები, გარიგებები და მიმოწერები შენარჩუნდება.</p></div></div>
    {!open ? <Button className={styles.action} variant="secondary" aria-expanded={false} aria-controls="company-upgrade-form" onClick={() => setOpen(true)}><Icon name="plus"/>კომპანიის პროფილის დამატება</Button> : <form id="company-upgrade-form" className="ma-form" onSubmit={submit} noValidate>
      <fieldset className={styles.fields} disabled={busy}>
        <div className="ma-field"><label className="ma-field__label" htmlFor="upgrade-company">კომპანიის დასახელება *</label><input className="ma-input" autoComplete="organization" maxLength={120} value={company} onChange={event => { setCompany(event.target.value); fields.clear('upgrade-company'); }} {...fields.control('upgrade-company')}/>{fields.message('upgrade-company')}</div>
        <div className="ma-field"><label className="ma-field__label" htmlFor="upgrade-industry">დარგი *</label><div><CustomSelect value={industry} onChange={event => { setIndustry(event.target.value); fields.clear('upgrade-industry'); }} {...fields.control('upgrade-industry')}><option value="" disabled>აირჩიეთ დარგი</option>{categoryOptions()}</CustomSelect></div>{fields.message('upgrade-industry')}</div>
        <fieldset className={styles.intents}><legend>რისთვის გამოიყენებთ MeetAny-ს?</legend>{(Object.keys(intents) as AccountIntent[]).map(key => <label key={key}><input type="radio" name="upgrade-intent" value={key} checked={intent === key} onChange={() => setIntent(key)} />{intents[key]}</label>)}</fieldset>
      </fieldset>
      {error && <p className="ma-field__error" role="alert">{error}</p>}
      <p className={styles.next}>შემდეგ ნაბიჯზე შეავსებთ კომპანიის მონაცემებს და გაგზავნით დოკუმენტებს ვერიფიკაციისთვის.</p>
      <div className={styles.actions}><Button type="submit" loading={busy}>კომპანიის პროფილის შექმნა</Button><Button variant="ghost" disabled={busy} onClick={() => { setOpen(false); setError(''); }}>დაბრუნება</Button></div>
    </form>}
  </section>;
}
