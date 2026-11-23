const { chromium, webkit, devices } = require(require.resolve('playwright', { paths: ['/Users/wangshanpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  for (const mobile of [false, true]) {
    const browser = await (mobile ? webkit : chromium).launch({ headless: true, ...(mobile ? {} : { channel: 'chrome' }) });
    try {
      const context = await browser.newContext({ serviceWorkers: 'block', ...(mobile ? devices['iPhone 13'] : { viewport: { width: 1440, height: 1000 } }) });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve(__dirname, '../题间·离线刷题.html')).href);
      await page.getByRole('heading', { name: '我的题库', exact: true }).waitFor();
      if (mobile) await page.locator('.operation-home-card').click();
      else await page.locator('.sidebar [data-view=operations]').click();
      await page.getByRole('heading', { name: '操作题训练', exact: true }).waitFor();
      assert.equal(await page.locator('.operation-unit-card').count(), 8);
      assert.equal(await page.locator('.operation-overview-stats strong').first().innerText(), '40');
      await page.locator('[data-unit=unit2-web]').click();
      assert.equal(await page.locator('.operation-task-row').count(), 5);
      await page.locator('#operation-search').fill('2.3.1');
      assert.equal(await page.locator('.operation-task-row').count(), 1);
      await page.locator('[data-id="2.3.1"]').last().click();
      await page.getByRole('heading', { name: '操作题 · 2.3.1' }).waitFor();
      assert(await page.locator('.operation-prompt').innerText().then(text => text.includes('animate')));
      assert(await page.locator('.operation-file').filter({ hasText: 'city_card.zip' }).isVisible());
      assert.equal(await page.locator('.operation-reference[open]').count(), 0);
      await page.locator('.operation-reference summary').click();
      assert(await page.locator('.operation-reference .operation-file').first().isVisible());
      await page.locator('[data-status=done]').click();
      await page.locator('#operation-note').fill('检查了自动轮播、悬停暂停和箭头切换。');
      await page.waitForFunction(() => document.querySelector('#operation-note-status')?.textContent === '已保存');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: '/tmp/tijian-operations-' + (mobile ? 'iphone' : 'desktop') + '.png', fullPage: true });
      await page.reload();
      await page.getByRole('heading', { name: '我的题库', exact: true }).waitFor();
      if (mobile) await page.locator('.operation-home-card').click();
      else await page.locator('.sidebar [data-view=operations]').click();
      await page.locator('[data-unit=unit2-web]').click();
      await page.locator('#operation-search').fill('2.3.1');
      await page.locator('.operation-task-row').click();
      assert.equal(await page.locator('.operation-status-text.status-done').count(), 1);
      assert.equal(await page.locator('#operation-note').inputValue(), '检查了自动轮播、悬停暂停和箭头切换。');
      assert.deepEqual(errors, []);
      console.log('PASS: ' + (mobile ? 'iPhone' : 'desktop') + ' operation task browse, materials, hidden references, progress and notes');
      await context.close();
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exit(1); });
