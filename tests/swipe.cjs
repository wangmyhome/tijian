const { chromium, webkit, devices } = require(require.resolve('playwright', { paths: ['/Users/wangshanpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const useWebkit = process.env.MOBILE_BROWSER === 'webkit';
  const browser = await (useWebkit ? webkit : chromium).launch({ headless: true, ...(useWebkit ? {} : { channel: 'chrome' }) });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', ...devices['iPhone 13'] }), page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await context.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.TIJIAN_CLOUD_CONFIG = { enabled: false };' }));
    const cdp = useWebkit ? null : await context.newCDPSession(page);
    const index = async n => page.waitForFunction(value => document.querySelector('.question-count strong')?.textContent === String(value), n);
    const swipe = async (dx, dy = 0, options = {}) => {
      const locator = page.locator(options.selector || '.question-text').first();
      if (cdp && !options.synthetic) {
        await locator.scrollIntoViewIfNeeded();
        const box = await locator.boundingBox(), x = dx < 0 ? 280 : 100, y = box.y + Math.min(box.height / 2, 30);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 5, y: y + dy * i / 5 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await locator.evaluate((target, { dx, dy, options }) => {
          const rect = target.getBoundingClientRect(), x = options.edge ? 10 : dx < 0 ? 280 : 100, y = rect.y + 10;
          const point = (offsetX, offsetY, identifier = 1) => ({ identifier, clientX: x + offsetX, clientY: y + offsetY });
          const send = (type, touches, changedTouches = touches) => {
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: changedTouches } }); target.dispatchEvent(event);
          };
          send('touchstart', options.pinch ? [point(0, 0), point(20, 20, 2)] : [point(0, 0)]);
          send('touchmove', [point(dx, dy)]);
          send(options.cancel ? 'touchcancel' : 'touchend', [], [point(dx, dy)]);
        }, { dx, dy, options });
      }
    };
    await page.goto(process.env.MOBILE_URL || pathToFileURL(path.resolve(__dirname, '../题间·离线刷题.html')).href);
    await page.getByRole('heading', { name: '我的题库', exact: true }).waitFor();
    await page.locator('.topbar [data-action=import]').tap();
    await page.locator('#csv-file').setInputFiles({ name: '滑动测试.csv', mimeType: 'text/csv', buffer: Buffer.from('题型,题目,选项A,选项B,答案\n单选题,第一题,甲,乙,A\n多选题,第二题,甲,乙,A|B\n判断题,第三题,,,正确\n') });
    await page.locator('[data-action=confirm-import]').tap();
    await page.waitForFunction(() => document.querySelector('.hero h2')?.textContent === '滑动测试');
    await page.locator('[data-action=mode][data-mode=sequential]').tap(); await index(1);
    await swipe(-140, 0, { selector: '.option' }); await index(2);
    assert.equal(await page.locator('.option.selected,.answer-panel').count(), 0, 'swiping an option must not choose or grade');
    await swipe(140); await index(1);
    assert.equal(await page.locator('.answer-panel').count(), 0);
    for (const [dx, dy, extra] of [[-140, 0, { edge: true }], [-140, 0, { pinch: true }], [-140, 0, { cancel: true }], [-40, 0, {}], [-100, 100, {}], [0, 150, {}]]) {
      await swipe(dx, dy, { ...extra, synthetic: true }); await index(1);
    }
    await page.locator('.option[data-label=A]').tap(); await page.locator('.answer-panel.good').waitFor();
    await swipe(-140, 0, { selector: '.option' }); await index(2);
    await swipe(140); await index(1); await page.locator('.answer-panel.good').waitFor();
    await swipe(140); await index(1);
    await swipe(-140); await index(2);
    await swipe(-140); await index(3);
    await swipe(-140); await index(3);
    assert.equal(await page.locator('.complete-card').count(), 0, 'swipe at last question stays in practice');
    await page.reload(); await page.locator('[data-action=continue]').tap(); await index(3);
    await swipe(140); await index(2);
    await swipe(140); await index(1); await page.locator('.answer-panel.good').waitFor();
    console.log('PASS: swipe directions, option ghost-click prevention, boundaries and saved progress');

    await page.locator('[data-action=toggle-note]').tap(); await page.locator('#question-note').fill('滑动不会打断笔记');
    await swipe(-140, 0, { synthetic: true }); await index(1);
    await page.locator('[data-action=note-done]').tap();
    await page.locator('.mobile-reading-settings').tap(); await page.locator('[data-action=settings-card]').tap();
    await swipe(-140, 0, { synthetic: true }); await index(1);
    await page.locator('.mobile-sheet-dismiss').tap();
    await page.setViewportSize({ width: 1440, height: 1040 });
    await swipe(-140, 0, { synthetic: true }); await index(1);
    await page.setViewportSize({ width: 390, height: 844 });
    console.log('PASS: vertical gestures, short drags, pinch, cancellation, edges, note editing, answer sheet and desktop guards');

    await page.locator('.mobile-focus-bar>[data-action=nav]').tap();
    await page.locator('[data-action=mode][data-mode=exam]').tap();
    for (let i = 0; i < 3; i++) await page.locator('#exam-count-' + i).fill('1');
    await page.locator('[data-action=exam-start]').tap(); await page.locator('.exam-timer').waitFor({ state: 'attached' }); await index(1);
    await page.locator('[data-action=exam-choose][data-label=A]').tap();
    await swipe(-140); await index(2); await swipe(140); await index(1);
    assert.equal(await page.locator('.option.selected').count(), 1);
    await swipe(-140); await index(2); await swipe(-140); await index(3);
    await swipe(-140); await index(3);
    assert.equal(await page.locator('[role=dialog]:visible').count(), 0, 'swipe never submits an exam');
    await page.locator('.mobile-reading-settings').tap(); await page.locator('[data-action=settings-card]').tap(); await page.locator('.answer-card [data-action=exam-submit]').tap();
    await page.getByRole('heading', { name: '确认交卷？', exact: true }).waitFor();
    await swipe(140, 0, { synthetic: true }); await index(3);
    await page.locator('[data-action=confirm]').tap();
    await page.getByRole('heading', { name: '考试成绩', exact: true }).waitFor();
    await page.locator('[data-action=exam-review][data-filter=""]').tap(); await index(1);
    await swipe(-140); await index(2); await swipe(140); await index(1);
    assert.deepEqual(errors, []);
    console.log('PASS: exam answers persist across swipes; confirmation guards and post-exam review work');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
