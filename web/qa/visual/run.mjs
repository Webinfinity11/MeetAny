import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import nextEnv from '@next/env';
import { pages, masks, viewports } from './pages.mjs';
import { guard, go, shot } from './lib/browser.mjs';
import { compare } from './lib/compare.mjs';

const root = path.resolve(import.meta.dirname, '../..');
nextEnv.loadEnvConfig(root, true, { info() {}, error() {} });
assert(new URL(process.env.DATABASE_URL).hostname.startsWith('ep-withered-glade-b54ts1g5'), 'მხოლოდ auth-probe ბაზაა დაშვებული');
const origin = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'მხოლოდ ლოკალური სერვერი');
const args = process.argv.slice(2), update = args.includes('--update');
assert(args.every((arg, i) => ['--update', '--only'].includes(arg) || args[i - 1] === '--only'), 'უცნობი არგუმენტი');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
assert(!args.includes('--only') || pages.some(p => p.id === only), '--only მოითხოვს ზუსტ page id-ს pages.mjs-დან');
const selected = pages.filter(p => !only || p.id === only);
const baseline = path.join(root, 'qa/shots/visual-baseline'), diff = path.join(root, 'qa/shots/visual-diff');
fs.mkdirSync(baseline, { recursive: true }); fs.mkdirSync(diff, { recursive: true });
const manifestPath = path.join(baseline, 'manifest.json');
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)) : null;
assert(update || previous, 'ჯერ გაუშვი npm run visual:baseline');
const ledgerPath = [path.join(root, '../DEMO-ACCOUNTS.local.md'), path.join(root, 'DEMO-ACCOUNTS.local.md')].find(f => fs.existsSync(f));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const secrets = Object.values(ledger.accounts).map(a => a.password).filter(Boolean);
const safe = value => secrets.reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value));
const routes = update ? {} : { ...previous?.routes };
const results = [], safety = [], errors = [];
const sourceStatus = () => execFileSync('git', ['status', '--porcelain', '--', 'app', 'public', 'next.config.ts', 'next.config.mjs'], { cwd: root, encoding: 'utf8' }).trim();
assert(!update || !sourceStatus(), 'baseline-ისთვის ჯერ დააკომიტეთ აპის ცვლილებები');
const sourceFingerprint = () => {
  const paths = ['app', 'public', 'next.config.ts', 'next.config.mjs'];
  const hash = createHash('sha256').update(execFileSync('git', ['diff', '--binary', 'HEAD', '--', ...paths], { cwd: root, maxBuffer: 64 * 1024 * 1024 }));
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z', '--', ...paths], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).sort();
  for (const file of untracked) hash.update(file).update(fs.readFileSync(path.join(root, file)));
  return hash.digest('hex');
};
// Diff must work on a local refactor before it is committed, while still detecting
// concurrent edits during the run. Baseline updates require a committed app revision.
const sourceHash = sourceFingerprint();
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const staging = update ? fs.mkdtempSync(path.join(baseline, '.pending-')) : null;
const discardStaging = () => { if (staging) fs.rmSync(staging, { recursive: true, force: true }); };
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
process.once('SIGINT', async () => { await browser.close(); discardStaging(); process.exit(130); });
process.once('SIGTERM', async () => { await browser.close(); discardStaging(); process.exit(143); });
const appBaselineHead = execFileSync('git', ['log', '-1', '--format=%H', '--', 'app', 'public'], { cwd: root, encoding: 'utf8' }).trim();
const manifest = { ...previous, head, appBaselineHead, chrome: browser.version(), origin, viewports, masks, routes, captures: only ? { ...previous?.captures } : {} };
async function login(p, role) {
  await go(p, origin, '/account/');
  await p.locator('#login-email').fill(ledger.accounts[role].email || `demo-${role}@meetany.ge`);
  await p.locator('#login-password').fill(ledger.accounts[role].password);
  await p.locator('form button[type="submit"]').click();
  await p.locator('#login-email').waitFor({ state: 'detached', timeout: 60000 });
  await p.waitForLoadState('networkidle');
}
try {
  for (const role of [...new Set(selected.map(p => p.role))]) {
    console.log(`როლი: ${role}`);
    const context = await browser.newContext({ viewport: viewports[0], reducedMotion: 'reduce', locale: 'ka-GE', timezoneId: 'Asia/Tbilisi', deviceScaleFactor: 1, serviceWorkers: 'block' });
    const state = { blocked: [], interceptions: 0, chat: null, conversations: [], adminPages: {} };
    await guard(context, state);
    const p = await context.newPage();
    p.on('pageerror', error => errors.push(safe(error.message)));
    p.on('response', async response => {
      const rpc = new URL(response.url()).pathname.split('/').pop();
      if (['admin_list_audit', 'admin_contact_events'].includes(rpc) && response.ok()) {
        try { state.adminPages[rpc] = await response.json(); } catch { /* Context closed. */ }
      }
      if (new URL(response.url()).pathname === '/api/db/rpc/list_my_conversations' && response.ok()) {
        try { state.conversations = await response.json(); } catch { /* Context may close after screenshot. */ }
      }
    });
    if (role !== 'guest') await login(p, role);
    const needs = selected.filter(def => def.role === role).map(def => def.route);
    if (needs.includes('request') && !routes.request) {
      await go(p, origin, '/requests/');
      routes.request = await p.locator('.request-card:not(.ma-rcard--closed) .card-main-link').first().getAttribute('href');
    }
    if (needs.includes('company') && !routes.company) {
      await go(p, origin, '/companies/'); routes.company = await p.locator('.card-main-link').first().getAttribute('href');
    }
    if (needs.includes('ownRequest') && !routes.ownRequest) {
      await go(p, origin, '/account/'); routes.ownRequest = await p.locator('.account-row__link').first().getAttribute('href');
    }
    if (needs.includes('offerRequest') && !routes.offerRequest) {
      await go(p, origin, '/requests/');
      const links = await p.locator('.request-card:not(.ma-rcard--closed) .card-main-link').evaluateAll(els => els.map(el => el.getAttribute('href')));
      for (const href of links) {
        await go(p, origin, href);
        await p.waitForFunction(() => document.querySelector('#of-body') || document.querySelector('main')?.innerText.includes('შენი შეთავაზება') || document.querySelector('main')?.innerText.includes('მოთხოვნა შეთავაზებებს აღარ იღებს'), null, { timeout: 15000 });
        if (await p.locator('#of-body').count()) { routes.offerRequest = href; break; }
      }
      assert(routes.offerRequest, 'შეთავაზების ფორმიანი მოთხოვნა ვერ მოიძებნა');
    }
    if (needs.includes('chatRequest')) {
      await go(p, origin, '/account/?tab=messages');
      await p.locator('.inbox-row').first().waitFor({ timeout: 60000 });
      state.chat = state.conversations.find(c => c.id === routes.chatConversation) || state.conversations.find(c => c.request_id);
      assert(state.chat?.request_id, 'კომპანიის არსებული მოთხოვნის საუბარი ვერ მოიძებნა');
      routes.chatConversation = state.chat.id;
      routes.chatRequest = `/requests/view/?id=${state.chat.request_id}`;
    }
    for (const def of selected.filter(def => def.role === role)) {
      if (role === 'owner_admin') routes[def.id] = def.route;
      for (const viewport of viewports) {
        assert(sourceFingerprint() === sourceHash && execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() === head, 'გადაღებისას რევიზია შეიცვალა; baseline/diff თავიდან გაუშვით');
        const key = `${def.id}-${viewport.width}`;
        console.log(`გადაღება: ${key}`);
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await p.setViewportSize(viewport);
            await go(p, origin, routes[def.id] || (def.route.startsWith('/') ? def.route : routes[def.route]));
            if (def.ready) await p.locator(def.ready).first().waitFor({ timeout: 60000 });
            if (def.action === 'conversation') {
              await p.locator('.inbox-row').first().click();
              await p.locator('.inbox-thread textarea').waitFor({ timeout: 30000 });
            }
            if (def.action === 'offer') await p.locator('#of-body').waitFor();
            if (def.action === 'chat-list') {
              await p.locator('.ma-chat-launcher').click();
              await p.locator('.ma-chat-list__row').first().click();
              await p.locator('#ma-chat-body').waitFor();
            }
            if (def.action === 'chat') {
              await p.getByRole('button', { name: 'მიწერა', exact: true }).first().click();
              await p.locator('.ma-chat').waitFor();
              await p.waitForFunction(() => !document.querySelector('.ma-chat [role="status"]'), null, { timeout: 60000 });
            }
            assert.equal(state.blocked.length, 0, `დაბლოკილი ჩაწერა: ${state.blocked.join(', ')}`);
            const file = path.join(baseline, `${key}.png`), current = path.join(diff, `${key}.current.png`);
            const size = await shot(p, update ? path.join(staging, `${key}.png`) : current, viewport);
            assert.equal(state.blocked.length, 0, `დაბლოკილი ჩაწერა: ${state.blocked.join(', ')}`);
            if (update) { manifest.captures[key] = { ...size, head }; results.push({ page: def.id, viewport: viewport.width, percent: 0, pass: true, baseline: true }); }
            else {
              assert(fs.existsSync(file), `baseline აკლია: ${key}`);
              const result = compare(file, fs.readFileSync(current), path.join(diff, `${key}.png`));
              fs.rmSync(current);
              results.push({ page: def.id, viewport: viewport.width, ...result });
              console.log(`${key}: ${result.percent.toFixed(5)}% ${result.pass ? 'PASS' : 'FAIL'}`);
            }
            break;
          } catch (error) {
            if (attempt || state.blocked.length || error.navigationRetried) throw error;
            console.log(`გადაღების გამეორება: ${key}`);
          }
        }
      }
    }
    safety.push({ role, blocked: state.blocked, startConversationInterceptions: state.interceptions });
    await context.close();
  }
  assert(!errors.length, `pageerror: ${errors.join('; ')}`);
  if (update) {
    assert(sourceFingerprint() === sourceHash && execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() === head, 'გადაღებისას რევიზია შეიცვალა');
    for (const file of fs.readdirSync(staging)) fs.renameSync(path.join(staging, file), path.join(baseline, file));
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
} catch (error) {
  errors.push(safe(error.message));
  console.error(safe(error.stack || error.message)); process.exitCode = 1;
} finally {
  await browser.close();
  discardStaging();
  for (const def of selected) for (const viewport of viewports) fs.rmSync(path.join(diff, `${def.id}-${viewport.width}.current.png`), { force: true });
  console.table(results.map(r => ({ გვერდი: r.page, viewport: r.viewport, '%': r.percent.toFixed(5), შედეგი: r.pass ? 'PASS' : 'FAIL' })));
  fs.writeFileSync(path.join(update ? baseline : diff, only ? `report-${only}.json` : 'report.json'), JSON.stringify({ head, sourceHash, baselineHead: update ? head : previous?.head, update, only, results, safety, errors, complete: !process.exitCode && results.length === selected.length * viewports.length }, null, 2) + '\n');
  if (results.some(r => !r.pass)) process.exitCode = 1;
}
