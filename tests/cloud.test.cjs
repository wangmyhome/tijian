const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client, Sync, CloudError } = require('../cloud.js');
const C = require('../core.js');
const clone = structuredClone;
const fixture = () => ({ version: 1, banks: [{ id: 'b', name: '题库', questions: [C.normalize({ 题型: '单选题', 题目: '问题', 选项A: '甲', 选项B: '乙', 答案: 'A' }, 0)] }], settings: { theme: 'light' }, records: {}, exams: [], activity: {}, session: null });
function server() {
  return { row: null, fail: false, async read(known) { if (this.fail) throw new CloudError('断网', 'network'); if (!this.row) return null; const row = clone(this.row); if (known === row.revision) delete row.payload; return row; }, async write(revision, payload) { if ((this.row?.revision || 0) !== revision) return { ok: false, ...clone(this.row) }; this.row = { revision: revision + 1, payload: clone(payload), updated_at: new Date().toISOString() }; return { ok: true, revision: this.row.revision, updated_at: this.row.updated_at }; } };
}
function device(remote, state = fixture(), meta = {}) {
  const d = { state, meta, backups: [], canApply: true };
  d.sync = new Sync({ client: { session: { user: { id: 'admin' } }, read: remote.read.bind(remote), write: remote.write.bind(remote) }, getState: () => d.state, getMeta: () => d.meta, validate: C.validateState, persist: async () => {}, archive: async (local, cloud) => d.backups.push([clone(local), clone(cloud)]), apply: async (payload, next) => { d.state = clone(payload); d.meta = next; }, canApply: () => d.canApply, hasLocalData: () => !!Object.keys(d.state.records).length, schedule() {} });
  return d;
}
function favorite(d, value) { d.state.records['b/q'] = { attempts: 0, right: 0, wrong: 0, favorite: value, note: '', history: [] }; d.sync.changed(); }

