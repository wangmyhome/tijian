const { chromium, webkit, devices } = require(require.resolve('playwright', { paths: ['/Users/wangshanpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
(async () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../题间·离线刷题.html'));
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const mobile of [false, true]) {
      const browser = await (mobile ? webkit : chromium).launch(mobile ? { headless: true } : { headless: true, channel: 'chrome' });
      try {
        const context = await browser.newContext(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 1040 } });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const click = selector => page.locator(selector).first().click();
        const home = async () => { await click('.mobile-focus-bar [data-action=nav][data-view=home]'); await page.locator('.hero').waitFor(); };
        const settings = () => click('.mobile-focus-bar [data-action=settings]');
        const index = n => page.waitForFunction(n => document.querySelector('.question-count strong')?.textContent === String(n), n);
        const jump = async n => { if (mobile) { await settings(); await click('[data-action=settings-card]'); } await click('[data-action=jump][data-index="' + (n - 1) + '"]'); await index(n); };
        const card = name => click('[data-action=practice-category][data-category="' + name + '"]');
        const snapshot = () => page.evaluate(() => new Promise(resolve => { const r = indexedDB.open('tijian-offline', 1); r.onsuccess = () => { const tx = r.result.transaction('workspace'); const get = tx.objectStore('workspace').get('main'); get.onsuccess = () => resolve(get.result); }; }));
        const clearQuestion = async () => { await settings(); await click('[data-action=clear-current-answer]'); await click('[data-action=confirm]'); await page.locator('.answer-panel').waitFor({ state: 'hidden' }); };
        await page.goto('http://127.0.0.1:' + server.address().port); await page.locator('.hero').waitFor();
        assert.equal(await page.locator('.category-card').count(), 9);
        assert.equal(await page.locator('#category-title').innerText(), '分类练习');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.locator('.category-section').screenshot({ path: '/tmp/tijian-categories-' + (mobile ? 'iphone' : 'desktop') + '.png' });
        const base = '题目ID,题型,章节,题目,选项A,选项B,答案\na,单选题,原章/第一节,旧题单选,甲,乙,A\nb,多选题,原章/第二节,旧题多选,甲,乙,A|B\nc,判断题,另一章,旧题判断,,,正确\nd,单选题,另一章,另一道单选,甲,乙,B\n';
        await click('[data-action=import]');
        await page.locator('#csv-file').setInputFiles({ name: '分类迁移.csv', mimeType: 'text/csv', buffer: Buffer.from(base) });
        await click('[data-action=confirm-import]'); await page.locator('.hero h2').filter({ hasText: '分类迁移' }).waitFor();
        const bankId = (await snapshot()).selectedBank;
        await click('[data-action=mode][data-mode=sequential]'); await click('[data-action=choose][data-label=B]');
        await clearQuestion(); await click('[data-action=choose][data-label=B]');
        await page.waitForFunction(() => document.querySelector('.attempt-count strong')?.textContent === '2');
        assert.equal(await page.locator('.attempt-count strong').innerText(), '2');
        await jump(2); await click('[data-action=choose][data-label=B]'); await home();
        const updated = '序号,一级分类,二级分类,' + base.split('\n')[0] + '\n' + base.trim().split('\n').slice(1).map((r, i) => (i + 1) + ',' + (i < 2 ? '程序设计' : '基础知识') + ',知识点,' + r).join('\n');
        await click('[data-action=import]');
        await page.locator('#csv-file').setInputFiles({ name: '新分类.csv', mimeType: 'text/csv', buffer: Buffer.from(updated) });
        await page.locator('#import-target').selectOption(bankId);
        assert.equal(await page.locator('.preview-category').first().innerText(), '程序设计\n知识点');
        await click('[data-action=edit-import][data-index="0"]');
        assert.equal(await page.locator('#edit-number').inputValue(), '1'); assert.equal(await page.locator('#edit-category').inputValue(), '程序设计');
        await click('[data-action=save-edit]'); await click('[data-action=confirm-import]'); await page.locator('.hero').waitFor();
        assert.equal(await page.locator('.category-card').count(), 2);
        let data = await snapshot(); assert.equal(data.banks.find(b => b.id === bankId).questions.length, 4);
        assert.equal(data.records[bankId + '/a'].attempts, 2);
        await card('程序设计'); await index(2); assert.equal(await page.locator('.option.selected .option-letter').innerText(), 'B');
        await jump(1); assert.equal(await page.locator('.option.selected .option-letter').innerText(), 'B');
        assert.equal(await page.locator('.answer-panel.bad').count(), 1);
        assert.match(await page.locator('.history-detail').innerText(), /已练 · 上次答错 · 2 次/);
        await home(); await card('基础知识'); await jump(2); await click('[data-action=choose][data-label=A]'); await home();
        await card('程序设计'); await index(1); assert.equal(await page.locator('.answer-panel.bad').count(), 1);
        await page.reload(); await page.locator('.hero').waitFor(); await card('程序设计'); await index(1);
        assert.equal(await page.locator('.option.selected .option-letter').innerText(), 'B');
        await clearQuestion(); assert.equal(await page.locator('.answer-panel').count(), 0); assert.equal(await page.locator('.option.selected').count(), 0);
        assert.match(await page.locator('.history-detail').innerText(), /已练 · 上次答错 · 2 次/);
        await home(); await card('基础知识'); await index(2); assert.equal(await page.locator('.option.selected .option-letter').innerText(), 'A'); await home();
        await card('程序设计'); await index(1); assert.equal(await page.locator('.answer-panel').count(), 0);
        await jump(2); assert.equal(await page.locator('.option.selected .option-letter').innerText(), 'B');
        await click('[data-action=submit]'); await page.locator('.answer-panel.bad').waitFor();
        await settings(); await click('[data-action=restart-practice]'); await click('[data-action=confirm]'); await index(1);
        assert.equal(await page.locator('.option.selected').count(), 0); assert.equal(await page.locator('.attempt-count strong').innerText(), '2');
        await jump(2); assert.equal(await page.locator('.option.selected').count(), 0); assert.equal(await page.locator('.attempt-count strong').innerText(), '1');
        await home(); await page.reload(); await page.locator('.hero').waitFor(); await card('程序设计'); await index(2); assert.equal(await page.locator('.option.selected').count(), 0);
        assert.equal(await page.locator('.attempt-count strong').innerText(), '1');
        await home(); await card('基础知识'); await index(2); assert.equal(await page.locator('.option.selected .option-letter').innerText(), 'A');
        data = await snapshot(); assert.equal(data.records[bankId + '/a'].attempts, 2); assert.equal(data.records[bankId + '/b'].attempts, 1);
        assert.deepEqual(errors, []);
        console.log('PASS: ' + (mobile ? 'iPhone Safari' : 'desktop Chrome') + ' 9 cards, classification import/update, unchanged IDs and attempts, independent resume, historical selections, multi-select drafts and persistent manual clearing');
      } finally { await browser.close(); }
    }
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
