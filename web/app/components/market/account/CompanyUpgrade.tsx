"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../ui/Button';
import { CustomSelect } from '../../ui/CustomSelect';
import { useMarketStore } from '../../../lib/market-client';
import { categories } from '../../../lib/categories';
import { useFieldErrors, type FieldErrors } from '../fieldErrors';
import { categoryOptions } from '../CategoryOptions';
import type { AnyUser } from './shared';
import styles from './CompanyUpgrade.module.css';

/** Adds company capabilities to the existing account; verification remains moderated. */
export function CompanyUpgrade({ user }: { user: AnyUser }) {
  const { store } = useMarketStore();
  const router = useRouter();
  const [company, setCompany] = useState(user.company || '');
  const [industry, setIndustry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fields = useFieldErrors();
  if (user.role !== 'client' || user.blocked) return null;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!store || busy) return;
    const errors: FieldErrors = {};
    if (company.trim().length < 2) errors['upgrade-company'] = 'მიუთითეთ კომპანიის დასახელება.';
    if (!Object.hasOwn(categories, industry)) errors['upgrade-industry'] = 'აირჩიეთ მიმართულება.';
    if (!fields.check(errors, ['upgrade-company', 'upgrade-industry'])) return;
    setBusy(true); setError('');
    try {
      const result = await store.mutateRpc('become_company', { p_company: company.trim(), p_industry: industry });
      if (result?.id !== user.id || result.role !== 'company') throw new Error('კომპანიის პროფილის შექმნა ვერ დადასტურდა.');
      router.push('/onboarding/?step=type');
    } catch (failure) {
      setError((failure as { userMessage?: string; message?: string })?.userMessage || (failure as Error)?.message || 'პროფილი ვერ შეიქმნა. სცადეთ ხელახლა.');
    } finally { setBusy(false); }
  }
  return <section className={styles.panel} id="company-upgrade" aria-labelledby="company-upgrade-title">
    <h3 id="company-upgrade-title">კომპანიის პროფილის შექმნა</h3>
    <p>ამავე ანგარიშით გაყიდეთ პროდუქტები და მომსახურება. თქვენი მოთხოვნები, გარიგებები და მიმოწერა შენარჩუნდება. შემდეგ შეავსებთ კომპანიის მონაცემებს და მოითხოვთ დადასტურებას.</p>
    <form className="ma-form" onSubmit={submit} noValidate>
      <fieldset className={styles.fields} disabled={busy}>
        <div className="ma-field"><label className="ma-field__label" htmlFor="upgrade-company">კომპანიის დასახელება *</label><input className="ma-input" autoComplete="organization" maxLength={120} value={company} onChange={event => { setCompany(event.target.value); fields.clear('upgrade-company'); }} {...fields.control('upgrade-company')}/>{fields.message('upgrade-company')}</div>
        <div className="ma-field"><label className="ma-field__label" htmlFor="upgrade-industry">მიმართულება *</label><div><CustomSelect value={industry} onChange={event => { setIndustry(event.target.value); fields.clear('upgrade-industry'); }} {...fields.control('upgrade-industry')}><option value="" disabled>აირჩიეთ მიმართულება</option>{categoryOptions()}</CustomSelect></div>{fields.message('upgrade-industry')}</div>
      </fieldset>
      {error && <p className="ma-field__error" role="alert">{error}</p>}
      <Button className={styles.action} type="submit" loading={busy}>კომპანიის პროფილის შექმნა</Button>
    </form>
  </section>;
}
