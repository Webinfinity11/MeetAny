// Start the existing session read while the browser downloads application scripts.
// This is a one-use in-memory response; no credentials are persisted or shared.
export function sessionPreloadScript(authUrl) {
  if (!authUrl) return '';
  const endpoint = JSON.stringify(authUrl.replace(/\/+$/, '') + '/get-session').replaceAll('<', '\\u003c');
  return `window.__meetanySessionPreload=fetch(${endpoint},{credentials:'include',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}}).then(async r=>r.ok?{data:await r.json(),jwt:r.headers.get('set-auth-jwt')}:null).catch(e=>e.name==='TimeoutError'||e.name==='AbortError'?{error:'TIMEOUT'}:null);`;
}
