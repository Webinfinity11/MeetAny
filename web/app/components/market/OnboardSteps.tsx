'use client';
import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { Badge } from '../ui/Badge';
import { toast } from '../Toasts';
import { Button } from '../ui/Button';
import { OnboardIcon as Icon } from './OnboardFields';
import { categories, cities } from '../../lib/categories';
import { type OnboardProfile, type OnboardStep, type Product } from '../../lib/onboarding-client';
import { OnboardCard as Card, OnboardField as Field, OnboardItems as Items, OnboardCategories as Categories } from './OnboardFields';
import s from './onboarding.module.css';

export const stepLabels: Record<OnboardStep, string> = { type: 'ანგარიშის ტიპი', details: 'კომპანიის მონაცემები', profile: 'ბიზნეს-პროფილი', provide: 'რას სთავაზობთ', need: 'რას ყიდულობთ', verify: 'ვერიფიკაცია', review: 'გადახედვა' };
export const titles: Record<OnboardStep, string> = { type: 'როგორ გამოიყენებთ MeetAny-ს?', details: 'კომპანიის მონაცემები', profile: 'ბიზნეს-პროფილი', provide: 'რას სთავაზობთ ბაზარს', need: 'რას ყიდულობთ ხშირად', verify: 'ვერიფიკაცია', review: 'გადახედვა და დასრულება' };
export const leads: Record<OnboardStep, string> = {
  type: 'ერთი კომპანიის ანგარიშით შეგიძლიათ იყიდოთ, გაყიდოთ ან ორივე. ნებისმიერ დროს შეცვლით.',
  details: 'გამოიყენება ვერიფიკაციისთვის. საკონტაქტო მონაცემები საჯაროდ არ ჩანს.',
  profile: 'ეს ნაწილი ყველას უჩანს. ტეგებით MeetAny შესაბამის მოთხოვნებსა და პარტნიორებს გიპოვით.',
  provide: 'დაამატეთ პროდუქტები და მომსახურებები — მყიდველები ამით გიპოვიან. ფასი აქ არ საჭიროა, ის შეთავაზებაში იწერება.',
  need: 'აირჩიეთ კატეგორიები — შესაბამისი მომწოდებლები გიპოვიან და რეკომენდაციებს მიიღებთ.',
  verify: 'ვერიფიცირებულ კომპანიებს მყიდველები უფრო ხშირად ირჩევენ. განხილვას 1–2 სამუშაო დღე სჭირდება.',
  review: 'შეამოწმეთ შენახული მონაცემები. დასრულების შემდეგ თქვენს ანგარიშზე გადახვალთ.',
};
export const intents = { buy: 'მომწოდებლების პოვნა', sell: 'კლიენტების პოვნა', both: 'ორივე' };
const intentTags = (p: OnboardProfile) => p.account_intent === 'both' ? ['ყიდვა', 'გაყიდვა'] : [p.account_intent === 'buy' ? 'ყიდვა' : 'გაყიდვა'];
const categoryNames = (keys: string[]) => keys.map(key => categories[key as keyof typeof categories] || key);
const tags = (values: string[]) => <div className={s.tags}>{[...new Set(values)].map(value => <span key={value}>{value}</span>)}</div>;
const certificateOptions = ['ISO სერტიფიკატი', 'HACCP', 'სურსათის უვნებლობა', 'ლიცენზია'];
export function OnboardPreview({ profile: p, products, step }: { profile: OnboardProfile; products: Product[]; step: OnboardStep }) {
  return <section className={s.preview}><p className={s.muted}><Icon name="eye" />ასე გამოჩნდებით</p><div className={s.identity}>
    <span className={s.avatar}>{p.logo_url ? <Image unoptimized loading="eager" width={48} height={48} src={p.logo_url} alt="კომპანიის ლოგო" /> : p.company.slice(0, 2)}</span><div><strong>{p.company}</strong><small>{categories[p.industry as keyof typeof categories]} · {cities[p.city]}</small></div>
  </div>{tags([...intentTags(p), ...categoryNames(p.provide_categories), ...(step === 'profile' ? p.business_tags : [])])}
  {step === 'provide' && tags([`${products.length} პროდუქტი · ${p.offers.length} მომსახურება`])}
  {step === 'need' && tags(categoryNames(p.need_categories).map(name => `ყიდულობთ: ${name}`))}
  {step === 'profile' && p.about && <p className={s.previewAbout}>{p.about}</p>}
  <div className={s.verificationHint}>{(p.verified || step === 'verify') && <Badge status={p.verified ? 'success' : 'warning'}>{p.verified ? 'ვერიფიცირებული' : 'მოლოდინში'}</Badge>}{(!p.verified || step === 'verify') && <p>ნიშანი გამოჩნდება დადასტურების შემდეგ</p>}</div></section>;
}
type Props = { step: OnboardStep; profile: OnboardProfile; patch: (patch: Partial<OnboardProfile>) => void; products: Product[]; setProducts: (p: Product[]) => void; upload: (file: File, kind: 'logo' | 'gallery' | 'cover') => Promise<string | undefined>; go: (step: OnboardStep) => void };
export function OnboardSteps({ step, profile: p, patch, products, setProducts, upload, go }: Props) {
  const [expanded, setExpanded] = useState(0);
  const [photoPicker, setPhotoPicker] = useState<number | null>(null);
  const [serviceEditor, setServiceEditor] = useState<number | null>(null);
  const [serviceText, setServiceText] = useState('');
  const saveService = () => {
    const value = serviceText.trim();
    if (!value || (p.offers.includes(value) && p.offers[serviceEditor ?? -1] !== value)) return;
    patch({ offers: serviceEditor === p.offers.length ? [...p.offers, value] : p.offers.map((item, i) => i === serviceEditor ? value : item) });
    setServiceEditor(null); setServiceText('');
  };
  const updateProduct = (index: number, value: Partial<Product>) => setProducts(products.map((item, i) => i === index ? { ...item, ...value } : item));
  const fileInput = (kind: 'logo' | 'gallery' | 'cover', label: string) => <label className={s.file}><Icon name="upload" />{label}<input aria-label={label} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file, kind); }} /></label>;
  if (step === 'type') return <>
    <div className={s.intentGrid}>{(['buy', 'sell', 'both'] as const).map((key, i) => <label key={key} className={`${s.intent} ${p.account_intent === key ? s.intentSelected : ''}`}><input type="radio" name="intent" value={key} checked={p.account_intent === key} onChange={() => patch({ account_intent: key })} /><span className={s.intentCheck} aria-hidden="true">{p.account_intent === key && <Icon name="check" />}</span><span className={s.intentIcon}><Icon name={['shopping-cart', 'store', 'handshake'][i]} /></span><strong>{intents[key]}</strong><span>{['განათავსეთ მოთხოვნები და მიიღეთ შეთავაზებები', 'ნახეთ მოთხოვნები და გაგზავნეთ შეთავაზებები', 'ყიდვა და გაყიდვა ერთი ანგარიშით'][i]}</span></label>)}</div>
    <Card title="ძირითადი დარგები" hint={`${p.provide_categories.length} / 5`}><Categories compact limit={5} values={p.provide_categories} onChange={provide_categories => patch({ provide_categories })} /></Card>
  </>;
  if (step === 'details') return <>
    <Card title="იურიდიული ინფორმაცია"><div className={s.two}><Field label="იურიდიული სახელი" required value={p.legal_name || ''} maxLength={200} onChange={legal_name => patch({ legal_name: legal_name || null })} /><Field label="საიდენტიფიკაციო კოდი" icon="hash" required value={p.registration_code || ''} maxLength={40} onChange={registration_code => patch({ registration_code: registration_code || null })} /></div><div className={s.two}>
      <Field label="დაარსების წელი" required type="number" min={1800} max={new Date().getFullYear()} value={p.founded_year?.toString() || ''} onChange={value => patch({ founded_year: value ? Number(value) : null })} />
      <Field label="იურიდიული ფორმა" required value={p.legal_form || ''} options={{ ...Object.fromEntries(['შპს', 'ინდ. მეწარმე', 'სს', 'კოოპერატივი', 'სხვა'].map(value => [value, value])), ...(p.legal_form ? { [p.legal_form]: p.legal_form } : {}) }} onChange={legal_form => patch({ legal_form: legal_form || null })} />
      <Field label="თანამშრომლები" required value={p.employee_band || ''} options={{ '1-7': '1–7', '8-50': '8–50', '51-200': '51–200', '201+': '201+' }} onChange={employee_band => patch({ employee_band: employee_band || null })} />
    </div></Card>
    <Card title="ლოკაცია"><div className={s.two}><Field label="ქალაქი" icon="map-pin" required value={p.city} options={cities} onChange={city => patch({ city })} /><Field label="მისამართი" value={p.address || ''} maxLength={200} onChange={address => patch({ address: address || null })} /></div></Card>
    <Card title="კონტაქტი"><div className={s.two}><Field label="საკონტაქტო პირი" icon="user" required value={p.name} maxLength={80} onChange={name => patch({ name })} /><Field label="პოზიცია" value={p.contact_position || ''} maxLength={100} onChange={contact_position => patch({ contact_position: contact_position || null })} /><Field label="ელფოსტა" icon="mail" required value={p.email || ''} readOnly /><Field label="ტელეფონი" icon="phone" required value={p.phone || ''} readOnly /></div><Field label="ვებგვერდი" icon="globe" type="url" value={p.website || ''} maxLength={500} onChange={website => patch({ website: website || null })} /><p className={s.muted}><Icon name="lock-keyhole" />ტელეფონი და ელფოსტა მხოლოდ არჩეულ პარტნიორს გაეხსნება.</p></Card>
    <details className={s.optional}><summary>დამატებითი</summary><Card title="საქმიანობის არეალი"><Items label="ბაზრები" values={p.markets} onChange={markets => patch({ markets })} /><Items label="ენები" values={p.languages} onChange={languages => patch({ languages })} /></Card></details>
  </>;
  if (step === 'profile') return <>
    <Card title="ვინ ხართ"><div className={s.profileMedia}><div className={s.coverFrame}>{p.gallery?.[0] ? <Image unoptimized loading="eager" width={640} height={200} className={s.cover} src={p.gallery[0]} alt="კომპანიის ქავერი" /> : <div className={s.coverPlaceholder}><Icon name="image" /></div>}<div className={s.coverAction}>{fileInput('cover', 'ქავერის შეცვლა')}</div></div><div className={s.logoAction}><span className={`${s.avatar} ${s.largeAvatar}`}>{p.logo_url ? <Image unoptimized loading="eager" width={72} height={72} src={p.logo_url} alt="კომპანიის ლოგო" /> : p.company.slice(0, 2)}</span>{fileInput('logo', 'ლოგო')}</div></div>
      <Field label="მოკლე აღწერა" hint={`${p.about.length} / 500`} multiline value={p.about || ''} maxLength={500} onChange={about => patch({ about })} /></Card>
    <Card title="დარგი და ტეგები"><Field label="ძირითადი დარგი" required value={p.industry} options={categories} onChange={industry => patch({ industry })} /><Items label="ტეგები" values={p.business_tags} suggestions={['HoReCa', 'დისტრიბუცია', 'იმპორტი', 'წარმოება', 'კეითერინგი']} onChange={business_tags => patch({ business_tags })} /></Card>
    <Card title="სერტიფიკატები" hint="არასავალდებულო"><Items label="სერტიფიკატები" values={p.certificates} suggestions={certificateOptions} onChange={certificates => patch({ certificates })} /></Card>
  </>;
  if (step === 'need') return <><Card title="კატეგორიები" hint={`არჩეულია ${p.need_categories.length}`}><Categories values={p.need_categories} onChange={need_categories => patch({ need_categories })} /></Card><Card title="კონკრეტული ერთეულები" hint="არასავალდებულო"><Items rows label="რას ეძებთ" values={p.seeks || []} onChange={seeks => patch({ seeks })} /></Card><p className={s.muted}><Icon name="info" />ეს არ არის მოთხოვნა — ეხმარება შესაბამისობას</p></>;
  if (step === 'provide') return <Card title="პროდუქტები და მომსახურებები">
    {products.map((item, index) => index === expanded ? <div className={s.productEditor} key={index}>
      <div><button type="button" className={s.photoBox} aria-label={`${item.name || 'პროდუქტი'} — ფოტოს არჩევა`} aria-expanded={photoPicker === index} onClick={() => setPhotoPicker(photoPicker === index ? null : index)}>{item.photoUrl ? <Image unoptimized width={96} height={96} src={item.photoUrl} alt={item.name || 'პროდუქტის ფოტო'} /> : <Icon name="upload" />}</button>
      {photoPicker === index && <div className={s.photoPicker} role="group" aria-label="ფოტო გალერეიდან">{p.gallery.map((url, i) => <button type="button" key={url} aria-label={`ფოტო ${i + 1}`} aria-pressed={item.photoUrl === url} onClick={() => { updateProduct(index, { photoUrl: url }); setPhotoPicker(null); }}><Image unoptimized width={48} height={48} src={url} alt="" /></button>)}<label className={s.file}><Icon name="upload" />ატვირთვა<input type="file" aria-label="პროდუქტის ფოტოს ატვირთვა" accept="image/jpeg,image/png,image/webp,image/gif" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) { const url = await upload(file, 'gallery'); if (url) { updateProduct(index, { photoUrl: url }); setPhotoPicker(null); } } }} /></label></div>}</div>
      <div className={s.stack}><Field label="სახელი" required value={item.name} maxLength={80} onChange={name => updateProduct(index, { name })} /><Field label="მოკლე აღწერა" multiline value={item.note || ''} maxLength={200} onChange={note => updateProduct(index, { note })} /><Button variant="ghost" onClick={() => { setProducts(products.filter((_, i) => i !== index)); setExpanded(0); }}><Icon name="trash-2" />წაშლა</Button></div>
    </div> : <div className={s.productRow} key={index}>{item.photoUrl ? <Image unoptimized width={48} height={48} src={item.photoUrl} alt="" /> : <span className={s.reviewIcon}><Icon name="package" /></span>}<div><strong>{item.name}</strong><p>{item.note}</p></div><Button variant="ghost" aria-label={`${item.name} — შეცვლა`} onClick={() => setExpanded(index)}><Icon name="pencil" /></Button><Button variant="ghost" aria-label={`${item.name} — წაშლა`} onClick={() => { setProducts(products.filter((_, i) => i !== index)); setExpanded(0); }}><Icon name="trash-2" /></Button></div>)}
    {p.offers.map((name, i) => <div className={s.productRow} key={`service-${i}`}><span className={s.reviewIcon}><Icon name="handshake" /></span><div><strong>{name}</strong><p>მომსახურება</p></div><Button variant="ghost" aria-label={`${name} — შეცვლა`} onClick={() => { setServiceEditor(i); setServiceText(name); }}><Icon name="pencil" /></Button><Button variant="ghost" aria-label={`${name} — წაშლა`} onClick={() => { patch({ offers: p.offers.filter((_, index) => index !== i) }); setServiceEditor(null); }}><Icon name="trash-2" /></Button></div>)}
    {serviceEditor !== null && <div className={s.stack}><Field label="მომსახურების სახელი" value={serviceText} maxLength={120} onChange={setServiceText} /><div className={s.addItem}><Button variant="secondary" disabled={!serviceText.trim()} onClick={saveService}>დამატება</Button><Button variant="ghost" onClick={() => setServiceEditor(null)}>გაუქმება</Button></div></div>}
    <Button variant="secondary" className={s.addProduct} disabled={products.length >= 12} onClick={() => { setExpanded(products.length); setProducts([...products, { name: '', note: '', photoUrl: p.gallery[0] || '' }]); }}><Icon name="plus" />პროდუქტის დამატება</Button>
    <Button variant="ghost" className={s.addProduct} disabled={p.offers.length >= 8 || serviceEditor !== null} onClick={() => { setServiceEditor(p.offers.length); setServiceText(''); }}><Icon name="plus" />მომსახურების დამატება</Button>
  </Card>;
  if (step === 'verify') return <>
    <Card title="სავალდებულო დოკუმენტები">{['რეგისტრაციის ამონაწერი', 'საგადასახადო დოკუმენტი', 'კომპანიის ლოგო'].map((name, i) => {
      const done = i === 2 && !!p.logo_url;
      return <div className={s.docRow} data-done={done || undefined} key={name}><span className={s.docIcon}><Icon name="file-text" /></span><div><strong>{name}</strong><p>PDF, JPG, PNG · 10 MB</p></div>{done ? <span className={s.docCheck} aria-label="ატვირთულია"><Icon name="circle-check" /></span> : <Button aria-label={`${name} — ატვირთვა`} onClick={() => { if (i === 2) go('profile'); else toast('დოკუმენტების ატვირთვა მალე — გამოგზავნეთ ელფოსტაზე'); }}><Icon name="upload" /><span className={s.editLabel}>ატვირთვა</span></Button>}</div>;
    })}</Card>
    <Card title="დამატებითი" hint="არასავალდებულო"><Items label="სერტიფიკატები" values={p.certificates} suggestions={certificateOptions} onChange={certificates => patch({ certificates })} /></Card>
    <p className={s.muted}><Icon name="lock-keyhole" />დოკუმენტები კონფიდენციალურია — საჯაროდ მხოლოდ ვერიფიკაციის ნიშანი ჩანს.</p>
  </>;
  const rows: [OnboardStep, string, string, ReactNode][] = [
    ['type', 'handshake', 'ტიპი', tags([...intentTags(p), ...categoryNames(p.provide_categories)])],
    ['details', 'building-2', 'კომპანია', <p key="company">{[p.legal_name || p.company, p.registration_code, cities[p.city]].filter(Boolean).join(' · ')}</p>],
    ['profile', 'file-text', 'ბიზნეს-პროფილი', <div key="profile"><p className={s.ellipsis}>{p.about}</p>{tags([...p.business_tags, ...p.certificates])}</div>],
    ['provide', 'store', 'გთავაზობთ', <div key="products" className={s.thumbnails}>{products.filter(product => product.photoUrl).map((product, index) => <Image key={index} unoptimized width={40} height={32} src={product.photoUrl} alt={product.name} />)}<span>{products.length} პროდუქტი · {p.offers.length} მომსახურება</span></div>],
    ['need', 'shopping-cart', 'ყიდულობთ', tags([...categoryNames(p.need_categories), ...p.seeks])],
    ['verify', 'shield-check', 'ვერიფიკაცია', <Badge key="verification" status={p.verified ? 'success' : 'warning'}>{p.verified ? 'ვერიფიცირებული' : 'მოლოდინში'}</Badge>],
  ];
  return <><section className={s.review}><ul>{rows.map(([key, icon, title, content]) => <li key={key}><span className={s.reviewIcon}><Icon name={icon} /></span><div><strong>{title}</strong>{content}</div><Button variant="ghost" aria-label={`${title} — შეცვლა`} onClick={() => go(key)}><Icon name="pencil" /><span className={s.editLabel}>შეცვლა</span></Button></li>)}</ul></section><p className={s.muted}><Icon name="info" />დასრულებით ეთანხმებით <a href="/terms/" target="_blank" rel="noopener noreferrer">წესებს</a>.</p></>;
}
