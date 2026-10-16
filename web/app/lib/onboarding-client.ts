import { productKey, PRODUCT_UNITS } from "./products-import";
import type { Store } from './market-client';
import { categories } from './categories';

export const onboardSteps = ['type', 'details', 'profile', 'provide', 'need', 'verify', 'review'] as const;
export type OnboardStep = typeof onboardSteps[number];
export type AccountIntent = 'buy' | 'sell' | 'both';
export const intents: Record<AccountIntent, string> = { buy: 'მომწოდებლების პოვნა', sell: 'კლიენტების პოვნა', both: 'ორივე' };
/** Buyers skip "provide", sellers skip "need"; both keep every step. */
export function stepsFor(intent?: AccountIntent | string | null): readonly OnboardStep[] {
  return onboardSteps.filter(step => step === 'provide' ? intent !== 'buy' : step === 'need' ? intent !== 'sell' : true);
}
export type Product = { name: string; photoUrl?: string | null; note: string; code?: string; unit?: string; price?: number };
/** An unused editor may be skipped; an entered detail must never disappear with a blank name. */
export const hasProductContent = (product: Product) => [product.name, product.note, product.code, product.photoUrl, product.unit].some(value => !!value?.trim()) || product.price !== undefined;
export const normalizeOnboardItems = (values: string[]) => values.map(value => value.trim()).filter(Boolean);
export function onboardItemsError(values: string[], { limit = 8, maxLength = 120 }: { limit?: number; maxLength?: number } = {}): string {
  const filled = normalizeOnboardItems(values);
  if (filled.length > limit) return `შეგიძლიათ დაამატოთ მაქსიმუმ ${limit} ჩანაწერი.`;
  if (filled.some(value => value.length > maxLength)) return `ჩანაწერი ${maxLength} სიმბოლოზე გრძელი არ უნდა იყოს.`;
  const keys = filled.map(value => value.replace(/\s+/g, ' ').toLocaleLowerCase('ka-GE'));
  return new Set(keys).size !== keys.length ? 'ერთნაირი ჩანაწერი მეორდება — შეცვალეთ ან წაშალეთ.' : '';
}
export type OnboardProfile = {
  onboarding_completed_at?:string|null;
  id: string; role: string; blocked: boolean; verified: boolean;
  name: string; company: string; city: string; industry: string; email: string; phone: string;
  about: string; address: string | null; lat: number | null; lng: number | null;
  offers: string[]; seeks: string[]; service_cities: string[]; logo_url: string | null; gallery: string[];
  account_intent: 'buy' | 'sell' | 'both'; employee_band: string | null; founded_year: number | null;
  markets: string[]; languages: string[]; legal_name: string | null; registration_code: string | null;
  legal_form: string | null; contact_position: string | null; website: string | null;
  business_tags: string[]; certificates: string[]; provide_categories: string[]; need_categories: string[];
  verification_documents_status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  /** Admin's reason for a returned set; present once the admin migration adds it to my_profile. */
  verification_note?: string | null;
};
/** Verification as the company sees it; one source for every screen.
 *  Database values (verification_documents_status) map onto it: not_submitted → none, rejected → returned.
 *  `verified` wins: an admin-verified company is verified even without a document record. */
