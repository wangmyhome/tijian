const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const questions = C.inspect(C.parseCSV(C.template())).map(row => row.q);
const counts = { 单选题: 1, 多选题: 1, 判断题: 1 };
const exam = () => ({ id: 'exam1', bankId: 'b1', bankName: '题库', questions: structuredClone(questions), index: 0, answers: {}, marked: {}, durationMinutes: 60, passScore: 60, startedAt: '2026-11-17T10:00:00.000Z', deadline: '2026-11-17T11:00:00.000Z' });

test('exam paper enforces exact type counts and chapter scope without duplicates or source mutation', () => {
  const paper = C.examPaper(questions, counts, '', () => 0);
  assert.equal(paper.length, 3);
  assert.equal(new Set(paper.map(q => q.id)).size, 3);
  for (const type of C.TYPES) assert.equal(paper.filter(q => q.type === type).length, 1);
  paper[0].text = 'modified';
  assert(!questions.some(q => q.text === 'modified'));
  const scoped = C.examPaper(questions, { 单选题: 1, 多选题: 1, 判断题: 0 }, '第一章');
  assert(scoped.every(q => q.chapter.startsWith('第一章/')));
  assert.throws(() => C.examPaper(questions, counts, '第二章'), /只有/);
  assert.throws(() => C.examPaper(questions, { ...counts, 单选题: 2 }), /只有/);
  assert.throws(() => C.examPaper(questions, { ...counts, 单选题: 0.5 }), /整数/);
  assert.throws(() => C.examPaper(questions, Object.fromEntries(C.TYPES.map(t => [t, 0]))), /1–500/);
});

test('exam grading counts partial multi-select and unanswered separately with a 100 point score', () => {
  const e = exam(); e.answers = { [questions[0].id]: ['B'], [questions[1].id]: ['A'] };
  let result = C.examResult(e);
  assert.deepEqual([result.right, result.wrong, result.unanswered, result.answered, result.score, result.passed], [1, 1, 1, 2, 33.3, false]);
  e.answers[questions[1].id] = [...questions[1].answer].reverse();
  e.answers[questions[2].id] = ['A'];
  result = C.examResult(e);
  assert.equal(result.score, 100); assert(result.passed);
  assert.equal(result.byType.多选题.right, 1);
  e.answers = {}; assert.equal(C.examResult(e).score, 0);
});

test('old backups remain valid and exam backups reject corrupted deadlines, answers and duplicate history', () => {
  const base = { version: 1, banks: [], records: {}, settings: {} };
  assert.equal(C.validateState(base), base);
  assert(C.validateState({ ...base, activeExam: exam() }));
  assert.throws(() => C.validateState({ ...base, activeExam: { ...exam(), deadline: '2026-11-17T10:01:00.000Z' } }), /考试/);
  assert.throws(() => C.validateState({ ...base, activeExam: { ...exam(), answers: { [questions[0].id]: ['G'] } } }), /作答/);
  assert.throws(() => C.validateState({ ...base, activeExam: { ...exam(), marked: { missing: true } } }), /标记/);
  const completed = { ...exam(), finishedAt: '2026-11-17T10:30:00.000Z', autoSubmitted: false };
  assert(C.validateState({ ...base, exams: [completed] }));
  assert.throws(() => C.validateState({ ...base, exams: [completed, completed] }), /重复/);
  assert.throws(() => C.validateState({ ...base, exams: [completed], activeExam: exam() }), /冲突/);
});
