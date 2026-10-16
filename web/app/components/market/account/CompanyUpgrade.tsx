"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../ui/Button';
import { Combobox } from '../../ui/Combobox';
import { categoryOptions } from '../../ui/combobox-options';
import { useMarketStore } from '../../../lib/market-client';
import { categories } from '../../../lib/categories';
import { useFieldErrors, type FieldErrors } from '../fieldErrors';
import { Icon } from '../../Icon';
import type { AnyUser } from './shared';
import styles from './CompanyUpgrade.module.css';

/** Adds company capabilities to the existing account; verification remains moderated. */
export function CompanyUpgrade({ user }: { user: AnyUser }) {
  const { store } = useMarketStore();
  const router = useRouter();
  // Personal profiles may carry the person's name as a legacy company fallback.
  const [company, setCompany] = useState(user.company && user.company !== user.name ? user.company : '');
  const [industry, setIndustry] = useState(user.industry || '');
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
      const result = await store.mutateRpc('become_company', { p_company: company.trim(), p_industry: industry, p_account_intent: 'both' });
      if (result?.id !== user.id || result.role !== 'company') throw new Error('კომპანიის პროფილის შექმნა ვერ დადასტურდა.');
      router.push('/onboarding/?step=type');
    } catch (failure) {
      setError((failure as { userMessage?: string; message?: string })?.userMessage || (failure as Error)?.message || 'პროფილი ვერ შეიქმნა. სცადეთ ხელახლა.');
    } finally { setBusy(false); }
  }
  return <section className={`account-section ${styles.panel}`} id="company-upgrade" aria-labelledby="company-upgrade-title">
    <div className={styles.intro}><span className={styles.icon} aria-hidden="true"><Icon name="building-2"/></span><div><h2 className="account-section__title" id="company-upgrade-title">კომპანიის პროფილი</h2><p>შექმენით კომპანიის საჯარო პროფილი. თქვენი მონაცემები და მიმოწერები შენარჩუნდება.</p></div></div>
    {!open ? <Button className={styles.action} variant="secondary" aria-expanded={false} aria-controls="company-upgrade-form" onClick={() => setOpen(true)}><Icon name="plus"/>დაამატეთ კომპანია</Button> : <form id="company-upgrade-form" className="ma-form" onSubmit={submit} noValidate>
      <fieldset className={styles.fields} disabled={busy}>
        <div className="ma-field"><label className="ma-field__label" htmlFor="upgrade-company">კომპანიის დასახელება *</label><input className="ma-input" autoComplete="organization" maxLength={100} required value={company} onChange={event => { setCompany(event.target.value); fields.clear('upgrade-company'); }} {...fields.control('upgrade-company')}/>{fields.message('upgrade-company')}</div>
        <div className="ma-field"><label className="ma-field__label" htmlFor="upgrade-industry">დარგი *</label><Combobox {...fields.control("upgrade-industry")} required label="დარგი" options={categoryOptions} value={industry} onChange={value => {setIndustry(value); fields.clear('upgrade-industry');}}/>{fields.message('upgrade-industry')}</div>
      </fieldset>
      {error && <p className="ma-field__error" role="alert">{error}</p>}
      <div className={styles.actions}><Button variant="secondary" disabled={busy} onClick={() => { setOpen(false); setError(''); }}>უკან</Button><Button type="submit" loading={busy}>გააგრძელეთ</Button></div>
    </form>}
  </section>;
}
