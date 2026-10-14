"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { FormLayout } from "../../ui/FormLayout";
import { Badge } from "../../ui/Badge";
import { CompanyListingCard } from "../CompanyListingCard";
import { useMarketStore } from "../../../lib/market-client";
import { readOnboard, verificationLabel, verificationTone } from "../../../lib/onboarding-client";
import { cities } from "../../../lib/categories";
import type { AnyUser } from "./shared";
import panel from "../onboarding.module.css";
import styles from "./ProfileForm.module.css";

/** The preview and progress use saved data; drafts stay inside their form blocks. */
export function ProfileLayout({ me, children, section = "details" }: { me: AnyUser; children: ReactNode; section?: string }) {
  const { store } = useMarketStore();
  const company = me.role === "company";
  const [extra, setExtra] = useState<Awaited<ReturnType<typeof readOnboard>>>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    if (company && store) void readOnboard(store).then(value => { if (active) { setExtra(value); setFailed(false); } }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [store, company, me, section]);
  const checks = [
    { label: company ? "ძირითადი მონაცემები" : "პირადი მონაცემები", filled: !!(me.name && me.city && (!company || me.company && me.industry)), href: "details#profile-basic" },
    ...(company ? [
      { label: "აღწერა და ტეგები", filled: !!(me.about && (me.offers?.length || me.seeks?.length)), href: "details#profile-description" },
      { label: "ლოგო და გალერეა", filled: !!(me.logoUrl && me.gallery?.length), href: "details#profile-media" },
      { label: "მისამართი და მდებარეობა", filled: !!((me.address || me.lat != null && me.lng != null) && me.serviceCities?.length), href: "details#profile-location" },
    ] : []),
    { label: "კონტაქტი", filled: !!(me.phone && me.email), href: "details#profile-contact" },
    ...(company && extra ? [
      { label: "იურიდიული მონაცემები", filled: !!(extra.profile.legal_name && extra.profile.registration_code), href: "legal" },
      { label: "დოკუმენტები", filled: me.verified || ["approved", "pending"].includes(extra.profile.verification_documents_status), href: "documents" },
      { label: "პროდუქტები", filled: !!extra.products.length, href: "products" },
    ] : []),
  ];
  const complete = checks.filter(check => check.filled).length;
  const status = extra?.profile.verification_documents_status || me.verificationDocumentsStatus;
  return <FormLayout className={styles.layout} asideLabel={company ? "ასე ჩანს · პროფილის სტატუსი" : "ანგარიშის სტატუსი"} aside={<>
    {company ? <section className={styles.preview} aria-label="ასე ჩანს"><p className={panel.previewLabel}>ასე ჩანს</p><CompanyListingCard catalog c={{ id: me.id, name: me.company || me.name, logoUrl: me.logoUrl, gallery: me.gallery, industry: me.industry || "", city: me.city, serviceCities: me.serviceCities || [], offers: me.offers || [], about: me.about || "", verified: me.verified, stats: { sent: 0, chosen: 0 } }}/></section>
      : <section className={panel.progressPanel} aria-label="შენახული მონაცემები"><strong>{me.name}</strong><p className="account-hint">{[me.company, cities[me.city] || me.city].filter(Boolean).join(" · ")}</p></section>}
    <section className={panel.progressPanel} aria-label="შევსების პროგრესი">
      <strong>შევსებულია {complete}/{checks.length} ბლოკი</strong><progress value={complete} max={checks.length} aria-label="შევსებული ბლოკები"/>
      {complete < checks.length ? <><p className="account-hint">შესავსებია:</p><ul className={styles.checks}>{checks.filter(check => !check.filled).map(check => <li key={check.href}><Link href={`/account/?tab=profile${company ? `&section=${check.href}` : `#${check.href.split('#')[1]}`}`}><span aria-hidden="true">○</span>{check.label}</Link></li>)}</ul></> : <p className="account-hint">ყველა ბლოკი შევსებულია.</p>}
      {company && !extra && <p className="account-hint">{failed ? "დამატებითი სექციების სტატუსი ვერ ჩაიტვირთა." : "სექციების სტატუსი იტვირთება…"}</p>}
    </section>
    {company && <section className={panel.progressPanel} aria-label="ვერიფიკაციის სტატუსი"><strong>ვერიფიკაცია</strong><Badge status={verificationTone(status, me.verified)}>{verificationLabel(status, me.verified)}</Badge><Link className={styles.panelLink} href={`/companies/view/?id=${encodeURIComponent(me.id)}`}>საჯარო გვერდის ნახვა</Link></section>}
  </>}>{children}</FormLayout>;
}
