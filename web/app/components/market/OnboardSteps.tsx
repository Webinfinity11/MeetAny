'use client';
import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CategoryChips, ImageUpload, ChipsInput } from '../ui';
import type { Store } from '../../lib/market-client';
import { VerificationDocuments, VerificationSummary } from './VerificationDocuments';
import { ProductsImport } from './ProductsImport';
import type { ProductUnit } from '../../lib/products-import';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { OnboardIcon as Icon } from './OnboardFields';
import { categories, cities } from '../../lib/categories';
import { intents, verificationLabel, verificationTone, type OnboardProfile, type OnboardStep, type Product } from '../../lib/onboarding-client';
import { OnboardCard as Card, OnboardField as Field, OnboardItems as Items, OnboardCategories as Categories } from './OnboardFields';
import s from './onboarding.module.css';

export const stepLabels: Record<OnboardStep, string> = { type: 'ანგარიშის ტიპი', details: 'კომპანიის მონაცემები', profile: 'ბიზნეს-პროფილი', provide: 'რას სთავაზობთ', need: 'რას ყიდულობთ', verify: 'ვერიფიკაცია', review: 'გადახედვა' };
export const titles: Record<OnboardStep, string> = { type: 'როგორ გამოიყენებთ MeetAny-ს?', details: 'კომპანიის მონაცემები', profile: 'ბიზნეს-პროფილი', provide: 'რას სთავაზობთ ბაზარს', need: 'რას ყიდულობთ ხშირად', verify: 'ვერიფიკაცია', review: 'გადახედვა და დასრულება' };
export const leads: Record<OnboardStep, string> = {
  type: 'ერთი კომპანიის ანგარიშით შეგიძლიათ იყიდოთ, გაყიდოთ ან ორივე. არჩევანის შეცვალეთ შეგიძლიათ ნებისმიერ დროს.',
  details: 'დაადასტურეთ საკონტაქტო პირი და ქალაქი. დანარჩენის დამატება მოგვიანებითაც შეგიძლიათ.',
  profile: 'ეს ნაწილი ყველას უჩანს. ტეგებით MeetAny შესაბამის მოთხოვნებსა და პარტნიორებს გიპოვით.',
  provide: 'დაამატეთ პროდუქტები და მომსახურებები — მყიდველები ამით გიპოვიან. ფასი აქ არ საჭიროა, ის შეთავაზებაში იწერება.',
  need: 'აირჩიეთ, რას ყიდულობთ ხშირად — რეკომენდაციებში ამ კატეგორიების მომწოდებლებს ნახავთ.',
  verify: 'ვერიფიცირებულ კომპანიას შეუძლია შეთავაზებების გაგზავნა, მის პროფილზე კი ვერიფიკაციის ნიშანი ჩანს.',
  review: 'შეამოწმეთ შენახული მონაცემები. დასრულების შემდეგ თქვენს ანგარიშზე გადახვალთ.',
};
const intentTags = (p: OnboardProfile) => p.account_intent === 'both' ? ['ყიდვა', 'გაყიდვა'] : [p.account_intent === 'buy' ? 'ყიდვა' : 'გაყიდვა'];
const categoryNames = (keys: string[]) => keys.map(key => categories[key as keyof typeof categories] || key);
const tags = (values: string[]) => <div className={s.tags}>{[...new Set(values)].map(value => <span key={value}>{value}</span>)}</div>;
const verificationBadge = (p: OnboardProfile) => <Badge status={verificationTone(p.verification_documents_status, p.verified)}>{verificationLabel(p.verification_documents_status, p.verified)}</Badge>;
const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('ka') === b.trim().toLocaleLowerCase('ka');
// "3 პროდუქტი · 2 მომსახურება"; a zero part is left out, never shown as "0 …".
const itemsSummary = (products: number, services: number) => [products ? `${products} პროდუქტი` : '', services ? `${services} მომსახურება` : ''].filter(Boolean).join(' · ');
const certificateOptions = ['ISO სერტიფიკატი', 'HACCP', 'სურსათის უვნებლობა', 'ლიცენზია'];
export function OnboardPreview({ profile: p, products, step }: { profile: OnboardProfile; products: Product[]; step: OnboardStep }) {
  return <section className={s.preview} aria-label="პროფილის გადახედვა"><p className={s.previewLabel}>ასე გამოჩნდებით</p><div className={s.identity}>
    <Avatar name={p.company} logoUrl={p.logo_url} size={48} /><div><strong>{p.company}</strong><small>{[categories[p.industry as keyof typeof categories], cities[p.city]].filter(Boolean).join(' · ')}</small></div>
  </div>{tags([...intentTags(p), ...(p.account_intent !== 'buy' ? categoryNames(p.provide_categories) : []), ...(step === 'profile' ? p.business_tags : [])])}
  {step === 'provide' && itemsSummary(products.length, p.offers.length) && tags([itemsSummary(products.length, p.offers.length)])}
  {step === 'need' && tags(categoryNames(p.need_categories).map(name => `ყიდულობთ: ${name}`))}
  {step === 'profile' && p.about && <p className={s.previewAbout}>{p.about}</p>}
  {(p.verified || step === 'verify') && <div className={s.verificationHint}>{verificationBadge(p)}</div>}</section>;
}
type Props = { store:Store; onBusy:(busy:boolean)=>void; step: OnboardStep; profile: OnboardProfile; patch: (patch: Partial<OnboardProfile>) => void; products: Product[]; setProducts: (p: Product[]) => void; upload: (file: File | null, kind: 'logo' | 'gallery') => Promise<string | undefined>; go: (step: OnboardStep) => void };
export function OnboardSteps({ store,onBusy,step, profile: p, patch, products, setProducts, upload, go }: Props) {
  const [editingIndustry, setEditingIndustry] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(products.length > 10 ? null : 0);
  const [photoPicker, setPhotoPicker] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const productError = (index: number, value: string) => !value.trim() ? '' : value.trim().length < 2 ? 'მიუთითეთ მინიმუმ 2 სიმბოლო.' : products.some((product, i) => i !== index && sameName(product.name, value)) ? 'ეს პროდუქტი უკვე დამატებულია.' : p.offers.some(offer => sameName(offer, value)) ? 'ეს სახელი მომსახურებებშია — გადაიტანეთ?' : '';
  const updateProduct = (index: number, value: Partial<Product>) => setProducts(products.map((item, i) => i === index ? { ...item, ...value } : item));
  const removeProduct = (index: number) => { setProducts(products.filter((_, i) => i !== index)); setExpanded(null); setPhotoPicker(null); };
  if (step === 'type') return <>
    <div className={s.intentGrid}>{(['buy', 'sell', 'both'] as const).map((key, i) => <label key={key} className={`${s.intent} ${p.account_intent === key ? s.intentSelected : ''}`}><input type="radio" name="intent" value={key} checked={p.account_intent === key} onChange={() => patch({ account_intent: key, ...(key !== 'buy' && !p.provide_categories.length && p.industry ? { provide_categories: [p.industry] } : {}) })} /><span className={s.intentCheck} aria-hidden="true" /><span className={s.intentIcon}><Icon name={['shopping-cart', 'store', 'handshake'][i]} /></span><strong>{intents[key]}</strong><span>{['განათავსეთ მოთხოვნები და მიიღეთ შეთავაზებები', 'ნახეთ მოთხოვნები და გაგზავნეთ შეთავაზებები', 'ყიდვა და გაყიდვა ერთი ანგარიშით'][i]}</span></label>)}</div>
    {p.account_intent !== 'buy' && <Card title="რას აწვდით"><p className={s.muted}>ძირითადი დარგი: {categories[p.industry]} (რეგისტრაციიდან)</p><Categories compact limit={5} count={`არჩეულია ${p.provide_categories.length} / 5`} values={p.provide_categories} onChange={provide_categories => patch({ provide_categories })} /></Card>}
  </>;
  if (step === 'details') return <>
    <Card title="საკონტაქტო მონაცემები"><div className={s.two}>
      <Field autoComplete="name" label="საკონტაქტო პირი" icon="user" required value={p.name} maxLength={80} invalid={p.name.trim() && p.name.trim().length < 2 ? 'მიუთითეთ მინიმუმ 2 სიმბოლო.' : ''} onChange={name => patch({ name })} />
      <Field label="ქალაქი" icon="map-pin" required value={p.city} options={cities} onChange={city => patch({ city })} />
    </div><div className={s.stack}><Field label="ელფოსტა" type="email" autoComplete="email" value={p.email || ''} readOnly /><Field label="ტელეფონი" type="tel" autoComplete="tel" value={p.phone || ''} readOnly /><p className={s.muted}>ანგარიშის იდენტიფიკატორია; შესაცვლელად: <Link href="/account/?tab=profile">პარამეტრები → კონტაქტი</Link></p></div></Card>
    <Card title="იურიდიული ინფორმაცია" hint="ვერიფიკაციისთვის — შეგიძლიათ მოგვიანებით"><div className={s.two}>
      <Field autoComplete="organization" label="იურიდიული სახელი" value={p.legal_name || ''} maxLength={200} invalid={p.legal_name?.trim() && p.legal_name.trim().length < 2 ? 'მიუთითეთ მინიმუმ 2 სიმბოლო.' : ''} onChange={legal_name => patch({ legal_name: legal_name || null })} />
      <Field label="საიდენტიფიკაციო კოდი" icon="hash" value={p.registration_code || ''} maxLength={40} invalid={p.registration_code?.trim() && p.registration_code.trim().length < 3 ? 'მიუთითეთ მინიმუმ 3 სიმბოლო.' : ''} onChange={registration_code => patch({ registration_code: registration_code || null })} />
      <Field label="დაარსების წელი" type="number" min={1800} max={new Date().getFullYear()} value={p.founded_year?.toString() || ''} onChange={value => patch({ founded_year: value ? Number(value) : null })} />
      <Field label="იურიდიული ფორმა" value={p.legal_form || ''} options={{ ...Object.fromEntries(['შპს', 'ინდ. მეწარმე', 'სს', 'კოოპერატივი', 'სხვა'].map(value => [value, value])), ...(p.legal_form ? { [p.legal_form]: p.legal_form } : {}) }} onChange={legal_form => patch({ legal_form: legal_form || null })} />
      <Field label="თანამშრომლები" value={p.employee_band || ''} options={{ '1-7': '1–7', '8-50': '8–50', '51-200': '51–200', '201+': '201+' }} onChange={employee_band => patch({ employee_band: employee_band || null })} />
    </div></Card>
    <details className={s.optional}><summary>დამატებითი</summary><Card title="დამატებითი ინფორმაცია"><div className={s.two}>
      <Field label="მისამართი" value={p.address || ''} maxLength={200} onChange={address => patch({ address: address || null })} />
      <Field autoComplete="organization-title" label="პოზიცია" value={p.contact_position || ''} maxLength={100} onChange={contact_position => patch({ contact_position: contact_position || null })} />
    </div><Field autoComplete="url" label="ვებგვერდი" icon="globe" type="url" value={p.website || ''} maxLength={500} invalid={p.website?.trim() && !/^https?:\/\/\S+$/.test(p.website) ? 'ვებგვერდი უნდა იწყებოდეს https:// ან http://-ით.' : ''} onChange={website => patch({ website: website || null })} />
      <Items label="ბაზრები" values={p.markets} onChange={markets => patch({ markets })} /><Items label="ენები" values={p.languages} onChange={languages => patch({ languages })} />
    </Card></details>
  </>;
  if (step === 'profile') return <>
    <Card title="ვინ ხართ"><ImageUpload id="onboard-logo" label="ლოგო (არასავალდებულო)" kind="logo" items={p.logo_url ? [{ key: 'logo', url: p.logo_url }] : []} onChange={items => { void upload(items[0]?.file || null, 'logo'); }} />
      <Field label="კომპანიის შესახებ" hint={`${p.about.length} / 1000`} multiline value={p.about || ''} maxLength={1000} onChange={about => patch({ about })} /><p className={s.muted}>გალერეა და ფონური ფოტო ემატება <Link href="/account/?tab=profile">პროფილის პარამეტრებში</Link></p></Card>
    <Card title="დარგი და ტეგები"><div className={s.industryRow}><p>დარგი: {categories[p.industry] || 'არ არის მითითებული'}</p><Button variant="ghost" aria-expanded={editingIndustry} onClick={() => setEditingIndustry(!editingIndustry)}>შეცვალეთ</Button></div>
      {editingIndustry && <CategoryChips value={[p.industry]} onChange={values => { patch({ industry: values[0] }); setEditingIndustry(false); }} />}
      <Items label="ტეგები" values={p.business_tags} suggestions={['HoReCa', 'დისტრიბუცია', 'იმპორტი', 'წარმოება', 'კეითერინგი']} onChange={business_tags => patch({ business_tags })} /></Card>
    <details className={s.optional}><summary>დამატებითი</summary><Card title="სერტიფიკატები" hint="არასავალდებულო"><Items label="სერტიფიკატები" values={p.certificates} suggestions={certificateOptions} onChange={certificates => patch({ certificates })} /></Card></details>
  </>;
  if (step === 'need') return <><Card title="რას ყიდულობთ"><Categories count={p.need_categories.length ? `არჩეულია ${p.need_categories.length}` : undefined} values={p.need_categories} onChange={need_categories => patch({ need_categories })} /></Card><Card title="კონკრეტული ერთეულები" hint="არასავალდებულო"><Items rows label="რას ეძებთ" values={p.seeks || []} onChange={seeks => patch({ seeks })} /></Card><p className={s.muted}><Icon name="info" />ეს არ არის მოთხოვნა — არჩევანი დაგეხმარებათ შესაბამისი მომწოდებლების პოვნაში.</p></>;
  if (step === 'provide') return <Card title="პროდუქტები და მომსახურებები" hint={`${products.length} / 100`}>
    <ProductsImport existing={products.map(({ unit, ...rest }) => ({ ...rest, unit: unit as ProductUnit | undefined }))} gallery={p.gallery}
      onConfirm={async next => { const saved = await store.setMyProducts(next); setProducts((Array.isArray(saved) ? saved : next).map(item => ({ ...item, note: item.note || '' }))); }} />
    {products.length > 10 && <Field label="პროდუქტის ძიება სახელით" value={search} onChange={setSearch} />}
    <div className={s.productList} data-compact={products.length > 10 || undefined}>
    {products.map((item, index) => search && !item.name.toLocaleLowerCase('ka').includes(search.toLocaleLowerCase('ka')) ? null : index === expanded ? <div className={s.productEditor} key={index}>
      <div><button type="button" className={s.photoBox} aria-label={`${item.name || 'პროდუქტი'} — აირჩიეთ ფოტო`} aria-expanded={photoPicker === index} onClick={() => setPhotoPicker(photoPicker === index ? null : index)}>{item.photoUrl ? <Image unoptimized width={96} height={96} src={item.photoUrl} alt={item.name || 'პროდუქტის ფოტო'} /> : <Icon name="upload" />}</button><p className={s.muted}>ფოტო არასავალდებულოა</p>
      {photoPicker === index && <div className={s.photoPicker} role="group" aria-label="ფოტო გალერეიდან">{p.gallery.map((url, i) => <button type="button" key={url} aria-label={`ფოტო ${i + 1}`} aria-pressed={item.photoUrl === url} onClick={() => { updateProduct(index, { photoUrl: url }); setPhotoPicker(null); }}><Image unoptimized width={48} height={48} src={url} alt="" /></button>)}<label className={s.file}><Icon name="upload" />ატვირთეთ<input type="file" aria-label="ატვირთეთ პროდუქტის ფოტო" accept="image/jpeg,image/png,image/webp,image/gif" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) { const url = await upload(file, 'gallery'); if (url) { updateProduct(index, { photoUrl: url }); setPhotoPicker(null); } } }} /></label>{item.photoUrl && <Button variant="ghost" onClick={() => updateProduct(index, { photoUrl: null })}>წაშალეთ ფოტო</Button>}</div>}</div>
      <div className={s.stack}><Field label="სახელი" value={item.name} maxLength={80} invalid={productError(index, item.name)} onChange={name => updateProduct(index, { name })} />
        {!item.name.trim() && <p className={s.muted}>ცარიელი პროდუქტი არ შეინახება</p>}
        {item.name.trim() && p.offers.some(offer => sameName(offer, item.name)) && <Button variant="secondary" onClick={() => removeProduct(index)}>გადაიტანეთ მომსახურებებში</Button>}
        <Field label="მოკლე აღწერა" multiline value={item.note || ''} maxLength={200} onChange={note => updateProduct(index, { note })} />
        <div className={s.addRow}><Button variant="ghost" onClick={() => removeProduct(index)}><Icon name="trash-2" />წაშალეთ</Button><Button variant="secondary" onClick={() => setExpanded(null)}>დაკეცეთ</Button></div>
      </div>
    </div> : <div className={s.productRow} key={index}>{item.photoUrl ? <Image unoptimized width={48} height={48} src={item.photoUrl} alt="" /> : <span className={s.reviewIcon}><Icon name="package" /></span>}<div><strong>{item.name || 'ცარიელი პროდუქტი'}</strong><p>{item.name.trim() ? item.note : 'ცარიელი პროდუქტი არ შეინახება'}</p>{productError(index, item.name) && <small className={s.fieldError}>{productError(index, item.name)}</small>}</div><Button variant="ghost" aria-label={`${item.name || 'პროდუქტი'} — შეცვალეთ`} onClick={() => { setExpanded(index); setPhotoPicker(null); }}><Icon name="pencil" /></Button><Button variant="ghost" aria-label={`${item.name || 'პროდუქტი'} — წაშალეთ`} onClick={() => removeProduct(index)}><Icon name="trash-2" /></Button></div>)}
    </div>
    {search && !products.some(item => item.name.toLocaleLowerCase('ka').includes(search.toLocaleLowerCase('ka'))) && <p className={s.muted}>პროდუქტი ვერ მოიძებნა.</p>}
    <Button variant="secondary" disabled={products.length >= 100} onClick={() => { setSearch(''); setExpanded(products.length); setPhotoPicker(null); setProducts([...products, { name: '', note: '', photoUrl: null }]); }}><Icon name="plus" />{products.length >= 100 ? 'ლიმიტი: 100 პროდუქტი' : 'დაამატეთ პროდუქტი'}</Button>
    <ChipsInput id="onboard-services" label="მომსახურებები" values={p.offers} max={8} onChange={offers => patch({ offers })} />
    <Button variant="ghost" onClick={() => document.getElementById('onboard-services')?.focus()}><Icon name="plus" />დაამატეთ მომსახურება</Button>
  </Card>;
  if (step === 'verify') return <>
    <Card title="ვერიფიკაციის დოკუმენტები"><VerificationDocuments store={store} id={p.id} status={p.verification_documents_status} verified={p.verified} note={p.verification_note} onStatus={verification_documents_status=>patch({verification_documents_status:verification_documents_status as OnboardProfile['verification_documents_status']})} onBusy={onBusy} onDetails={() => go('details')}/></Card>
    <p className={s.muted}><Icon name="lock-keyhole" />საჯაროდ ჩანს მხოლოდ ადმინისტრატორის მიერ დადასტურებული ვერიფიკაციის ნიშანი.</p>
  </>;
  const missing = (label: string) => <p className={s.missing}>{label}: არ არის მითითებული</p>;
  const rows: [OnboardStep, string, string, ReactNode][] = [
    ['type', 'handshake', 'ტიპი', <div key="type">{p.account_intent ? tags(intentTags(p)) : missing('ტიპი')}{p.account_intent !== 'buy' && (p.provide_categories.length ? tags(categoryNames(p.provide_categories)) : missing('მიწოდების დარგები'))}</div>],
    ['details', 'building-2', 'კომპანია', <div key="company"><p>{p.company}</p>{p.name ? <p>{p.name}</p> : missing('საკონტაქტო პირი')}{p.city ? <p>{cities[p.city]}</p> : missing('ქალაქი')}{p.legal_name ? <p>{p.legal_name}</p> : missing('იურიდიული სახელი')}{p.registration_code ? <p>{p.registration_code}</p> : missing('საიდენტიფიკაციო კოდი')}</div>],
    ['profile', 'file-text', 'ბიზნეს-პროფილი', <div key="profile">{p.industry ? <p>{categories[p.industry]}</p> : missing('დარგი')}{p.about ? <p className={s.ellipsis}>{p.about}</p> : missing('კომპანიის შესახებ')}{!p.logo_url && missing('ლოგო')}{p.business_tags.length ? tags(p.business_tags) : missing('ტეგები')}</div>],
    ['provide', 'store', 'გთავაზობთ', <div key="products">{products.some(product => product.name.trim()) || p.offers.length ? <p>{itemsSummary(products.filter(product => product.name.trim()).length, p.offers.length)}</p> : missing('პროდუქტები და მომსახურებები')}</div>],
    ['need', 'shopping-cart', 'ყიდულობთ', <div key="need">{p.need_categories.length || p.seeks.length ? tags([...categoryNames(p.need_categories), ...p.seeks]) : missing('საჭიროებები')}</div>],
    ['verify', 'shield-check', 'ვერიფიკაცია', <div key="verification"><p>{verificationBadge(p)}</p><VerificationSummary store={store} id={p.id} onDetails={() => go('details')} /></div>],
  ].filter(([key]) => key === 'provide' ? p.account_intent !== 'buy' : key === 'need' ? p.account_intent !== 'sell' : true) as [OnboardStep, string, string, ReactNode][];
  return <><section className={s.review}><ul>{rows.map(([key, icon, title, content]) => <li key={key}><span className={s.reviewIcon}><Icon name={icon} /></span><div><strong>{title}</strong>{content}</div><Button variant="ghost" aria-label={`${title} — შეცვალეთ`} onClick={() => go(key)}><Icon name="pencil" /><span className={s.editLabel}>შეცვალეთ</span></Button></li>)}</ul></section></>;
}
