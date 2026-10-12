import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withReadTimeout } from '../../app/lib/read-timeout.js';

test('a hung read aborts and releases its caller even when transport ignores abort', async () => {
  let signal;
  await assert.rejects(withReadTimeout(s => { signal=s; return new Promise(()=>{}); }, 15), e => e.code === 'TIMEOUT');
  assert.equal(signal.aborted, true);
  assert.equal(await withReadTimeout(() => Promise.resolve('recovered'), 100), 'recovered');
});

test('the timeout covers the response body and successful reads leave no abort', async () => {
  let signal;
  const result=await withReadTimeout(async s => { signal=s; return new Response('ok').text(); },100);
  assert.equal(result,'ok');
  assert.equal(signal.aborted,false);
  await assert.rejects(withReadTimeout(async () => {
    const response=new Response(new ReadableStream({start(){}}));
    return response.text();
  },15),e=>e.code==='TIMEOUT');
});
