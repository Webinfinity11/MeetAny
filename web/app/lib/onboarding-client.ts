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
export type Product = { name: string; photoUrl: string; note: string };
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
const verificationLabels: Record<VerificationState, string> = { none: 'დოკუმენტები არ არის', pending: 'განსახილველი', approved: 'ვერიფიცირებული', returned: 'დაბრუნებულია შესასწორებლად' };
/** Badge text: „დოკუმენტები არ არის“ · „განსახილველი“ · „ვერიფიცირებული“ · „დაბრუნებულია შესასწორებლად“. */
export function verificationLabel(status?: string | null, verified = false): string {
  return verificationLabels[verificationState(status, verified)];
}
/** One sentence under the badge; for a returned set, the admin's reason follows when there is one. */
export function verificationHint(status?: string | null, verified = false, note?: string | null): string {
  const state = verificationState(status, verified);
  if (state === 'approved') return 'კომპანიის პროფილზე ვერიფიკაციის ნიშანი ჩანს.';
  if (state === 'pending') return 'ადმინისტრატორი ამოწმებს დოკუმენტებს. შედეგს შეტყობინებით მიიღებთ.';
  if (state === 'returned') return note?.trim() ? `შეასწორეთ და ხელახლა გაგზავნეთ. მიზეზი: ${note.trim()}` : 'შეასწორეთ დოკუმენტები და ხელახლა გაგზავნეთ.';
  return 'ატვირთეთ რეგისტრაციის ამონაწერი და საგადასახადო დოკუმენტი, შემდეგ გაგზავნეთ განსახილველად.';
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
    offers: p.offers || [], seeks: p.seeks || [], serviceCities: p.service_cities || [], lat: p.lat, lng: p.lng };
}
export async function readOnboard(store: Store) {
  const profile = await readOnboardProfile(store);
  const products: Product[] = await store.companyProducts(profile.id);
  if (!Array.isArray(products)) throw new Error('პროდუქტები ვერ ჩაიტვირთა.');
  return { profile, products };
}
/** Read the current raw row before full replacements; only this step's edits override it. */
export async function saveOnboardStep(store: Store, step: OnboardStep, draft: OnboardProfile, products: Product[]) {
  if (step === 'provide' && draft.provide_categories.length > 5) throw new Error('აირჩიეთ მაქსიმუმ 5 მიწოდების კატეგორია.');
  const current = await readOnboardProfile(store);
  if (current.id !== draft.id) throw new Error('ანგარიში შეიცვალა. განაახლეთ გვერდი.');
  const merged = { ...current };
  for (const key of keysByStep[step] || []) Object.assign(merged, { [key]: draft[key] });
  if (['type', 'details', 'profile'].includes(step)) {
    const args = Object.fromEntries(detailKeys.map(key => ['p_' + key, merged[key]]));
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
    const result = await store.setMyProducts(products);
    if (!Array.isArray(result)) throw new Error('პროდუქტების შენახვა ვერ დადასტურდა.');
  }
  // verify/review are read-only: there is no document submission or completion RPC.
  return readOnboard(store);
}
export function onboardError(error: unknown) {
  return (error as { userMessage?: string; message?: string })?.userMessage || (error as Error)?.message || 'ვერ შესრულდა. სცადეთ ხელახლა.';
}
