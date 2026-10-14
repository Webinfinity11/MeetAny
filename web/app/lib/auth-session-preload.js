export const SESSION_HINT_KEY = 'meetany.session';
export const GUEST_SESSION_TTL = 300000;
// Self-contained so the early inline script and hydrated store use exactly the same cache.
export function createSessionCache(env, endpoint) {
  const key = 'meetany.session.v1', syncKey = key + '.revision';
  let memory = null, bridge = null, task = null, revision = 0, timer = null, cancelRetry = null;
  const listeners = new Set();
  const get = (storage, k) => { try { return env[storage].getItem(k); } catch { return null; } };
  const remove = () => { memory = null; try { env.sessionStorage.removeItem(key); } catch {} };
  const exp = value => { try { return Number(JSON.parse(env.atob(value.jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp) * 1000 || 0; } catch { return 0; } };
  function read(margin = 60000) {
    let value = memory;
    if (!value) { try { value = JSON.parse(get('sessionStorage', key)); } catch {} }
    if (!value || value.endpoint !== endpoint || value.generation !== get('localStorage', syncKey) || (value.guest ? !(value.until > Date.now()) : !value.data?.user || exp(value) <= Date.now() + margin)) { remove(); return null; }
    memory = value;
    return value;
  }
  function write(value) {
    if (!value?.data) return;
    if (!value.data.user) {
      // A late guest response must not replace a valid signed-in session.
      if (read(0)?.data?.user) return;
      memory = { guest: true, until: Date.now() + 300000, endpoint, generation: get('localStorage', syncKey), data: { user: null, session: null }, jwt: null };
    } else {
      if (exp(value) <= Date.now() + 60000) return;
      memory = { ...value, endpoint, generation: get('localStorage', syncKey) };
    }
    try { env.sessionStorage.setItem(key, JSON.stringify(memory)); } catch {}
  }
  function invalidate(broadcast = false) {
    revision++; task = null; bridge = null; remove();
    if (timer !== null) { env.clearTimeout(timer); timer = null; }
    if (cancelRetry) { cancelRetry(null); cancelRetry = null; }
    delete env.__meetanySessionPreload; delete env.__meetanyBootstrapPreload;
    if (broadcast) { try { env.localStorage.setItem(syncKey, Date.now() + ':' + Math.random()); } catch {} }
  }
  env.addEventListener?.('storage', event => {
    if (event.key !== syncKey && event.key !== null) return;
    invalidate(); listeners.forEach(fn => fn());
  });
  function rateError() {
    return Object.assign(new Error('ძალიან ბევრი მცდელობა — სცადეთ წუთში'), { status: 429, userMessage: 'ძალიან ბევრი მცდელობა — სცადეთ წუთში' });
  }
  function load() {
    const fallback = read(0);
    const cached = read();
    if (cached) return Promise.resolve(cached);
    if (task) return bridge && exp(bridge) > Date.now() ? Promise.resolve(bridge) : task;
    // Within the safety minute a still-valid JWT can bridge a rate-limited refresh.
    const version = revision;
    const request = async retry => {
      const response = await env.fetch(endpoint, { credentials: 'include', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
      if (version !== revision) return null;
      if (response.status === 429) {
        if (retry) throw rateError();
        const delayed = new Promise((resolve, reject) => {
          cancelRetry = resolve;
          timer = env.setTimeout(() => { timer = null; cancelRetry = null; request(true).then(resolve, reject); }, 30000);
        });
        task = delayed;
        delayed.then(() => { if (task === delayed) task = null; }, () => { if (task === delayed) task = null; });
        if (fallback && exp(fallback) > Date.now()) { bridge = fallback; return fallback; }
        throw rateError();
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error(data?.message || 'Auth request failed'), { status: response.status, code: data?.code });
      const value = data?.user ? { data, jwt: response.headers.get('set-auth-jwt') } : { data: { user: null, session: null }, jwt: null };
      if (version === revision) { bridge = null; write(value); }
      return value;
    };
    const pending = request(false);
    task = pending;
    pending.then(() => { if (task === pending) task = null; }, () => { if (task === pending) task = null; });
    return pending;
  }
  return { read, write, load, invalidate, subscribe: fn => listeners.add(fn) };
}
export function browserSessionCache(endpoint) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return null;
  return window.__meetanySessionCache ||= createSessionCache(window, endpoint);
}
export function sessionPreloadScript(authUrl) {
  if (!authUrl) return '';
  const endpoint = JSON.stringify(authUrl.replace(/\/+$/, '') + '/get-session').replaceAll('<', '\\u003c');
  return `try{const H={Accept:'application/json'},T=()=>AbortSignal.timeout(12000);
const detail=['/requests/view','/companies/view'].includes((window.location?.pathname||'').replace(/\\/$/,''));
const boot=jwt=>detail?Promise.resolve(null):fetch('/api/db/bootstrap',{headers:jwt?{...H,Authorization:'Bearer '+jwt}:H,signal:T()}).then(async r=>r.ok?await r.json():null);
let guest=null;try{if(localStorage.getItem('${SESSION_HINT_KEY}')!=='1')guest=boot(null).catch(()=>null);}catch{}
const cache=window.__meetanySessionCache||=(${createSessionCache.toString()})(window,${endpoint});
const s=window.__meetanySessionPreload=cache.load().catch(e=>e.status===429?{error:'RATE_LIMIT'}:e.name==='TimeoutError'||e.name==='AbortError'?{error:'TIMEOUT'}:null);
window.__meetanyBootstrapPreload=s.then(r=>{if(!r||r.error)return null;const u=r.data&&r.data.user;if(u&&!r.jwt)return null;
return (u?boot(r.jwt):guest||boot(null)).then(d=>d?{sub:u?u.id:null,jwt:u?r.jwt:null,data:d}:null);}).catch(()=>null);}catch{}`;
}
