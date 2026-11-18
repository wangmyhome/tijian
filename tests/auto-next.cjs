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
      const browser = await (mobile ? webkit : chromium).launch({ headless: true, ...(mobile ? {} : { channel: 'chrome' }) });
      try {
        const context = await browser.newContext({ serviceWorkers: 'block', ...(mobile ? devices['iPhone 13'] : { viewport: { width: 1440, height: 1040 } }) });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const now = new Date('2026-11-18T08:00:00Z');
        await page.clock.install({ time: now }); await page.clock.pauseAt(new Date(now.getTime() + 1000));
        const click = selector => page.locator(selector).first().click();
        const settings = () => click('.mobile-focus-bar [data-action=settings]');
        const close = () => click('.modal-footer [data-action=close-modal]');
        const index = n => page.locator('.question-count strong').filter({ hasText: new RegExp('^' + n + '$') }).waitFor({ state: 'attached' });
        const current = async n => assert.equal(await page.locator('.question-count strong').innerText(), String(n));
        const storedSettings = () => page.evaluate(() => new Promise((resolve, reject) => {
          const r = indexedDB.open('tijian-offline', 1); r.onerror = reject;
          r.onsuccess = () => { const get = r.result.transaction('workspace').objectStore('workspace').get('main'); get.onsuccess = () => { r.result.close(); resolve(get.result.settings); }; get.onerror = reject; };
        }));
        const setDelay = async value => { await page.locator('#auto-next-delay').fill(value); await page.locator('#auto-next-delay').press('Tab'); };
        const next = async n => { await page.keyboard.press('ArrowRight'); await index(n); };
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.locator('.hero').waitFor(); await click('[data-action=import]');
        const csv = '题型,题目,选项A,选项B,答案\n' + Array.from({ length: 8 }, (_, i) => (i === 2 ? '多选题' : i === 5 ? '判断题' : '单选题') + ',计时题' + (i + 1) + ',甲,乙,' + (i === 2 ? 'A|B' : 'A')).join('\n');
        await page.locator('#csv-file').setInputFiles({ name: 'auto-next.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
        await click('[data-action=confirm-import]'); await page.locator('.hero h2').filter({ hasText: 'auto-next' }).waitFor();
        await click('[data-action=mode][data-mode=sequential]'); await index(1);
        await settings(); assert.equal(await page.locator('#auto-next-delay').inputValue(), '1.6');
        await setDelay('2.5');
        await page.locator('[data-setting=autoCorrect]').check(); await page.locator('[data-setting=autoWrong]').check();
        assert.equal((await storedSettings()).autoNextDelay, 2.5); await close();
        await click('[data-action=choose][data-label=A]'); await page.locator('.answer-panel.good').waitFor();
        await page.clock.runFor(2499); await current(1); await page.clock.runFor(1); await index(2);
        await click('[data-action=choose][data-label=B]'); await page.locator('.answer-panel.bad').waitFor();
        await page.clock.runFor(2499); await current(2); await page.clock.runFor(1); await index(3);
        await click('[data-action=choose][data-label=A]'); await click('[data-action=choose][data-label=B]');
        await page.clock.runFor(10000); await current(3);
        await click('[data-action=submit]'); await page.locator('.answer-panel.good').waitFor();
        await page.clock.runFor(2499); await current(3); await page.clock.runFor(1); await index(4);
        await settings(); await setDelay('0.75'); await page.locator('[data-setting=autoCorrect]').uncheck(); await close();
        await click('[data-action=choose][data-label=A]'); await page.locator('.answer-panel.good').waitFor();
        await page.clock.runFor(10000); await current(4); await next(5);
        await settings(); await setDelay('0'); await page.locator('[data-setting=autoCorrect]').check(); await close();
        await click('[data-action=choose][data-label=A]'); await page.locator('.answer-panel.good').waitFor();
        await page.clock.runFor(1); await index(6);
        await settings(); await setDelay('1.25'); await close();
        await click('[data-action=choose][data-label=A]'); await page.locator('.answer-panel.good').waitFor();
        await settings(); await page.clock.runFor(5000); await close(); await current(6);
        await next(7); await page.reload(); await page.locator('.hero').waitFor();
        await click('[data-action=mode][data-mode=sequential]'); await index(7); await settings();
        assert.equal(await page.locator('#auto-next-delay').inputValue(), '1.25');
        assert(await page.locator('[data-setting=autoCorrect]').isChecked()); assert(await page.locator('[data-setting=autoWrong]').isChecked());
        for (const invalid of ['', '-1', '61']) {
          await setDelay(invalid); assert.equal(await page.locator('#auto-next-delay').inputValue(), '1.25');
          assert.equal((await storedSettings()).autoNextDelay, 1.25);
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.locator('[data-setting=autoWrong]').uncheck(); await close();
        await click('[data-action=choose][data-label=A]'); await page.locator('.answer-panel.good').waitFor();
        await page.clock.runFor(1249); await current(7); await page.clock.runFor(1); await index(8);
        await click('[data-action=choose][data-label=B]'); await page.locator('.answer-panel.bad').waitFor();
        await page.clock.runFor(5000); await current(8);
        assert.deepEqual(errors, []);
        console.log('PASS: ' + (mobile ? 'iPhone Safari' : 'desktop Chrome') + ' custom decimal/zero delays, exact timers, correct/wrong switches, multi-select submit, settings cancellation, invalid values and reload persistence');
      } finally { await browser.close(); }
    }
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