export type VerificationState = 'none' | 'pending' | 'approved' | 'returned';
export function verificationState(status?: string | null, verified = false): VerificationState {
  if (verified || status === 'approved') return 'approved';
  if (status === 'pending') return 'pending';
  if (status === 'rejected' || status === 'returned') return 'returned';
  return 'none';
}
const verificationLabels: Record<VerificationState, string> = { none: 'ვერიფიკაციის გარეშე', pending: 'განსახილველი', approved: 'ვერიფიცირებული', returned: 'დაბრუნებულია შესასწორებლად' };
/** Badge text: „ვერიფიკაციის გარეშე“ · „განსახილველი“ · „ვერიფიცირებული“ · „დაბრუნებულია შესასწორებლად“. */
export function verificationLabel(status?: string | null, verified = false): string {
  return verificationLabels[verificationState(status, verified)];
}
/** One sentence under the badge; for a returned set, the admin's reason follows when there is one. */
export function verificationHint(status?: string | null, verified = false, note?: string | null): string {
  const state = verificationState(status, verified);
  if (state === 'approved') return 'კომპანიის პროფილზე ვერიფიკაციის ნიშანი ჩანს.';
  if (state === 'pending') return 'ადმინისტრატორი ამოწმებს დოკუმენტებს. შედეგს შეტყობინებით მიიღებთ.';
  if (state === 'returned') return note?.trim() ? `შეასწორეთ და ხელახლა გაგზავნეთ. მიზეზი: ${note.trim()}` : 'შეასწორეთ დოკუმენტები და ხელახლა გაგზავნეთ.';
  return 'ვერიფიკაცია არჩევითია — პროფილს დადასტურების ნიშანს ამატებს.';
}
/** Badge tone for the state. */
export function verificationTone(status?: string | null, verified = false): 'success' | 'warning' | 'danger' | 'neutral' {
  return ({ approved: 'success', pending: 'warning', returned: 'danger', none: 'neutral' } as const)[verificationState(status, verified)];
}
/** The next step, when the company has one: none → upload, returned → correct; pending/approved → null. */
export function verificationAction(status?: string | null, verified = false): { label: string; href: string } | null {
  const state = verificationState(status, verified);
  return state === 'none' ? { label: 'დოკუმენტების ატვირთვა', href: '/onboarding/?step=verify' }
    : state === 'returned' ? { label: 'დოკუმენტების შესწორება', href: '/onboarding/?step=verify' } : null;
}
export const verificationRequirements = {
  legal_name: 'იურიდიული სახელი', registration_code: 'საიდენტიფიკაციო კოდი',
  registration_document: 'რეგისტრაციის ამონაწერი', tax_document: 'საგადასახადო დოკუმენტი',
} as const;
export type VerificationRequirements = Record<keyof typeof verificationRequirements, boolean>;
export async function readVerificationRequirements(store: Store): Promise<VerificationRequirements> {
  const data = await store.callRpc('verification_requirements');
  if (!data || Object.keys(verificationRequirements).some(key => typeof data[key] !== 'boolean')) throw new Error('ვერიფიკაციის მოთხოვნები ვერ ჩაიტვირთა. სცადეთ ხელახლა.');
  return data;
}
const detailKeys = ['account_intent', 'employee_band', 'founded_year', 'markets', 'languages', 'legal_name', 'registration_code', 'legal_form', 'contact_position', 'website', 'business_tags', 'certificates'] as const;
const keysByStep: Partial<Record<OnboardStep, readonly (keyof OnboardProfile)[]>> = {
  type: ['account_intent'],
  details: ['legal_name', 'registration_code', 'founded_year', 'legal_form', 'employee_band', 'contact_position', 'website', 'markets', 'languages', 'city', 'address', 'name'],
  profile: ['company', 'about', 'industry', 'business_tags', 'certificates'],
  provide: ['provide_categories', 'offers'], need: ['need_categories', 'seeks'],
};
type OnboardModel = { profile: OnboardProfile; products: Product[] };
export function onboardWrites(step: OnboardStep, dirty: Iterable<OnboardStep>, leaving = false, steps: readonly OnboardStep[] = onboardSteps) {
  const changed = new Set(dirty);
  return steps.filter((value, index) => (leaving || index <= steps.indexOf(step)) && (changed.has(value) || value === step));
}
/** Keep later, unfinished drafts when earlier steps refresh their saved data. */
export function retainOnboardDraft(saved: OnboardModel, draft: OnboardModel, steps: readonly OnboardStep[]): OnboardModel {
  const profile = { ...saved.profile };
  for (const step of steps) {
    for (const key of keysByStep[step] || []) Object.assign(profile, { [key]: draft.profile[key] });
    if (step === 'type') profile.provide_categories = draft.profile.provide_categories;
  }
  return { profile, products: steps.includes('provide') ? draft.products : saved.products };
}
export const onboardDraftKey = (profileId: string) => `onboard-draft:${profileId}`;
export const onboardDraftLifetime = 24 * 60 * 60 * 1000;
const draftKeys = (step: OnboardStep) => step === 'type' ? [...(keysByStep.type || []), 'provide_categories' as const] : keysByStep[step] || [];
/** Only editable step data and product strings belong in a local draft, never files or server flags. */
export function serializeOnboardDraft(model: OnboardModel, dirtySteps: Iterable<OnboardStep>, now = Date.now()): string {
  const dirty = new Set(dirtySteps);
  const steps = onboardSteps.filter(step => dirty.has(step) && draftKeys(step).length);
  const profile = Object.fromEntries(steps.flatMap(step => draftKeys(step).map(key => [key, model.profile[key]])));
  return JSON.stringify({ version: 1, profileId: model.profile.id, savedAt: now, dirtySteps: steps, profile,
    ...(steps.includes('provide') ? { products: model.products.map(({ name, photoUrl, note, code, unit, price }) => ({ name, photoUrl, note, code, unit, price })) } : {}) });
}
/** Invalid, foreign and expired drafts cannot replace confirmed server data. */
export function restoreOnboardDraft(persisted: OnboardModel, draft: string | null, now = Date.now()): OnboardModel {
  if (!draft) return persisted;
  try {
    const value = JSON.parse(draft);
    if (value?.version !== 1 || value.profileId !== persisted.profile.id || !Number.isFinite(value.savedAt)
      || value.savedAt > now || now - value.savedAt >= onboardDraftLifetime
      || !Array.isArray(value.dirtySteps) || !value.profile || typeof value.profile !== 'object') return persisted;
    const profile = { ...persisted.profile };
    const arrays = ['markets', 'languages', 'business_tags', 'certificates', 'provide_categories', 'need_categories', 'offers', 'seeks'];
    const nullable = ['legal_name', 'registration_code', 'legal_form', 'employee_band', 'contact_position', 'website', 'address'];
    for (const step of onboardSteps.filter(step => value.dirtySteps.includes(step))) {
      for (const key of draftKeys(step)) {
        if (!Object.hasOwn(value.profile, key)) continue;
        const field = value.profile[key];
        const valid = arrays.includes(key) ? Array.isArray(field) && field.every(item => typeof item === 'string')
          : key === 'founded_year' ? field === null || typeof field === 'number' && Number.isFinite(field)
          : typeof field === 'string' || nullable.includes(key) && field === null;
        if (valid) Object.assign(profile, { [key]: field });
      }
    }
    const products = value.dirtySteps.includes('provide') && Array.isArray(value.products)
      && value.products.every((item: Product) => item && typeof item.name === 'string' && typeof item.note === 'string' && (item.photoUrl == null || typeof item.photoUrl === 'string') && (item.code === undefined || typeof item.code === 'string') && (item.unit === undefined || typeof item.unit === 'string') && (item.price === undefined || typeof item.price === 'number' && Number.isFinite(item.price)))
      ? value.products.map(({ name, photoUrl, note, code, unit, price }: Product) => ({ name, photoUrl, note, ...(code !== undefined ? { code } : {}), ...(unit !== undefined ? { unit } : {}), ...(price !== undefined ? { price } : {}) })) : persisted.products;
    const restored = { profile, products };
    return JSON.stringify(restored) === JSON.stringify(persisted) ? persisted : restored;
  } catch { return persisted; }
}
/** Shared by normal saves and save-and-exit: invalid steps stay only in the local draft. */
export function validateOnboardStep(step: OnboardStep, p: OnboardProfile, products: Product[]): string {
  const length = (value: string | null | undefined, min: number, max: number) => !value?.trim() || value.trim().length >= min && value.trim().length <= max;
  const items = (values: string[]) => !onboardItemsError(values);
  if (step === 'type' && (!['buy', 'sell', 'both'].includes(p.account_intent) || p.provide_categories.length > 5)) return 'აირჩიეთ ანგარიშის ტიპი და მაქსიმუმ 5 დარგი.';
  if (step === 'details') {
    if (p.name.trim().length < 2 || p.name.length > 80) return 'საკონტაქტო პირის სახელი უნდა შეიცავდეს 2–80 სიმბოლოს.';
    if (!p.city) return 'აირჩიეთ ქალაქი.';
    if (!length(p.legal_name, 2, 200)) return 'იურიდიული სახელი უნდა შეიცავდეს 2–200 სიმბოლოს.';
    if (!length(p.registration_code, 3, 40)) return 'საიდენტიფიკაციო კოდი უნდა შეიცავდეს 3–40 სიმბოლოს.';
    if (p.founded_year != null && (!Number.isInteger(p.founded_year) || p.founded_year < 1800 || p.founded_year > new Date().getFullYear())) return 'მიუთითეთ წელი დასაშვებ დიაპაზონში.';
    if (p.website?.trim() && !/^https?:\/\/\S+$/.test(p.website)) return 'ვებგვერდი უნდა იწყებოდეს https:// ან http://-ით.';
    if (!length(p.legal_form, 1, 80) || !length(p.contact_position, 1, 100) || !length(p.address, 1, 200) || !length(p.website, 1, 500) || !items(p.markets) || !items(p.languages)) return 'შეამოწმეთ დამატებითი მონაცემების ფორმატი.';
  }
  if (step === 'profile' && (p.company.trim().length < 2 || p.about.length > 1000 || !items(p.business_tags) || !items(p.certificates))) return 'შეამოწმეთ კომპანიის სახელი, აღწერა (1000-მდე სიმბოლო) და ტეგები.';
  if (step === 'provide') {
    const filled = products.filter(hasProductContent);
    if (filled.some(item => !item.name.trim())) return 'მიუთითეთ პროდუქტის სახელი ან წაშალეთ დაუმთავრებელი პროდუქტი.';
    if (filled.length > 15) return 'ლიმიტი: მაქსიმუმ 15 პროდუქტი.';
    if (filled.some(item => item.name.trim().length < 2 || item.name.length > 80 || item.note.length > 200)) return 'პროდუქტის სახელი უნდა შეიცავდეს 2–80 სიმბოლოს, აღწერა — 200-მდე.';
    const keys = filled.map(productKey);
    if (new Set(keys).size !== keys.length) return 'პროდუქტის კოდი მეორდება ან უკოდო პროდუქტი ამ სახელით უკვე დამატებულია.';
    if (filled.some(item => (item.code?.length || 0) > 40 || item.unit && !Object.hasOwn(PRODUCT_UNITS, item.unit) || item.price !== undefined && (!Number.isFinite(item.price) || item.price < 0 || item.price > 1e9))) return 'შეამოწმეთ პროდუქტის კოდი, ერთეული და ფასი.';
    if (p.provide_categories.length > 5) return 'აირჩიეთ მაქსიმუმ 5 დარგი.';
    if (onboardItemsError(p.offers)) return onboardItemsError(p.offers);
  }
  if (step === 'need') return onboardItemsError(p.seeks);
  return '';
}
export async function readOnboardProfile(store: Store): Promise<OnboardProfile> {
  const data = await store.callRpc('my_profile');
  const profile = Array.isArray(data) ? data[0] : data;
  if (!profile?.id) throw new Error('პროფილი ვერ ჩაიტვირთა. სცადეთ ხელახლა.');
  if (profile.role !== 'company' || profile.blocked) throw new Error('ეს გვერდი ხელმისაწვდომია კომპანიის ანგარიშისთვის.');
  // Never replace unseen fields with defaults when the migration/API is unavailable.
  if ([...detailKeys, 'provide_categories', 'need_categories', 'verification_documents_status'].some(key => profile[key] === undefined)) throw new Error('პროფილის ახალი ველები მიუწვდომელია. სცადეთ მოგვიანებით.');
  return profile;
}
export function profileInput(p: OnboardProfile) {
  return { name: p.name, company: p.company, city: p.city, industry: p.industry, about: p.about || '', address: p.address,
    offers: normalizeOnboardItems(p.offers || []), seeks: normalizeOnboardItems(p.seeks || []), serviceCities: p.service_cities || [], lat: p.lat, lng: p.lng };
}
export async function readOnboard(store: Store) {
  const profile = await readOnboardProfile(store);
  const products: Product[] = await store.companyProducts(profile.id);
  if (!Array.isArray(products)) throw new Error('პროდუქტები ვერ ჩაიტვირთა.');
  return { profile, products };
}
/** Read the current raw row before full replacements; only this step's edits override it. */
export async function saveOnboardStep(store: Store, step: OnboardStep, draft: OnboardProfile, products: Product[]) {
  const error = validateOnboardStep(step, draft, products);
  if (error) throw new Error(error);
  const current = await readOnboardProfile(store);
  if (current.id !== draft.id) throw new Error('ანგარიში შეიცვალა. განაახლეთ გვერდი.');
  const merged = { ...current };
  for (const key of keysByStep[step] || []) Object.assign(merged, { [key]: draft[key] });
  for (const key of ['markets', 'languages', 'business_tags', 'certificates'] as const) merged[key] = normalizeOnboardItems(merged[key]);
  if (['type', 'details', 'profile'].includes(step)) {
    const args = Object.fromEntries(detailKeys.map(key => ['p_' + key, typeof merged[key] === 'string' && !merged[key]?.trim() ? null : merged[key]]));
    const result = await store.callRpc('set_onboarding_details', args);
    const row = Array.isArray(result) ? result[0] : result;
    if (row?.id !== current.id) throw new Error('შენახვა ვერ დადასტურდა. სცადეთ ხელახლა.');
  }
  if (['details', 'profile', 'provide', 'need'].includes(step)) {
    const result = await store.updateProfile(profileInput(merged));
    if (result?.id !== current.id) throw new Error('პროფილის შენახვა ვერ დადასტურდა.');
  }
  if (['provide', 'need'].includes(step)) {
    if ([...merged.provide_categories, ...merged.need_categories].some(key => !Object.hasOwn(categories, key))) throw new Error('აირჩიეთ კატეგორია სიიდან.');
    const result = await store.callRpc('set_matching_categories', { p_provide: merged.provide_categories, p_need: merged.need_categories });
    if (!Array.isArray(result?.provide) || !Array.isArray(result?.need)) throw new Error('კატეგორიების შენახვა ვერ დადასტურდა.');
  }
  if (step === 'provide') {
    const result = await store.setMyProducts(products.filter(hasProductContent));
    if (!Array.isArray(result)) throw new Error('პროდუქტების შენახვა ვერ დადასტურდა.');
  }
  // verify/review are read-only: there is no document submission or completion RPC.
  return readOnboard(store);
}
export function onboardError(error: unknown) {
  return (error as { userMessage?: string; message?: string })?.userMessage || (error as Error)?.message || 'ვერ შესრულდა. სცადეთ ხელახლა.';
}
