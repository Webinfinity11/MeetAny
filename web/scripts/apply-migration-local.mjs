// Only the local preview database. Never reads DATABASE_URL or prints connection details.
import fs from 'node:fs';

const plans = {
  'offer-terms': { tables: [], routines: ['set_offer_terms(uuid,text,date,text[],timestamptz)', 'compare_offers(uuid)'] },
  deals: { tables: ['deals', 'deal_events'], routines: ['select_offer_deal(uuid,timestamptz)', 'get_deal(uuid)', 'propose_deal_terms(uuid,integer,numeric,numeric,text,integer,date,text,text,text[])', 'advance_deal(uuid,text,integer)', 'confirm_deal_terms(uuid,integer)', 'rate_deal(uuid,integer,text,integer)'] },
  'contact-visibility': { tables: [], routines: ['get_deal_contact(uuid)', 'contact_for_request(uuid)', 'log_contact_event(text,uuid,text,text)'] },
  matching: { tables: [], routines: ['set_matching_categories(text[],text[])', 'list_matching(uuid,text,integer,integer)'] },
  onboarding: { tables: [], routines: ['set_onboarding_details(text,text,integer,text[],text[],text,text,text,text,text,text[],text[])', 'admin_set_document_status(uuid,text)'] },
};
const fail = code => { throw Object.assign(new Error(), { code }); };
let client, transactionOpen = false, current = 'setup';
try {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const positional = args.filter(arg => !arg.startsWith('--'));
  if (args.some(arg => arg.startsWith('--') && arg !== '--dry-run') || positional.length > 1) fail('INVALID_ARGUMENTS');
  const migration = positional[0] || 'all';
  if (migration !== 'all' && !Object.hasOwn(plans, migration)) fail('UNKNOWN_MIGRATION');
  const selected = migration === 'all' ? Object.keys(plans) : [migration];

  const envFile = new URL('../.env.local', import.meta.url);
  let localUrl = process.env.MEETANY_LOCAL_DATABASE_URL;
  if (!localUrl && fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const match = /^MEETANY_LOCAL_DATABASE_URL\s*=\s*(.*?)\s*$/.exec(line);
      if (match) localUrl = match[1].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  if (!localUrl) fail('LOCAL_DATABASE_REQUIRED');
  let url;
  try { url = new URL(localUrl); } catch { fail('INVALID_LOCAL_DATABASE_URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) fail('LOCAL_HOST_REQUIRED');
  // pg connection-string query parameters can override host. Do not accept any overrides.
  if (url.search || url.hash || url.pathname.length < 2 || !url.username) fail('INVALID_LOCAL_DATABASE_URL');
  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail('INVALID_LOCAL_DATABASE_URL');

  // Read all trusted migration files before connecting, stripping their transaction wrappers.
  const scripts = selected.map(name => {
    const sql = fs.readFileSync(new URL(`../../db/migrations/20261007-${name}.sql`, import.meta.url), 'utf8');
    if ((sql.match(/^begin;$/gm) || []).length !== 1 ||
        (sql.match(/^commit;$/gm) || []).length !== 1 || !/\ncommit;\s*$/.test(sql)) fail('INVALID_TRANSACTION_WRAPPER');
    return [name, sql.replace(/^begin;$/m, '').replace(/\ncommit;\s*$/, '\n')];
  });
  const { default: pg } = await import('pg');
  // Explicit fields avoid PGHOST/PGSERVICE or connection-string host overrides.
  client = new pg.Client({
    host: url.hostname === '[::1]' ? '::1' : '127.0.0.1', port,
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)), ssl: false,
    connectionTimeoutMillis: 5000, statement_timeout: 30000,
    application_name: 'meetany-local-migrations',
  });
  await client.connect();
  const { rows: [server] } = await client.query("select host(inet_server_addr()) in ('127.0.0.1','::1') local");
  if (!server.local) fail('LOCAL_SERVER_REQUIRED');
  await client.query('begin');
  transactionOpen = true;
  // Serialize local runs, including an all-chain dry run and its later apply.
  await client.query("set local lock_timeout='5s'");
  await client.query("select pg_advisory_xact_lock(hashtextextended('meetany-local-migrations',0))");
  for (const [name, sql] of scripts) {
    current = name;
    await client.query(sql);
    const plan = plans[name];
    const { rows: [check] } = await client.query(`select
      (select count(*)::int from unnest($1::text[]) sig where to_regprocedure('public.' || sig) is not null) routines,
      (select count(*)::int from unnest($2::text[]) name where to_regclass('meetany_private.' || name) is not null) tables`, [plan.routines, plan.tables]);
    if (check.routines !== plan.routines.length || check.tables !== plan.tables.length) fail('MISSING_OBJECTS');
    if (name === 'contact-visibility') {
      const { rows: [privacy] } = await client.query(`select
        not has_column_privilege('anonymous','public.profiles','phone','SELECT') and
        not has_column_privilege('authenticated','public.profiles','phone','SELECT') and
        not has_column_privilege('anonymous','public.profiles','email','SELECT') and
        not has_column_privilege('authenticated','public.profiles','email','SELECT') and
        has_column_privilege('anonymous','public.profiles','company','SELECT') ok`);
      if (!privacy.ok) fail('BAD_CONTACT_PRIVACY');
    }
  }
  current = 'transaction';
  await client.query(dryRun ? 'rollback' : 'commit');
  transactionOpen = false;
  // Report success only after the transaction outcome is known.
  for (const name of selected) console.log(`local: ${name} ${dryRun ? 'dry-run ok, rolled back' : 'apply ok, committed'}`);
} catch (error) {
  let rollbackFailed = false;
  if (transactionOpen && client) {
    try { await client.query('rollback'); } catch { rollbackFailed = true; }
  }
  const code = /^[A-Z0-9_]{2,48}$/.test(error.code || '') ? error.code : 'LOCAL_MIGRATION_FAILED';
  console.error(`local: ${current} ${code}${transactionOpen ? (rollbackFailed ? ', rollback unconfirmed' : ', rolled back') : ''}`);
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}
