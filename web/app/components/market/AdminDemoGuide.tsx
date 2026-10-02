"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import type { Store } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { useBusinessResource } from "../../lib/business-client";
import { AdminState } from "./AdminState";
import styles from "./admin.module.css";

const steps = [
  { title: "კლიენტი აქვეყნებს მოთხოვნას", text: "მაგალითად, სასტუმროს სჭირდება თეთრეული: უთითებს რაოდენობას, ქალაქსა და სასურველ ვადას. მომწოდებელი წინასწარ ხედავს, რა არის საჭირო.", href: "/requests/", action: "მოთხოვნების ნახვა", icon: "clipboard-list" },
  { title: "კომპანია სთავაზობს პირობებს", text: "მომწოდებელი პასუხობს მოთხოვნას და აღწერს მიწოდების პირობებს. კლიენტი ადარებს შეთავაზებებს, მიმოწერით აზუსტებს დეტალებს და ირჩევს კომპანიას.", href: "/companies/", action: "კომპანიების ნახვა", icon: "users" },
  { title: "ბიზნესი პოულობს დისტრიბუტორს", text: "მაღაზია ეძებს რეგულარულ მომარაგებას: არჩევს რეგიონს, მიწოდების არხსა და საჭირო შესაძლებლობებს — მაგალითად, საწყობს ან ცივ მიწოდებას.", href: "/companies/?type=distributors", action: "დისტრიბუტორების ნახვა", icon: "truck" },
  { title: "ადმინი აკვირდება შედეგს", text: "ანალიტიკა აჩვენებს, სად ელოდებიან შეთავაზებას და სად არის მეტი მომწოდებელი საჭირო. საჩივრები, შეფასებები და მოქმედებების ისტორია ხარისხის მართვაში ეხმარება.", href: "/admin/", action: "ანალიტიკის ნახვა", icon: "layout-grid" },
];

export function AdminDemoGuide({ store }: { store: Store }) {
  // Public profile snapshots omit client emails; use the existing admin-only search.
  const load = useCallback(() => store.adminSearchUsers({ p_q: "demo-", p_limit: 100 }), [store]);
  const accounts = useBusinessResource<{ items: { id: string; email?: string }[] }>(load, String(store.dataRevision()));
  const demoOwners = new Set((accounts.data?.items || []).filter(account => /^demo-[^@]+@meetany\.ge$/i.test(account.email || "")).map(account => account.id));
  const examples = (store.listRequests({ state: "open" }) as { id: string; title: string; ownerId: string; category: string; city: string }[])
    .filter(request => demoOwners.has(request.ownerId))
    .slice(0, 3);

  return <div className={styles.overview}>
    <section className={styles.demoIntro} aria-labelledby="demo-intro-heading">
      <span className="ma-badge ma-badge--info">სადემონსტრაციო გარემო</span>
      <h2 id="demo-intro-heading">MeetAny — ბიზნესს საჭირო მომწოდებელთან აკავშირებს</h2>
      <p>კლიენტი აღწერს საჭიროებას, კომპანიები აგზავნიან შეთავაზებებს, შეთანხმება კი პირდაპირი კომუნიკაციით ხდება. კატალოგში შესაძლებელია კომპანიისა და დისტრიბუტორის დამოუკიდებლად მოძებნაც.</p>
      <p className={styles.note}>სადემო კომპანიები, მოთხოვნები და შეთავაზებები პროდუქტის შესაძლებლობების საჩვენებლადაა მომზადებული. ანალიტიკის რიცხვები ამ გარემოში არსებულ ჩანაწერებს ასახავს და რეალური ბიზნესშედეგების მტკიცებულება არ არის.</p>
    </section>

    <section aria-labelledby="demo-steps-heading">
      <h2 className="ma-h3" id="demo-steps-heading">როგორ წარვადგინოთ — 4 ნაბიჯი</h2>
      <ol className={styles.demoSteps}>
        {steps.map((step, index) => <li className={styles.demoStep} key={step.href}>
          <span className={styles.demoStepNumber} aria-hidden="true">{index + 1}</span>
          <h3><Icon name={step.icon} />{step.title}</h3>
          <p>{step.text}</p>
          <Button variant="secondary" href={step.href}>{step.action}</Button>
        </li>)}
      </ol>
    </section>

    <section className={styles.panel} aria-labelledby="demo-examples-heading">
      <header className={styles.panelHead}><h2 id="demo-examples-heading">სადემო მოთხოვნების მაგალითები</h2><span>არსებული ღია მოთხოვნებიდან</span></header>
      {accounts.error ? <AdminState error title="სადემო მაგალითები ვერ ჩაიტვირთა" text={accounts.error} onRetry={accounts.reload} /> : !accounts.data ? <p role="status">სადემო მაგალითები იტვირთება…</p> : examples.length ? <ul className={styles.demoExamples}>{examples.map(request => <li key={request.id}>
        <Link href={`/requests/view/?id=${encodeURIComponent(request.id)}`}><strong>{request.title}</strong><span>{categories[request.category] || request.category} · {cities[request.city] || request.city} · {store.offerCount(request.id)} შეთავაზება</span></Link>
      </li>)}</ul> : <p className={styles.note}>ღია სადემო მაგალითები ამჟამად არ არის. სრული კატალოგი მოთხოვნების გვერდზეა.</p>}
    </section>

    <section className={styles.panel} aria-labelledby="demo-glossary-heading">
      <header className={styles.panelHead}><h2 id="demo-glossary-heading">რას ნიშნავს ადმინის მაჩვენებლები</h2></header>
      <dl className={styles.demoGlossary}>
        <div><dt>მომწოდებლის არჩევა</dt><dd>კლიენტმა კონკრეტული შეთავაზება აირჩია. ეს არ ადასტურებს გადახდას ან შეკვეთის მიწოდებას.</dd></div>
        <div><dt>დაკავშირების სტატისტიკა</dt><dd>ითვლება ნომრის გახსნა და დარეკვის ღილაკზე დაჭერა. სატელეფონო საუბრის დასრულება არ მოწმდება.</dd></div>
        <div><dt>შეფასება და საჩივარი</dt><dd>შეფასება კომპანიასთან თანამშრომლობის გამოცდილებაა; საჩივარი შესაძლო დარღვევაზე შეტყობინებაა, რომელსაც ადმინი განიხილავს.</dd></div>
        <div><dt>Premium / VIP პაკეტები</dt><dd>კომპანიის დამატებითი ხილვადობის განაცხადებია. პირობები კომპანიასთან თანხმდება; საიტზე გადახდა არ მუშავდება.</dd></div>
      </dl>
    </section>
  </div>;
}
