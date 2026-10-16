'use client';
import { categoryOptions } from "../ui/combobox-options";
import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Combobox, ImageUpload } from '../ui';
import type { Store } from '../../lib/market-client';
import { VerificationDocuments, VerificationSummary } from './VerificationDocuments';
import { ProductsImport } from './ProductsImport';
import { productKey, type ProductUnit } from '../../lib/products-import';
import { productPresentation } from '../../lib/product-presentation';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { toast } from '../Toasts';
import { OnboardIcon as Icon } from './OnboardFields';
import { categories, cities } from '../../lib/categories';
import { hasProductContent, intents, normalizeOnboardItems, verificationLabel, verificationTone, type OnboardProfile, type OnboardStep, type Product } from '../../lib/onboarding-client';
import { OnboardCard as Card, OnboardField as Field, OnboardItems as Items, OnboardCategories as Categories } from './OnboardFields';
import s from './onboarding.module.css';

export const stepLabels: Record<OnboardStep, string> = { type: 'ანგარიშის ტიპი', details: 'კომპანიის მონაცემები', profile: 'ბიზნეს-პროფილი', provide: 'რას სთავაზობთ', need: 'რას ყიდულობთ', verify: 'ვერიფიკაცია', review: 'გადახედვა' };
export const leads: Record<OnboardStep, string> = {
  type: 'აირჩიეთ, იყიდით, გაყიდით თუ ორივეს გააკეთებთ — ტიპს მოგვიანებითაც შეცვლით.',
  details: 'საკონტაქტო ინფორმაცია უკვე შენახულია. იურიდიული მონაცემები მხოლოდ ვერიფიკაციისთვის დაგჭირდებათ.',
  profile: 'ეს ინფორმაცია კომპანიის გვერდზე გამოჩნდება.',
  provide: 'პროდუქტებსა და მომსახურებებს მოგვიანებითაც დაამატებთ.',
  need: 'აირჩიეთ კატეგორიები შესაბამისი მომწოდებლების საპოვნელად.',
  verify: 'ვერიფიკაცია კომპანიის პროფილს სანდოობის ნიშანს ამატებს.',
  review: 'შეამოწმეთ მონაცემები და დაასრულეთ.',
};
const intentTags = (p: OnboardProfile) => p.account_intent === 'both' ? ['ყიდვა', 'გაყიდვა'] : [p.account_intent === 'buy' ? 'ყიდვა' : 'გაყიდვა'];
const categoryNames = (keys: string[]) => keys.map(key => categories[key as keyof typeof categories] || key);
const tags = (values: string[]) => <div className={s.tags}>{[...new Set(values)].map(value => <span key={value}>{value}</span>)}</div>;
const verificationBadge = (p: OnboardProfile) => <Badge status={verificationTone(p.verification_documents_status, p.verified)}>{verificationLabel(p.verification_documents_status, p.verified)}</Badge>;
// "3 პროდუქტი · 2 მომსახურება"; a zero part is left out, never shown as "0 …".
const itemsSummary = (products: number, services: number) => [products ? `${products} პროდუქტი` : '', services ? `${services} მომსახურება` : ''].filter(Boolean).join(' · ');
export function OnboardPreview({ profile: p, products, step }: { profile: OnboardProfile; products: Product[]; step: OnboardStep }) {
  const catalogSummary = itemsSummary(products.filter(product => product.name.trim()).length, normalizeOnboardItems(p.offers).length);
  return <section className={s.preview} aria-label="პროფილის გადახედვა"><p className={s.previewLabel}>ასე გამოჩნდებით</p><div className={s.identity}>
    <Avatar name={p.company} logoUrl={p.logo_url} size={48} /><div><strong>{p.company}</strong><small>{[categories[p.industry as keyof typeof categories], cities[p.city]].filter(Boolean).join(' · ')}</small></div>
  </div>{tags([...intentTags(p), ...(p.account_intent !== 'buy' ? categoryNames(p.provide_categories) : []), ...(step === 'profile' ? p.business_tags : [])])}
  {step === 'provide' && catalogSummary && tags([catalogSummary])}
  {step === 'need' && tags(categoryNames(p.need_categories).map(name => `ყიდულობთ: ${name}`))}
  {step === 'profile' && p.about && <p className={s.previewAbout}>{p.about}</p>}
  {(p.verified || step === 'verify') && <div className={s.verificationHint}>{verificationBadge(p)}</div>}</section>;
}
type Props = { store:Store; onBusy:(busy:boolean)=>void; step: OnboardStep; profile: OnboardProfile; patch: (patch: Partial<OnboardProfile>, serverSaved?: boolean) => void; products: Product[]; setProducts: (p: Product[], serverSaved?: boolean) => void; upload: (file: File | null, kind: 'logo' | 'gallery') => Promise<string | undefined>; go: (step: OnboardStep) => void };
export function OnboardSteps({ store,onBusy,step, profile: p, patch, products, setProducts, upload, go }: Props) {
  const [editingIndustry, setEditingIndustry] = useState(false);
  const [editingContact, setEditingContact] = useState(!p.name || !p.city);
  const [expanded, setExpanded] = useState<number | null>(products.length > 10 ? null : 0);
  const [photoPicker, setPhotoPicker] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const productError = (index: number, value: string) => !value.trim() ? hasProductContent({ ...products[index], name: value }) ? 'მიუთითეთ პროდუქტის სახელი.' : '' : value.trim().length < 2 ? 'მიუთითეთ მინიმუმ 2 სიმბოლო.' : products.some((product, i) => i !== index && product.name.trim() && productKey(product) === productKey({ ...products[index], name: value })) ? 'კოდი მეორდება ან უკოდო პროდუქტი ამ სახელით უკვე დამატებულია.' : '';
  const updateProduct = (index: number, value: Partial<Product>) => setProducts(products.map((item, i) => i === index ? { ...item, ...value } : item));
  const removeProduct = (index: number) => { setProducts(products.filter((_, i) => i !== index)); setExpanded(null); setPhotoPicker(null); };
  if (step === 'type') return <>
    <div className={s.intentGrid}>{(['buy', 'sell', 'both'] as const).map((key, i) => <label key={key} className={`${s.intent} ${p.account_intent === key ? s.intentSelected : ''}`}><input type="radio" name="intent" value={key} checked={p.account_intent === key} onChange={() => patch({ account_intent: key, ...(key !== 'buy' && !p.provide_categories.length && p.industry ? { provide_categories: [p.industry] } : {}) })} /><span className={s.intentIcon} aria-hidden="true"><Icon name={['shopping-cart', 'store', 'handshake'][i]} /></span><span className={s.intentCopy}><strong>{intents[key]}</strong><span>{['მიიღეთ შეთავაზებები', 'გაგზავნეთ შეთავაზებები', 'იყიდეთ და გაყიდეთ'][i]}</span></span><span className={s.intentCheck} aria-hidden="true" /></label>)}</div>
    {p.account_intent !== 'buy' && <Card title="რას აწვდით"><p className={s.muted}>ძირითადი დარგი: {categories[p.industry]} (რეგისტრაციიდან)</p><Categories compact limit={5} count={`არჩეულია ${p.provide_categories.length} / 5`} values={p.provide_categories} onChange={provide_categories => patch({ provide_categories })} /></Card>}
  </>;
  if (step === 'details') return <>
    <Card title="საკონტაქტო მონაცემები" hint="გადმოტანილია თქვენი ანგარიშიდან">
      <dl className={s.savedContact}><div><dt>საკონტაქტო პირი</dt><dd>{p.name}</dd></div><div><dt>ქალაქი</dt><dd>{cities[p.city]}</dd></div><div><dt>ელფოსტა</dt><dd>{p.email}</dd></div><div><dt>ტელეფონი</dt><dd>{p.phone}</dd></div></dl>
      <Button variant="ghost" aria-expanded={editingContact} aria-controls="onboard-contact-edit" onClick={() => setEditingContact(!editingContact)}>{editingContact ? 'დაკეცეთ' : 'შეცვალეთ საკონტაქტო პირი ან ქალაქი'}</Button>
      {editingContact && <div id="onboard-contact-edit" className={s.two}>
        <Field autoComplete="name" label="საკონტაქტო პირი" icon="user" required value={p.name} maxLength={80} invalid={p.name.trim() && p.name.trim().length < 2 ? 'მიუთითეთ მინიმუმ 2 სიმბოლო.' : ''} onChange={name => patch({ name })} />
        <Field label="ქალაქი" icon="map-pin" required value={p.city} options={cities} onChange={city => patch({ city })} />
        <p className={s.muted}>ელფოსტის ან ტელეფონის შეცვლა: <Link href="/account/?tab=profile">ანგარიშის პარამეტრები</Link></p>
      </div>}
    </Card>
    <Card title="იურიდიული ინფორმაცია"><div className={s.reuseName}><Button variant="secondary" size="sm" disabled={p.legal_name === p.company} onClick={() => patch({ legal_name: p.company })}>კომპანიის სახელის გამოყენება</Button></div><div className={s.two}>
      <Field autoComplete="organization" label="იურიდიული სახელი" value={p.legal_name || ''} maxLength={200} invalid={p.legal_name?.trim() && p.legal_name.trim().length < 2 ? 'მიუთითეთ მინიმუმ 2 სიმბოლო.' : ''} onChange={legal_name => patch({ legal_name: legal_name || null })} />
      <Field label="საიდენტიფიკაციო კოდი" icon="hash" value={p.registration_code || ''} maxLength={40} invalid={p.registration_code?.trim() && p.registration_code.trim().length < 3 ? 'მიუთითეთ მინიმუმ 3 სიმბოლო.' : ''} onChange={registration_code => patch({ registration_code: registration_code || null })} />
    </div></Card>
    <Card title="დამატებითი ინფორმაცია"><div className={s.two}>
      <Field label="დაარსების წელი" type="number" min={1800} max={new Date().getFullYear()} value={p.founded_year?.toString() || ''} onChange={value => patch({ founded_year: value ? Number(value) : null })} />
      <Field label="იურიდიული ფორმა" value={p.legal_form || ''} options={{ ...Object.fromEntries(['შპს', 'ინდ. მეწარმე', 'სს', 'კოოპერატივი', 'სხვა'].map(value => [value, value])), ...(p.legal_form ? { [p.legal_form]: p.legal_form } : {}) }} onChange={legal_form => patch({ legal_form: legal_form || null })} />
      <Field label="თანამშრომლები" value={p.employee_band || ''} options={{ '1-7': '1–7', '8-50': '8–50', '51-200': '51–200', '201+': '201+' }} onChange={employee_band => patch({ employee_band: employee_band || null })} />

      <Field label="მისამართი" value={p.address || ''} maxLength={200} onChange={address => patch({ address: address || null })} />
      <Field autoComplete="organization-title" label="პოზიცია" value={p.contact_position || ''} maxLength={100} onChange={contact_position => patch({ contact_position: contact_position || null })} />
    </div><Field autoComplete="url" label="ვებგვერდი" icon="globe" type="url" value={p.website || ''} maxLength={500} invalid={p.website?.trim() && !/^https?:\/\/\S+$/.test(p.website) ? 'ვებგვერდი უნდა იწყებოდეს https:// ან http://-ით.' : ''} onChange={website => patch({ website: website || null })} />
      <Items label="ბაზრები" values={p.markets} onChange={markets => patch({ markets })} /><Items label="ენები" values={p.languages} onChange={languages => patch({ languages })} />
    </Card>
  </>;
  if (step === 'profile') return <>
    <Card title="ვინ ხართ"><ImageUpload id="onboard-logo" label="ლოგო" kind="logo" items={p.logo_url ? [{ key: 'logo', url: p.logo_url }] : []} onChange={items => { void upload(items[0]?.file || null, 'logo'); }} />
      <Field label="კომპანიის შესახებ" hint={`${p.about.length} / 1000`} multiline value={p.about || ''} maxLength={1000} onChange={about => patch({ about })} /><p className={s.muted}>გალერეა და ფონური ფოტო ემატება <Link href="/account/?tab=profile">პროფილის პარამეტრებში</Link></p></Card>
    <Card title="დარგი და ტეგები"><div className={s.industryRow}><p>დარგი: {categories[p.industry] || 'არ არის მითითებული'}</p><Button variant="ghost" aria-expanded={editingIndustry} onClick={() => setEditingIndustry(!editingIndustry)}>შეცვალეთ</Button></div>
      {editingIndustry && <Combobox label="დარგი" options={categoryOptions} value={p.industry} onChange={value => { patch({ industry: value }); setEditingIndustry(false); }} />}
      <Items label="ტეგები" values={p.business_tags} onChange={business_tags => patch({ business_tags })} /></Card>
    <Card title="სერტიფიკატები"><Items label="სერტიფიკატები" values={p.certificates} onChange={certificates => patch({ certificates })} /></Card>
  </>;
  if (step === 'need') return <><Card title="რას ყიდულობთ"><Categories count={p.need_categories.length ? `არჩეულია ${p.need_categories.length}` : undefined} values={p.need_categories} onChange={need_categories => patch({ need_categories })} /></Card><Card title="კონკრეტული ერთეულები" hint="არასავალდებულო"><Items rows label="რას ეძებთ" values={p.seeks || []} onChange={seeks => patch({ seeks })} /></Card><p className={s.muted}><Icon name="info" />ეს არ არის მოთხოვნა — არჩევანი დაგეხმარებათ შესაბამისი მომწოდებლების პოვნაში.</p></>;
  if (step === 'provide') return <Card title="პროდუქტები და მომსახურებები" hint="არასავალდებულო">
    <ProductsImport onBusy={onBusy} existing={products.map(({ unit, ...rest }) => ({ ...rest, unit: unit as ProductUnit | undefined }))} gallery={p.gallery}
      onConfirm={async next => { const saved = await store.setMyProducts(next); setProducts((Array.isArray(saved) ? saved : next).map(item => ({ ...item, note: item.note || '' })), true); }} />
    {products.length > 10 && <Field label="პროდუქტის ძიება სახელით" value={search} onChange={setSearch} />}
    <div className={s.productList} data-compact={products.length > 10 || undefined}>
    {products.map((item, index) => search && !item.name.toLocaleLowerCase('ka').includes(search.toLocaleLowerCase('ka')) ? null : index === expanded ? <div className={s.productEditor} key={index}>
      <div><button type="button" className={s.photoBox} aria-label={`${item.name || 'პროდუქტი'} — აირჩიეთ ფოტო`} aria-expanded={photoPicker === index} onClick={() => setPhotoPicker(photoPicker === index ? null : index)}>{item.photoUrl ? <Image unoptimized width={96} height={96} src={productPresentation(item, p.id).photoUrl!} alt={item.name || 'პროდუქტის ფოტო'} /> : <Icon name="upload" />}</button>
      {photoPicker === index && <div className={s.photoPicker} role="group" aria-label="ფოტო გალერეიდან">{p.gallery.map((url, i) => <button type="button" key={url} aria-label={`ფოტო ${i + 1}`} aria-pressed={item.photoUrl === url} onClick={() => { updateProduct(index, { photoUrl: url }); setPhotoPicker(null); }}><Image unoptimized width={48} height={48} src={url} alt="" /></button>)}<label className={s.file}><Icon name="upload" />ატვირთეთ<input type="file" aria-label="ატვირთეთ პროდუქტის ფოტო" accept="image/jpeg,image/png,image/webp,image/gif" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) { const url = await upload(file, 'gallery'); if (url) { updateProduct(index, { photoUrl: url }); setPhotoPicker(null); } } }} /></label>{item.photoUrl && <Button variant="ghost" onClick={() => updateProduct(index, { photoUrl: null })}>წაშალეთ ფოტო</Button>}</div>}</div>
      <div className={s.stack}><Field label="სახელი" requiredMarker required={hasProductContent(item)} value={item.name} maxLength={80} invalid={productError(index, item.name)} help={!hasProductContent(item) ? 'პროდუქტის დასამატებლად მიუთითეთ სახელი.' : undefined} onChange={name => updateProduct(index, { name })} />
        <Field label="პროდუქტის კოდი" value={item.code || ''} maxLength={40} help="მსგავს პროდუქტებს განსხვავებული კოდი მიანიჭეთ." onChange={code => updateProduct(index, { code: code || undefined })} />
        <Field label="მოკლე აღწერა" multiline value={item.note || ''} maxLength={200} onChange={note => updateProduct(index, { note })} />
        <div className={s.addRow}><Button variant="ghost" onClick={() => removeProduct(index)}><Icon name="trash-2" />წაშალეთ</Button><Button variant="secondary" onClick={() => setExpanded(null)}>დაკეცეთ</Button></div>
      </div>
    </div> : <div className={s.productRow} key={index}>{item.photoUrl ? <Image unoptimized width={48} height={48} src={productPresentation(item, p.id).photoUrl!} alt="" /> : <span className={s.reviewIcon}><Icon name="package" /></span>}<Button variant="ghost" className={s.productRowEdit} aria-label={`${item.name || 'პროდუქტი'} — შეცვალეთ`} onClick={() => { setExpanded(index); setPhotoPicker(null); }}><strong>{item.name || (hasProductContent(item) ? 'დაუმთავრებელი პროდუქტი' : 'ცარიელი პროდუქტი')}</strong><Icon name="pencil" /></Button><Button variant="ghost" className={s.productRowDelete} aria-label={`${item.name || 'პროდუქტი'} — წაშალეთ`} onClick={() => removeProduct(index)}><Icon name="trash-2" /></Button>{item.note.trim() ? <p>{item.note}</p> : !hasProductContent(item) ? <p>ცარიელი პროდუქტი არ შეინახება</p> : null}{productError(index, item.name) && <small className={s.fieldError}>{productError(index, item.name)}</small>}</div>)}
    </div>
    {search && !products.some(item => item.name.toLocaleLowerCase('ka').includes(search.toLocaleLowerCase('ka'))) && <p className={s.muted}>პროდუქტი ვერ მოიძებნა.</p>}
    <Button variant="secondary" onClick={() => { if (products.length >= 15) { toast({ title: 'შეგიძლიათ დაამატოთ მაქსიმუმ 15 პროდუქტი.', tone: 'warning' }); return; } setSearch(''); setExpanded(products.length); setPhotoPicker(null); setProducts([...products, { name: '', note: '', photoUrl: null }]); }}><Icon name="plus" />დაამატეთ პროდუქტი</Button>
    <Items rows label="მომსახურებები" values={p.offers} onChange={offers => patch({ offers })} />
  </Card>;
  if (step === 'verify') return <>
    <Card title="ვერიფიკაციის დოკუმენტები"><VerificationDocuments store={store} id={p.id} status={p.verification_documents_status} verified={p.verified} note={p.verification_note} onStatus={verification_documents_status=>patch({verification_documents_status:verification_documents_status as OnboardProfile['verification_documents_status']}, true)} onBusy={onBusy} onDetails={() => go('details')}/></Card>
    <p className={s.muted}><Icon name="lock-keyhole" />საჯაროდ ჩანს მხოლოდ ადმინისტრატორის მიერ დადასტურებული ვერიფიკაციის ნიშანი.</p>
  </>;
  const missing = (label: string) => <p className={s.missing}>{label} — შეგიძლიათ მოგვიანებით დაამატოთ</p>;
  const rows: [OnboardStep, string, string, ReactNode][] = [
    ['type', 'handshake', 'ტიპი', <div key="type">{p.account_intent ? tags(intentTags(p)) : missing('ტიპი')}{p.account_intent !== 'buy' && (p.provide_categories.length ? tags(categoryNames(p.provide_categories)) : missing('მიწოდების დარგები'))}</div>],
    ['details', 'building-2', 'კომპანია', <div key="company"><p>{p.company}</p>{p.name && <p>საკონტაქტო პირი: {p.name}</p>}{p.city && <p>ქალაქი: {cities[p.city]}</p>}{p.legal_name && p.legal_name.trim() !== p.company.trim() && <p>იურიდიული სახელი: {p.legal_name}</p>}{p.registration_code && <p>საიდენტიფიკაციო კოდი: {p.registration_code}</p>}</div>],
    ['profile', 'file-text', 'ბიზნეს-პროფილი', <div key="profile">{p.industry ? <p>{categories[p.industry]}</p> : missing('დარგი')}{p.about ? <p className={s.ellipsis}>{p.about}</p> : missing('კომპანიის შესახებ')}{!p.logo_url && missing('ლოგო')}{p.business_tags.length ? tags(p.business_tags) : missing('ტეგები')}</div>],
    ['provide', 'store', 'გთავაზობთ', <div key="products">{products.some(product => product.name.trim()) || normalizeOnboardItems(p.offers).length ? <p>{itemsSummary(products.filter(product => product.name.trim()).length, normalizeOnboardItems(p.offers).length)}</p> : missing('პროდუქტები და მომსახურებები')}</div>],
    ['need', 'shopping-cart', 'ყიდულობთ', <div key="need">{p.need_categories.length || normalizeOnboardItems(p.seeks).length ? tags([...categoryNames(p.need_categories), ...normalizeOnboardItems(p.seeks)]) : missing('საჭიროებები')}</div>],
    ['verify', 'shield-check', 'ვერიფიკაცია', <div key="verification"><p>{verificationBadge(p)}</p>{!p.verified && p.verification_documents_status !== 'approved' && <VerificationSummary store={store} id={p.id} onDetails={() => go('details')} />}</div>],
  ].filter(([key]) => key === 'provide' ? p.account_intent !== 'buy' : key === 'need' ? p.account_intent !== 'sell' : true) as [OnboardStep, string, string, ReactNode][];
  return <><section className={s.review}><ul>{rows.map(([key, icon, title, content]) => <li key={key}><span className={s.reviewIcon}><Icon name={icon} /></span><div><strong>{title}</strong>{content}</div><Button variant="ghost" aria-label={`${title} — შეცვალეთ`} onClick={() => go(key)}><Icon name="pencil" /><span className={s.editLabel}>შეცვალეთ</span></Button></li>)}</ul></section></>;
}
