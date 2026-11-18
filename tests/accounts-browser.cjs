// Browser tests backed by the actual SQL/RLS in an isolated local PostgreSQL runtime.
const { chromium, devices } = require(require.resolve('playwright', { paths: ['/Users/wangshanpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const assert = require('node:assert/strict');
const C = require('../core.js');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createDatabase, migration, fixture, read, write, ADMIN, LEARNER } = require('./shared-backend.cjs');
(async () => {
  const db = await createDatabase(); await db.exec(migration());
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + (req.url === '/' ? '/index.html' : new URL(req.url, 'http://local').pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [], tokens = new Map(); let nextToken = 0, sqlQueue = Promise.resolve();
  const queued = fn => { const result = sqlQueue.catch(() => {}).then(fn); sqlQueue = result; return result; };
  try {
    async function device(options = {}) {
      const context = await browser.newContext({ ...options, serviceWorkers: 'block', acceptDownloads: true });
      const connection = { offline: false };
      await context.route('https://plgqouambkntvxjzajww.supabase.co/**', async route => {
        if (connection.offline) return route.abort('internetdisconnected');
        const req = route.request(), url = new URL(req.url()), body = req.postDataJSON();
        const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
        if (url.pathname.endsWith('/token')) {
          const id = ({ 'admin@tijian.local': ADMIN, '10001@tijian.local': LEARNER })[body.email];
          if (!id || body.password !== 'test-password') return reply({ error_code: 'invalid_credentials' }, 400);
          const access_token = 'test-' + ++nextToken; tokens.set(access_token, id);
          return reply({ access_token, refresh_token: 'refresh-' + nextToken, expires_at: Date.now() / 1000 + 3600, user: { id, email: body.email } });
        }
        const id = tokens.get((req.headers().authorization || '').replace('Bearer ', ''));
        if (!id) return reply({}, 401);
        if (url.pathname.endsWith('/logout')) return reply({});
        try {
          if (url.pathname.endsWith('/tijian_read_workspace')) return reply(await queued(() => read(db, id, body.known_revision, body.known_bank_revision)));
          if (url.pathname.endsWith('/tijian_save_account_workspace')) return reply(await queued(() => write(db, id, body.expected_revision, body.expected_bank_revision, body.workspace_payload)));
          return reply({}, 404);
        } catch (error) { return reply({ code: error.code }, error.code === '42501' ? 403 : 400); }
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:' + server.address().port + '/');
      const login = async name => {
        await page.locator('#login-username').fill(name); await page.locator('#login-password').fill('test-password');
        await page.locator('#login-form [type=submit]').click();
        await page.getByRole('heading', { name: '我的题库', exact: true }).waitFor(); await synced();
      };
      const synced = () => page.waitForFunction(() => [...document.querySelectorAll('.cloud-status')].some(e => e.dataset.status === 'synced'));
      const nav = async view => {
        if (await page.locator('body.focus-mode').count()) await page.locator('.mobile-focus-bar [data-action=nav][data-view=home]').click();
        if (view !== 'home') await page.locator('.sidebar [data-action=nav][data-view=' + view + ']').click();
      };
      const syncNow = async () => { await page.evaluate(() => dispatchEvent(new Event('online'))); await synced(); };
      const logout = async () => { await nav('home'); await page.locator('.topbar [data-action=account]').click(); await page.locator('[data-action=account-logout]').click(); await page.locator('#login-form').waitFor(); };
      const note = async value => { await page.locator('[data-action=toggle-note]').click(); await page.locator('#question-note').fill(value); await page.waitForFunction(() => document.querySelector('#note-status')?.textContent === '已保存'); await page.locator('[data-action=note-done]').click(); };
      return { page, context, connection, login, synced, nav, syncNow, logout, note };
    }
    const d = await device({ viewport: { width: 1440, height: 1000 } }), a = d.page;
    // Existing unscoped storage belongs to admin. A learner must never adopt it.
    const legacy = fixture(), qkey = 'b/' + legacy.banks[0].questions[0].id;
    legacy.records[qkey] = { attempts: 1, right: 0, wrong: 1, lastCorrect: false, favorite: true, inWrong: true, note: 'admin-private', history: [{ at: new Date().toISOString(), correct: false }] };
    await a.evaluate(async snapshot => {
      const request = indexedDB.open('tijian-offline', 1);
      await new Promise((resolve, reject) => { request.onsuccess = () => { const tx = request.result.transaction('workspace', 'readwrite'); tx.objectStore('workspace').put(snapshot, 'main'); tx.oncomplete = resolve; tx.onerror = reject; }; });
    }, legacy);
    await d.login('10001');
    assert.equal(await a.locator('.bank-row').count(), 0);
    assert.equal(await a.locator('[data-action=import]').count(), 0);
    await d.logout(); await d.login('admin');
    assert.equal(await a.locator('.bank-row').count(), 1);
    assert.equal((await queued(() => read(db, ADMIN))).payload.records[qkey].note, 'admin-private');
    // Admin exports the selected bank from both entries; only question data is included.
    const downloadBank = async selector => {
      const event = a.waitForEvent('download'); await a.locator(selector).click();
      const download = await event, exportPath = '/tmp/tijian-admin-bank.csv';
      assert(download.suggestedFilename().endsWith('.csv')); await download.saveAs(exportPath);
      const text = fs.readFileSync(exportPath, 'utf8'), rows = C.inspect(C.parseCSV(text));
      assert(text.startsWith('\uFEFF')); assert(!text.includes('admin-private'));
      assert(rows.every(row => !row.validation));
      assert.deepEqual(rows.map(row => row.q), legacy.banks[0].questions);
    };
    await downloadBank('.bank-row [data-action=export-bank]');
    await d.nav('manage'); await a.locator('#export-bank').selectOption('b');
    await downloadBank('[data-action=export-bank]');
    console.log('PASS: admin exports a reimportable CSV from the bank list and backup page without personal records');
    await d.logout(); await d.login('10001');
    assert.equal(await a.locator('.bank-row').count(), 1);
    for (const action of ['import', 'rename-bank', 'delete-bank', 'template', 'export-bank']) assert.equal(await a.locator('[data-action=' + action + ']').count(), 0);
    let unauthorizedDownloads = 0; a.on('download', () => unauthorizedDownloads++);
    await a.evaluate(() => { const button = document.createElement('button'); button.id = 'forged-export'; button.dataset.action = 'export-bank'; button.dataset.id = 'b'; button.textContent = 'forged export'; document.body.append(button); });
    await a.locator('#forged-export').evaluate(el => el.click());
    await a.locator('#toast').filter({ hasText: '只有管理员' }).waitFor();
    assert.equal(unauthorizedDownloads, 0); await a.locator('#forged-export').evaluate(el => el.remove());
    await d.nav('manage'); assert.equal(await a.locator('[data-action=export-bank], #export-bank').count(), 0); await a.locator('.sidebar [data-view=home]').click();
    console.log('PASS: learners have no export entry and a forged export action is rejected without a download');
    assert.equal(await a.locator('.topbar .account-button span').innerText(), '10001');
    await a.locator('[data-action=mode][data-mode=sequential]').click();
    assert.equal(await a.locator('[data-practiced=false]').first().innerText(), '未练过');
    assert.equal(await a.locator('#question-note').count(), 0);
    assert.equal(await a.locator('[data-action=favorite]').innerText(), '收藏题目');
    await a.locator('[data-action=choose][data-label=A]').click();
    await a.locator('.answer-panel.good').waitFor(); await d.note('learner-private');
    await d.nav('home'); await d.syncNow();
    assert.equal((await queued(() => read(db, LEARNER))).payload.records[qkey].note, 'learner-private');
    assert.equal((await queued(() => read(db, ADMIN))).payload.records[qkey].note, 'admin-private');
    await a.screenshot({ path: '/tmp/tijian-learner-home.png' });
    console.log('PASS: legacy admin data is never adopted by learners; same-browser login switches records/notes/favorites without leaking permissions');

    const admin = await device({ viewport: { width: 1440, height: 1000 } }); await admin.login('admin');
    d.connection.offline = true;
    await a.locator('[data-action=continue]').click(); await d.note('learner-offline'); await d.nav('home');
    await admin.page.locator('[data-action=rename-bank]').click(); await admin.page.locator('#bank-new-name').fill('更新后的共享题库'); await admin.page.locator('[data-action=save-bank-name]').click(); await admin.syncNow();
    d.connection.offline = false; await d.syncNow();
    await a.waitForFunction(() => document.querySelector('.hero h2')?.textContent === '更新后的共享题库');
    let learner = await queued(() => read(db, LEARNER));
    assert.equal(learner.payload.records[qkey].note, 'learner-offline');
    assert.equal(learner.payload.records[qkey].attempts, 1);
    await a.reload(); await a.getByRole('heading', { name: '我的题库', exact: true }).waitFor(); await d.synced();
    await a.locator('[data-action=continue]').click(); assert.equal(await a.locator('#question-note').inputValue(), 'learner-offline');
    console.log('PASS: shared bank updates merge with pending private progress; learner state survives reload');

    await d.nav('manage'); const downloadEvent = a.waitForEvent('download'); await a.locator('[data-action=export-backup]').click();
    const download = await downloadEvent; const backupPath = '/tmp/tijian-learner-backup.json'; await download.saveAs(backupPath);
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8')); assert.equal(backup.accountId, LEARNER);
    backup.banks[0].name = '备份试图更改题库';
    await a.locator('#backup-file').setInputFiles({ name: 'own.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await a.getByRole('heading', { name: '恢复当前账号的学习记录' }).waitFor(); await a.locator('[data-action=confirm]').click(); await d.syncNow();
    assert.equal(await a.locator('.hero h2').innerText(), '更新后的共享题库');
    assert.equal((await queued(() => read(db, ADMIN))).payload.banks[0].name, '更新后的共享题库');
    await d.nav('manage'); backup.accountId = ADMIN;
    await a.locator('#backup-file').setInputFiles({ name: 'other.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await a.locator('#toast').filter({ hasText: '不能恢复其他账号' }).waitFor(); assert.equal(await a.locator('[data-action=confirm]').count(), 0);
    console.log('PASS: learner backups restore only their own study data and cannot replace shared banks or import another account’s records');

    const phone = await device({ ...devices['iPhone 13'] }); await phone.login('10001');
    assert.equal(await phone.page.locator('.hero h2').innerText(), '更新后的共享题库');
    assert.equal(await phone.page.locator('[data-action=import]').count(), 0);
    await phone.page.locator('[data-action=continue]').tap();
    assert.equal(await phone.page.locator('#question-note').inputValue(), 'learner-offline');
    assert(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await phone.page.screenshot({ path: '/tmp/tijian-learner-phone.png' });
    console.log('PASS: an iPhone session loads the same learner progress with compact read-only bank UI');

    const adminPhone = await device({ ...devices['iPhone 13'] }); await adminPhone.login('admin');
    const phoneExport = adminPhone.page.locator('.bank-row [data-action=export-bank]');
    assert(await phoneExport.isVisible());
    assert(await adminPhone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const phoneDownloadEvent = adminPhone.page.waitForEvent('download'); await phoneExport.tap();
    const phoneDownload = await phoneDownloadEvent; await phoneDownload.saveAs('/tmp/tijian-admin-phone-bank.csv');
    assert.deepEqual(C.inspect(C.parseCSV(fs.readFileSync('/tmp/tijian-admin-phone-bank.csv', 'utf8'))).map(row => row.q), legacy.banks[0].questions);
    await adminPhone.page.screenshot({ path: '/tmp/tijian-admin-export-phone.png', fullPage: true });
    await adminPhone.page.locator('.mobile-nav [data-view=more]').tap();
    await adminPhone.page.locator('.more-links [data-view=manage]').tap();
    assert(await adminPhone.page.locator('#export-bank').isVisible());
    assert(await adminPhone.page.locator('[data-action=export-bank]').isVisible());
    assert(await adminPhone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log('PASS: iPhone admin can download a bank CSV and use the export page without horizontal overflow');

    const otherTab = await d.context.newPage(); otherTab.on('pageerror', e => errors.push(e.message));
    await otherTab.goto(a.url()); await otherTab.getByRole('heading', { name: '我的题库', exact: true }).waitFor();
    await d.logout(); await otherTab.locator('#login-form').waitFor();
    await d.login('admin'); await otherTab.locator('#login-form').waitFor();
    assert.equal(await otherTab.locator('.question-card').count(), 0);
    assert.equal((await queued(() => read(db, ADMIN))).payload.records[qkey].note, 'admin-private');
    await d.logout(); await d.login('10001'); await a.locator('[data-action=continue]').click();
    assert.equal(await a.locator('#question-note').inputValue(), 'learner-offline');
    assert.deepEqual(errors, []);
    console.log('PASS: cross-tab account switches close the previous account; returning to either account preserves its own cache');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await db.close(); }
})().catch(error => { console.error(error); process.exit(1); });
