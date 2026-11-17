const { chromium, devices } = require(require.resolve('playwright', { paths: ['/Users/wangshanpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    res.end(path.basename(file) === 'config.js' ? 'window.TIJIAN_CLOUD_CONFIG = { enabled: false };' : fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const base = 'http://127.0.0.1:' + server.address().port;
    await page.goto(base + '/');
    await page.getByRole('heading', { name: '我的题库', exact: true }).waitFor();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    assert(await page.evaluate(async () => (await caches.keys()).some(key => key.startsWith('tijian-mobile-'))));
    await page.locator('[data-action=mode][data-mode=sequential]').tap();
    for (const letter of ['A', 'B', 'D']) await page.locator('[data-action=choose][data-label=' + letter + ']').tap();
    await page.locator('.question-footer [data-action=submit]').tap();
    await page.locator('.answer-panel.good').waitFor();
    await context.setOffline(true);
    await page.reload();
    await page.locator('[data-action=continue]').tap();
    await page.locator('.answer-panel.good').waitFor();
    assert(await page.locator('.mobile-focus-bar').isVisible());
    // Offline navigation also resolves to the installed application shell.
    await page.goto(base + '/offline-reopen');
    await page.getByRole('heading', { name: '我的题库', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: installed app caches all assets, reopens offline and retains answers');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exit(1); });
