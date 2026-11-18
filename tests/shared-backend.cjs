// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite package.
// Executes the actual migration/RPCs/RLS locally; never contacts production.
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../core.js');
const ADMIN = '00000000-0000-4000-8000-000000000001';
const LEARNER = '00000000-0000-4000-8000-000000010001';

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text unique);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    insert into auth.users values ('${ADMIN}', 'admin@tijian.local'), ('${LEARNER}', '10001@tijian.local');`);
  return db;
}
async function asUser(db, id, query, params = []) {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id || '']);
    await db.exec('set local role ' + (id ? 'authenticated' : 'anon'));
    const result = await db.query(query, params);
    await db.exec('commit'); return result;
  } catch (error) { await db.exec('rollback'); throw error; }
}
const migration = () => fs.readFileSync(path.join(__dirname, '../supabase/升级_共享题库与独立账号.sql'), 'utf8');
const fixture = () => ({ version: 1, banks: [{ id: 'b', name: '共享题库', questions: [C.normalize({ 题型: '单选题', 题目: '共享问题', 选项A: '甲', 选项B: '乙', 答案: 'A' }, 0)] }], records: {}, settings: {}, exams: [], session: null, activity: {} });
const read = async (db, id, known = -1, banks = -1) => (await asUser(db, id, 'select public.tijian_read_workspace($1, $2) as data', [known, banks])).rows[0].data;
const write = async (db, id, revision, banks, payload) => (await asUser(db, id, 'select public.tijian_save_account_workspace($1, $2, $3::jsonb) as data', [revision, banks, JSON.stringify(payload)])).rows[0].data;

async function main() {
  const db = await createDatabase();
  try {
    // Migrate an existing administrator workspace without losing private records.
    const legacy = fixture(); legacy.records.secret = { note: '仅管理员可见' };
    await db.exec(`create table public.tijian_workspaces(user_id uuid primary key references auth.users, revision bigint not null, payload jsonb not null, updated_at timestamptz not null default now());`);
    await db.query('insert into public.tijian_workspaces values ($1, 7, $2::jsonb, now())', [ADMIN, JSON.stringify(legacy)]);
    await db.exec(migration()); await db.exec(migration());
    let admin = await read(db, ADMIN), learner = await read(db, LEARNER);
    assert.equal(admin.revision, 7); assert.equal(admin.payload.records.secret.note, '仅管理员可见');
    assert.deepEqual(learner.payload.records, {}); assert.deepEqual(learner.payload.banks, admin.payload.banks);
    assert.equal((await asUser(db, LEARNER, 'select * from public.tijian_workspaces')).rows.length, 0);
    const shared = (await asUser(db, LEARNER, 'select * from public.tijian_shared_banks')).rows;
    assert(!JSON.stringify(shared).includes('仅管理员可见'));
    await assert.rejects(asUser(db, LEARNER, 'select public.tijian_workspace_snapshot($1)', [ADMIN]), /permission denied/);
    await assert.rejects(asUser(db, null, 'select public.tijian_read_workspace()'), /permission denied/);
    await assert.rejects(asUser(db, null, 'select * from public.tijian_shared_banks'), /permission denied/);
    await assert.rejects(asUser(db, LEARNER, "update public.tijian_shared_banks set banks = '[]'"), /permission denied/);
    await assert.rejects(asUser(db, LEARNER, 'delete from public.tijian_shared_banks'), /permission denied/);
    await assert.rejects(asUser(db, LEARNER, "insert into public.tijian_workspaces values ($1, 1, '{}'::jsonb, now())", [ADMIN]), /permission denied/);
    await assert.rejects(write(db, LEARNER, 0, learner.bank_revision, fixture()), /Only the administrator/);
    await assert.rejects(asUser(db, LEARNER, 'select public.tijian_save_workspace(0, $1::jsonb)', [JSON.stringify(fixture())]), /Administrator required/);
    const personal = { ...learner.payload, records: { own: { note: '普通用户私有笔记' } } }; delete personal.banks;
    assert.equal((await write(db, LEARNER, 0, learner.bank_revision, personal)).ok, true);
    assert.deepEqual((await asUser(db, LEARNER, 'select user_id from public.tijian_workspaces')).rows.map(r => r.user_id), [LEARNER]);
    assert.deepEqual((await asUser(db, ADMIN, 'select user_id from public.tijian_workspaces')).rows.map(r => r.user_id), [ADMIN]);
    assert(!(await read(db, ADMIN)).payload.records.own);
    admin.payload.banks[0].name = '管理员更新后的题库';
    const saved = await write(db, ADMIN, admin.revision, admin.bank_revision, admin.payload);
    assert.equal(saved.ok, true);
    assert.equal((await asUser(db, ADMIN, 'select payload from public.tijian_workspaces')).rows[0].payload.banks[0].name, '管理员更新后的题库', 'deployed legacy admin clients can still read their own workspace during upgrade');
    learner = await read(db, LEARNER);
    assert.equal(learner.payload.banks[0].name, '管理员更新后的题库');
    assert.equal(learner.payload.records.own.note, '普通用户私有笔记');
    assert.equal(learner.revision, 1, 'bank updates leave personal revisions independent');
    const stale = await write(db, ADMIN, 7, admin.bank_revision, admin.payload);
    assert.equal(stale.ok, false);
    const fresh = await read(db, ADMIN);
    fresh.payload.banks[0].name = '旧设备尝试覆盖';
    assert.equal((await write(db, ADMIN, fresh.revision, 0, fresh.payload)).ok, false);
    assert.deepEqual(await read(db, LEARNER, learner.revision, learner.bank_revision), { revision: learner.revision, bank_revision: learner.bank_revision, updated_at: learner.updated_at });
    assert.equal((await asUser(db, LEARNER, 'select payload from public.tijian_workspaces')).rows[0].payload.banks, undefined);
    console.log('PASS: actual SQL preserves legacy data, isolates accounts, denies anonymous/private access and learner bank writes, shares admin bank updates, and rejects stale writes');
  } finally { await db.close(); }
}
module.exports = { createDatabase, asUser, migration, fixture, read, write, ADMIN, LEARNER };
if (require.main === module) main().catch(error => { console.error(error); process.exit(1); });
