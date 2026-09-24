#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { root, origin, guard, safe, Scenario, query, demoSnapshotIds, atomicJson, assert } from './lib.mjs';

const names = ['guest', 'registration', 'company', 'messaging', 'client', 'choose', 'admin', 'moderation', 'permissions'];
const labels = { guest: 'სტუმარი', registration: 'რეგისტრაცია / აღდგენა', company: 'კომპანია — პროფილი', messaging: 'კომპანია / კლიენტი — ჩატი', client: 'კლიენტი — მოთხოვნა', choose: 'კლიენტი — შეთავაზების არჩევა', admin: 'ადმინი — მომხმარებლები', moderation: 'ადმინი — მოთხოვნები / კონტაქტები', permissions: 'უფლებები' };
fs.mkdirSync(path.join(root, 'qa/shots/e2e'), { recursive: true });
function write(file, data) { atomicJson(path.join(root, file), data); }

async function worker(name, run) {
  guard(); assert(names.includes(name), 'უცნობი სცენარი'); const start = Date.now();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const t = new Scenario(browser, name, run); t.persist();
  t.checkpoint = () => write(`qa/e2e/${name}.json`, { name, run, label: labels[name], status: 'RUNNING', ms: Date.now() - start, steps: t.steps, cleanup: t.cleanupLog, counts: t.counts });
  let timer;
  try {
    await Promise.race([
      import(`./scenarios/${name}.mjs`).then(m => m.default(t)),
      new Promise((_, reject) => { timer = setTimeout(() => { t.stopped = true; reject(new Error('სცენარის სამუშაო დრო ამოიწურა (75 წმ; დარჩენილი დრო cleanup-სთვის)')); }, 75000); }),
    ]);
  } catch (e) {
    t.steps.push({ name: 'სცენარის შესრულება', status: 'FAIL', actual: safe(e.message), screenshot: await t.shot() });
  } finally {
    clearTimeout(timer);
    await t.step('CSP დარღვევები', 'ბრაუზერში securitypolicyviolation რაოდენობა 0', async () => {
      assert.equal(t.cspViolations.length, 0, safe(JSON.stringify(t.cspViolations)));
      return { violations: 0 };
    });
    // Stop further UI work before cleanup on timeout; ordinary runs keep authenticated contexts.
    if (t.stopped) await Promise.allSettled(t.contexts.map(c => c.close()));
    try { await t.cleanup(); }
    catch (e) { t.cleanupLog.push({ status: 'FAIL', reason: safe(e.message) }); }
    await browser.close();
  }
  const fail = t.steps.some(s => s.status === 'FAIL') || t.cleanupLog.some(s => s.status === 'FAIL' || s.restore === 'FAIL');
  const report = { name, run, label: labels[name], status: fail ? 'FAIL' : 'PASS', ms: Date.now() - start, steps: t.steps, cleanup: t.cleanupLog, counts: t.counts };
  write(`qa/e2e/${name}.json`, report);
}

