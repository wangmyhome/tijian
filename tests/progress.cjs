const { chromium } = require(require.resolve('playwright', { paths: ['/Users/wangshanpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1040 }, colorScheme: 'light' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const home = async () => {
      await page.locator('.mobile-focus-bar [data-action=nav][data-view=home]').click();
      assert(await page.locator('.sidebar').isVisible());
      assert(await page.locator('.topbar').isVisible());
    };
    const start = async mode => {
      if (mode) await page.locator('[data-action=mode][data-mode=' + mode + ']').click();
      else await page.locator('[data-action=start-configured]').click();
      if (await page.locator('[data-action=confirm]').isVisible()) await page.locator('[data-action=confirm]').click();
      await page.locator('.question-card').waitFor();
      assert(!await page.locator('.sidebar').isVisible());
      assert(!await page.locator('.topbar').isVisible());
      assert.equal(await page.locator('.content .page-head').count(), 0);
      assert(await page.locator('.answer-card').isVisible());
      assert(await page.locator('.mobile-focus-bar').isVisible());
    };
    const assertFreshHistory = async text => {
      assert.equal(await page.locator('.question-text').innerText(), text);
      assert.match(await page.locator('.question-labels .history-badge').innerText(), /已练/);
      assert.equal(await page.locator('.number-button.current.historical').count(), 1);
      assert.equal(await page.locator('.answer-panel, .option.selected, .option[disabled]').count(), 0);
    };
    await page.goto(pathToFileURL(path.resolve(__dirname, '../题间·离线刷题.html')).href);
    await page.getByRole('heading', { name: '我的题库', exact: true }).waitFor();
    await page.locator('.topbar [data-action=import]').click();
    const csv = '题型,章节,题目,选项A,选项B,答案\n多选题,第一章/基础,已练正确题,甲,乙,A|B\n多选题,第一章/基础,已练错误题,丙,丁,A|B\n单选题,第一章/基础,未练单选题,戊,己,A\n判断题,第二章,未练判断题,,,正确\n';
    await page.locator('#csv-file').setInputFiles({ name: 'progress.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.locator('[data-action=confirm-import]').click();
    await page.waitForFunction(() => document.querySelector('.hero h2')?.textContent === 'progress');
    await start('sequential');
    for (const label of ['A', 'B']) await page.locator('[data-action=choose][data-label=' + label + ']').click();
    await page.locator('[data-action=submit]').click();
    await page.locator('.answer-panel.good').waitFor();
    await page.locator('[data-action=favorite]').click();
    await page.locator('[data-action=next]').click();
    await page.locator('[data-action=choose][data-label=A]').click();
    await page.locator('[data-action=submit]').click();
    await page.locator('.answer-panel.bad').waitFor();
    assert.match(await page.locator('.focus-save').innerText(), /已保存到本机/);
    await home();
    for (const mode of ['sequential', 'random']) {
      assert.equal(await page.locator('[data-mode=' + mode + '] .mode-progress').innerText(), '已练 2 / 未练 2');
    }
    for (const mode of ['wrong', 'favorite']) {
      assert.equal(await page.locator('[data-mode=' + mode + '] .mode-progress').innerText(), '已练 1 / 未练 0');
    }
    for (const mode of ['chapter', 'type']) assert.equal(await page.locator('[data-action=mode][data-mode=' + mode + ']').count(), 0);
    assert.equal(await page.locator('[data-mode=multiple] .mode-progress').innerText(), '已练 2 / 未练 0');
    for (const mode of ['single', 'judgment']) assert.equal(await page.locator('[data-mode=' + mode + '] .mode-progress').innerText(), '已练 0 / 未练 1');
    await start('multiple');
    await assertFreshHistory('已练正确题');
    await page.screenshot({ path: '/tmp/tijian-cross-mode-progress.png', fullPage: true });
    // Re-answering increases attempts without counting the same question twice.
    for (const label of ['B', 'A']) await page.locator('[data-action=choose][data-label=' + label + ']').click();
    await page.locator('[data-action=submit]').click();
    await page.locator('.answer-panel.good').waitFor();
    assert.equal(await page.locator('.attempt-count strong').innerText(), '2');
    await page.reload();
    await page.locator('[data-action=continue]').click();
    await page.locator('.answer-panel.good').waitFor();
    assert.equal(await page.locator('.attempt-count strong').innerText(), '2');
    await home();
    assert.equal(await page.locator('[data-mode=sequential] .mode-progress').innerText(), '已练 2 / 未练 2');
    console.log('PASS: cross-mode history, unique progress and attempts persist after reload');

    await page.locator('[data-action=mode][data-mode=random]').click();
    await page.locator('#mode-chapter').selectOption('第一章');
    await page.locator('#mode-status').selectOption('done');
    await start();
    assert.equal(await page.locator('.number-button.historical').count(), 2);
    assert.equal(await page.locator('.answer-panel').count(), 0);
    assert.match(await page.locator('.question-count').innerText(), /\/ 2/);
    await home();
    await page.locator('[data-action=mode][data-mode=random]').click();
    await page.locator('#mode-status').selectOption('done');
    await start();
    assert.equal(await page.locator('.number-button.historical').count(), 2);
    await home();
    await page.locator('[data-action=mode][data-mode=random]').click();
    await page.locator('#mode-type').selectOption('多选题');
    await page.locator('#mode-type').selectOption('多选题');
    await page.locator('#mode-status').selectOption('new');
    assert(await page.locator('[data-action=start-configured]').isDisabled());
    await page.locator('#mode-type').selectOption('单选题');
    await start();
    assert.equal(await page.locator('.question-text').innerText(), '未练单选题');
    assert.equal(await page.locator('.history-badge[data-practiced=false]').count(), 1);
    assert.equal(await page.locator('.number-button.historical').count(), 0);
    await home();
    await start('wrong');
    await assertFreshHistory('已练错误题');
    await home();
    await start('favorite');
    await assertFreshHistory('已练正确题');
    await home();
    await page.locator('[data-action=search-view]').click();
    await page.locator('#collection-bank').selectOption({ label: 'progress' });
    await page.locator('#collection-status').selectOption('done');
    assert.equal(await page.locator('.question-item').count(), 2);
    assert.equal(await page.locator('.question-item .history-badge[data-practiced=true]').count(), 2);
    await page.locator('#collection-status').selectOption('new');
    assert.equal(await page.locator('.question-item').count(), 2);
    assert.equal(await page.locator('.question-item .history-badge[data-practiced=false]').count(), 2);
    console.log('PASS: direct type practice, random filters, wrong, favorite and search share practice status');

    const themes = [
      ['classic-light', '明亮', 'rgb(246, 247, 249)'],
      ['classic-dark', '黑夜', 'rgb(23, 29, 32)'],
      ['classic-eye', '护眼', 'rgb(237, 240, 227)'],
      ['light', '浅色', 'rgb(246, 247, 250)'],
      ['dark', '深色', 'rgb(11, 13, 18)'],
      ['eye', '护眼绿', 'rgb(201, 226, 198)'],
      ['solar', '暖米黄', 'rgb(243, 236, 218)']
    ];
    for (const [id, name, color] of themes) {
      await page.locator('.topbar [data-action=settings]').click();
      assert.equal(await page.locator('[data-action=setting-theme]').count(), 8);
      const choice = page.locator('[data-action=setting-theme][data-value=' + id + ']');
      assert.equal(await choice.innerText(), name);
      await choice.click();
      await page.waitForFunction(theme => document.body.dataset.theme === theme, id);
      assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), color);
      await page.reload();
      await page.getByRole('heading', { name: '我的题库', exact: true }).waitFor();
      assert.equal(await page.locator('body').getAttribute('data-theme'), id);
    }
    await page.locator('.topbar [data-action=settings]').click();
    await page.locator('[data-action=setting-theme][data-value=classic-light]').click();
    await page.waitForFunction(() => document.body.dataset.theme === 'classic-light');
    await page.screenshot({ path: '/tmp/tijian-all-themes-settings.png', fullPage: true });
    await page.locator('[data-action=setting-theme][data-value=system]').click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.body.dataset.theme === 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.body.dataset.theme === 'light');
    assert.deepEqual(errors, []);
    console.log('PASS: all seven palettes and system theme remain available and persist');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
