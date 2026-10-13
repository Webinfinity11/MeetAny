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
