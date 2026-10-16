/** Only a local absolute path may be used after authentication. */
export function safeNext(value) {
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(value))return null;
 try {const url=new URL(value,'https://meetany.invalid');return url.origin==='https://meetany.invalid'?url.pathname+url.search+url.hash:null;}catch{return null;}
}

/** Role is registration data, never an implicit authentication mode. */
export function authMode(tab) { return tab === 'register' ? 'register' : tab === 'reset' ? 'reset' : 'login'; }
export function authLoginCopy(intent, context, next) {
 return intent === 'offer'
  ? {title: 'შედით, რომ გაგზავნოთ შეთავაზება', lead: typeof context === 'string' ? Array.from(context).slice(0, 120).join('') : ''}
  : {title: next ? 'შედით, რომ გააგრძელოთ' : 'შესვლა', lead: 'კეთილი იყოს თქვენი დაბრუნება.'};
}

/** Keep the original task through company setup without sending completion back into setup. */
export function safeOnboardingNext(value) {
 let candidate = safeNext(value);
 for (let depth = 0; candidate && depth < 3; depth++) {
  const url = new URL(candidate, 'https://meetany.invalid');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '').toLowerCase(); } catch { return null; }
  if (pathname !== '/onboarding') return candidate;
  candidate = safeNext(url.searchParams.get('next'));
 }
 return null;
}
/** @param {string} [step] @param {string | null} [next] */
export function onboardingHref(step = 'type', next = null) {
 const params = new URLSearchParams({step});
 const destination = safeOnboardingNext(next);
 if (destination) params.set('next', destination);
 return '/onboarding/?' + params.toString();
}
