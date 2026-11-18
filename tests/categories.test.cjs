const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../core.js');
const read = file => C.inspect(C.parseCSV(fs.readFileSync(file, 'utf8')));
const classified = () => read(path.resolve(__dirname, '../data/计算机程序设计员 · 三级_已分类.csv'));

test('classified CSV keeps all 1751 original questions and exports all classification fields losslessly', () => {
  const rows = classified();
  assert.equal(rows.length, 1751); assert(rows.every(r => r.q && !r.validation && !r.duplicate));
  const questions = rows.map(r => r.q), originals = new Map(read(path.resolve(__dirname, '../../理论题.csv')).map(r => [r.q.id, r.q]));
  assert.equal(new Set(questions.map(C.categoryOf)).size, 9);
  for (const q of questions) { assert.equal(C.signature(q), C.signature(originals.get(q.id))); assert(q.number && q.category && q.subcategory); }
  assert.deepEqual(C.inspect(C.parseCSV(C.exportBank({ questions }))).map(r => r.q), questions);
});

test('reimport updates metadata without duplicating questions or changing the IDs used by learning records', () => {
  const incoming = classified().map(r => r.q), bank = { questions: read(path.resolve(__dirname, '../../理论题.csv')).map(r => r.q) };
  const originalIds = bank.questions.map(q => q.id), first = bank.questions[0];
  const result = C.mergeBankQuestions(bank, incoming, () => { throw new Error('must not generate IDs'); });
  assert.deepEqual(result, { added: 0, updated: 1751, skipped: 0 });
  assert.deepEqual(bank.questions.map(q => q.id), originalIds); assert.equal(bank.questions[0], first);
  assert.deepEqual(C.mergeBankQuestions(bank, incoming, () => 'new'), { added: 0, updated: 0, skipped: 1751 });
});

test('the supplied CSV accepts embedded HTML quotes and its Excel date conversion cannot overwrite an existing option', () => {
  const rows = read(path.resolve(__dirname, '../../计算机程序设计员 · 三级_已分类.csv'));
  assert.equal(rows.length, 1751); assert(rows.every(r => r.q && !r.validation));
  const originals = read(path.resolve(__dirname, '../../理论题.csv')).map(r => r.q), bank = { questions: originals };
  const originalContent = bank.questions.map(C.signature);
  assert.equal(C.mergeBankQuestions(bank, rows.map(r => r.q), () => { throw new Error('no new IDs expected'); }).added, 0);
  assert.deepEqual(bank.questions.map(C.signature), originalContent);
});

test('existing cloud banks gain only missing metadata when IDs and question content both match', () => {
  const source = classified()[0].q;
  const old = { ...source }; delete old.category; delete old.subcategory; delete old.number;
  const custom = { ...source, category: '自定义分类' }, changed = { ...old, text: '其他内容' };
  C.fillCategories([{ questions: [old, custom, changed] }], [source]);
  assert.equal(old.category, source.category); assert.equal(old.number, source.number);
  assert.equal(custom.category, '自定义分类'); assert.equal(changed.category, undefined);
});

test('category checkpoints stay separate through serialization and category changes prune only moved questions', () => {
  const questions = classified().slice(0, 3).map(r => r.q), bank = { id: 'b', name: 'test', questions };
  const s = { bankId: 'b', mode: 'category', filters: { category: questions[0].category }, ids: questions.map(q => q.id), index: 1, answers: { [questions[0].id]: { selected: questions[0].answer } }, drafts: { [questions[1].id]: ['B'] } };
  assert.notEqual(C.practiceKey('b', 'category', { category: '甲' }), C.practiceKey('b', 'category', { category: '乙' }));
  const state = C.restorePractice(JSON.parse(JSON.stringify({ banks: [bank], records: {}, session: s })));
  assert.equal(state.session.index, 1); assert.deepEqual(state.session.answers[questions[0].id].selected, questions[0].answer);
  questions[0].category = '移动后的分类';
  const clean = C.reconcilePractice(s, bank);
  assert.equal(clean.ids[clean.index], questions[1].id); assert(!clean.ids.includes(questions[0].id));
});

test('first category visit restores the previous submitted selection without adding attempts', () => {
  const q = classified()[0].q, records = { ['b/' + q.id]: { attempts: 2, history: [{ at: '2026-11-18', selected: ['A'], correct: false }] } };
  const state = { records }, before = JSON.stringify(state);
  assert.deepEqual(C.previousAnswers(state, { id: 'b' }, [q])[q.id].selected, ['A']);
  assert.equal(JSON.stringify(state), before);
  records['b/' + q.id].history[0].selected = ['Z']; assert.deepEqual(C.previousAnswers(state, { id: 'b' }, [q]), {});
});

test('new category can adopt an unsubmitted multi-select draft, while templates and old backups remain compatible', () => {
  const q = classified()[0].q;
  assert.deepEqual(C.previousDrafts({ session: { bankId: 'b', answers: {}, drafts: { [q.id]: ['B'] } } }, { id: 'b' }, [q]), { [q.id]: ['B'] });
  const template = C.inspect(C.parseCSV(C.template())); assert(template.every(r => r.q && r.q.category && r.q.subcategory && r.q.number));
  const old = { ...q }; delete old.category; delete old.subcategory; delete old.number;
  C.validateState({ version: 1, banks: [{ id: 'b', name: 'old', questions: [old] }], records: {}, settings: {} });
  assert.throws(() => C.validateState({ version: 1, banks: [{ id: 'b', name: 'bad', questions: [{ ...q, category: {} }] }], records: {}, settings: {} }), /分类/);
});
