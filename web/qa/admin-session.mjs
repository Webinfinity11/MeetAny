// Local QA only. Reuse one private browser session per role across admin checks.
import fs from 'node:fs';
process.env.QA_ORIGIN = process.env.BASE || 'http://localhost:3003';
const { login, rpc, token } = await import('./e2e/lib.mjs');
export { token };
export async function adminSession(browser, key) {
  const file = `/tmp/meetany-walk-b-${key}.json`;
  const context = await browser.newContext({ ...(fs.existsSync(file) ? { storageState: file } : {}), viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const me = fs.existsSync(file) ? (await rpc(page, 'my_profile'))[0] : null;
  if (!me) await login(page, key);
  await context.storageState({ path: file });
  fs.chmodSync(file, 0o600);
  return { context, page };
}