async function runProcess(args, timeout, extraEnv = {}) {
  return await new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', killed = false;
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, timeout);
    child.on('error', e => { clearTimeout(timer); resolve({ code: -1, output: safe(e.message), killed }); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, output: safe(output), killed }); });
  });
}
async function snapshot() {
  assert(demoSnapshotIds.requests.length > 0 && demoSnapshotIds.profiles.length > 0, 'v2 seed-ის ID-ები არ არსებობს');
  return await query(`select 'profiles' kind, to_jsonb(p) row from public.profiles p where id=any($1::uuid[])
    union all select 'requests',to_jsonb(r) from public.requests r where id=any($2::uuid[])
    union all select 'offers',to_jsonb(o) from public.offers o where request_id=any($2::uuid[])
    order by 1,2`, [demoSnapshotIds.profiles, demoSnapshotIds.requests]);
}
async function main() {
  guard(); const startedAt = new Date().toISOString(), start = Date.now();
  const run = Date.now().toString(); const results = [];
  write('qa/e2e/report.json', {status:'RUNNING',run,startedAt,origin,results});
  const before = await snapshot();
  write('qa/e2e/demo-before.json', before);
  let suiteCleanup;
  try {
  for (const name of names) {
    const file = path.join(root, `qa/e2e/${name}.json`); fs.rmSync(file, { force: true });
    if (Date.now() - start > 535000) { results.push({name, label:labels[name], status:'FAIL', ms:0, steps:[{name:'ჯამური დროის ლიმიტი',status:'FAIL',actual:'შემდეგი ქვეკეისი აღარ დაიწყო; seed verify-სთვის დარჩა დრო'}],cleanup:[]}); continue; }
    const scenarioStarted = Date.now();
    for (const shot of fs.readdirSync(path.join(root, 'qa/shots/e2e'))) {
      if (shot === name + '.png' || shot.startsWith(name + '-') && shot.endsWith('.png')) fs.rmSync(path.join(root, 'qa/shots/e2e', shot));
    }
    const result = await runProcess(['qa/e2e/run.mjs', '--worker', name, `${run}-${name}`], 89000);
    const row = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { name, label: labels[name], status: 'FAIL', steps: [{ name: 'გამშვები', status: 'FAIL', actual: result.killed ? '89 წმ ლიმიტი; cleanup ვერ დადასტურდა' : result.output.slice(-2000) }], cleanup: [] };
    if (row.status === 'RUNNING') { row.status = 'FAIL'; row.steps.push({name:'გამშვები',status:'FAIL',actual:'პროცესი ლიმიტზე შეწყდა; cleanup ვერ დადასტურდა'}); }
    row.ms = Date.now() - scenarioStarted;
    results.push(row); write('qa/e2e/report.json', {status:'RUNNING',run,startedAt,origin,results}); console.log(`${row.status} ${name}: ${row.steps.filter(s => s.status === 'FAIL').map(s => s.name + ': ' + s.actual.split('\n')[0]).join('; ') || 'ყველა შემოწმება შესრულდა'}`);
  }
  } finally {
    suiteCleanup = await runProcess(['qa/e2e/cleanup.mjs', '--run-id', run], Math.max(1000, Math.min(45000, 710000 - (Date.now() - start))));
  }
  const after = await snapshot();
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  write('qa/e2e/demo-after.json', after);
  const verification = await runProcess(['scripts/seed-demo-v2.cjs', '--verify'], Math.max(1000, 715000 - (Date.now() - start)), { DEMO_API_ORIGIN: origin });
  const report = { startedAt, origin, run, ms: Date.now() - start, results, suiteCleanup, demoRowsUnchanged: unchanged, seedVerify: { status: verification.code === 0 ? 'PASS' : 'FAIL', ...verification }, contractFindings: ['წინასწარ API-ზე delete_request საუბარს request_id=NULL-ით ტოვებდა. ახალი მიგრაციის შედეგი მოწმდება messaging ქვეკეისში; ცალკე SQL cleanup ორივე მდგომარეობას ამუშავებს.', 'contact_events GET არ არის გამოქვეყნებული; შემოწმება იყენებს admin_contact_events RPC-სა და ადმინის UI-ს.'] };
  write('qa/e2e/report.json', report);
  const cell = s => String(s || '').replaceAll('|', '\\|').replaceAll('\n', ' ');
  const table = results.map(r => `| ${r.label} | ${r.status} | ${cell(r.steps.filter(s => s.status === 'FAIL').map(s => s.name + ': ' + s.actual.split('\n')[0]).join('; ') || 'ყველა ნაბიჯი შესრულდა')} | ${(r.ms / 1000).toFixed(1)} წმ |`).join('\n');
  const details = results.map(r => `## ${r.label}\n\n` + r.steps.map(s => `- **${s.status} — ${s.name}**. მოსალოდნელი: ${s.expected || 'სცენარის დასრულება'}. ${s.actual ? 'რეალური: ' + cell(s.actual) : s.evidence ? cell(JSON.stringify(s.evidence)) : 'შემოწმება შესრულდა.'}${s.screenshot ? ` [კადრი](../${s.screenshot.replace(/^qa\//, 'qa/')})` : ''}`).join('\n') + '\n\nCleanup: `' + cell(JSON.stringify(r.cleanup)) + '`' + (r.counts ? '\n\nT4.4: `' + JSON.stringify(r.counts) + '`' : '')).join('\n\n');
  fs.writeFileSync(path.join(root, 'qa/E2E-GE.md'), safe(`# MeetAny — E2E\n\nგაშვება: \`npm run e2e\`; სურვილისამებრ \`QA_ORIGIN=http://localhost:3001\`. Chrome: \`QA_BROWSER_PATH\` ან macOS Google Chrome. მხოლოდ auth-probe; სხვა ჰოსტი უარყოფილია. პაროლები ledger-იდან მხოლოდ მეხსიერებაში იკითხება; trace/video არ იწერება.\n\nთარიღი: ${startedAt}. ხანგრძლივობა: ${(report.ms / 1000).toFixed(1)} წმ. თითო სცენარის სრული ლიმიტი 89 წმ (სამუშაო 75 წმ + cleanup). ჩავარდნა შემდეგ სცენარს არ აჩერებს.\n\n| სცენარი | PASS/FAIL | მიზეზი | დრო |\n|---|---|---|---|\n${table}\n\nSeed --verify: **${report.seedVerify.status}**. Cleanup CLI: **${suiteCleanup.code === 0 ? 'PASS' : 'FAIL'}**. დემო profiles/requests/offers ზუსტი before/after შედარება: **${unchanged ? 'უცვლელია' : 'შეიცვალა — იხ. report.json'}**.\n\n\`\`\`json\n${verification.output.trim()}\n\`\`\`\n\n## საზღვრები და cleanup\n\n- რეგისტრაციის ანგარიშები admin RPC-ით იბლოკება; არასრული signup ზუსტი email+ID-ით იშლება. დაბლოკილი ანგარიშები და უცვლელი მოდერაციის audit ისტორია რჩება განზრახ.\n- ხელით აღდგენა: \`node qa/e2e/cleanup.mjs --run-id <id>\` (ჯერ \`--dry-run\`). ზუსტი ID-ები და \`[e2e:<runId>]\` მარკერი ინახება \`qa/e2e/runs/\`-ში. გამშვები cleanup-ს ბოლოსაც იძახებს.\n- მოთხოვნა/შეთავაზება/ფოტო, ჩატი და ამ ბრაუზერის მიერ დაბრუნებული contact-event ID-ები finally-ში იშლება. ჩატამდე SELECT count; DELETE messages → conversations; დარჩენილი ჩანაწერები მოწმდება. არსებული დემო საუბრები არ იცვლება.\n- გრძელი ნაკადები იყოფა დამოუკიდებელ ქვეკეისებად, საკუთარი fixture-ით და cleanup-ით: კომპანიის პროფილი / ჩატი, კლიენტის მოთხოვნა / არჩევა. არჩევის ქვეკეისში კომპანია ჯერ აგზავნის შეთავაზებას. დახურვა მოწმდება არჩევამდე, რადგან არჩეულ მოთხოვნას UI აღარ ხურავს.\n- ${report.contractFindings.join('\n- ')}\n- ელფოსტის გარეშე სწორი OTP და წარმატებული password reset არ მოწმდება; მხოლოდ ხელმისაწვდომი UI ეტაპები და უარყოფა.\n\n${details}\n`));
  console.log(`seed --verify: ${report.seedVerify.status}; demo unchanged: ${unchanged}; ${(report.ms/1000).toFixed(1)} წმ`);
  process.exitCode = results.every(r => r.status === 'PASS') && unchanged && suiteCleanup.code === 0 && verification.code === 0 ? 0 : 1;
}
if (process.argv[2] === '--worker') await worker(process.argv[3], process.argv[4]);
else await main().catch(e => {
  const error = safe(e.message);
  let report = {};
  try { report = JSON.parse(fs.readFileSync(path.join(root, 'qa/e2e/report.json'), 'utf8')); } catch {}
  write('qa/e2e/report.json', {...report,status:'FAIL',runnerError:error});
  fs.writeFileSync(path.join(root, 'qa/E2E-GE.md'), '# MeetAny — E2E\n\nგამშვები ვერ დასრულდა: ' + error + '\n\nნაწილობრივი შედეგები და cleanup: [report.json](e2e/report.json).\n');
  console.error(error); process.exitCode = 1;
});
