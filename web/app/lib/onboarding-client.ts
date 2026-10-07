import type { Store } from './market-client';
import { categories } from './categories';

export const onboardSteps = ['type', 'details', 'profile', 'provide', 'need', 'verify', 'review'] as const;
export type OnboardStep = typeof onboardSteps[number];
export type Product = { name: string; photoUrl: string; note: string };
export type OnboardProfile = {
  id: string; role: string; blocked: boolean; verified: boolean;
  name: string; company: string; city: string; industry: string; email: string; phone: string;
  about: string; address: string | null; lat: number | null; lng: number | null;
  offers: string[]; seeks: string[]; service_cities: string[]; logo_url: string | null; gallery: string[];
  account_intent: 'buy' | 'sell' | 'both'; employee_band: string | null; founded_year: number | null;
  markets: string[]; languages: string[]; legal_name: string | null; registration_code: string | null;
  legal_form: string | null; contact_position: string | null; website: string | null;
  business_tags: string[]; certificates: string[]; provide_categories: string[]; need_categories: string[];
  verification_documents_status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
};
export const documentLabels = { not_submitted: 'დოკუმენტები არ არის წარდგენილი', pending: 'დოკუმენტები განხილვაშია', approved: 'დოკუმენტები დამტკიცებულია', rejected: 'დოკუმენტები უარყოფილია' };
const detailKeys = ['account_intent', 'employee_band', 'founded_year', 'markets', 'languages', 'legal_name', 'registration_code', 'legal_form', 'contact_position', 'website', 'business_tags', 'certificates'] as const;
const keysByStep: Partial<Record<OnboardStep, readonly (keyof OnboardProfile)[]>> = {
  type: ['account_intent', 'provide_categories'],
  details: ['legal_name', 'registration_code', 'founded_year', 'legal_form', 'employee_band', 'contact_position', 'website', 'markets', 'languages', 'city', 'address', 'name'],
  profile: ['company', 'about', 'industry', 'business_tags', 'certificates'],
  provide: ['provide_categories', 'offers'], need: ['need_categories', 'seeks'],
};
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
  if (['type', 'provide', 'need'].includes(step)) {
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
