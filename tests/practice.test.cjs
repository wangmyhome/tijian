const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const q = (id, chapter = '第一章', type = '单选题') => ({ id, chapter, type, text: id, options: [{ label: 'A', text: '甲' }, { label: 'B', text: '乙' }], answer: ['A'], analysis: '' });
const bank = { id: 'bank', questions: [q('a'), q('b'), q('c', '第二章'), q('d', '第二章', '多选题')] };
const session = (changes = {}) => ({ bankId: bank.id, mode: 'sequential', filters: {}, ids: ['a', 'b', 'c', 'd'], index: 2, answers: { a: { selected: ['A'], correct: true } }, drafts: {}, startedAt: '2026-11-18T01:00:00.000Z', complete: false, ...changes });
const state = changes => ({ banks: [structuredClone(bank)], records: {}, session: null, ...changes });

test('keys separate bank, mode, chapter, status, random count and collection scope', () => {
  const base = C.practiceKey('bank', 'chapter', { chapter: '第一章' });
  for (const [b, mode, filters] of [['bank2', 'chapter', { chapter: '第一章' }], ['bank', 'sequential', { chapter: '第一章' }], ['bank', 'chapter', { chapter: '第二章' }], ['bank', 'chapter', { chapter: '第一章', status: 'new' }], ['bank', 'chapter', { chapter: '第一章', scope: 'one:a' }]]) assert.notEqual(base, C.practiceKey(b, mode, filters));
  assert.notEqual(C.practiceKey('bank', 'random', { count: 2 }), C.practiceKey('bank', 'random', { count: 3 }));
  assert.equal(C.practiceKey('bank', 'multiple'), C.practiceKey('bank', 'multiple', { chapter: '', type: '多选题', status: '' }));
});

test('legacy current position migrates; switching modes and JSON roundtrip retain independent progress', () => {
  const s = C.restorePractice(state({ session: session() }));
  const firstKey = C.practiceKey('bank', 'sequential');
  assert.equal(s.practiceSessions[firstKey].index, 2);
  s.session = session({ mode: 'multiple', ids: ['d'], index: 0, answers: {}, drafts: { d: ['B'] } }); C.rememberPractice(s);
  const copy = C.restorePractice(JSON.parse(JSON.stringify(s)));
  assert.equal(copy.practiceSessions[firstKey].index, 2);
  assert.deepEqual(copy.session.drafts.d, ['B']);
  assert.equal(copy.session, copy.practiceSessions[C.practiceKey('bank', 'multiple')]);
  copy.session.index = 0; C.rememberPractice(copy);
  assert.equal(copy.practiceSessions[firstKey].index, 2);
});

test('removing a question preserves surviving cursor, answers and drafts; new static questions are added', () => {
  const changedBank = { ...bank, questions: [q('a'), q('c', '第二章'), q('d', '第二章', '多选题'), q('new')] };
  let s = C.reconcilePractice(session({ drafts: { d: ['B'] } }), changedBank);
  assert.equal(s.ids[s.index], 'c'); assert.deepEqual(s.ids, ['a', 'c', 'd', 'new']);
  assert(s.answers.a.correct); assert.deepEqual(s.drafts.d, ['B']);
  s = C.reconcilePractice(session({ index: 1 }), changedBank);
  assert.equal(s.ids[s.index], 'c');
});

test('random order and new-only round survive practice history changes without adding or dropping questions', () => {
  const original = session({ mode: 'random', filters: { count: 2, status: 'new' }, ids: ['d', 'a'], index: 1, answers: { a: { selected: ['A'], correct: true } } });
  const s = C.restorePractice(state({ session: original, records: { 'bank/a': { attempts: 4 } } }));
  assert.deepEqual(s.session.ids, ['d', 'a']); assert.equal(s.session.index, 1); assert(s.session.answers.a);
});

test('separate chapter checkpoints and last-used chapter survive cloud serialization', () => {
  const s = C.restorePractice(state());
  for (const [chapter, ids] of [['第一章', ['a', 'b']], ['第二章', ['c', 'd']]]) {
    s.session = session({ mode: 'chapter', filters: { chapter }, ids, index: 1, answers: {} }); C.rememberPractice(s);
  }
  const copy = C.restorePractice(JSON.parse(JSON.stringify(s)));
  assert.equal(Object.keys(copy.practiceSessions).length, 2);
  assert.equal(copy.practiceLast[C.practicePlace('bank', 'chapter')], C.practiceKey('bank', 'chapter', { chapter: '第二章' }));
  assert.equal(copy.practiceSessions[C.practiceKey('bank', 'chapter', { chapter: '第一章' })].index, 1);
});

test('collection sessions do not replace main entries; removed banks are pruned', () => {
  const s = C.restorePractice(state({ session: session() }));
  s.session = session({ mode: 'sequential', filters: { scope: 'one:a' }, ids: ['a'], index: 0 }); C.rememberPractice(s);
  assert.equal(s.practiceLast[C.practicePlace('bank', 'sequential')], C.practiceKey('bank', 'sequential'));
  s.banks = []; C.restorePractice(s);
  assert.equal(s.session, null); assert.deepEqual(s.practiceSessions, {}); assert.deepEqual(s.practiceLast, {});
});

test('invalid selection is discarded per question without losing the entire saved position', () => {
  const s = C.reconcilePractice(session({ answers: { a: { selected: ['Z'], correct: true }, b: { selected: ['A'], correct: false } }, drafts: { d: ['Z'] } }), bank);
  assert.equal(s.index, 2); assert(!s.answers.a); assert(s.answers.b.correct); assert(!s.drafts.d);
});
