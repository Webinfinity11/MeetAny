#!/usr/bin/env node
// Only auth-probe: retain admin@gmail.com, demote other admins without deleting/blocking profiles.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Client } = require('@neondatabase/serverless');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, '..', 'DEMO-ACCOUNTS.local.md');
const LOCK = FILE + '.lock';
const NOTE = '(ადმინის როლი მოხსნილია 2026-09-29)';
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
assert.equal(process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, ''), 'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth', 'Wrong Neon Auth branch');
assert.match(new URL(process.env.DATABASE_URL).hostname, /^ep-withered-glade-b54ts1g5(?:-pooler)?\./, 'Wrong database branch');
assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DEMO_API_ORIGIN || 'http://localhost:3001').hostname), 'Use a local API connected to auth-probe');
async function main() {
  fs.closeSync(fs.openSync(LOCK, 'wx', 0o600));
  const db = new Client({connectionString:process.env.DATABASE_URL, connectionTimeoutMillis:10000});
  try {
    const ledger = fs.readFileSync(FILE, 'utf8');
    const state = JSON.parse(ledger.match(/```json\n([\s\S]*?)\n```/)[1]);
    const lines = ledger.split('\n');
    await db.connect();
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout = '10s'");
    await db.query('LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE');
    const {rows:before} = await db.query('select * from public.profiles order by id');
    assert.equal(before.filter(p=>p.email==='admin@gmail.com' && p.role==='admin').length,1,'Owner admin missing; run add-owner-accounts.cjs first');
    // Backup precedes the database mutation. On a ledger write failure, rerunning repairs its stale roles.
    fs.copyFileSync(FILE, FILE+'.bak'); fs.chmodSync(FILE+'.bak',0o600);
    const {rows:changed} = await db.query("update public.profiles set role='client' where role='admin' and email <> 'admin@gmail.com' returning id,email");
    const {rows:after} = await db.query('select * from public.profiles order by id');
    assert.deepEqual(after,before.map(p=>p.role==='admin' && p.email!=='admin@gmail.com'?{...p,role:'client'}:p),'Unexpected profile changes');
    assert.deepEqual(after.filter(p=>p.role==='admin').map(p=>p.email),['admin@gmail.com'],'Expected exactly one admin');
    const updatedKeys = [];
    for (const [key,account] of Object.entries(state.accounts)) {
      const profile = after.find(p=>p.id===account.id || (account.email && p.email===account.email));
      if (!profile || profile.email==='admin@gmail.com') continue;
      const i = lines.findIndex(line=>line.startsWith('| ') && line.split(' | ')[1]===profile.email);
      const cells = i>=0 ? lines[i].split(' | ') : null;
      const wasAdmin = changed.some(p=>p.id===profile.id) || account.role==='admin' || cells?.[3]?.replace(/\s*\|$/, '').trim()==='admin';
      if (!wasAdmin) continue;
      assert.equal(profile.role,'client','Ledger demotion target is not a client');
      const label = account.label || cells?.[0]?.slice(2) || profile.company || profile.email;
      account.label = label.includes(NOTE) ? label : label+' '+NOTE;
      account.email = profile.email; account.role = 'client';
      if (cells) {cells[0]='| '+account.label; cells[3]='client |'; lines[i]=cells.join(' | ');}
      updatedKeys.push(key);
    }
    const next = lines.join('\n').replace(/```json\n[\s\S]*?\n```/,()=> '```json\n'+JSON.stringify(state,null,2)+'\n```');
    await db.query('COMMIT');
    if (next!==ledger) {
      fs.writeFileSync(FILE+'.tmp',next,{mode:0o600}); fs.chmodSync(FILE+'.tmp',0o600);
      fs.renameSync(FILE+'.tmp',FILE);
    }
    console.log(JSON.stringify({changes:changed.length,emails:changed.map(p=>p.email),ledgerKeys:updatedKeys,admins:1,unrelatedProfileFieldsUnchanged:true,OK:true}));
  } catch (err) {
    await db.query('ROLLBACK').catch(()=>{});
    throw err;
  } finally {await db.end(); fs.unlinkSync(LOCK);}
}
main().catch(err=>{console.error('FAIL',err.code || (err.name==='AssertionError'?err.message.split('\n')[0]:'Single-admin operation failed'));process.exitCode=1;});
