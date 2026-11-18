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
        const context = await browser.newContext(mobile ? { ...devices['iPhone 13'], acceptDownloads: true } : { viewport: { width: 1440, height: 1040 }, acceptDownloads: true });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const click = selector => page.locator(selector).first().click();
        const home = async () => {
          if (await page.locator('body.focus-mode').count()) await click('.mobile-focus-bar [data-action=nav][data-view=home]');
          else if (!await page.locator('.hero').count()) await click((mobile ? '.mobile-nav' : '.sidebar') + ' [data-action=nav][data-view=home]');
          await page.locator('.hero').waitFor();
        };
        const mode = async name => { await click('[data-action=mode][data-mode=' + name + ']'); };
        const index = n => page.waitForFunction(n => document.querySelector('.question-count strong')?.textContent === String(n), n);
        const jump = async n => {
          if (mobile) { await click('.mobile-focus-bar [data-action=settings]'); await click('[data-action=settings-card]'); }
          await click('[data-action=jump][data-index="' + (n - 1) + '"]'); await index(n);
        };
        const configure = async (name, chapter) => {
          await click('[data-action=configure-mode][data-mode=' + name + ']');
          if (chapter !== undefined) await page.locator('#mode-chapter').selectOption(chapter);
          await click('[data-action=start-configured]');
        };
        const persisted = () => page.evaluate(() => new Promise((resolve, reject) => {
          const r = indexedDB.open('tijian-offline', 1); r.onerror = reject;
          r.onsuccess = () => { const get = r.result.transaction('workspace').objectStore('workspace').get('main'); get.onsuccess = () => { r.result.close(); resolve(get.result); }; get.onerror = reject; };
        }));
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.locator('.hero').waitFor();
        await click('[data-action=import]');
        const csv = '题型,章节,题目,选项A,选项B,答案\n单选题,第一章,单选一,甲,乙,A\n单选题,第一章,单选二,甲,乙,A\n单选题,第一章,单选三,甲,乙,A\n多选题,第一章,多选一,甲,乙,A|B\n多选题,第二章,多选二,甲,乙,A|B\n多选题,第二章,多选三,甲,乙,A|B\n判断题,第二章,判断一,,,正确\n判断题,第二章,判断二,,,正确\n';
        await page.locator('#csv-file').setInputFiles({ name: 'resume.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
        await click('[data-action=confirm-import]');
        await page.waitForFunction(() => document.querySelector('.hero h2')?.textContent === 'resume');
        await mode('sequential'); await index(1); await click('[data-action=choose][data-label=A]'); await jump(2); await home();
        await mode('single'); await index(2); // Historical records guide the first entry to an unseen question.
        await click('[data-action=choose][data-label=A]'); await jump(3); await home();
        await mode('multiple'); await index(1); await click('[data-action=choose][data-label=A]'); await jump(2); await click('[data-action=choose][data-label=B]'); await home();
        await mode('judgment'); await jump(2); await home();
        await mode('single'); await index(3); await home();
        await mode('multiple'); await index(2);
        assert.equal(await page.locator('.option.selected .option-letter').innerText(), 'B');
        await page.reload(); await page.locator('.hero').waitFor(); await mode('multiple'); await index(2);
        assert.equal(await page.locator('.option.selected .option-letter').innerText(), 'B');
        await jump(1); assert.equal(await page.locator('.option.selected .option-letter').innerText(), 'A'); await jump(2); await home();
        await mode('chapter'); await page.locator('#mode-chapter').selectOption('第一章'); await click('[data-action=start-configured]'); await index(3); await jump(4); await home();
        await configure('chapter', '第二章'); await jump(2); const chapterB = await page.locator('.question-text').innerText(); await home();
        await mode('chapter'); await index(2); assert.equal(await page.locator('.question-text').innerText(), chapterB); await home();
        await configure('chapter', '第一章'); await index(4); await home();
        await mode('random'); await page.locator('#mode-count').fill('3'); await click('[data-action=start-configured]'); await jump(3);
        const randomQuestion = await page.locator('.question-text').innerText(), before = await persisted(), randomIds = before.session.ids;
        await home(); await mode('sequential'); await index(2); assert.equal(await page.locator('.answer-panel').count(), 0); await home();
        await mode('random'); await index(3); assert.equal(await page.locator('.question-text').innerText(), randomQuestion);
        assert.deepEqual((await persisted()).session.ids, randomIds);
        // Complete a random round and verify that re-entry cannot silently start it again.
        for (let i = 1; i <= 3; i++) {
          await jump(i); await click('[data-action=choose][data-label=A]');
          if (await page.locator('[data-action=submit]').count()) { await click('[data-action=choose][data-label=B]'); await click('[data-action=submit]'); }
        }
        await home(); await mode('random'); await index(3); await page.locator('.answer-panel').waitFor();
        if (mobile) { await click('.mobile-focus-bar [data-action=settings]'); await click('[data-action=settings-card]'); }
        await click('[data-action=summary]'); await page.getByRole('heading', { name: '本轮练习完成' }).waitFor();
        await click('[data-action=next-random-round]'); await page.locator('.question-card').waitFor();
        assert((await persisted()).session.ids.every(id => !randomIds.includes(id)), 'next random round uses unseen questions');
        await home(); await mode('single'); await index(3);
        await click('.mobile-focus-bar [data-action=settings]'); await click('[data-action=restart-practice]'); await click('[data-action=confirm]'); await index(1);
        assert.equal(await page.locator('.answer-panel').count(), 0); assert.equal(await page.locator('.attempt-count strong').innerText(), '1');
        await home(); await mode('multiple'); await index(2); assert.equal(await page.locator('.option.selected .option-letter').innerText(), 'B');
        await home();
        await page.locator('#home-bank').selectOption('builtin-theory'); await mode('single'); await jump(3); await home();
        await page.locator('#home-bank').selectOption({ label: 'resume' }); await mode('single'); await index(1); await home();
        await page.locator('#home-bank').selectOption('builtin-theory'); await mode('single'); await index(3); await home();
        const snapshot = await persisted();
        assert(Object.keys(snapshot.practiceSessions).length >= 8);
        // Backup/restore goes through the same validation and migration as a cloud download.
        if (mobile) await click('.mobile-nav [data-action=nav][data-view=more]');
        await click((mobile ? '.more-links' : '.sidebar') + ' [data-action=nav][data-view=manage]');
        const downloaded = page.waitForEvent('download'); await click('[data-action=export-backup]');
        const backup = await downloaded, backupPath = '/tmp/tijian-resume-' + (mobile ? 'iphone' : 'desktop') + '.json'; await backup.saveAs(backupPath);
        assert(Object.keys(JSON.parse(fs.readFileSync(backupPath)).practiceSessions).length >= 8);
        await page.locator('#backup-file').setInputFiles(backupPath); await click('[data-action=confirm]'); await page.locator('.hero').waitFor();
        await page.locator('#home-bank').selectOption({ label: 'resume' }); await mode('multiple'); await index(2);
        assert.equal(await page.locator('.option.selected .option-letter').innerText(), 'B');
        assert.deepEqual(errors, []);
        console.log('PASS: ' + (mobile ? 'iPhone Safari' : 'desktop Chrome') + ' independent mode/chapter/bank resume, random order, drafts, reload, explicit restart and backup recovery');
      } finally { await browser.close(); }
    }
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