test('a second device downloads the first device’s saved workspace', async () => {
  const remote = server(), a = device(remote);
  await a.sync.run(); favorite(a, true); await a.sync.run();
  const b = device(remote); await b.sync.run();
  assert.equal(b.state.records['b/q'].favorite, true);
  assert.equal(b.meta.revision, a.meta.revision);
  assert.equal(remote.row.revision, 2);
});
test('offline edits remain pending and upload when the connection returns', async () => {
  const remote = server(), d = device(remote); await d.sync.run();
  remote.fail = true; favorite(d, true); await d.sync.run();
  assert.equal(d.sync.status, 'offline'); assert.equal(d.meta.dirty, true);
  remote.fail = false; await d.sync.run();
  assert.equal(remote.row.payload.records['b/q'].favorite, true); assert.equal(d.meta.dirty, false);
});
test('simultaneous edits pause and archive both snapshots; choosing cloud is explicit', async () => {
  const remote = server(), a = device(remote); await a.sync.run();
  const b = device(remote); await b.sync.run();
  favorite(a, true); favorite(b, false); await a.sync.run(); await b.sync.run();
  assert.equal(b.sync.status, 'conflict'); assert.equal(b.backups.length, 1);
  assert.equal(remote.row.payload.records['b/q'].favorite, true);
  assert.equal(b.state.records['b/q'].favorite, false);
  await b.sync.resolve('remote');
  assert.equal(b.state.records['b/q'].favorite, true); assert.equal(b.sync.conflict, null);
  assert.equal(b.backups.at(-1)[0].records['b/q'].favorite, false);
});
test('choosing the local copy archives the latest cloud snapshot before replacing it', async () => {
  const remote = server(), a = device(remote); await a.sync.run();
  const b = device(remote); await b.sync.run(); favorite(a, true); favorite(b, false); await a.sync.run(); await b.sync.run();
  await b.sync.resolve('local');
  assert.equal(remote.row.payload.records['b/q'].favorite, false);
  assert.equal(b.backups.at(-1)[1].records['b/q'].favorite, true);
});
test('first login never silently replaces existing local learning records', async () => {
  const remote = server(), a = device(remote); await a.sync.run();
  const local = device(remote); favorite(local, true); await local.sync.run();
  assert.equal(local.sync.status, 'conflict'); assert.equal(remote.row.revision, 1);
});
test('cloud updates wait while a question is being answered', async () => {
  const remote = server(), a = device(remote); await a.sync.run();
  const b = device(remote); await b.sync.run(); b.canApply = false;
  favorite(a, true); await a.sync.run(); await b.sync.run();
  assert.equal(b.sync.status, 'remote'); assert.equal(b.state.records['b/q'], undefined);
  b.canApply = true; await b.sync.run(); assert.equal(b.state.records['b/q'].favorite, true);
});
test('an answer saved during an upload is not marked as synchronized prematurely', async () => {
  const remote = server(), d = device(remote); await d.sync.run(); favorite(d, true);
  const write = d.sync.client.write;
  d.sync.client.write = async (...args) => { const result = await write(...args); d.state.records['b/q'].note = '上传中新增的笔记'; d.sync.changed(); return result; };
  await d.sync.run(); assert.equal(d.meta.dirty, true); assert.equal(remote.row.payload.records['b/q'].note, '');
  d.sync.client.write = write; await d.sync.run();
  assert.equal(remote.row.payload.records['b/q'].note, '上传中新增的笔记'); assert.equal(d.meta.dirty, false);
});
test('atomic revision mismatch also protects writes that race after the initial read', async () => {
  const remote = server(), d = device(remote); await d.sync.run(); favorite(d, true);
  const write = d.sync.client.write;
  d.sync.client.write = async (...args) => { remote.row.revision++; remote.row.payload.settings.theme = 'dark'; return write(...args); };
  await d.sync.run(); assert.equal(d.sync.status, 'conflict'); assert.equal(remote.row.payload.settings.theme, 'dark');
});
test('authentication stores tokens but never persists the supplied password; refresh is shared', async () => {
  const memory = new Map(), storage = { getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, v), removeItem: k => memory.delete(k) };
  let refreshes = 0;
  const client = new Client({ url: 'https://example.supabase.co', key: 'public', adminEmail: 'admin@tijian.local' }, { storage, fetch: async (url, options) => {
    if (url.includes('refresh_token')) refreshes++;
    assert.equal(options.headers.apikey, 'public');
    return { ok: true, json: async () => ({ access_token: 'access', refresh_token: 'refresh', expires_at: 1, user: { id: 'u', email: 'admin@tijian.local' } }) };
  } });
  await assert.rejects(client.login('someone', 'password'), /账号或密码/);
  await client.login('admin', 'password');
  assert(![...memory.values()].join('').includes('password'));
  await Promise.all([client.token(), client.token()]); assert.equal(refreshes, 1);
  await client.logout(); assert.equal(memory.size, 0);
});

test('a refresh finishing after account switching cannot restore the previous account', async () => {
  const memory = new Map(), storage = { getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, v), removeItem: k => memory.delete(k) };
  let finish;
  const client = new Client({ url: 'https://example.supabase.co', key: 'public', adminEmail: 'admin@tijian.local' }, { storage, fetch: async () => {
    await new Promise(resolve => { finish = resolve; });
    return { ok: true, json: async () => ({ access_token: 'new-admin-token', refresh_token: 'new-refresh', expires_at: 9999999999, user: { id: 'admin-id', email: 'admin@tijian.local' } }) };
  } });
  client.remember({ access_token: 'old', refresh_token: 'old-refresh', expires_at: 1, user: { id: 'admin-id', email: 'admin@tijian.local' } });
  const refreshing = client.token();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  const learner = { access_token: 'learner', refresh_token: 'learner-refresh', user: { id: 'learner-id', email: '10001@tijian.local' } };
  storage.setItem(client.key, JSON.stringify(learner)); finish();
  await assert.rejects(refreshing, /账号已退出或切换/);
  assert.equal(JSON.parse(storage.getItem(client.key)).user.id, 'learner-id');
});
