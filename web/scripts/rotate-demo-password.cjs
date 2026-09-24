#!/usr/bin/env node
// Rotate one demo account's password on Neon branch auth-probe only.
// Run: node site/web/scripts/rotate-demo-password.cjs --key web [--check]
// Signs in with the ledger password, calls Neon Auth /change-password (revoking other sessions),
// then rewrites DEMO-ACCOUNTS.local.md (table row + JSON state) after a .bak copy.
// --check only signs in with the ledger password. Passwords are never printed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, '..', 'DEMO-ACCOUNTS.local.md');
const LOCK = FILE + '.lock';
const ORIGIN = process.env.DEMO_API_ORIGIN || 'http://localhost:3000';
const CHECK = process.argv.includes('--check');
const KEY = process.argv[process.argv.indexOf('--key') + 1];
assert(process.argv.includes('--key') && KEY && !KEY.startsWith('--'), 'Usage: --key <account key>');
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
const AUTH = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, '');
assert.equal(AUTH, 'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth', 'Wrong Neon Auth branch');
assert.match(new URL(process.env.DATABASE_URL).hostname, /^ep-withered-glade-b54ts1g5(?:-pooler)?\./, 'Wrong database branch');
assert(['localhost', '127.0.0.1'].includes(new URL(ORIGIN).hostname), 'Use a local origin');

async function session(email, password) {
  const jar = new Map();
  async function auth(route, body) {
    const res = await fetch(AUTH + route, {method: 'POST', signal: AbortSignal.timeout(45000),
      headers: {'Content-Type': 'application/json', Origin: ORIGIN, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ')},
      body: JSON.stringify(body)});
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${route}: HTTP ${res.status} (${data?.code || 'request failed'})`);
    for (const c of res.headers.getSetCookie()) {const pair = c.split(';')[0]; const i = pair.indexOf('='); jar.set(pair.slice(0, i), pair.slice(i + 1));}
    return data;
  }
  await auth('/sign-in/email', {email, password});
  return auth;
}

async function main() {
  const fd = fs.openSync(LOCK, 'wx', 0o600); fs.closeSync(fd);
  try {
    const text = fs.readFileSync(FILE, 'utf8');
    const state = JSON.parse(text.match(/```json\n([\s\S]*?)\n```/)[1]);
    const old = state.accounts?.[KEY]?.password;
    assert(old, 'Unknown account key');
    const rows = text.split('\n').filter(l => l.startsWith('| ') && l.split(' | ')[2] === old);
    assert.equal(rows.length, 1, 'Ledger row not found');
    const email = rows[0].split(' | ')[1];
    const auth = await session(email, old);
    if (CHECK) return console.log('OK');
    const next = crypto.randomBytes(24).toString('base64url') + '!a9';
    const count = text.split(old).length - 1;
    assert.equal(count, 2, 'Password must appear once in the table and once in JSON');
    fs.copyFileSync(FILE, FILE + '.bak'); fs.chmodSync(FILE + '.bak', 0o600);
    await auth('/change-password', {currentPassword: old, newPassword: next, revokeOtherSessions: true});
    fs.writeFileSync(FILE, text.split(old).join(next), {mode: 0o600}); fs.chmodSync(FILE, 0o600);
    await session(email, next);
    console.log('OK');
  } finally {fs.unlinkSync(LOCK);}
}
main().catch(err => {console.error('როტაცია შეჩერდა:', err.message); process.exitCode = 1;});
