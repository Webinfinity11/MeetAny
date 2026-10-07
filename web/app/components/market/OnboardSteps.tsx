'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Button } from '../ui/Button';
import { OnboardIcon as Icon } from './OnboardFields';
import { categories, cities } from '../../lib/categories';
import { documentLabels, type OnboardProfile, type OnboardStep, type Product } from '../../lib/onboarding-client';
import { OnboardCard as Card, OnboardField as Field, OnboardItems as Items, OnboardCategories as Categories } from './OnboardFields';
import s from './onboarding.module.css';

export const stepLabels: Record<OnboardStep, string> = { type: 'ანგარიშის ტიპი', details: 'კომპანიის მონაცემები', profile: 'ბიზნეს-პროფილი', provide: 'რას სთავაზობთ', need: 'რას ყიდულობთ', verify: 'ვერიფიკაცია', review: 'გადახედვა' };
export const titles: Record<OnboardStep, string> = { type: 'როგორ გამოიყენებთ MeetAny-ს?', details: 'კომპანიის მონაცემები', profile: 'ბიზნეს-პროფილი', provide: 'რას სთავაზობთ ბაზარს', need: 'რას ყიდულობთ ხშირად', verify: 'ვერიფიკაცია', review: 'გადახედვა და დასრულება' };
export const leads: Record<OnboardStep, string> = {
  type: 'ერთი კომპანიის ანგარიშით შეგიძლიათ იყიდოთ, გაყიდოთ ან ორივე. ნებისმიერ დროს შეცვლით.',
  details: 'კომპანიის იურიდიული ინფორმაცია და საკონტაქტო მონაცემები.',
  profile: 'ეს ნაწილი ყველას უჩანს. შეავსეთ აღწერა და ბიზნესის მიმართულებები.',
  provide: 'დაამატეთ პროდუქტები და მომსახურებები — მყიდველები ამით გიპოვიან. ფასი შეთავაზებაში იწერება.',
  need: 'აირჩიეთ შესყიდვის კატეგორიები. ეს თქვენი პირადი პარამეტრებია და აქტიურ მოთხოვნას არ ქმნის.',
  verify: 'შეამოწმეთ დოკუმენტების მიმდინარე სტატუსი. დადასტურებას ადმინისტრატორი ასრულებს.',
  review: 'შეამოწმეთ შენახული მონაცემები. დასრულების შემდეგ თქვენს ანგარიშზე გადახვალთ.',
};
export const intents = { buy: 'მომწოდებლების პოვნა', sell: 'კლიენტების პოვნა', both: 'ორივე' };
export function OnboardPreview({ profile: p, products, step }: { profile: OnboardProfile; products: Product[]; step: OnboardStep }) {
  return <section className={s.preview}><p className={s.muted}><Icon name="eye" />პროფილის გადახედვა</p><div className={s.identity}>
    <span className={s.avatar}>{p.logo_url ? <Image unoptimized loading="eager" width={320} height={180} src={p.logo_url} alt="კომპანიის ლოგო" /> : p.company.slice(0, 2)}</span><div><strong>{p.company}</strong><small>{categories[p.industry as keyof typeof categories]} · {cities[p.city]}</small></div>
  </div><div className={s.tags}>{(step === 'type' ? [intents[p.account_intent], ...p.provide_categories.map(key => categories[key as keyof typeof categories])] : step === 'provide' ? [`${products.length} პროდუქტი / მომსახურება`] : step === 'need' ? p.need_categories.map(key => categories[key as keyof typeof categories]) : p.business_tags).map(tag => <span key={tag}>{tag}</span>)}</div>{step === 'profile' && p.about && <p className={s.previewAbout}>{p.about}</p>}</section>;
}
type Props = { step: OnboardStep; profile: OnboardProfile; patch: (patch: Partial<OnboardProfile>) => void; products: Product[]; setProducts: (p: Product[]) => void; upload: (file: File, kind: 'logo' | 'gallery') => Promise<void>; go: (step: OnboardStep) => void };
export function OnboardSteps({ step, profile: p, patch, products, setProducts, upload, go }: Props) {
  const [expanded, setExpanded] = useState(0);
  const updateProduct = (index: number, value: Partial<Product>) => setProducts(products.map((item, i) => i === index ? { ...item, ...value } : item));
  const fileInput = (kind: 'logo' | 'gallery', label: string) => <label className={s.file}><Icon name="upload" />{label}<input aria-label={label} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file, kind); }} /></label>;
  if (step === 'type') return <>
    <div className={s.intentGrid}>{(['buy', 'sell', 'both'] as const).map((key, i) => <label key={key} className={`${s.intent} ${p.account_intent === key ? s.intentSelected : ''}`}><input type="radio" name="intent" value={key} checked={p.account_intent === key} onChange={() => patch({ account_intent: key })} /><span className={s.intentIcon}><Icon name={['shopping-cart', 'store', 'handshake'][i]} /></span><strong>{intents[key]}</strong><span>{['განათავსეთ მოთხოვნები და მიიღეთ შეთავაზებები', 'ნახეთ მოთხოვნები და გაგზავნეთ შეთავაზებები', 'ყიდვა და გაყიდვა ერთი ანგარიშით'][i]}</span></label>)}</div>
    <Card title="ძირითადი დარგები" hint={`${p.provide_categories.length} არჩეული`}><Categories compact values={p.provide_categories} onChange={provide_categories => patch({ provide_categories })} /><p className={s.muted}>აირჩიეთ თქვენი შეთავაზების მიმართულებები. ანგარიშის უფლებები უცვლელი რჩება.</p></Card>
  </>;
  if (step === 'details') return <>
    <Card title="იურიდიული ინფორმაცია"><div className={s.two}><Field label="იურიდიული სახელი" value={p.legal_name || ''} maxLength={200} onChange={legal_name => patch({ legal_name: legal_name || null })} /><Field label="საიდენტიფიკაციო კოდი" value={p.registration_code || ''} maxLength={40} onChange={registration_code => patch({ registration_code: registration_code || null })} /></div><div className={s.three}>
      <Field label="დაფუძნდა" type="number" min={1800} max={new Date().getFullYear()} value={p.founded_year?.toString() || ''} onChange={value => patch({ founded_year: value ? Number(value) : null })} />
      <Field label="ტიპი" value={p.legal_form || ''} maxLength={80} onChange={legal_form => patch({ legal_form: legal_form || null })} />
      <Field label="თანამშრომლები" value={p.employee_band || ''} options={{ '1-7': '1–7', '8-50': '8–50', '51-200': '51–200', '201+': '201+' }} onChange={employee_band => patch({ employee_band: employee_band || null })} />
    </div></Card>
    <Card title="ლოკაცია"><div className={s.two}><Field label="ქალაქი" required value={p.city} options={cities} onChange={city => patch({ city })} /><Field label="მისამართი" value={p.address || ''} maxLength={200} onChange={address => patch({ address: address || null })} /></div></Card>
    <Card title="კონტაქტი"><div className={s.two}><Field label="საკონტაქტო პირი" required value={p.name} maxLength={80} onChange={name => patch({ name })} /><Field label="პოზიცია" value={p.contact_position || ''} maxLength={100} onChange={contact_position => patch({ contact_position: contact_position || null })} /><Field label="ოფიციალური ელფოსტა" value={p.email || ''} readOnly /><Field label="ტელეფონი" value={p.phone || ''} readOnly /></div><Field label="ვებგვერდი" type="url" value={p.website || ''} maxLength={500} onChange={website => patch({ website: website || null })} /><p className={s.muted}><Icon name="lock-keyhole" />ელფოსტა და ტელეფონი რეგისტრაციის მონაცემებია და აქ არ იცვლება.</p></Card>
    <Card title="საქმიანობის არეალი"><Items label="ბაზრები" values={p.markets} onChange={markets => patch({ markets })} /><Items label="ენები" values={p.languages} onChange={languages => patch({ languages })} /></Card>
  </>;
  if (step === 'profile') return <>
    <Card title="ვინ ხართ"><div className={s.media}><div><span className={`${s.avatar} ${s.largeAvatar}`}>{p.logo_url ? <Image unoptimized loading="eager" width={320} height={180} src={p.logo_url} alt="კომპანიის ლოგო" /> : p.company.slice(0, 2)}</span>{fileInput('logo', 'ლოგო')}</div><div className={s.gallery}>{p.gallery?.[0] ? <Image unoptimized loading="eager" width={320} height={180} className={s.cover} src={p.gallery[0]} alt="გალერეის პირველი ფოტო" /> : <div className={s.coverPlaceholder}><Icon name="image" />კომპანიის გალერეა</div>}{fileInput('gallery', 'გალერეის ფოტო')}</div></div>
      <Field label="კომპანიის სახელი" required value={p.company} maxLength={100} onChange={company => patch({ company })} /><Field label="აღწერა" multiline value={p.about || ''} maxLength={1000} onChange={about => patch({ about })} /></Card>
    <Card title="დარგი და ტეგები"><Field label="ძირითადი დარგი" required value={p.industry} options={categories} onChange={industry => patch({ industry })} /><Items label="ტეგები" values={p.business_tags} suggestions={['HoReCa', 'დისტრიბუცია', 'იმპორტი', 'წარმოება', 'კეითერინგი']} onChange={business_tags => patch({ business_tags })} /></Card>
    <Card title="სერტიფიკატები" hint="არასავალდებულო"><Items checkboxes label="სერტიფიკატების დასახელებები" values={p.certificates} suggestions={['ISO 22000', 'HACCP', 'ორგანული', 'Fair Trade']} onChange={certificates => patch({ certificates })} /></Card>
  </>;
  if (step === 'need') return <><Card title="კატეგორიები" hint={`${p.need_categories.length} არჩეული`}><Categories values={p.need_categories} onChange={need_categories => patch({ need_categories })} /></Card><Card title="კონკრეტული ერთეულები" hint="არასავალდებულო"><Items label="რას ეძებთ" values={p.seeks || []} onChange={seeks => patch({ seeks })} /><p className={s.muted}>ჩანაწერები კომპანიის საჯარო პროფილის „ვეძებთ“ ნაწილშიც ჩანს.</p></Card><p className={s.muted}><Icon name="info" />ეს არ არის მოთხოვნა — კონკრეტული შესყიდვისთვის მოთხოვნას ცალკე განათავსებთ.</p></>;
  if (step === 'provide') return <>
    {products.map((item, index) => index === expanded ? <Card title={item.name || 'ახალი პროდუქტი / მომსახურება'} key={index}><div className={s.productEditor}><div>{item.photoUrl && <Image unoptimized loading="eager" width={320} height={180} className={s.productPhoto} src={item.photoUrl} alt={item.name || 'პროდუქტის ფოტო'} />}{fileInput('gallery', 'ფოტოს ატვირთვა')}<Field label="ფოტო გალერეიდან" required value={item.photoUrl} options={Object.fromEntries(p.gallery.map((url, i) => [url, `ფოტო ${i + 1}`]))} onChange={photoUrl => updateProduct(index, { photoUrl })} /></div><div className={s.stack}><Field label="სახელი" required value={item.name} maxLength={80} onChange={name => updateProduct(index, { name })} /><Field label="მოკლე აღწერა" multiline value={item.note || ''} maxLength={200} onChange={note => updateProduct(index, { note })} /><Button variant="ghost" onClick={() => { setProducts(products.filter((_, i) => i !== index)); setExpanded(0); }}>პროდუქტის წაშლა</Button></div></div></Card> : <div className={s.productRow} key={index}>{item.photoUrl && <Image unoptimized loading="eager" width={320} height={180} src={item.photoUrl} alt="" />}<div><strong>{item.name}</strong><p>{item.note}</p></div><Button variant="ghost" aria-label={`${item.name} — შეცვლა`} onClick={() => setExpanded(index)}><Icon name="pencil" /></Button></div>)}
    <Button variant="secondary" className={s.addProduct} disabled={products.length >= 12} onClick={() => { setExpanded(products.length); setProducts([...products, { name: '', note: '', photoUrl: p.gallery[0] || '' }]); }}><Icon name="plus" />პროდუქტის ან მომსახურების დამატება</Button>
    <Card title="მიწოდების კატეგორიები"><Categories compact values={p.provide_categories} onChange={provide_categories => patch({ provide_categories })} /></Card>
    <Card title="მომსახურებები" hint="ფოტოს გარეშე"><Items label="რას სთავაზობთ" values={p.offers || []} onChange={offers => patch({ offers })} /></Card>
  </>;
  if (step === 'verify') return <>
    <Card title="დოკუმენტების სტატუსი"><p className={s.documentStatus} role="status"><Icon name="shield-check" />{documentLabels[p.verification_documents_status]}</p><p className={s.muted}>დოკუმენტების ატვირთვა ჯერ ხელმისაწვდომი არ არის. ამ გვერდიდან დოკუმენტები განხილვაზე არ იგზავნება.</p></Card>
    <Card title="კომპანიის მონაცემები"><div className={s.docRow}><Icon name="file-text" /><div><strong>რეგისტრაციის ამონაწერი და საგადასახადო დოკუმენტი</strong><p>ცალკეული ფაილების სტატუსი ხელმისაწვდომი არ არის.</p></div></div><div className={s.docRow}><Icon name="image" /><div><strong>კომპანიის ლოგო</strong><p>{p.logo_url ? 'ატვირთულია ბიზნეს-პროფილში' : 'ლოგო ჯერ არ დამატებულა'}</p></div><Button variant="ghost" onClick={() => go('profile')}>შეცვლა</Button></div></Card>
    <Card title="სერტიფიკატები"><div className={s.tags}>{p.certificates.length ? p.certificates.map(c => <span key={c}>{c}</span>) : <p className={s.muted}>სერტიფიკატები არ არის მითითებული.</p>}</div><p className={s.muted}>დასახელების მითითება დოკუმენტის დადასტურებას არ ნიშნავს.</p></Card>
  </>;
  const names = (keys: string[]) => keys.map(key => categories[key as keyof typeof categories] || key).join(', ') || 'არ არის არჩეული';
  const rows: [OnboardStep, string, string][] = [
    ['type', 'handshake', intents[p.account_intent]], ['details', 'building-2', [p.legal_name || p.company, p.registration_code, cities[p.city], p.employee_band].filter(Boolean).join(' · ')],
    ['profile', 'file-text', [p.about, `${p.business_tags.length} ტეგი`, ...p.certificates].filter(Boolean).join(' · ')],
    ['provide', 'store', `${products.length} პროდუქტი / მომსახურება · ${names(p.provide_categories)}`], ['need', 'shopping-cart', names(p.need_categories)],
    ['verify', 'shield-check', documentLabels[p.verification_documents_status]],
  ];
  return <><section className={s.review}><ul>{rows.map(([key, icon, text]) => <li key={key}><span className={s.reviewIcon}><Icon name={icon} /></span><div><strong>{stepLabels[key]}</strong><p>{text}</p></div><Button variant="ghost" aria-label={`${stepLabels[key]} — შეცვლა`} onClick={() => go(key)}><Icon name="pencil" /><span className={s.editLabel}>შეცვლა</span></Button></li>)}</ul></section><p className={s.muted}><Icon name="info" />პროფილის დასრულება ვერიფიკაციის სტატუსს არ ცვლის.</p></>;
}
