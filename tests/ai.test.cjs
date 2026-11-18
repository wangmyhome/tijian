const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('../core.js');
const { Client } = require('../cloud.js');
const source = fs.readFileSync(path.resolve(__dirname, '../supabase/functions/ai-explain/index.ts'), 'utf8');
const question = C.normalize({ 题目ID: 'q1', 题型: '单选题', 题目: '测试原题', 选项A: '甲', 选项B: '乙', 答案: 'A', 解析: '原解析' });
const payload = () => ({ bankId: 'b', questionId: question.id, signature: C.signature(question), selected: ['B'] });
function edge(options = {}) {
  const env = { SUPABASE_URL: 'https://project.example', SUPABASE_ANON_KEY: 'public-key', ...(options.configured === false ? {} : { DEEPSEEK_API_KEY: 'test-private-provider-key' }) };
  const calls = []; let handle;
  vm.runInNewContext(source, { Deno: { env: { get: name => env[name] }, serve: handler => { handle = handler; } }, Request, Response, AbortSignal, Date, Map, Set, JSON, fetch: async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify(options.auth === false ? {} : { id: 'learner' }), { status: options.auth === false ? 401 : 200 });
    if (url.includes('/rest/v1/')) {
      assert.equal(init.headers.Authorization, 'Bearer valid-session');
      return Response.json([{ banks: [{ id: 'b', questions: [question] }] }]);
    }
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer test-private-provider-key');
    if (options.networkError) throw new Error('simulated private-provider-key network failure');
    return new Response(JSON.stringify(options.providerBody || { choices: [{ message: { content: '解题思路：原题的正确选项为 A。' } }] }), { status: options.providerStatus || 200 });
  } });
  const invoke = (body = payload(), changes = {}) => handle(new Request('https://project.example/functions/v1/ai-explain', { method: 'POST', headers: { Origin: 'https://wangmyhome.github.io', Authorization: 'Bearer valid-session', 'Content-Type': 'application/json', ...changes.headers }, body: JSON.stringify(body), ...changes }));
  return { handle, invoke, calls, providerCalls: () => calls.filter(call => call.url.includes('api.deepseek.com')) };
}

test('AI endpoint makes no calls until invoked, rejects anonymous and foreign-origin requests before generation', async () => {
  const e = edge(); assert.equal(e.calls.length, 0);
  assert.equal((await e.handle(new Request('https://project.example/functions/v1/ai-explain', { method: 'OPTIONS', headers: { Origin: 'https://wangmyhome.github.io' } }))).status, 204);
  assert.equal(e.calls.length, 0);
  assert.equal((await e.handle(new Request('https://project.example/functions/v1/ai-explain', { method: 'POST', headers: { Origin: 'https://wangmyhome.github.io' } }))).status, 401);
  assert.equal((await e.invoke(payload(), { headers: { Origin: 'https://untrusted.example', Authorization: 'Bearer valid-session' } })).status, 403);
  assert.equal(e.providerCalls().length, 0);
  const invalid = edge({ auth: false }); assert.equal((await invalid.invoke()).status, 401); assert.equal(invalid.providerCalls().length, 0);
});

test('AI endpoint uses authenticated canonical questions and learner selections; never returns the provider key', async () => {
  const e = edge(), response = await e.invoke({ ...payload(), question: 'arbitrary injected question', apiKey: 'client-supplied-key' });
  assert.equal(response.status, 200); assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://wangmyhome.github.io');
  const result = await response.json(); assert.equal(result.model, 'deepseek-chat'); assert(result.text.includes('正确选项'));
  assert(!JSON.stringify(result).includes('provider-key'));
  const body = JSON.parse(e.providerCalls()[0].init.body), material = JSON.parse(body.messages[1].content);
  assert.equal(body.model, 'deepseek-chat'); assert.equal(body.stream, false); assert.equal(material.题目, question.text); assert.deepEqual(material.我的作答, ['B']);
});

test('AI endpoint rejects unsynced questions, stale content, invalid selections and missing configuration without calling DeepSeek', async () => {
  for (const [input, status] of [[{ ...payload(), questionId: 'unknown' }, 404], [{ ...payload(), signature: 'stale' }, 409], [{ ...payload(), selected: ['Z'] }, 400], [{ ...payload(), selected: ['A', 'B'] }, 400]]) {
    const e = edge(); assert.equal((await e.invoke(input)).status, status); assert.equal(e.providerCalls().length, 0);
  }
  const e = edge({ configured: false }); assert.equal((await e.invoke()).status, 503); assert.equal(e.providerCalls().length, 0);
});

test('AI endpoint limits repeated requests and gives safe provider errors', async () => {
  const limited = edge(); for (let i = 0; i < 10; i++) assert.equal((await limited.invoke()).status, 200);
  assert.equal((await limited.invoke()).status, 429); assert.equal(limited.providerCalls().length, 10);
  for (const status of [401, 402, 429, 500]) {
    const e = edge({ providerStatus: status, providerBody: { error: 'test-private-provider-key' } }), response = await e.invoke();
    assert.equal(response.status, status === 429 ? 429 : 502); assert(!(await response.text()).includes('provider-key'));
  }
  const network = await edge({ networkError: true }).invoke(); assert.equal(network.status, 504); assert(!(await network.text()).includes('provider-key'));
  assert.equal((await edge({ providerBody: { choices: [] } }).invoke()).status, 502);
});

function client(fetch) {
  const values = new Map(), c = new Client({ url: 'https://project.example', key: 'public-key', adminEmail: 'admin@tijian.local' }, { storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }, fetch });
  c.remember({ user: { id: 'learner', email: '10001@tijian.local' }, access_token: 'user-token', refresh_token: 'refresh', expires_at: 9999999999 }); return c;
}

test('browser AI client only invokes its authenticated function explicitly and discards results after account changes', async () => {
  let calls = 0, finish;
  const c = client(async (url, init) => {
    calls++; assert.equal(url, 'https://project.example/functions/v1/ai-explain');
    assert.equal(init.headers.Authorization, 'Bearer user-token'); assert.equal(init.headers.apikey, 'public-key');
    assert.deepEqual(Object.keys(JSON.parse(init.body)), ['bankId', 'questionId', 'signature', 'selected']);
    return Response.json({ text: '结果' });
  });
  assert.equal(calls, 0); assert.equal((await c.explain('b', question, ['B'])).text, '结果'); assert.equal(calls, 1);
  const switching = client(async () => { await new Promise(resolve => { finish = resolve; }); return Response.json({ text: 'old account result' }); });
  const pending = switching.explain('b', question, ['A']); while (!finish) await new Promise(resolve => setImmediate(resolve));
  switching.remember(null); finish(); await assert.rejects(pending, /账号已切换/);
});

test('browser AI client reports deployment errors and rejects invalid model output', async () => {
  await assert.rejects(client(async () => Response.json({ code: 'NOT_FOUND' }, { status: 404 })).explain('b', question, []), /尚未部署/);
  await assert.rejects(client(async () => Response.json({ text: '' })).explain('b', question, []), /有效解析/);
});
