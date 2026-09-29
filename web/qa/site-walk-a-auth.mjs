// Reuse a real, unexpired anonymous token in this audit process only. Repeated
// full-document navigations otherwise exhaust Neon Auth's anonymous-token quota.
// User sessions always come from storageState and reach the real auth service.
let cached;
let pending;
export async function reuseAnonymousToken(context) {
  await context.route('**/token/anonymous', async route => {
    if (!cached || cached.until < Date.now() + 60000) {
      pending ||= route.fetch().then(async response => {
        if (!response.ok()) return null;
        const json = await response.json();
        const expiry = Number(json.expires_at);
        const claims = JSON.parse(Buffer.from(json.token.split('.')[1], 'base64url'));
        return {json, until: expiry > 1e12 ? expiry : (expiry || Number(claims.exp)) * 1000};
      }).finally(() => {pending = null;});
      cached = await pending;
    }
    if (cached) await route.fulfill({json: cached.json});
    else await route.continue();
  });
}
