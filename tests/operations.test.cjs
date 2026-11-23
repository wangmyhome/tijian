const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../core.js');
const catalog = require('../operations.js');

test('operation task catalog contains 40 complete tasks in eight five-task units', () => {
  assert.equal(catalog.tasks.length, 40);
  assert.equal(catalog.units.length, 8);
  assert.equal(new Set(catalog.tasks.map(task => task.id)).size, 40);
  for (const unit of catalog.units) assert.equal(catalog.tasks.filter(task => task.unit === unit.id).length, 5, unit.id);
  for (const task of catalog.tasks) {
    assert(task.title && task.prompt && task.minutes > 0, task.id);
    for (const file of [...task.sourceLinks, ...task.referenceLinks]) {
      assert(!path.isAbsolute(file.path), file.path);
      assert(!file.path.split('/').includes('..'), file.path);
      assert(fs.existsSync(path.resolve(__dirname, '..', file.path)), file.path);
    }
  }
});

test('per-account operation progress is accepted in backups and rejects invalid statuses', () => {
  const state = { version: 1, banks: [], records: {}, settings: {}, operationProgress: { '2.3.1': { status: 'done', note: '完成并检查过' } } };
  assert.equal(C.validateState(state), state);
  assert.throws(() => C.validateState({ ...state, operationProgress: { '2.3.1': { status: 'unknown', note: '' } } }), /操作题进度/);
});
