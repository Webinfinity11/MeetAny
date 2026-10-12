// Start the existing session read — and the caller's /api/db/bootstrap right behind it — while
// the browser downloads application scripts. Both are one-use in-memory responses; nothing is
// persisted or shared. The store re-checks that a preloaded bootstrap belongs to its caller.
// Before this, /bootstrap started only after hydration (~4.8 s on a throttled phone, ~1.2 s here).
// localStorage 'meetany.session' is only a hint (set by the store): without it the anonymous
// bootstrap starts at once, beside the session read, and is used only if that read finds no user.
export const SESSION_HINT_KEY = 'meetany.session';
export function sessionPreloadScript(authUrl) {
  if (!authUrl) return '';
  const endpoint = JSON.stringify(authUrl.replace(/\/+$/, '') + '/get-session').replaceAll('<', '\\u003c');
  return `try{const H={Accept:'application/json'},T=()=>AbortSignal.timeout(12000);
const boot=jwt=>fetch('/api/db/bootstrap',{headers:jwt?{...H,Authorization:'Bearer '+jwt}:H,signal:T()}).then(async r=>r.ok?await r.json():null);
let guest=null;try{if(localStorage.getItem('${SESSION_HINT_KEY}')!=='1')guest=boot(null).catch(()=>null);}catch{}
const s=window.__meetanySessionPreload=fetch(${endpoint},{credentials:'include',signal:T(),headers:H}).then(async r=>r.ok?{data:await r.json(),jwt:r.headers.get('set-auth-jwt')}:null).catch(e=>e.name==='TimeoutError'||e.name==='AbortError'?{error:'TIMEOUT'}:null);
window.__meetanyBootstrapPreload=s.then(r=>{if(!r||r.error)return null;const u=r.data&&r.data.user;if(u&&!r.jwt)return null;
return (u?boot(r.jwt):guest||boot(null)).then(d=>d?{sub:u?u.id:null,jwt:u?r.jwt:null,data:d}:null);}).catch(()=>null);}catch{}`;
}
