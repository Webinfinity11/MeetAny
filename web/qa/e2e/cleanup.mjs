#!/usr/bin/env node
// Manual recovery: node qa/e2e/cleanup.mjs --run-id <suite-or-scenario-id> [--dry-run]
// Only durable manifests from this runner are accepted. No broad time/email-prefix DELETE.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assert, branch, guard, journalDir, markerFor, validateRunId, Scenario, query, safe } from './lib.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readManifests(run) {
  validateRunId(run); guard();
  const files = fs.existsSync(journalDir) ? fs.readdirSync(journalDir).filter(f => f === run + '.json' || f.startsWith(run + '-') && f.endsWith('.json')) : [];
  return files.map(file => {
    const m = JSON.parse(fs.readFileSync(path.join(journalDir, file), 'utf8'));
    assert.equal(m.version, 1); assert.equal(m.branch, branch); validateRunId(m.run);
    assert.equal(file, m.run + '.json'); assert.equal(m.marker, markerFor(m.run));
    for (const key of ['requests', 'offers', 'messages', 'conversations', 'accounts', 'contacts']) assert(Array.isArray(m[key]) && m[key].every(id => uuid.test(id)), 'არასწორი ID სია: ' + key);
    assert(Array.isArray(m.photos) && Array.isArray(m.restores) && Array.isArray(m.emails));
    assert(m.emails.every(email => email.startsWith(`e2e+${m.run}-`) && email.endsWith('@meetany.local')));
    assert(m.restores.every(r => uuid.test(r.id) && /^demo-[a-z]+@meetany\.ge$/.test(r.email)));
    return m;
  });
}
export async function cleanupRun(run, { dryRun = false } = {}) {
  guard();
  const manifests = readManifests(run);
  assert(manifests.length, 'ამ run-id-ის ჟურნალი ვერ მოიძებნა; ცვლილებები არ შესრულდა');
  const results = [];
  // Keep independent manifests recoverable when one cannot be cleaned.
  for (const m of manifests) {
    try {
      if (dryRun) {
        const rows = await query('select count(*)::int requests from public.requests where position($1 in title)>0', [m.marker]);
        results.push({ run: m.run, status: 'DRY RUN', ...rows[0], recordedRequestIds: m.requests.length, recordedContactIds: m.contacts.length, cleaned: m.cleaned });
        continue;
      }
      if (m.cleaned) { results.push({ run: m.run, status: 'PASS', alreadyClean: true }); continue; }
      const t = new Scenario(null, m.name, m.run);
      // Do not overwrite the durable journal while loading it.
      const journalFile = t.journalFile; t.journalFile = null;
      for (const key of ['requests', 'offers', 'messages', 'conversations', 'accounts', 'contacts', 'photos', 'emails']) for (const item of m[key]) t[key].add(item);
      t.restores = m.restores; t.cleanupLog = m.cleanupLog || []; t.journalFile = journalFile;
      await t.cleanup();
      results.push({ run: m.run, status: 'PASS', cleanup: t.cleanupLog });
    } catch (e) { results.push({ run: m.run, status: 'FAIL', reason: safe(e.message) }); }
  }
  return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const index = process.argv.indexOf('--run-id');
  try {
    assert(index > 0, 'გამოყენება: node qa/e2e/cleanup.mjs --run-id <id> [--dry-run]');
    const results = await cleanupRun(process.argv[index + 1], { dryRun: process.argv.includes('--dry-run') });
    console.log(safe(JSON.stringify({ branch, results }, null, 2)));
    process.exitCode = results.some(r => r.status === 'FAIL') ? 1 : 0;
  } catch (e) { console.error(safe(e.message)); process.exitCode = 1; }
}
