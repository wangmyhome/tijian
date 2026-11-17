const { chromium, devices } = require(require.resolve('playwright', { paths: ['/Users/wangshanpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    let row = null, tokens = 0;
    const errors = [], credentials = new Set();
    const create = async options => {
      const context = await browser.newContext({ ...options, serviceWorkers: 'allow', acceptDownloads: true }), connection = { offline: false };
      await context.route('https://plgqouambkntvxjzajww.supabase.co/**', async route => {
        if (connection.offline) return route.abort('internetdisconnected');
        const request = route.request(), url = new URL(request.url()), body = request.postDataJSON();
        const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
        if (url.pathname.endsWith('/token')) {
          if (url.searchParams.get('grant_type') === 'password' && (body.email !== 'admin@tijian.local' || body.password !== 'test-password')) return reply({ error_code: 'invalid_credentials' }, 400);
          const access_token = 'test-access-' + (++tokens); credentials.add(access_token);
          return reply({ access_token, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'test-admin', email: 'admin@tijian.local' } });
        }
        if (!credentials.has((request.headers().authorization || '').replace('Bearer ', ''))) return reply({}, 401);
        if (url.pathname.endsWith('/logout')) return reply({});
        if (url.pathname.endsWith('/tijian_workspaces')) return reply(!row ? [] : [url.searchParams.get('select').includes('payload') ? row : { revision: row.revision, updated_at: row.updated_at }]);
        if (url.pathname.endsWith('/tijian_save_workspace')) {
          if (body.expected_revision !== (row?.revision || 0)) return reply({ ok: false, ...row });
          row = { revision: (row?.revision || 0) + 1, payload: body.workspace_payload, updated_at: new Date().toISOString() };
          return reply({ ok: true, revision: row.revision, updated_at: row.updated_at });
        }
        return reply({}, 404);
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      const login = async password => {
        await page.locator('#login-password').fill(password || 'test-password');
        await page.locator('#login-form [type=submit]').click();
      };
      const synced = () => page.waitForFunction(() => [...document.querySelectorAll('.cloud-status')].some(el => el.dataset.status === 'synced'));
      const syncNow = async (status = 'synced') => {
        await page.locator('.topbar [data-action=account]').click();
        await page.locator('[data-action=sync-now]').click();
        await page.waitForFunction(value => [...document.querySelectorAll('.cloud-status')].some(el => el.dataset.status === value), status);
        await page.locator('.modal-header [data-action=close-modal]').click();
      };
      await page.goto('http://127.0.0.1:' + server.address().port + '/');
      await page.getByRole('heading', { name: '登录题间' }).waitFor();
      return { page, context, connection, login, synced, syncNow };
    };
    const desktop = await create({ viewport: { width: 1440, height: 1040 } }), a = desktop.page;
    await a.screenshot({ path: '/tmp/tijian-login-desktop.png', scale: 'css' });
    await desktop.login('wrong'); await a.locator('#login-error').filter({ hasText: '账号或密码错误' }).waitFor();
    assert.equal(row, null, 'incorrect credentials cannot initialize or read cloud data');
    await desktop.login(); await desktop.synced();
    await a.getByRole('heading', { name: '我的题库', exact: true }).waitFor();
    await a.locator('[data-action=mode][data-mode=sequential]').click();
    for (const label of ['A', 'B', 'D']) await a.locator('[data-action=choose][data-label=' + label + ']').click();
    await a.locator('[data-action=submit]').click(); await a.locator('.answer-panel.good').waitFor();
    await a.locator('[data-action=favorite]').click(); await a.locator('[data-action=toggle-note]').click();
    await a.locator('#question-note').fill('电脑写的同步笔记');
    await a.waitForFunction(() => document.querySelector('#note-status')?.textContent === '已保存');
    await a.locator('[data-action=note-done]').click();
    await a.locator('.mobile-focus-bar [data-action=nav]').click(); await desktop.syncNow();
    const firstRecord = Object.keys(row.payload.records)[0];
    assert.equal(row.payload.records[firstRecord].note, '电脑写的同步笔记');

    const phone = await create({ ...devices['iPhone 13'] }), b = phone.page;
    await b.screenshot({ path: '/tmp/tijian-login-phone.png', scale: 'css' });
    await phone.login(); await phone.synced();
    for (const width of [320, 390, 430]) { await b.setViewportSize({ width, height: 844 }); assert(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
    await b.setViewportSize({ width: 390, height: 844 });
    await b.locator('[data-action=continue]').tap(); await b.locator('.answer-panel.good').waitFor();
    assert.equal(await b.locator('#question-note').inputValue(), '电脑写的同步笔记');
    assert.equal(await b.locator('[data-action=favorite]').innerText(), '已收藏');
    await b.locator('.mobile-focus-bar [data-action=nav]').tap();
    console.log('PASS: desktop login uploads progress, favorite and notes; iPhone login downloads them without replacing the cloud');

    // A network outage retains the dirty checkpoint across a page reload.
    await b.waitForFunction(() => !!navigator.serviceWorker.controller);
    phone.connection.offline = true; await phone.context.setOffline(true);
    await b.locator('[data-action=continue]').tap();
    await b.locator('[data-action=toggle-note]').tap();
    await b.locator('#question-note').fill('手机断网时写的笔记');
    await b.waitForFunction(() => document.querySelector('#note-status')?.textContent === '已保存');
    await b.locator('[data-action=note-done]').tap();
    await b.locator('.mobile-focus-bar [data-action=nav]').tap();
    await phone.syncNow('offline');
    await b.reload(); await b.getByRole('heading', { name: '我的题库', exact: true }).waitFor();
    await b.waitForFunction(() => [...document.querySelectorAll('.cloud-status')].some(el => el.dataset.status === 'offline'));
    phone.connection.offline = false; await phone.context.setOffline(false); await b.evaluate(() => dispatchEvent(new Event('online'))); await phone.synced();
    assert.equal(row.payload.records[firstRecord].note, '手机断网时写的笔记');
    await a.evaluate(() => dispatchEvent(new Event('focus')));
    await a.waitForFunction(() => document.querySelector('.hero-progress strong')?.textContent.includes('1'));
    await a.locator('[data-action=continue]').click();
    await a.waitForFunction(() => document.querySelector('#question-note')?.value === '手机断网时写的笔记');
    console.log('PASS: offline note survives reload, uploads on reconnect and appears on the other device');

    // Concurrent edits are preserved and require a deliberate choice.
    desktop.connection.offline = true;
    await a.locator('[data-action=toggle-note]').click(); await a.locator('#question-note').fill('电脑尚未上传的笔记');
    await a.waitForFunction(() => document.querySelector('#note-status')?.textContent === '已保存');
    await a.locator('[data-action=note-done]').click(); await a.locator('.mobile-focus-bar [data-action=nav]').click();
    await b.locator('[data-action=continue]').tap(); await b.locator('[data-action=favorite]').tap();
    await b.locator('.mobile-focus-bar [data-action=nav]').tap(); await phone.syncNow();
    desktop.connection.offline = false; await a.evaluate(() => dispatchEvent(new Event('online')));
    await a.waitForFunction(() => [...document.querySelectorAll('.cloud-status')].some(el => el.dataset.status === 'conflict'));
    await a.locator('.topbar [data-action=account]').click();
    await a.locator('.sync-conflict').waitFor();
    await a.screenshot({ path: '/tmp/tijian-sync-conflict.png', scale: 'css' });
    assert.equal(row.payload.records[firstRecord].note, '手机断网时写的笔记');
    await a.locator('[data-action=sync-remote]').click(); await desktop.synced();
    await a.locator('[data-action=sync-backups]').click();
    assert(await a.locator('[data-action=export-sync-backup]').count() >= 2);
    const downloadPromise = a.waitForEvent('download'); await a.locator('[data-action=export-sync-backup]').first().click();
    const download = await downloadPromise; await download.saveAs('/tmp/tijian-cloud-conflict-backup.json');
    assert(Object.values(JSON.parse(fs.readFileSync('/tmp/tijian-cloud-conflict-backup.json', 'utf8')).records).some(r => r.note === '电脑尚未上传的笔记'));
    await a.locator('.topbar [data-action=account]').click(); await a.locator('[data-action=account-logout]').click();
    await a.getByRole('heading', { name: '登录题间' }).waitFor();
    await a.reload(); await a.getByRole('heading', { name: '登录题间' }).waitFor();
    assert(!await a.locator('.question-card').isVisible());
    await desktop.login(); await desktop.synced();
    assert.deepEqual(errors, []);
    console.log('PASS: simultaneous changes pause safely, both backups are exportable, cloud choice works and logout requires authentication again');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exit(1); });
