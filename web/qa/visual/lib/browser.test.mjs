import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guard } from './browser.mjs';

test('API guard permits reads/mark_read/auth, blocks writes, and only mocks start_conversation', async () => {
  const state = { blocked: [], interceptions: 0, chat: null };
  let intercept;
  await guard({ route: async (_pattern, handler) => { intercept = handler; } }, state);
  async function request(path, method = 'POST') {
    let result;
    await intercept({
      request: () => ({ url: () => `http://localhost:3001/api/${path}`, method: () => method }),
      continue: async () => { result = 'continue'; },
      abort: async () => { result = 'abort'; },
      fulfill: async body => { result = body; },
    });
    return result;
  }
  for (const rpc of ['my_profile', 'list_messages', 'admin_list_audit', 'mark_read']) assert.equal(await request(`db/rpc/${rpc}`), 'continue');
  assert.equal(await request('db/requests', 'GET'), 'continue');
  assert.equal(await request('auth/sign-in/email'), 'continue');
  for (const rpc of ['create_request', 'send_offer', 'update_my_profile', 'send_message', 'start_conversation', 'mark_notification_read', 'log_contact_event']) assert.equal(await request(`db/rpc/${rpc}`), 'abort');
  assert.equal(await request('auth/sign-up/email'), 'abort');
  state.chat = { id: 'existing-conversation' };
  assert.deepEqual(await request('db/rpc/start_conversation'), { json: state.chat });
  assert.equal(state.interceptions, 1);
  assert.equal(state.blocked.length, 8);
});
