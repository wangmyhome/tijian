const { chromium, devices } = require(require.resolve('playwright', { paths: ['/Users/wangshanpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../core.js');
(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + (req.url === '/' ? '/index.html' : new URL(req.url, 'http://local').pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const questions = [C.normalize({ 题目ID: 'q1', 题型: '单选题', 题目: '第一道测试题', 选项A: '甲', 选项B: '乙', 答案: 'A' }), C.normalize({ 题目ID: 'q2', 题型: '多选题', 题目: '第二道测试题', 选项A: '甲', 选项B: '乙', 答案: 'A|B', 解析: '保留原解析' }), C.normalize({ 题目ID: 'q3', 题型: '判断题', 题目: '第三道测试题', 答案: '正确' })];
  const banks = [{ id: 'b', name: 'AI测试题库', questions, createdAt: new Date().toISOString() }], rows = new Map(), tokens = new Map(), errors = [];
  let functionCalls = 0, providerCalls = 0, handle, providerError = false, holdProvider = null, tokenNumber = 0;
  const rowFor = owner => {
    if (!rows.has(owner)) rows.set(owner, { revision: 1, bank_revision: 1, updated_at: new Date().toISOString(), payload: { version: 1, banks: structuredClone(banks), records: {}, settings: {}, activity: {}, session: null, selectedBank: 'b', exams: [], activeExam: null } });
    return rows.get(owner);
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'supabase/functions/ai-explain/index.ts'), 'utf8'), {
    Deno: { env: { get: name => ({ AI_ALLOWED_ORIGINS: origin, SUPABASE_URL: 'https://test.example', SUPABASE_ANON_KEY: 'public', DEEPSEEK_API_KEY: 'test-private-key' })[name] }, serve: handler => { handle = handler; } },
    Request, Response, AbortSignal, Date, JSON, Map, Set,
    fetch: async (url, options) => {
      if (url.endsWith('/auth/v1/user')) { const user = tokens.get(options.headers.Authorization?.replace('Bearer ', '')); return Response.json(user ? { id: user } : {}, { status: user ? 200 : 401 }); }
      if (url.includes('/rest/v1/')) return Response.json([{ banks }]);
      providerCalls++; if (holdProvider) await holdProvider;
      if (providerError) return Response.json({}, { status: 500 });
      const material = JSON.parse(JSON.parse(options.body).messages[1].content);
      return Response.json({ choices: [{ message: { content: '解题思路：' + material.题目 + '\n正确答案来自原题。<img src=x onerror=alert(1)>\n易错点：仔细阅读选项。' } }] });
    }
  });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    async function device(mobile = false) {
      const context = await browser.newContext({ serviceWorkers: 'block', ...(mobile ? devices['iPhone 13'] : { viewport: { width: 1440, height: 1040 } }) });
      await context.route('https://plgqouambkntvxjzajww.supabase.co/**', async route => {
        const req = route.request(), url = new URL(req.url()), body = req.postDataJSON();
        const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
        if (url.pathname.endsWith('/token')) {
          const owner = body.email?.split('@')[0], token = 'token-' + ++tokenNumber; tokens.set(token, owner);
          return reply({ access_token: token, refresh_token: 'refresh-' + tokenNumber, expires_at: Date.now() / 1000 + 3600, user: { id: owner, email: body.email } });
        }
        const owner = tokens.get(req.headers().authorization?.replace('Bearer ', '')); if (!owner) return reply({}, 401);
        if (url.pathname.endsWith('/logout')) return reply({});
        if (url.pathname.endsWith('/ai-explain')) {
          functionCalls++;
          const response = await handle(new Request(url.href, { method: 'POST', headers: { ...req.headers(), origin }, body: req.postData() }));
          return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
        }
        const row = rowFor(owner);
        if (url.pathname.endsWith('/tijian_read_workspace')) return reply(body.known_revision === row.revision && body.known_bank_revision === 1 ? { revision: row.revision, bank_revision: 1 } : row);
        if (url.pathname.endsWith('/tijian_save_account_workspace')) {
          if (body.expected_revision !== row.revision) return reply({ ok: false, ...row });
          row.revision++; row.payload = { ...structuredClone(body.workspace_payload), banks: structuredClone(banks) }; row.updated_at = new Date().toISOString();
          return reply({ ok: true, revision: row.revision, bank_revision: 1, updated_at: row.updated_at });
        }
        return reply({}, 404);
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); await page.goto(origin);
      const login = async owner => { await page.locator('#login-username').fill(owner); await page.locator('#login-password').fill('test-password'); await page.locator('#login-form [type=submit]').click(); await page.locator('.hero h2').filter({ hasText: 'AI测试题库' }).waitFor(); };
      const home = async () => { await page.locator('.mobile-focus-bar [data-action=nav][data-view=home]').click(); await page.locator('.hero').waitFor(); };
      const sync = async () => { await page.evaluate(() => dispatchEvent(new Event('online'))); await page.waitForFunction(() => [...document.querySelectorAll('.cloud-status')].some(el => el.dataset.status === 'synced')); };
      const settings = () => page.locator('.mobile-focus-bar [data-action=settings]').click();
      return { page, context, login, home, sync, settings };
    }
    const d = await device(), p = d.page; await d.login('10001');
    assert.equal(functionCalls, 0); await p.locator('[data-action=mode][data-mode=sequential]').click();
    assert.equal(await p.locator('[data-action=ai-explain]').count(), 0);
    await p.locator('[data-action=choose][data-label=B]').click(); await p.locator('.answer-panel.bad').waitFor();
    assert.equal(functionCalls, 0); assert.equal(providerCalls, 0);
    await p.locator('[data-action=ai-explain]').click(); await p.locator('.ai-text').waitFor();
    assert.equal(functionCalls, 1); assert.equal(providerCalls, 1); assert.equal(await p.locator('.ai-text img').count(), 0);
    assert.match(await p.locator('.ai-text').innerText(), /第一道测试题/);
    await p.reload(); await p.locator('.hero').waitFor(); await p.locator('[data-action=mode][data-mode=sequential]').click();
    assert.equal(functionCalls, 1); assert.equal(await p.locator('.ai-text').count(), 0);
    await p.locator('[data-action=ai-explain]').click(); await p.locator('.ai-text').waitFor(); assert.equal(providerCalls, 1);
    await p.locator('[data-action=ai-explain]').click(); await p.locator('[data-action=ai-explain][data-refresh=true]:enabled').waitFor(); assert.equal(providerCalls, 2);
    await d.home(); await d.sync();
    const phone = await device(true); await phone.login('10001'); await phone.page.locator('[data-action=mode][data-mode=sequential]').click();
    assert.equal(await phone.page.locator('[data-action=ai-explain]').innerText(), '查看 AI 解析');
    await phone.page.locator('[data-action=ai-explain]').tap(); await phone.page.locator('.ai-text').waitFor(); assert.equal(providerCalls, 2);
    assert(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await phone.page.screenshot({ path: '/tmp/tijian-ai-phone.png', fullPage: true });
    console.log('PASS: AI only calls after a click; generated text is escaped, cached after reload and synchronized to iPhone');

    await p.locator('[data-action=mode][data-mode=sequential]').click(); await p.locator('[data-action=next]').click();
    await p.locator('[data-action=choose][data-label=A]').click(); await p.locator('[data-action=choose][data-label=B]').click();
    assert.equal(await p.locator('[data-action=ai-explain]').count(), 0); assert.equal(providerCalls, 2);
    await p.locator('[data-action=submit]').click(); await p.locator('.answer-panel.good').waitFor(); assert.equal(providerCalls, 2);
    let release; holdProvider = new Promise(resolve => { release = resolve; });
    await p.locator('[data-action=ai-explain]').click(); await p.locator('[data-action=ai-explain]:disabled').waitFor();
    await p.locator('[data-action=next]').click(); await p.locator('.question-text').filter({ hasText: '第三道测试题' }).waitFor();
    release(); holdProvider = null;
    await p.waitForResponse(response => response.url().endsWith('/ai-explain'));
    assert.equal(await p.locator('.ai-text').count(), 0);
    await p.locator('[data-action=previous]').click(); await p.locator('.ai-text').waitFor(); assert.match(await p.locator('.ai-text').innerText(), /第二道测试题/);
    providerError = true; await p.locator('[data-action=ai-explain]').click(); await p.locator('.ai-error').waitFor();
    const failedCount = providerCalls; await p.locator('[data-action=favorite]').click(); assert.equal(providerCalls, failedCount);
    assert.match(await p.locator('.ai-text').innerText(), /第二道测试题/);
    providerError = false; await p.locator('[data-action=ai-explain]').click(); await p.locator('.ai-error').waitFor({ state: 'hidden' });
    console.log('PASS: multi-select only offers AI after submission; late results stay with the original question and errors require a new click');

    // A different account has its own records and no cached answer from the learner.
    await d.home(); await p.locator('.topbar [data-action=account]').click(); await p.locator('[data-action=account-logout]').click(); await p.locator('#login-form').waitFor(); await d.login('admin');
    await p.locator('[data-action=mode][data-mode=sequential]').click(); await p.locator('[data-action=choose][data-label=A]').click(); await p.locator('.answer-panel.good').waitFor();
    assert.equal(await p.locator('[data-action=ai-explain]').innerText(), 'AI解析'); assert.equal(await p.locator('.ai-text').count(), 0);
    const beforeExam = providerCalls;
    await d.home(); await p.locator('[data-action=mode][data-mode=exam]').click(); await p.locator('[data-action=exam-start]').click();
    await p.locator('.question-card').waitFor(); assert.equal(await p.locator('[data-action=ai-explain]').count(), 0);
    await p.locator('.practice-aside [data-action=exam-submit]').click(); await p.locator('[data-action=confirm]').click();
    await p.locator('.exam-result-card').waitFor(); await p.locator('.exam-result-actions [data-action=exam-review]').first().click();
    assert.equal(providerCalls, beforeExam); await p.locator('[data-action=ai-explain]').click(); await p.locator('.ai-text').waitFor();
    assert.equal(providerCalls, beforeExam + 1);
    assert.deepEqual(questions.map(q => q.answer), [['A'], ['A', 'B'], ['A']]);
    assert.deepEqual(errors, []);
    console.log('PASS: AI caches remain private to each account; completed exam reviews support explicit AI requests and bank answers stay unchanged');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
