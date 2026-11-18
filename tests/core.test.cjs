const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../core.js');

test('CSV preserves quoted commas, escaped quotes, multiline code and BOM', () => {
  const rows = C.parseCSV('\ufeff题型,题目,选项A,选项B,答案\r\n单选题,"第一行,逗号\n代码：""hello""",是,否,A\r\n');
  assert.equal(rows[0].raw.题目, '第一行,逗号\n代码："hello"');
  assert.equal(rows[0].line, 2);
  assert.equal(C.normalize(rows[0].raw).answer[0], 'A');
});
test('malformed CSV fails explicitly instead of importing shifted data', () => {
  assert.throws(() => C.parseCSV('a,b\n"open,b'), /没有闭合/);
  assert.throws(() => C.parseCSV('a,a\n1,2'), /列名/);
  const rows = C.inspect(C.parseCSV('题型,题目,答案\n单选题,测试,A,多余'));
  assert.match(rows[0].validation, /列数/);
});
test('seven options and unordered ABC answer sets normalize and grade correctly', () => {
  const raw = { 题型: '多选题', 题目: '七个选项', 答案: 'ABDCEFG' };
  for (const a of 'ABCDEFG') raw['选项' + a] = a + '内容';
  const q = C.normalize(raw);
  assert.equal(q.options.length, 7);
  assert(C.correct(q, ['G', 'F', 'E', 'D', 'C', 'B', 'A']));
  assert(!C.correct(q, ['A', 'B']));
  assert(!C.correct(q, [...q.answer, 'H']));
});
test('dynamic option columns extend past Z with explicit answer separators', () => {
  const q = C.normalize({ 题型: '多选题', 题目: '长标签', 选项A: '1', 选项AA: '2', 选项AB: '3', 答案: 'AB|AA' });
  assert.deepEqual(q.options.map(o => o.label), ['A', 'AA', 'AB']);
  assert(C.correct(q, ['AA', 'AB']));
  assert.equal(C.label(26), 'AA');
});
test('legacy source header names never become options', () => {
  const q = C.normalize({ testId: 'id', typeName: '单选题', question: '问题', A: '一', B: '二', answerText: 'A', analysis: '无', difficult: 'simple' });
  assert.equal(q.options.length, 2);
  assert.equal(q.analysis, '');
});
test('true and false normalization supports Chinese and original A/B answers', () => {
  for (const a of ['正确', 'A', 'true', '√']) assert.deepEqual(C.normalize({ 题型: '判断', 题目: '测试', 答案: a }).answer, ['A']);
  for (const a of ['错误', 'B', 'false', '×']) assert.deepEqual(C.normalize({ 题型: '判断', 题目: '测试', 答案: a }).answer, ['B']);
});
test('missing options and mismatched answers are rejected', () => {
  assert.throws(() => C.normalize({ 题型: '单选题', 题目: '测试', 选项A: '一', 选项B: '二', 答案: 'C' }), /不存在/);
  assert.throws(() => C.normalize({ 题型: '单选题', 题目: '测试', 选项A: '一', 选项B: '二', 答案: 'AB' }), /只能有一个/);
});
test('duplicate contents skip but conflicting IDs are errors', () => {
  const raw = { 题目ID: 'same', 题型: '判断题', 题目: '测试', 答案: '正确' };
  const result = C.inspect([{ raw }, { raw: { ...raw } }, { raw: { ...raw, 题目: '不同' } }]);
  assert(result[1].duplicate);
  assert.match(result[2].validation, /ID重复/);
});
test('downloadable template round-trips without losing any of the seven options', () => {
  const result = C.inspect(C.parseCSV(C.template()));
  assert.equal(result.length, 3);
  assert(result.every(x => !x.validation));
  assert.equal(result[1].q.options.length, 7);
});
test('the complete original theory CSV is accepted with all 1751 questions', () => {
  const text = fs.readFileSync(path.resolve(__dirname, '../../理论题.csv'), 'utf8');
  const rows = C.inspect(C.parseCSV(text));
  assert.equal(rows.length, 1751);
  assert.equal(rows.filter(r => r.validation).length, 0);
  assert.equal(rows.filter(r => r.duplicate).length, 0);
  assert.equal(rows.filter(r => r.q.type === '判断题').length, 430);
});
test('backup validation rejects malformed records and unsafe activity values', () => {
  const base = { version: 1, banks: [], records: {}, settings: {} };
  assert.equal(C.validateState(base), base);
  assert.throws(() => C.validateState({ ...base, activity: { '2026-11-17': { attempts: '<img>', right: 1 } } }), /统计/);
  assert.throws(() => C.validateState({ ...base, records: { x: {} } }), /记录/);
});

test('bank CSV export round-trips all 1751 questions in original order', () => {
  const questions = C.inspect(C.parseCSV(fs.readFileSync(path.resolve(__dirname, '../../理论题.csv'), 'utf8'))).map(row => row.q);
  const csv = C.exportBank({ questions }), restored = C.inspect(C.parseCSV(csv));
  assert(csv.startsWith('\uFEFF'));
  assert(restored.every(row => !row.validation && !row.duplicate));
  assert.deepEqual(restored.map(row => row.q), questions);
});

test('bank CSV export preserves sparse and multi-letter options, quotes, commas, multiline text and both judgment answers', () => {
  const questions = [
    C.normalize({ 题目ID: 'long-labels', 题型: '多选题', 章节: '第一章/基础', 题目: '包含逗号,和"引号"\n还有换行', 选项A: '选项,甲', 选项G: '选项"庚"', 选项AA: '选项\n双A', 选项AB: '双B', 答案: 'A|AA|AB', 解析: '解析,保留"格式"\n下一行' }),
    C.normalize({ 题目ID: 'true', 题型: '判断题', 题目: '正确判断', 答案: '正确' }),
    C.normalize({ 题目ID: 'false', 题型: '判断题', 题目: '错误判断', 答案: '错误' })
  ];
  const csv = C.exportBank({ questions }), entries = C.parseCSV(csv);
  assert.deepEqual(Object.keys(entries[0].raw).filter(key => key.startsWith('选项')), ['选项A', '选项B', '选项G', '选项AA', '选项AB']);
  assert.equal(entries[0].raw.答案, 'A|AA|AB');
  assert.deepEqual(C.inspect(entries).map(row => row.q), questions);
});

test('auto-next delay keeps old backups valid and rejects invalid delays', () => {
  const state = value => ({ version: 1, banks: [], records: {}, settings: value === undefined ? {} : { autoNextDelay: value } });
  assert(C.validateState(state()));
  for (const delay of [0, 0.75, 1.6, 60]) assert.equal(C.validateState(state(delay)).settings.autoNextDelay, delay);
  for (const delay of [-1, 60.1, Infinity, NaN, null, '2']) assert.throws(() => C.validateState(state(delay)), /等待时间/);
});
