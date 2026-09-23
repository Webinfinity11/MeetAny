// Explicit one-shot worker; no cron or real delivery is enabled by committing this file.
import { Pool } from '@neondatabase/serverless';
import { pathToFileURL } from 'node:url';

export async function deliverNotification(job, { apiKey, fetcher = fetch }) {
 const response = await fetcher('https://api.resend.com/emails', {
  method: 'POST', signal: AbortSignal.timeout(15000),
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `meetany-notification/${job.id}` },
  body: JSON.stringify(job.payload),
 });
 if (!response.ok) throw new Error(`provider_http_${response.status}`);
 const data = await response.json();
 if (!data.id) throw new Error('provider_missing_id');
 return data.id;
}

export async function runWorker({ db, send, from, origin, limit = 10 }) {
 let sent = 0, failed = 0;
 for (let i=0; i<Math.min(limit,50); i++) {
  const { rows } = await db.query('select meetany_private.claim_notification_email($1,$2) as job', [from, origin]);
  const job = rows[0]?.job;
  if (!job) break;
  let success = false, error = null;
  try { await send(job); success = true; }
  catch (err) { error = /^provider_(http_\d{3}|missing_id)$/.test(err.message) ? err.message : 'delivery_error'; }
  const result = await db.query('select meetany_private.finish_notification_email($1,$2,$3,$4) as finished', [job.id, job.lease, success, error]);
  if (result.rows[0]?.finished) { if (success) sent++; else failed++; }
 }
 return { sent, failed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const { NOTIFICATION_EMAIL_ENABLED, DATABASE_URL, RESEND_API_KEY, NOTIFICATION_FROM, APP_ORIGIN } = process.env;
 if (NOTIFICATION_EMAIL_ENABLED !== 'true' || !DATABASE_URL || !RESEND_API_KEY || !NOTIFICATION_FROM || !/^https:\/\/[^/]+$/.test(APP_ORIGIN || '')) {
  console.error('Notification delivery is disabled or not configured.');process.exitCode=1;
 } else {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  try { console.log(await runWorker({db:pool,from:NOTIFICATION_FROM,origin:APP_ORIGIN,send:job=>deliverNotification(job,{apiKey:RESEND_API_KEY})})); }
  catch { console.error('Notification worker failed; inspect delivery queue.');process.exitCode=1; }
  finally {await pool.end();}
 }
}
