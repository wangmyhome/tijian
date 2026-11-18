(async function () {
  'use strict';
  const C = window.QuizCore;
  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const paths = {
    book: '<path d="M4 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H3V4a1 1 0 0 1 1-1Z"/><path d="M13 6a3 3 0 0 1 3-3h5v16h-4a4 4 0 0 0-4 2"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    wrong: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
    star: '<path class="star" d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    upload: '<path d="M12 16V3m-4 4 4-4 4 4M4 15v5h16v-5"/>',
    download: '<path d="M12 3v13m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    settings: '<path d="m9 3-.6 2.3-2 .9-2.2-.7-2 3.5L4 10.7v2.6l-1.8 1.7 2 3.5 2.2-.7 2 .9L9 21h6l.6-2.3 2-.9 2.2.7 2-3.5-1.8-1.7v-2.6L21.8 9l-2-3.5-2.2.7-2-.9L15 3Z"/><circle cx="12" cy="12" r="3"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
    bars: '<path d="M5 20v-6m7 6V4m7 16V9"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c1.5 0 3-2 4-4m4-4c1-2 2.5-4 4-4h3m-4-4 4 4-4 4"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
    chapter: '<path d="M3 7h7l2 2h9v11H3Z"/><path d="M3 7V4h7l2 3"/>',
    type: '<rect x="3" y="3" width="7" height="7" rx="1"/><circle cx="17.5" cy="6.5" r="3.5"/><path d="m6.5 14 4.5 7H2Zm8.5 1h7m-7 5h7"/>',
    note: '<path d="M13 4H4v17h16v-9M9 15l1-4L19 2l3 3-9 9Z"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m13 6 5 5"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    refresh: '<path d="M20 7V3l-3 2a8 8 0 1 0 3 12M20 3v6h-6"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.book) + '</svg>';
  const uid = () => window.crypto?.randomUUID?.() || 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const dateKey = value => { const d = new Date(value || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const modes = { sequential: '顺序练习', random: '随机练习', single: '单选练习', multiple: '多选练习', judgment: '判断练习', wrong: '错题重练', favorite: '收藏练习', chapter: '章节练习', type: '题型练习', custom: '专项练习' };
  const practiceTypes = { single: '单选题', multiple: '多选题', judgment: '判断题' };
  const defaultSettings = { theme: 'system', font: 18, autoCorrect: false, autoWrong: false, analysis: true, notes: true };
  const cloudConfig = window.TIJIAN_CLOUD_CONFIG || { enabled: false };
  const cloudClient = cloudConfig.enabled ? new window.QuizCloud.Client(cloudConfig) : null;
  let localOwner = '';
  const localKey = key => cloudConfig.enabled && localOwner ? 'account:' + localOwner + ':' + key : key;
  const canManageBanks = () => !cloudConfig.enabled || !!cloudClient?.isAdmin;
  const canExportBanks = () => !!cloudClient?.isAdmin;
  const accountName = () => esc(cloudClient?.username || '');
  const bankActions = new Set(['import', 'choose-csv', 'rename-bank', 'save-bank-name', 'delete-bank', 'export-bank', 'preview-prev', 'preview-next', 'edit-import', 'delete-import', 'cancel-edit', 'add-option', 'remove-option', 'save-edit', 'confirm-import', 'template']);
  function requireBankAdmin() { if (!canManageBanks()) throw new Error('只有管理员可以上传、导出、修改或删除共享题库。'); }
  let cloud = null, cloudMeta = {}, syncBackups = [], accountLocked = !!cloudConfig.enabled, accountBusy = false, loginError = '';
  let db, state, saveQueue = Promise.resolve(), storageOK = true, storageError = '';
  let ui = { view: 'home', bankId: '', query: '', type: '', chapter: '', listPage: 0, draft: [], showNote: false, cardPage: 0, sessionBankId: '', lastFocus: null };
  let pendingImport = null, editorIndex = null, previewPage = 0, confirmAction = null, editorFields = [];
  let toastTimer, nextTimer, noteTimer;
  function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3800); }
  function openDB() { return new Promise((resolve, reject) => { const r = indexedDB.open('tijian-offline', 1); r.onupgradeneeded = () => r.result.createObjectStore('workspace'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); r.onblocked = () => reject(new Error('请关闭其他题间窗口后重试。')); }); }
  function readDB(key = 'main') { return new Promise((resolve, reject) => { const tx = db.transaction('workspace', 'readonly'); const r = tx.objectStore('workspace').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  function saveLabel() { return !storageOK ? '保存失败，请立即导出备份' : state.savedAt ? '已保存到本机 · ' + new Date(state.savedAt).toLocaleTimeString('zh-CN', { hour12: false }) : '练习记录保存在当前浏览器'; }
  function updateSaveIndicators() { document.querySelectorAll('.save-indicator').forEach(el => { el.textContent = saveLabel(); el.classList.toggle('save-failed', !storageOK); }); }
  function save() { C.rememberPractice(state); cloud?.changed(); return persistLocal(); }
  function persistLocal() {
    const snapshot = structuredClone(state);
    const metaSnapshot = structuredClone(cloudMeta);
    const mainKey = localKey('main'), metaKey = localKey('cloud-meta'), owner = localOwner;
    snapshot.savedAt = new Date().toISOString();
    saveQueue = saveQueue.catch(() => {}).then(() => new Promise((resolve, reject) => {
      if (!db) { storageOK = false; updateSaveIndicators(); reject(new Error('本地存储暂不可用，请立即导出备份以保留本次记录。')); return; }
      const tx = db.transaction('workspace', 'readwrite'); tx.objectStore('workspace').put(snapshot, mainKey); tx.objectStore('workspace').put(metaSnapshot, metaKey);
      tx.oncomplete = () => { if (localOwner === owner) state.savedAt = snapshot.savedAt; storageOK = true; storageError = ''; updateSaveIndicators(); resolve(); };
      tx.onerror = tx.onabort = () => { storageOK = false; storageError = '保存失败，请导出备份'; updateSaveIndicators(); reject(new Error('本地保存失败，请到“数据与备份”导出完整备份。')); };
    }));
    return saveQueue;
  }
  function cloudLabel() {
    if (!cloud) return '本机离线版';
    return ({ idle: '等待同步', syncing: '正在同步', synced: '已同步到云端', pending: '本机已保存，等待同步', offline: '离线中，联网后同步', remote: '其他设备有更新', conflict: '同步待处理', auth: '请重新登录', error: '同步失败，请重试' })[cloud.status] || '等待同步';
  }
  function updateCloudUI() {
    document.querySelectorAll('.cloud-status').forEach(el => { el.textContent = cloudLabel(); el.dataset.status = cloud?.status || 'idle'; });
    document.querySelectorAll('.cloud-message').forEach(el => { el.textContent = cloud?.message || (cloudMeta.syncedAt ? '上次同步：' + new Date(cloudMeta.syncedAt).toLocaleString('zh-CN') : '联网后自动同步题库与学习记录。'); });
  }
  function loginView() {
    document.body.classList.remove('focus-mode', 'reading-mode', 'answer-sheet-open', 'editing-note');
    $('#app').innerHTML = '<main class="login-page"><section class="login-card"><div class="brand-mark">间</div><h1>登录题间</h1><p>手机与电脑，接着上次的进度。</p><form id="login-form"><label for="login-username">账号</label><input id="login-username" name="username" autocomplete="username" value="admin" required><label for="login-password">密码</label><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="请输入密码" required><p id="login-error" class="login-error" role="alert">' + esc(loginError) + '</p><button class="button primary" type="submit" ' + (accountBusy ? 'disabled' : '') + '>' + (accountBusy ? '正在登录…' : '登录') + '</button></form><small>登录后自动同步，本机仍保留离线记录。</small></section></main>';
  }
  async function signIn(username, password) {
    accountBusy = true; loginError = ''; loginView();
    try {
      await cloud.running;
      await cloud.client.login(username, password);
      await loadAccount(cloud.client.session.user);
      cloud.stopped = false; cloud.conflict = null; accountLocked = false;
      ui.view = 'home'; await cloud.run();
      if (!accountLocked) { render(); examTick(); if (cloud.conflict) accountDialog(); }
    } catch (error) { loginError = error.message; accountLocked = true; }
    finally { accountBusy = false; if (accountLocked) loginView(); }
  }
  function snapshotSummary(snapshot) {
    const records = Object.values(snapshot.records || {});
    return snapshot.banks.length + ' 个题库 · 已练 ' + records.filter(r => r.attempts > 0).length + ' 题 · 累计 ' + records.reduce((n, r) => n + r.attempts, 0) + ' 次';
  }
  function accountDialog() {
    if (!cloud) return;
    const conflict = cloud.conflict;
    const body = '<div class="account-summary"><div class="avatar">我</div><div><strong>' + accountName() + ' · ' + (canManageBanks() ? '管理员' : '刷题账号') + '</strong><p class="cloud-status">' + cloudLabel() + '</p></div></div><p class="help">' + (canManageBanks() ? '管理所有账号共用的题库。' : '使用管理员维护的共享题库。') + '练习进度、错题、收藏、笔记和考试记录仅属于当前账号。</p><p class="cloud-message help"></p>' + (conflict ? '<div class="sync-conflict"><h3>请选择要继续使用的数据</h3><p>' + esc(conflict.message) + '</p><div><strong>本机</strong><span>' + snapshotSummary(state) + '</span><button class="button" data-action="sync-local">使用本机并上传</button></div><div><strong>云端</strong><span>' + snapshotSummary(conflict.remote.payload) + '</span><button class="button primary" data-action="sync-remote">使用云端数据</button></div><p>另一份数据可在“数据与备份”中导出。</p></div>' : '') + (syncBackups.length ? '<button class="text-button" data-action="sync-backups">查看同步前备份（' + syncBackups.length + ' 份）</button>' : '');
    modal('账号与同步', body, '<button class="button" data-action="account-logout">' + (cloudMeta.dirty ? '保存本机并退出' : '退出登录') + '</button><button class="button primary" data-action="sync-now" ' + (conflict ? 'disabled' : '') + '>立即同步</button>');
    updateCloudUI();
  }
  async function archiveSync(local, remote) {
    const at = new Date().toISOString();
    const next = [...syncBackups, { id: uid(), at, label: '同步前 · 本机', payload: structuredClone(local) }, ...(remote ? [{ id: uid(), at, label: '同步前 · 云端', payload: structuredClone(remote) }] : [])].slice(-8);
    await new Promise((resolve, reject) => {
      if (!db) return reject(new Error('无法保存同步前备份，请先导出本机记录。'));
      const tx = db.transaction('workspace', 'readwrite'); tx.objectStore('workspace').put(next, localKey('sync-backups'));
      tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(new Error('备份保存失败，同步已暂停。'));
    });
    syncBackups = next;
  }
  function canApplyCloud() { return !accountLocked && !['practice', 'exam', 'exam-review'].includes(ui.view) && !$('#overlay').children.length && document.activeElement?.tagName !== 'TEXTAREA'; }
  async function applyCloud(payload, meta) {
    state = structuredClone(payload); state.settings = { ...defaultSettings, ...state.settings }; state.exams ||= []; state.activeExam ||= null;
    cloudMeta = meta; C.restorePractice(state);
    if (!banks().some(b => b.id === state.selectedBank)) state.selectedBank = banks()[0]?.id || '';
    ui.bankId = state.selectedBank; ui.draft = []; ui.showNote = false;
    await persistLocal(); render();
  }
  function initCloud() {
    if (!cloudConfig.enabled) return;
    cloud = new window.QuizCloud.Sync({
      client: cloudClient, getState: () => state, getMeta: () => cloudMeta,
      validate: C.validateState, persist: persistLocal, archive: archiveSync, apply: applyCloud, canApply: canApplyCloud,
      hasLocalData: () => !!(Object.keys(state.records).length || state.session || state.activeExam || state.exams.length || state.banks.length > 1 || state.banks.some(b => b.id !== 'builtin-theory' || b.name !== '计算机程序设计员 · 三级')),
      onStatus: updateCloudUI, onAuthRequired: () => { accountLocked = true; loginError = '登录已过期，请重新登录。本机记录已保留。'; closeModal(); render(); }
    });
    accountLocked = !cloud.client.session;
    setInterval(() => { if (!accountLocked && !document.hidden) cloud.run(); }, 15000);
    const retry = () => { if (!accountLocked && !document.hidden) cloud.run(); };
    window.addEventListener('online', retry); window.addEventListener('focus', retry); document.addEventListener('visibilitychange', retry);
    window.addEventListener('storage', event => {
      if (event.key === cloud.client.key) {
        let next; try { next = JSON.parse(event.newValue); } catch (_) {}
        if (!next || next.user?.id !== cloud.client.session?.user.id) { cloud.client.session = null; cloud.stop(); accountLocked = true; clearTimeout(nextTimer); clearTimeout(noteTimer); closeModal(); render(); }
      }
    });
  }
  const banks = () => state.banks;
  const bank = () => banks().find(b => b.id === ui.bankId) || banks()[0];
  const key = (b, q) => b.id + '/' + q.id;
  function record(b, q) { return state.records[key(b, q)] || { attempts: 0, right: 0, wrong: 0, lastCorrect: null, favorite: false, inWrong: false, note: '', history: [] }; }
  function ensureRecord(b, q) { const k = key(b, q); return state.records[k] ||= record(b, q); }
  function progress(b, questions) { const done = questions.filter(q => record(b, q).attempts > 0).length; return { total: questions.length, done, remaining: questions.length - done }; }
  function historyBadge(r) { return r.attempts ? '<span class="history-badge ' + (r.lastCorrect ? 'history-right' : 'history-wrong') + '" data-practiced="true"><span class="history-short">已练过</span><span class="history-detail">已练 · 上次' + (r.lastCorrect ? '答对' : '答错') + ' · ' + r.attempts + ' 次</span></span>' : '<span class="history-badge" data-practiced="false">未练过</span>'; }
  function counts(list = banks()) { let total = 0, done = 0, right = 0, attempts = 0, wrong = 0, favorite = 0; for (const b of list) for (const q of b.questions) { const r = record(b, q); total++; if (r.attempts) done++; right += r.right; attempts += r.attempts; if (r.inWrong) wrong++; if (r.favorite) favorite++; } return { total, done, right, attempts, wrong, favorite, rate: attempts ? Math.round(right / attempts * 100) + '%' : '—' }; }
  function chapterPaths(b) { const all = new Set(); for (const q of b.questions) { const path = q.chapter.split('/'); for (let i = 1; i <= path.length; i++) all.add(path.slice(0, i).join('/')); } return [...all].sort((a, b) => a.localeCompare(b, 'zh-CN')); }
  function chapterOptions(b, selected = '') { return '<option value="">全部章节</option>' + chapterPaths(b).map(p => { const c = progress(b, b.questions.filter(q => q.chapter === p || q.chapter.startsWith(p + '/'))); return '<option value="' + esc(p) + '" ' + (p === selected ? 'selected' : '') + '>' + esc(p.replaceAll('/', ' / ')) + '（已练 ' + c.done + ' / 未练 ' + c.remaining + '）</option>'; }).join(''); }
  function typeOptions(selected = '', b = null) { return '<option value="">全部题型</option>' + C.TYPES.map(t => { const c = b ? progress(b, b.questions.filter(q => q.type === t)) : null; return '<option value="' + t + '" ' + (selected === t ? 'selected' : '') + '>' + t + (c ? '（已练 ' + c.done + ' / 未练 ' + c.remaining + '）' : '') + '</option>'; }).join(''); }
  function bankOptions(selected = '', all = false) { return (all ? '<option value="">全部题库</option>' : '') + banks().map(b => '<option value="' + esc(b.id) + '" ' + (selected === b.id ? 'selected' : '') + '>' + esc(b.name) + '</option>').join(''); }
  function applyTheme() { let theme = state.settings.theme; if (theme === 'system') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; document.body.dataset.theme = theme; document.documentElement.style.colorScheme = ['dark', 'classic-dark'].includes(theme) ? 'dark' : 'light'; document.documentElement.style.setProperty('--font', (Number(state.settings.font) || 18) + 'px'); }
  function navButton(view, glyph, text, badge = '') { return '<button class="nav-button ' + (ui.view === view ? 'active' : '') + '" data-action="nav" data-view="' + view + '" title="' + text + '">' + icon(glyph) + '<span>' + text + '</span>' + (badge ? '<b class="badge">' + badge + '</b>' : '') + '</button>'; }
  function render() {
    applyTheme();
    if (accountLocked) return loginView();
    document.body.classList.remove('editing-note');
    document.body.classList.toggle('focus-mode', ['practice', 'exam', 'exam-review'].includes(ui.view));
    const c = counts(), title = { home: '我的题库', history: '学习记录', wrong: '错题本', favorite: '我的收藏', manage: '数据与备份', search: '搜索题目', practice: '开始练习', more: '我的', complete: '练习小结', exams: '模拟考试', exam: '模拟考试', 'exam-result': '考试成绩', 'exam-review': '试卷回顾' }[ui.view];
    $('#app').innerHTML = '<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">间</div><div><div class="brand-name">题间</div><small>MAKE IT COUNT</small></div></div><div class="nav-label">学习空间</div><nav class="nav" aria-label="主导航">' + navButton('home', 'grid', '我的题库') + navButton('exams', 'clock', '模拟考试') + navButton('history', 'clock', '学习记录') + navButton('wrong', 'wrong', '错题本', c.wrong || '') + navButton('favorite', 'star', '我的收藏', c.favorite || '') + '</nav><div class="nav-divider"></div><div class="nav-label">工具</div><nav class="nav">' + navButton('manage', 'shield', '数据与备份') + '<button class="nav-button" data-action="template">' + icon('download') + '<span>下载题库模板</span></button></nav><div class="sidebar-foot"><div class="local-status"><i class="status-dot"></i>' + '<span class="save-indicator" role="status">' + esc(saveLabel()) + '</span>' + '</div><p>' + (storageError || (cloud ? '登录 ' + accountName() + ' · <span class="cloud-status">' + cloudLabel() + '</span>' : '专注当下的每一道题。<br>数据保存在当前浏览器中。')) + '</p><div class="profile"><div class="avatar">我</div><div><strong>我的学习空间</strong><small>' + (cloud ? '云端同步版' : '个人离线版') + '</small></div><button class="icon-button" title="刷题设置" aria-label="刷题设置" data-action="settings">' + icon('settings') + '</button></div></div></aside><main class="main"><header class="topbar"><div class="breadcrumb">学习空间 <span>/</span><strong>' + title + '</strong></div><div class="top-actions"><span class="top-date">' + new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }) + '</span>' + (cloud ? '<button class="button account-button" data-action="account" aria-label="账号与同步">' + icon('shield') + '<span>' + accountName() + '</span></button>' : '') + '<button class="icon-button" title="刷题设置" aria-label="刷题设置" data-action="settings">' + icon('settings') + '</button><button class="button primary" data-action="import">' + icon('plus') + '导入题库</button></div></header><div class="content">' + (ui.view === 'more' ? moreView() : ui.view === 'exams' ? examsView() : ui.view === 'exam' ? examView() : ui.view === 'exam-review' ? examView(true) : ui.view === 'exam-result' ? examResultView() : ui.view === 'home' ? home() : ui.view === 'practice' ? practice() : ui.view === 'complete' ? complete() : ui.view === 'manage' ? manage() : ui.view === 'history' ? history() : collection()) + '</div></main></div>';
    syncMobileUI(); updateCloudUI();
    if (!canManageBanks()) document.querySelectorAll('[data-action]').forEach(el => { if (bankActions.has(el.dataset.action)) el.remove(); });
    if (cloud?.status === 'remote' && canApplyCloud()) cloud.schedule(0);
  }
  const mobileScreen = matchMedia('(max-width: 650px), (max-width: 950px) and (max-height: 500px) and (pointer: coarse)');
  const desktopCard = matchMedia('(min-width: 1000px)');
  function moreView() {
    return pageHead('MY STUDY SPACE', '我的', '学习记录、数据备份与个性设置。') + '<div class="mobile-profile"><div class="avatar">我</div><div><strong>我的学习空间</strong><span>' + (cloud ? accountName() + ' · <span class="cloud-status">' + cloudLabel() + '</span>' : '个人离线版 · 数据保存在当前设备') + '</span></div></div><div class="more-links">' + (cloud ? '<button data-action="account">' + icon('shield') + '<span><strong>账号与同步</strong><small class="cloud-status">' + cloudLabel() + '</small></span>' + icon('chevron') + '</button>' : '') + [['history', 'bars', '学习记录', '查看每日练习与累计成绩'], ['favorite', 'star', '我的收藏', '反复回顾值得记住的题目'], ['manage', 'shield', '数据与备份', '导出、恢复和跨设备迁移']].map(([view, glyph, title, detail]) => '<button data-action="nav" data-view="' + view + '">' + icon(glyph) + '<span><strong>' + title + '</strong><small>' + detail + '</small></span>' + icon('chevron') + '</button>').join('') + '<button data-action="settings">' + icon('settings') + '<span><strong>刷题设置</strong><small>主题、字号与作答习惯</small></span>' + icon('chevron') + '</button><button data-action="template">' + icon('download') + '<span><strong>下载题库模板</strong><small>支持单选、多选、判断与任意数量选项</small></span>' + icon('chevron') + '</button></div><p class="footer-note"><span class="save-indicator" role="status">' + esc(saveLabel()) + '</span></p>';
  }
  function mobileNavigation() {
    const active = ['history', 'manage', 'more'].includes(ui.view) ? 'more' : ui.view;
    return '<nav class="mobile-nav" aria-label="手机主导航">' + [['home', 'book', '题库'], ['exams', 'clock', '考试'], ['wrong', 'wrong', '错题'], ['favorite', 'star', '收藏'], ['more', 'grid', '我的']].map(([view, glyph, title]) => '<button data-action="nav" data-view="' + view + '" ' + (active === view ? 'aria-current="page"' : '') + '>' + icon(glyph) + '<span>' + title + '</span></button>').join('') + '</nav>';
  }
  function syncReadingMode() { document.body.classList.toggle('reading-mode', ['practice', 'exam', 'exam-review'].includes(ui.view)); document.body.dataset.answerView = ui.view; }
  function syncMobileUI() {
    syncReadingMode();
    const focus = ['practice', 'exam', 'exam-review'].includes(ui.view);
    $('.app-shell').insertAdjacentHTML('beforeend', mobileNavigation());
    if (focus && $('.practice-layout')) {
      const isPractice = ui.view === 'practice', review = ui.view === 'exam-review', s = isPractice ? state.session : currentExam();
      const index = isPractice ? s.index : review ? ui.examIndex || 0 : s.index;
      const total = isPractice ? s.ids.length : s.questions.length;
      const title = isPractice ? modes[s.mode] : review ? '试卷回顾' : '模拟考试';
      const back = review ? 'data-action="exam-result" data-id="' + esc(s.id) + '"' : 'data-action="nav" data-view="home"';
      $('.main').insertAdjacentHTML('afterbegin', '<header class="mobile-focus-bar"><button class="icon-button" ' + back + ' aria-label="' + (review ? '返回考试成绩' : isPractice ? '返回题库' : '暂离考试，继续计时') + '">' + icon('left') + '</button><div class="mobile-focus-title"><strong>' + title + '</strong><span>' + (index + 1) + ' / ' + total + '</span>' + (ui.view === 'exam' ? '<span class="exam-clock" role="timer" aria-label="考试剩余时间">' + examTime(examRemaining(s)) + '</span>' : '') + '</div><button class="mobile-answer-button" data-action="mobile-card-open" aria-controls="mobile-answer-sheet" aria-expanded="false">' + icon('grid') + '<span>答题卡</span></button>' + '<button class="icon-button mobile-reading-settings" data-action="settings" aria-label="答题显示设置" title="答题显示设置">' + icon('settings') + '</button>' + '</header>');
      const aside = $('.practice-aside'); aside.id = 'mobile-answer-sheet';
      aside.insertAdjacentHTML('afterbegin', '<button class="mobile-sheet-backdrop" data-action="mobile-card-close" aria-label="关闭答题卡" tabindex="-1"></button>');
      $('.answer-card').insertAdjacentHTML('afterbegin', '<button class="mobile-sheet-dismiss icon-button" data-action="mobile-card-close" aria-label="收起答题卡">' + icon('close') + '</button>');
    } else ui.answerSheet = false;
    const footer = $('.question-card .question-footer'); if (footer) footer.classList.toggle('reading-submit', !!footer.querySelector('[data-action=submit]'));
    syncAnswerSheet();
  }
  function syncAnswerSheet() {
    const open = !!(ui.answerSheet && !desktopCard.matches && document.body.classList.contains('focus-mode'));
    document.body.classList.toggle('answer-sheet-open', open);
    document.querySelectorAll('.mobile-answer-button').forEach(button => button.setAttribute('aria-expanded', String(open)));
    const aside = $('.practice-aside');
    if (aside) {
      if (desktopCard.matches) aside.removeAttribute('aria-hidden'); else aside.setAttribute('aria-hidden', String(!open));
      if (open) { aside.setAttribute('role', 'dialog'); aside.setAttribute('aria-modal', 'true'); aside.setAttribute('aria-label', '答题卡'); }
      else { aside.removeAttribute('role'); aside.removeAttribute('aria-modal'); aside.removeAttribute('aria-label'); }
    }
    document.querySelectorAll('.question-card,.mobile-focus-bar').forEach(el => { el.inert = open; });
    if (!$('#overlay').children.length) document.body.style.overflow = open ? 'hidden' : '';
  }
  function setAnswerSheet(open) {
    ui.answerSheet = open; syncAnswerSheet();
    if (open) $('.mobile-sheet-dismiss')?.focus(); else $('.mobile-reading-settings')?.focus();
  }
  mobileScreen.addEventListener('change', () => { ui.answerSheet = false; syncReadingMode(); syncAnswerSheet(); });
  desktopCard.addEventListener('change', () => { ui.answerSheet = false; syncAnswerSheet(); });

  function stat(glyph, title, value, unit = '') { return '<div class="stat"><div class="stat-top">' + icon(glyph) + title + '</div><div class="stat-value">' + value + (unit ? '<small>' + unit + '</small>' : '') + '</div></div>'; }
  function pageHead(eyebrow, title, description, right = '') { return '<div class="page-head"><div><div class="eyebrow">' + eyebrow + '</div><h1>' + title + '</h1><p>' + description + '</p></div>' + right + '</div>'; }
  function empty(title, description, button = '') { return '<div class="empty">' + icon('book') + '<h3>' + title + '</h3><p>' + description + '</p>' + button + '</div>'; }
  function home() {
    const c = counts(), b = bank();
    let html = pageHead('YOUR STUDY, YOUR PACE', '我的题库', '从上次停下的地方，继续前进。', '<button class="button" data-action="search-view">' + icon('search') + '搜索题目</button>');
    html += '<div class="stats">' + stat('book', '我的题库', banks().length, '个') + stat('list', '题目总数', c.total.toLocaleString(), '道') + stat('check', '已练题目', c.done.toLocaleString(), '道') + stat('bars', '累计正确率', c.rate) + '</div>';
    if (!b) return html + (canManageBanks() ? empty('你的第一本题库，从这里开始', '导入 CSV 文件，即可开始练习。', '<button class="button primary" data-action="import">' + icon('upload') + '导入题库</button>') : empty('暂无共享题库', '管理员上传并同步题库后，就可以开始练习。'));
    const bc = counts([b]), chapterCount = new Set(b.questions.map(q => q.chapter.split('/')[0])).size;
    const session = latestPractice(b), canContinue = !!session;
    html += '<div class="dashboard-grid"><section><div class="section-heading"><h2>继续学习</h2><select class="field-control" id="home-bank" aria-label="选择当前题库" style="max-width:260px;padding:6px 9px;font-size:11px">' + bankOptions(b.id) + '</select></div><div class="hero"><div class="hero-label">' + icon('book') + (canContinue ? '上次练习 · ' + modes[session.mode] : '你的专属练习题库') + '</div><h2>' + esc(b.name) + '</h2><div class="hero-meta"><span>' + b.questions.length.toLocaleString() + ' 道题目</span><span>' + chapterCount + ' 个章节</span><span>单选 / 多选 / 判断</span></div><div class="hero-footer"><div class="hero-progress"><div class="row"><span>整体练习进度</span><strong>' + bc.done + ' / ' + bc.total + '</strong></div><div class="progress-track"><div class="progress-fill" style="width:' + (bc.total ? bc.done / bc.total * 100 : 0) + '%"></div></div></div><button class="button" data-action="continue">' + (canContinue ? session.complete ? '查看练习' : '继续练习' : '开始练习') + icon('arrow') + '</button></div></div><div class="section-heading practice-label"><h2>选择练习方式</h2><span>按自己的节奏，逐题掌握</span></div><div class="modes">';
    for (const [m, glyph, description] of [['sequential', 'list', '按顺序练习，随时继续'], ['random', 'shuffle', '打乱顺序，巩固记忆'], ['chapter', 'chapter', '分章突破，循序渐进'], ['single', 'type', '选择一个正确答案'], ['multiple', 'list', '选择所有正确答案'], ['judgment', 'check', '判断说法是否正确'], ['wrong', 'wrong', bc.wrong + ' 道待巩固错题'], ['favorite', 'star', bc.favorite + ' 道收藏题目'], ['exam', 'clock', '限时自测，交卷统一判分']]) {
      const saved = savedPractice(b, m), configurable = ['chapter', 'random', 'type', 'custom'].includes(m);
      html += '<div class="mode-entry' + (configurable ? ' has-range' : '') + '"><button class="mode" data-action="mode" data-mode="' + m + '"><span class="mode-icon">' + icon(glyph) + '</span><span><strong>' + (m === 'exam' ? '模拟考试' : modes[m]) + '</strong><small>' + description + '</small><span class="mode-progress">' + modeProgress(b, m) + '</span>' + (saved ? '<span class="mode-resume">' + (saved.complete ? '本轮已完成 · 查看答案' : '继续第 ' + (saved.index + 1) + ' / ' + saved.ids.length + ' 题') + '</span>' : '') + '</span></button>' + (configurable ? '<button class="mode-range" data-action="configure-mode" data-mode="' + m + '">' + (m === 'chapter' ? '选择章节' : '调整范围') + '</button>' : '') + '</div>';
    }
    html += '</div>' + (state.activeExam ? '<div class="exam-resume-banner"><div><strong>模拟考试进行中</strong><span>已答 ' + examAnswered(state.activeExam) + ' / ' + state.activeExam.questions.length + ' 道 · 剩余 <span class="exam-clock" role="timer">' + examTime(examRemaining(state.activeExam)) + '</span></span></div><button class="button primary" data-action="exam-resume">继续考试</button></div>' : '') + '</section><aside class="dashboard-aside">' + weekly() + '<div class="aside-card"><h3>温故知新</h3><button class="quick-link" data-action="nav" data-view="wrong">' + icon('wrong') + '我的错题<strong>' + c.wrong + '</strong>' + icon('chevron') + '</button><button class="quick-link" data-action="nav" data-view="favorite">' + icon('star') + '我的收藏<strong>' + c.favorite + '</strong>' + icon('chevron') + '</button></div><div class="tip"><strong>' + icon('info') + '给专注留一点空间</strong>选项支持键盘 <span class="kbd">A–Z</span> 选择；<span class="kbd">Enter</span> 提交或下一题。答错后停一停，看懂比刷快更重要。</div></aside></div><section class="library-section"><div class="section-heading"><h2>全部题库 <span style="margin-left:8px">' + banks().length + '</span></h2><label class="search">' + icon('search') + '<input id="bank-search" type="search" placeholder="搜索题库名称…" aria-label="搜索题库"></label></div><div class="bank-list" id="bank-list">' + bankRows('') + '</div></section><p class="footer-note">' + icon('shield') + '无需联网，安心练习。记得定期导出备份。</p>';
    return html;
  }
  function bankRows(query) { const list = banks().filter(b => b.name.toLowerCase().includes(query.toLowerCase())); if (!list.length) return '<div style="padding:25px;text-align:center" class="muted">没有找到这个题库</div>'; return list.map(b => { const c = counts([b]); return '<div class="bank-row"><div class="bank-cover">' + icon('book') + '</div><div class="grow"><button class="bank-title" data-action="select-bank" data-id="' + esc(b.id) + '">' + esc(b.name) + '</button><div class="bank-details">' + b.questions.length + ' 道题目 · ' + new Date(b.createdAt).toLocaleDateString('zh-CN') + ' 导入</div></div><div class="bank-progress">已练 ' + c.done + ' / ' + c.total + '<div class="progress-track"><div class="progress-fill" style="width:' + (c.total ? c.done / c.total * 100 : 0) + '%"></div></div></div><button class="button" data-action="select-bank" data-id="' + esc(b.id) + '">去练习' + icon('chevron') + '</button>' + (canManageBanks() ? '<div class="bank-actions">' + (canExportBanks() ? '<button class="icon-button" title="导出题库" aria-label="导出题库" data-action="export-bank" data-id="' + esc(b.id) + '">' + icon('download') + '</button>' : '') + '<button class="icon-button" title="重命名题库" aria-label="重命名题库" data-action="rename-bank" data-id="' + esc(b.id) + '">' + icon('edit') + '</button><button class="icon-button" title="删除题库" aria-label="删除题库" data-action="delete-bank" data-id="' + esc(b.id) + '">' + icon('trash') + '</button></div>' : '') + '</div>'; }).join(''); }
  function dailyData() { const all = {}; for (const r of Object.values(state.records)) for (const h of r.history || []) { const d = dateKey(h.at); all[d] ||= { attempts: 0, right: 0 }; all[d].attempts++; all[d].right += h.correct ? 1 : 0; } return all; }
  function weekly() { const days = [], data = state.activity || {}; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ day: d, count: data[dateKey(d)]?.attempts || 0 }); } const total = days.reduce((s, d) => s + d.count, 0), max = Math.max(1, ...days.map(d => d.count)); return '<div class="aside-card"><div class="row" style="justify-content:space-between"><h3>近七天练习</h3>' + icon('bars') + '</div><div class="week-total">' + total + '<small>次作答</small></div><p class="week-label">每一次练习，都算数</p><div class="week-chart">' + days.map((d, i) => '<div class="day-column ' + (i === 6 ? 'today' : '') + '" title="' + dateKey(d.day) + '：' + d.count + ' 次"><div class="day-bar" style="height:' + Math.max(3, d.count / max * 58) + 'px"></div><small>' + (i === 6 ? '今' : '日一二三四五六'[d.day.getDay()]) + '</small></div>').join('') + '</div><div class="aside-rule"><span>累计练习天数</span><strong>' + Object.keys(data).length + ' 天</strong></div></div>'; }
  function sessionContext() { const s = state.session; if (!s) return {}; const b = banks().find(b => b.id === s.bankId); if (!b) return {}; const q = b.questions.find(q => q.id === s.ids[s.index]); return { s, b, q, answer: s.answers[s.ids[s.index]] }; }
  function practice() {
    const { s, b, q, answer } = sessionContext();
    if (!q) return empty('当前练习已不可用', '请回到题库重新开始。', '<button class="button" data-action="nav" data-view="home">返回题库</button>');
    const r = record(b, q), done = Object.keys(s.answers).length;
    let html = '';
    html += '<div class="practice-layout"><div><article class="question-card"><div class="question-meta"><span class="chapter" title="' + esc(q.chapter) + '">' + icon('chapter') + ' ' + esc(q.chapter.replaceAll('/', ' / ')) + '</span><span class="question-count"><strong>' + (s.index + 1) + '</strong> / ' + s.ids.length + '</span></div><div class="question-labels"><span class="chip green">' + q.type + '</span>' + historyBadge(r) + '</div><h2 class="question-text">' + esc(q.text) + '</h2><p class="question-instruction">' + (q.type === '多选题' ? '选择所有正确选项，点击“提交答案”。全部选对才算正确。' : '选择一个答案，选择后立即判题。') + '</p><div class="options" role="group" aria-label="题目选项">';
    for (const o of q.options) { const selected = (answer ? answer.selected : ui.draft).includes(o.label); const good = answer && q.answer.includes(o.label), bad = answer && selected && !good; html += '<button class="option ' + (q.type === '多选题' ? 'multiple ' : '') + (selected ? 'selected ' : '') + (good ? 'correct ' : '') + (bad ? 'incorrect ' : '') + '" data-action="choose" data-label="' + o.label + '" aria-pressed="' + selected + '" ' + (answer ? 'disabled' : '') + '><span class="option-letter">' + o.label + '</span><span class="option-content">' + esc(o.text) + '</span>' + (good ? '<span class="option-result good-text">正确答案</span>' : bad ? '<span class="option-result bad-text">你的选择</span>' : '') + '</button>'; }
    html += '</div>';
    if (answer) html += '<div class="answer-panel ' + (answer.correct ? 'good' : 'bad') + '" aria-live="polite"><div class="answer-verdict">' + icon(answer.correct ? 'check' : 'wrong') + (answer.correct ? '回答正确，继续保持' : '这道题还需要巩固') + '</div><div class="answer-values"><span>正确答案：<strong>' + formatAnswer(q, q.answer) + '</strong></span><span>你的答案：<strong>' + formatAnswer(q, answer.selected) + '</strong></span></div>' + (state.settings.analysis ? '<div class="analysis"><strong>题目解析</strong>' + (q.analysis ? esc(q.analysis) : '<span class="muted">原题库未提供解析，你可以在下方记录自己的理解。</span>') + '</div>' : '') + '</div>';
    html += '<div class="question-footer"><button class="button" data-action="previous" ' + (s.index === 0 ? 'disabled' : '') + '>' + icon('left') + '上一题</button><div class="row">' + (!answer && q.type === '多选题' ? '<button class="button primary" data-action="submit" ' + (!ui.draft.length ? 'disabled' : '') + '>提交答案</button>' : '') + '<button class="button ' + (answer ? 'primary' : '') + '" data-action="next">' + (s.index === s.ids.length - 1 ? '查看本轮小结' : answer ? '下一题' : '暂时跳过') + icon('arrow') + '</button></div></div><div class="question-tools"><button class="tool-button ' + (r.favorite ? 'on' : '') + '" data-action="favorite">' + icon('star') + (r.favorite ? '已收藏' : '收藏题目') + '</button><button class="tool-button ' + (ui.showNote ? 'on' : '') + '" data-action="toggle-note">' + icon('note') + (r.note ? '查看笔记' : '写笔记') + '</button>' + (r.inWrong ? '<button class="tool-button" data-action="remove-wrong-current">' + icon('check') + '移出错题本</button>' : '') + '<span class="muted attempt-count" style="margin-left:auto;font-size:10px"><span>累计作答 </span><strong>' + r.attempts + '</strong><span> 次</span></span></div>';
    if (ui.showNote || (state.settings.notes && r.note)) html += '<div class="note-box"><textarea id="question-note" maxlength="10000" placeholder="写下解题思路，或给未来的自己留一个提醒…" aria-label="本题笔记">' + esc(r.note) + '</textarea><div class="row"><span>保存在本机 · 最多 10,000 字</span><span id="note-status">' + (r.note ? '已保存' : '输入后自动保存') + '</span><button class="button mobile-note-done" data-action="note-done">完成</button></div></div>';
    html += '</article><p class="footer-note">' + icon('shield') + '<span class="save-indicator" role="status">' + esc(saveLabel()) + '</span>' + '</p></div><aside class="practice-aside"><div class="aside-card answer-card"><h3>本轮答题卡<span>' + done + ' / ' + s.ids.length + ' 已答</span></h3><div class="session-mini"><div><strong class="good-text">' + Object.values(s.answers).filter(a => a.correct).length + '</strong><span>答对</span></div><div><strong class="bad-text">' + Object.values(s.answers).filter(a => !a.correct).length + '</strong><span>答错</span></div><div><strong>' + (s.ids.length - done) + '</strong><span>未答</span></div></div>' + answerGrid(s, b) + '<div class="legend"><span><i class="good"></i>本轮答对</span><span><i class="bad"></i>本轮答错</span><span><i class="historical"></i>以前练过</span><span><i></i>从未练过</span></div>' + lifetimeSummary(b, s) + '<div class="focus-actions"><button class="button" data-action="nav" data-view="home">' + icon('left') + '返回题库</button><button class="button" data-action="summary">结束本轮</button></div><p class="focus-save save-indicator" role="status">' + esc(saveLabel()) + '</p></div></aside></div>';
    return html;
  }
  function formatAnswer(q, selected) { return esc(q.type === '判断题' ? (selected.includes('A') ? '正确' : '错误') : selected.join('、')); }
  function answerGrid(s, b) {
    const total = Math.ceil(s.ids.length / 100); ui.cardPage = Math.min(ui.cardPage, total - 1);
    const start = ui.cardPage * 100, questions = new Map(b.questions.map(q => [q.id, q]));
    return '<div class="answer-grid">' + s.ids.slice(start, start + 100).map((id, j) => {
      const a = s.answers[id], i = start + j, r = record(b, questions.get(id)), historical = !a && r.attempts > 0;
      const status = a ? a.correct ? '本轮答对' : '本轮答错' : historical ? '以前练过，上次' + (r.lastCorrect ? '答对' : '答错') + '，本轮未答' : '从未练过';
      return '<button class="number-button ' + (a ? a.correct ? 'good ' : 'bad ' : historical ? 'historical ' : '') + (i === s.index ? 'current' : '') + '" data-action="jump" data-index="' + i + '" data-practiced="' + (r.attempts > 0) + '" aria-label="第 ' + (i + 1) + ' 题，' + status + '" title="' + status + '" ' + (i === s.index ? 'aria-current="true"' : '') + '>' + (i + 1) + '</button>';
    }).join('') + '</div>' + (total > 1 ? '<div class="card-pager"><button data-action="card-prev" ' + (ui.cardPage === 0 ? 'disabled' : '') + '>上一组</button><span>' + (ui.cardPage + 1) + ' / ' + total + '</span><button data-action="card-next" ' + (ui.cardPage === total - 1 ? 'disabled' : '') + '>下一组</button></div>' : '');
  }
  function lifetimeSummary(b, session) {
    const ids = new Set(session.ids), c = progress(b, b.questions.filter(q => ids.has(q.id)));
    return '<p class="lifetime-progress">本轮范围内，跨模式累计已练 <strong>' + c.done + '</strong> 道，未练 <strong>' + c.remaining + '</strong> 道。历史标记不会提前显示答案。</p>';
  }
  function modeProgress(b, mode) {
    if (mode === 'exam') return '随机组卷 · 成绩留存';
    const c = progress(b, eligibleQuestions(b, mode));
    return '已练 ' + c.done + ' / 未练 ' + c.remaining;
  }
  function complete() { const { s, b } = sessionContext(); if (!s || !b) return empty('没有进行中的练习', '从题库选择一种方式开始吧。'); const done = Object.keys(s.answers).length, right = Object.values(s.answers).filter(a => a.correct).length; return '<div class="complete-card"><div class="complete-icon">' + icon('check') + '</div><div class="eyebrow">ONE STEP FORWARD</div><h1>' + (done === s.ids.length ? '本轮练习完成' : '稍作停留，也是一种进步') + '</h1><p>' + esc(b.name) + ' · ' + modes[s.mode] + '<br>' + (done === s.ids.length ? '答错的题目已经自动加入错题本。' : '还有 ' + (s.ids.length - done) + ' 道题未作答，进度已保留。') + '</p><div class="complete-stats"><div><strong>' + done + '</strong><span>已答题目</span></div><div><strong class="good-text">' + right + '</strong><span>回答正确</span></div><div><strong>' + (done ? Math.round(right / done * 100) + '%' : '—') + '</strong><span>本轮正确率</span></div></div><div class="row" style="justify-content:center;flex-wrap:wrap"><button class="button" data-action="nav" data-view="home">返回题库</button><button class="button" data-action="restart-practice">重新练习当前范围</button>' + (done < s.ids.length ? '<button class="button primary" data-action="resume-unanswered">继续未答题目' + icon('arrow') + '</button>' : '') + (s.complete && s.mode === 'random' && !s.filters.scope && eligibleQuestions(b, s.mode, s.filters).some(q => !record(b, q).attempts) ? '<button class="button primary" data-action="next-random-round">练习下一组未练题</button>' : '') + (done > right ? '<button class="button primary" data-action="retry-session-wrong">重练本轮错题</button>' : '') + '</div></div>'; }
  function visibleQuestions() { let result = []; for (const b of banks()) { if (ui.collectionBank && ui.collectionBank !== b.id) continue; for (const q of b.questions) { const r = record(b, q); if (ui.view === 'wrong' && !r.inWrong || ui.view === 'favorite' && !r.favorite) continue; if (ui.type && q.type !== ui.type) continue; if (ui.status === 'new' && r.attempts > 0 || ui.status === 'done' && !r.attempts) continue; if (ui.chapter && q.chapter !== ui.chapter && !q.chapter.startsWith(ui.chapter + '/')) continue; const query = ui.query.trim().toLowerCase(); if (query && ![q.text, q.chapter, q.analysis, ...q.options.map(o => o.text)].some(v => v.toLowerCase().includes(query))) continue; result.push({ b, q, r }); } } return result; }
  function collection() {
    const names = { wrong: ['REVIEW & REMEMBER', '我的错题本', '把暂时不会的，变成真正掌握的。'], favorite: ['KEEP THE IMPORTANT ONES', '我的收藏', '值得反复回看的题目，都在这里。'], search: ['FIND YOUR QUESTION', '搜索题目', '搜索题干、选项、解析或章节。'] }, n = names[ui.view];
    const list = visibleQuestions(), pageCount = Math.max(1, Math.ceil(list.length / 20)); ui.listPage = Math.min(ui.listPage, pageCount - 1);
    let html = pageHead(n[0], n[1], n[2], '<button class="button primary" data-action="practice-filtered" ' + (!list.length ? 'disabled' : '') + '>' + icon('arrow') + '练习筛选结果</button>');
    html += '<div class="filters"><label class="search">' + icon('search') + '<input type="search" id="question-search" value="' + esc(ui.query) + '" placeholder="输入关键词搜索…" aria-label="搜索题目"></label><select class="field-control" id="collection-bank" aria-label="筛选题库">' + bankOptions(ui.collectionBank, true) + '</select><select class="field-control" id="collection-type" aria-label="筛选题型">' + typeOptions(ui.type) + '</select><select class="field-control" id="collection-status" aria-label="筛选练习状态"><option value="">全部练习状态</option><option value="new" ' + (ui.status === 'new' ? 'selected' : '') + '>仅未练题目</option><option value="done" ' + (ui.status === 'done' ? 'selected' : '') + '>仅已练题目</option></select><span class="muted" style="font-size:11px;margin-left:auto">共 ' + list.length + ' 道题目</span></div>';
    if (!list.length) return html + empty(ui.query || ui.type || ui.collectionBank ? '没有找到符合条件的题目' : ui.view === 'wrong' ? '错题本还是空的' : ui.view === 'favorite' ? '还没有收藏题目' : '搜索你的题目', ui.view === 'wrong' ? '练习中答错的题目会自动收录到这里。' : ui.view === 'favorite' ? '练习时点击星标，把题目留在这里。' : '试试关键词，或先导入一份题库。');
    html += '<div class="question-list">' + list.slice(ui.listPage * 20, (ui.listPage + 1) * 20).map(({ b, q, r }) => '<article class="question-item"><div class="row"><span class="chip green">' + q.type + '</span><span class="muted" style="font-size:10px">' + esc(b.name) + '</span>' + historyBadge(r) + '</div><button class="item-title" data-action="practice-one" data-bank="' + esc(b.id) + '" data-id="' + esc(q.id) + '">' + esc(q.text) + '</button><div class="item-bottom"><span>' + esc(q.chapter.replaceAll('/', ' / ')) + '<br>作答 ' + r.attempts + ' 次 · 错误 ' + r.wrong + ' 次' + (r.note ? ' · 有笔记' : '') + '</span><div class="item-actions"><button class="text-button" data-action="practice-one" data-bank="' + esc(b.id) + '" data-id="' + esc(q.id) + '">去练习</button><button class="text-button" data-action="list-favorite" data-bank="' + esc(b.id) + '" data-id="' + esc(q.id) + '">' + icon('star') + (r.favorite ? '取消收藏' : '收藏') + '</button>' + (ui.view === 'wrong' ? '<button class="text-button" data-action="list-remove-wrong" data-bank="' + esc(b.id) + '" data-id="' + esc(q.id) + '">移出</button>' : '') + '</div></div></article>').join('') + '</div><div class="list-pagination"><button class="button" data-action="list-prev" ' + (ui.listPage === 0 ? 'disabled' : '') + '>上一页</button><span>' + (ui.listPage + 1) + ' / ' + pageCount + '</span><button class="button" data-action="list-next" ' + (ui.listPage >= pageCount - 1 ? 'disabled' : '') + '>下一页</button></div>';
    return html;
  }
  function history() { const c = counts(), data = state.activity || {}, days = Object.keys(data).sort().reverse(); return pageHead('YOUR PROGRESS MATTERS', '学习记录', '记录每一次作答，也看见自己的积累。') + '<div class="stats">' + stat('check', '累计作答', c.attempts.toLocaleString(), '次') + stat('book', '已练题目', c.done.toLocaleString(), '道') + stat('bars', '累计正确率', c.rate) + stat('clock', '累计练习天数', days.length, '天') + '</div>' + (days.length ? '<div class="history-wrap"><table class="history-table"><thead><tr><th>练习日期</th><th>作答次数</th><th>答对次数</th><th>正确率</th></tr></thead><tbody>' + days.map(day => '<tr><td>' + esc(day) + '</td><td>' + data[day].attempts + '</td><td class="good-text">' + data[day].right + '</td><td>' + Math.round(data[day].right / data[day].attempts * 100) + '%</td></tr>').join('') + '</tbody></table></div>' : empty('每一份积累，都从第一题开始', '完成一道题目后，这里会记录当天的学习情况。', '<button class="button primary" data-action="nav" data-view="home">开始学习</button>')); }
  function manage() { if (!canManageBanks()) return personalManage(); return pageHead('KEEP YOUR PROGRESS SAFE', '数据与备份', '你的题库和学习记录，由你自己保管。') + (cloud ? '<div class="data-card"><div class="mode-icon">' + icon('shield') + '</div><div class="grow"><h3>账号与同步</h3><p class="cloud-status">' + cloudLabel() + '</p><p class="cloud-message"></p></div><button class="button" data-action="account">管理同步</button></div>' : '') + syncBackups.map(item => '<div class="data-card"><div class="grow"><h3>' + esc(item.label) + '</h3><p>' + new Date(item.at).toLocaleString('zh-CN') + ' · ' + snapshotSummary(item.payload) + '</p></div><button class="button" data-action="export-sync-backup" data-id="' + item.id + '">导出此备份</button></div>').join('') + (canExportBanks() ? '<div class="data-card"><div class="mode-icon">' + icon('book') + '</div><div class="grow"><h3>导出题库</h3><p>导出题目、选项、答案、章节和解析为 CSV，可重新导入。</p><select class="field-control" id="export-bank" aria-label="选择要导出的题库" style="margin-top:10px">' + bankOptions(bank()?.id) + '</select></div><button class="button primary" data-action="export-bank" ' + (!banks().length ? 'disabled' : '') + '>导出题库' + icon('download') + '</button></div>' : '') + '<div class="data-card"><div class="mode-icon">' + icon('download') + '</div><div class="grow"><h3>导出完整备份</h3><p>包含全部题库、练习进度、答题记录、错题、收藏、笔记和设置。</p>' + (state.lastBackup ? '<p>上次导出：' + new Date(state.lastBackup).toLocaleString('zh-CN') + '</p>' : '') + '</div><button class="button primary" data-action="export-backup">导出备份' + icon('download') + '</button></div><div class="data-card"><div class="mode-icon">' + icon('upload') + '</div><div class="grow"><h3>从备份恢复</h3><p>用于换设备或恢复学习记录。恢复前会展示预览，确认后替换当前全部数据。</p></div><button class="button" data-action="restore-backup">选择备份文件</button></div><div class="data-card"><div class="mode-icon">' + icon('book') + '</div><div class="grow"><h3>CSV 题库模板</h3><p>支持单选、多选、判断。选项列可以按需要扩展，模板附有三道示例题。</p></div><button class="button" data-action="template">下载模板</button></div><div class="data-warning">' + icon('info') + ' 数据保存在当前浏览器、当前打开位置的本地空间中。更换浏览器、移动离线文件或清理网站数据后，可能需要重新恢复备份。建议固定使用同一个文件位置和浏览器，并定期导出。' + (cloud ? '登录后的设备会自动同步。断网时先保存到本机，联网后重试；同时修改导致冲突时会提示处理，并保留最近 8 份同步前备份。' : '离线设备之间暂不自动同步，可手动传递备份文件。') + '</div>'; }
  function modal(title, body, footer = '', wide = false) { const active = document.activeElement; if (!$('#overlay').children.length) ui.lastFocus = active; $('#overlay').innerHTML = '<div class="modal-backdrop"><section class="modal ' + (wide ? 'wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">' + title + '</h2><button class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭">' + icon('close') + '</button></header><div class="modal-body">' + body + '</div>' + (footer ? '<footer class="modal-footer">' + footer + '</footer>' : '') + '</section></div>'; document.body.style.overflow = 'hidden'; $('#overlay').querySelector('input:not([type=checkbox]),select,textarea,button')?.focus(); }
  function closeModal() { $('#overlay').innerHTML = ''; document.body.style.overflow = ''; confirmAction = null; ui.lastFocus?.focus?.(); }
  function ask(title, message, action, danger = false) { confirmAction = action; modal(title, '<p class="help" style="font-size:13px;line-height:2">' + message + '</p>', '<button class="button" data-action="close-modal">取消</button><button class="button ' + (danger ? 'danger' : 'primary') + '" data-action="confirm">确认' + (danger ? '删除' : '') + '</button>'); }
  function importDialog() { requireBankAdmin(); pendingImport = null; previewPage = 0; modal('导入题库', '<div class="drop-zone" id="drop-zone" role="button" tabindex="0" data-action="choose-csv">' + icon('upload') + '<strong>点击选择 CSV 文件，或拖到这里</strong><p>' + (cloud ? '导入后同步为所有账号共用的题库' : '仅在本机读取，不会上传到任何服务器') + ' · 最大 10 MB</p></div><button class="button" style="width:100%;margin-top:14px" data-action="template">' + icon('download') + '下载 CSV 填写模板</button><div class="format-guide"><h3>填写说明</h3><p>必填：题型、题目、答案；选择题还需填写选项。<br>选项列：选项A、选项B…按需要继续增加，支持超过 26 个选项（AA、AB…）。<br>多选答案推荐 A|B|D，也接受 ABD、A、B、D；顺序不影响判题。AA 等多字母标签须使用 | 分隔。<br>判断题：填写“正确”或“错误”，选项列可留空。<br>章节支持 / 分级，例如 数据库/索引；解析、题目ID可选填。<br>兼容现有题库的 typeName、question、answerText 等英文列名。支持 UTF-8 与常见 GB18030 编码。</p></div>'); }
  function personalManage() {
    return pageHead('KEEP YOUR PROGRESS SAFE', '数据与备份', '仅管理当前账号的学习记录，共享题库由管理员维护。') + '<div class="data-card"><div class="grow"><h3>' + accountName() + ' · 账号与同步</h3><p class="cloud-status">' + cloudLabel() + '</p></div><button class="button" data-action="account">管理同步</button></div>' + syncBackups.map(item => '<div class="data-card"><div class="grow"><h3>' + esc(item.label) + '</h3><p>' + snapshotSummary(item.payload) + '</p></div><button class="button" data-action="export-sync-backup" data-id="' + item.id + '">导出此备份</button></div>').join('') + '<div class="data-card"><div class="grow"><h3>备份我的学习记录</h3><p>包含当前账号的答题记录、错题、收藏、笔记、考试和设置。</p></div><button class="button primary" data-action="export-backup">导出备份</button></div><div class="data-card"><div class="grow"><h3>恢复我的学习记录</h3><p>仅支持当前账号导出的备份，共享题库不会被替换。</p></div><button class="button" data-action="restore-backup">选择备份文件</button></div>';
  }
  async function readCSV(file) {
    requireBankAdmin();
    if (!file) return; if (!/\.csv$/i.test(file.name)) throw new Error('请选择 .csv 文件。'); if (file.size > 10 * 1024 * 1024) throw new Error('文件超过 10 MB，请拆分题库后导入。');
    const bytes = await file.arrayBuffer(); let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { text = new TextDecoder('gb18030', { fatal: true }).decode(bytes); }
    pendingImport = { entries: C.parseCSV(text), name: file.name.replace(/\.csv$/i, ''), target: '', skip: false };
    if (pendingImport.entries.length > 50000) { pendingImport = null; throw new Error('单次最多导入 50,000 道题目，请拆分后重试。'); }
    previewPage = 0; importPreview();
  }
  function importPreview() {
    const p = pendingImport; if (!p) return; p.inspected = C.inspect(p.entries); const valid = p.inspected.filter(r => r.q && !r.duplicate), errors = p.inspected.filter(r => r.validation), dup = p.inspected.filter(r => r.duplicate), pageCount = Math.max(1, Math.ceil(p.inspected.length / 25)); previewPage = Math.min(previewPage, pageCount - 1);
    let summary = '<div class="import-summary">' + C.TYPES.map(t => '<span><strong>' + valid.filter(r => r.q.type === t).length + '</strong>' + t + '</span>').join('') + '<span><strong class="bad-text">' + errors.length + '</strong>有误</span><span><strong>' + dup.length + '</strong>重复</span></div>';
    summary += '<div class="row" style="align-items:start;gap:16px"><div class="form-field grow"><label for="import-name">题库名称</label><input id="import-name" maxlength="100" value="' + esc(p.name) + '" placeholder="为这份题库取个名字"></div><div class="form-field grow"><label for="import-target">导入到</label><select id="import-target"><option value="">新建题库</option>' + bankOptions(p.target) + '</select></div></div><div class="preview-scroll"><table class="preview-table"><thead><tr><th>行号</th><th>题型</th><th>题目预览</th><th>答案 / 状态</th><th>操作</th></tr></thead><tbody>';
    summary += p.inspected.slice(previewPage * 25, (previewPage + 1) * 25).map((r, j) => '<tr><td>' + r.line + '</td><td>' + esc(r.q ? r.q.type : (r.raw['题型'] || r.raw.typeName || '待检查')) + '</td><td class="preview-text">' + esc(r.q?.text || r.raw['题目'] || r.raw.question || '') + '<span class="error-label">' + esc(r.validation) + '</span></td><td>' + (r.duplicate ? '<span class="muted">重复，将跳过</span>' : r.q ? '<span class="good-text">' + formatAnswer(r.q, r.q.answer) + '</span>' : '<span class="bad-text">需修改</span>') + '</td><td><div class="preview-tools"><button data-action="edit-import" data-index="' + (previewPage * 25 + j) + '">编辑</button><button data-action="delete-import" data-index="' + (previewPage * 25 + j) + '">删除</button></div></td></tr>').join('');
    summary += '</tbody></table></div><div class="list-pagination" style="margin-top:12px"><button class="button" data-action="preview-prev" ' + (previewPage === 0 ? 'disabled' : '') + '>上一页</button><span>' + (previewPage + 1) + ' / ' + pageCount + '</span><button class="button" data-action="preview-next" ' + (previewPage === pageCount - 1 ? 'disabled' : '') + '>下一页</button></div>';
    if (errors.length) summary += '<label class="check-row"><input id="skip-invalid" type="checkbox" ' + (p.skip ? 'checked' : '') + '>跳过有误题目，仅导入有效题目（有误题目不会保存）</label>';
    summary += '<p class="help" style="margin-top:12px">相同内容与答案的重复题目会自动跳过。可先编辑或删除题目，再确认导入。</p>';
    modal('核对题库 · 导入预览', summary, '<button class="button" data-action="import">重新选文件</button><button class="button primary" data-action="confirm-import" ' + (!valid.length || (errors.length && !p.skip) ? 'disabled' : '') + '>确认导入 ' + valid.length + ' 道题目</button>', true);
    $('#import-target').value = p.target;
  }
  function editImport(index) {
    editorIndex = index; const entry = pendingImport.entries[index], q = pendingImport.inspected[index]?.q;
    const raw = entry.raw, find = (...names) => { for (const name of names) { const value = Object.entries(raw).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1]; if (value !== undefined) return value; } return ''; };
    editorFields = q ? q.options.map(o => ({ ...o })) : Object.entries(raw).filter(([k]) => C.optionLabel(k)).map(([k, v]) => ({ label: C.optionLabel(k), text: v }));
    if (!editorFields.length) editorFields = Array.from({ length: 4 }, (_, i) => ({ label: C.label(i), text: '' }));
    const type = q?.type || find('题型', 'typeName', 'type') || '单选题';
    modal('编辑导入题目', '<div class="row"><div class="form-field grow"><label>题目ID（可选）</label><input id="edit-id" value="' + esc(q?.id || find('题目ID', 'testId', 'id')) + '"></div><div class="form-field grow"><label>题型</label><select id="edit-type">' + C.TYPES.map(t => '<option ' + (t === type ? 'selected' : '') + '>' + t + '</option>').join('') + '</select></div></div><div class="form-field"><label>章节</label><input id="edit-chapter" value="' + esc(q?.chapter || find('章节', 'classificationName')) + '"></div><div class="form-field"><label>题目</label><textarea id="edit-text">' + esc(q?.text || find('题目', 'question', '题干')) + '</textarea></div><div id="editor-options">' + editorOptions() + '</div><button class="text-button" data-action="add-edit-option">' + icon('plus') + '增加选项</button><div class="form-field" style="margin-top:20px"><label>正确答案（多选用 | 分隔；判断填正确或错误）</label><input id="edit-answer" value="' + esc(q ? q.type === '判断题' ? (q.answer[0] === 'A' ? '正确' : '错误') : q.answer.join('|') : find('答案', 'answerText', 'answer')) + '"></div><div class="form-field"><label>解析</label><textarea id="edit-analysis">' + esc(q?.analysis || find('解析', 'analysis')) + '</textarea></div><p class="editor-error" id="edit-error"></p>', '<button class="button" data-action="cancel-edit">返回预览</button><button class="button primary" data-action="save-edit">保存修改</button>');
  }
  function editorOptions() { return '<p class="help" style="margin-bottom:10px">选择题选项（判断题可忽略）</p>' + editorFields.map((o, i) => '<div class="option-edit"><label for="edit-option-' + i + '">' + o.label + '</label><input id="edit-option-' + i + '" data-option-index="' + i + '" value="' + esc(o.text) + '" placeholder="选项内容"></div>').join(''); }
  function captureEditor() { editorFields.forEach((o, i) => { o.text = $('#edit-option-' + i)?.value || ''; }); }
  async function confirmImport() {
    requireBankAdmin();
    const p = pendingImport; if (!p) return; p.name = $('#import-name').value.trim(); p.target = $('#import-target').value;
    if (!p.target && !p.name) return toast('请填写题库名称。');
    const inspected = C.inspect(p.entries); if (inspected.some(r => r.validation) && !p.skip) return toast('请修正有误题目，或明确选择跳过。');
    let questions = inspected.filter(r => r.q && !r.duplicate).map(r => r.q), target = banks().find(b => b.id === p.target), removed = inspected.filter(r => r.duplicate).length;
    if (target) {
      const seen = new Set(target.questions.map(C.signature)); questions = questions.filter(q => { const sig = C.signature(q); if (seen.has(sig)) { removed++; return false; } seen.add(sig); return true; });
      const used = new Set(target.questions.map(q => q.id)); questions = questions.map(q => { if (used.has(q.id)) q = { ...q, id: uid() }; used.add(q.id); return q; });
      if (!questions.length) return toast('没有新增题目，所选内容都已存在。'); target.questions.push(...questions);
    } else { if (!questions.length) return toast('没有可以导入的题目。'); target = { id: uid(), name: p.name, questions, createdAt: new Date().toISOString() }; banks().push(target); }
    ui.bankId = target.id; state.selectedBank = target.id; await save(); pendingImport = null; closeModal(); ui.view = 'home'; render(); toast('已导入 ' + questions.length + ' 道题目' + (removed ? '，跳过 ' + removed + ' 道重复题' : '') + '。');
  }
  function eligibleQuestions(b, mode, filters = {}) {
    return b.questions.filter(q => {
      const r = record(b, q);
      return (!practiceTypes[mode] || q.type === practiceTypes[mode]) && (!filters.chapter || q.chapter === filters.chapter || q.chapter.startsWith(filters.chapter + '/')) && (!filters.type || q.type === filters.type) && (filters.status !== 'new' || !r.attempts) && (filters.status !== 'done' || r.attempts > 0) && (mode !== 'wrong' || r.inWrong) && (mode !== 'favorite' || r.favorite);
    });
  }
  function updateModeProgress() {
    const summary = $('#mode-progress-summary'); if (!summary) return;
    const b = bank(), filters = { chapter: $('#mode-chapter').value, type: $('#mode-type').value }, qs = eligibleQuestions(b, '', filters), c = progress(b, qs);
    const status = $('#mode-status').value, selected = status === 'new' ? c.remaining : status === 'done' ? c.done : c.total;
    const input = $('#mode-count'), button = $('[data-action="start-configured"]');
    const saved = state.practiceSessions?.[C.practiceKey(b.id, button.dataset.mode, { ...filters, status, count: input ? Number(input.value) : undefined })];
    summary.innerHTML = '所选范围共 ' + c.total + ' 道，已练 <strong>' + c.done + '</strong> 道，未练 <strong>' + c.remaining + '</strong> 道。<br>按当前练习状态可选 <strong>' + selected + '</strong> 道题目，所有模式共享记录。';
    if (saved) summary.innerHTML += '<br>此范围已有进度：' + (saved.complete ? '本轮已完成' : '第 ' + (saved.index + 1) + ' / ' + saved.ids.length + ' 题') + '，点击可继续查看。';
    if (input) { input.max = Math.max(selected, saved ? Number(saved.filters.count) || saved.ids.length : 0); if (!saved && Number(input.value) > selected) input.value = selected || 1; }
    button.disabled = selected === 0 && !saved;
  }
  function configure(mode, changeRange = false) {
    if (mode === 'exam') return examConfig();
    const b = bank(); if (!b) return importDialog();
    const saved = savedPractice(b, mode);
    if (saved && !changeRange) return activatePractice(saved);
    const lastFilters = saved?.filters || {};
    if (practiceTypes[mode]) return startMode(mode, { type: practiceTypes[mode] });
    if (mode === 'sequential' || mode === 'wrong' || mode === 'favorite') return startMode(mode, {});
    const body = '<p class="help" style="margin-bottom:22px">' + esc(b.name) + '</p><div class="form-field"><label for="mode-chapter">' + (mode === 'chapter' ? '选择章节' : '章节范围') + '</label><select id="mode-chapter">' + chapterOptions(b, lastFilters.chapter) + '</select></div><div class="form-field"><label for="mode-type">' + (mode === 'type' ? '选择题型' : '题型范围') + '</label><select id="mode-type">' + typeOptions(lastFilters.type || '', b) + '</select></div><div class="form-field"><label for="mode-status">练习状态</label><select id="mode-status"><option value="">全部题目</option><option value="new">仅未练题目</option><option value="done">仅已练题目</option></select></div><div class="mode-progress-summary" id="mode-progress-summary"></div>' + (mode === 'random' ? '<div class="form-field"><label for="mode-count">本轮题量</label><input id="mode-count" type="number" min="1" max="' + b.questions.length + '" value="' + (lastFilters.count || Math.min(20, b.questions.length)) + '"><p class="help" id="mode-count-help">按筛选范围随机抽取，不重复出题。</p></div>' : '<p class="help">按题库中的原始顺序练习。各项筛选可以组合使用。</p>');
    modal(modes[mode], body, '<button class="button" data-action="close-modal">取消</button><button class="button primary" data-action="start-configured" data-mode="' + mode + '">继续 / 开始练习' + icon('arrow') + '</button>');
    $('#mode-status').value = lastFilters.status || '';
    if (mode === 'chapter' && !saved) $('#mode-chapter').value = chapterPaths(b)[0] || '';
    if (mode === 'type' && !saved) $('#mode-type').value = '单选题';
    updateModeProgress();
  }
  function savedPractice(b, mode) {
    return b && state.practiceSessions?.[state.practiceLast?.[C.practicePlace(b.id, mode)]];
  }
  function latestPractice(b) {
    if (!b) return null;
    if (state.session?.bankId === b.id) return state.session;
    return Object.values(state.practiceSessions || {}).filter(s => s.bankId === b.id).sort((a, b) => String(b.updatedAt || b.startedAt || '').localeCompare(String(a.updatedAt || a.startedAt || '')))[0] || null;
  }
  async function activatePractice(session) {
    clearTimeout(nextTimer); clearTimeout(noteTimer);
    C.rememberPractice(state);
    const b = banks().find(b => b.id === session.bankId);
    session = C.reconcilePractice(session, b);
    if (!session) return toast('当前范围已没有题目，请重新选择。');
    if (!session.filters.scope && ['wrong', 'favorite'].includes(session.mode)) {
      const known = new Set(session.ids);
      session.ids.push(...eligibleQuestions(b, session.mode, session.filters).filter(q => !known.has(q.id)).map(q => q.id));
      session.complete = session.ids.every(id => session.answers[id]);
    }
    state.session = session; session.updatedAt = new Date().toISOString();
    ui.bankId = session.bankId; state.selectedBank = session.bankId;
    ui.draft = [...(session.drafts?.[session.ids[session.index]] || [])]; ui.showNote = false;
    ui.cardPage = Math.floor(session.index / 100); ui.answerSheet = false;
    ui.view = 'practice';
    await save(); closeModal(); render(); window.scrollTo(0, 0);
  }
  async function startMode(mode, filters, newRound = false) {
    const b = bank(); if (!b) return;
    const saved = state.practiceSessions?.[C.practiceKey(b.id, mode, filters)];
    if (saved && !newRound) return activatePractice(saved);
    let qs = eligibleQuestions(b, mode, filters);
    if (mode === 'random') {
      if (!Number.isInteger(filters.count) || filters.count < 1) return toast('题量需要填写大于 0 的整数。');
      const unseen = qs.filter(q => !record(b, q).attempts);
      qs = [...(unseen.length ? unseen : qs)];
      for (let i = qs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [qs[i], qs[j]] = [qs[j], qs[i]]; }
      qs = qs.slice(0, filters.count);
    }
    if (!qs.length) return toast(mode === 'wrong' ? '这个题库还没有错题。' : mode === 'favorite' ? '这个题库还没有收藏题目。' : '所选范围没有题目，请换个条件。');
    return requestSession(b, qs, mode, filters, newRound);
  }
  async function requestSession(b, qs, mode, filters = {}, restart = false) {
    const saved = state.practiceSessions?.[C.practiceKey(b.id, mode, filters)];
    if (saved && !restart) return activatePractice(saved);
    if (!qs.length) return toast('当前范围没有题目。');
    const firstUnseen = !restart && !['wrong', 'favorite'].includes(mode) ? qs.findIndex(q => !record(b, q).attempts) : 0;
    const session = { bankId: b.id, ids: qs.map(q => q.id), mode, filters, index: Math.max(0, firstUnseen), answers: {}, drafts: {}, startedAt: new Date().toISOString(), complete: false };
    return activatePractice(session);
  }
  function restartPractice() {
    const { s, b } = sessionContext(); if (!s || !b) return;
    ask('重新练习当前范围？', '仅重新开始当前范围，其他练习位置和累计答题记录、错题、收藏、笔记都会保留。', async () => {
      const questions = new Map(b.questions.map(q => [q.id, q]));
      await requestSession(b, s.ids.map(id => questions.get(id)).filter(Boolean), s.mode, s.filters, true);
    });
  }
  async function choose(label) { const { s, q, answer } = sessionContext(); if (!q || answer) return; if (q.type === '多选题') { ui.draft = ui.draft.includes(label) ? ui.draft.filter(a => a !== label) : [...ui.draft, label]; s.drafts ||= {}; s.drafts[q.id] = [...ui.draft]; s.updatedAt = new Date().toISOString(); await save(); render(); } else { ui.draft = [label]; await submit(); } }
  async function submit() { const { s, b, q, answer } = sessionContext(); if (!q || answer || !ui.draft.length) return; const selected = [...ui.draft], right = C.correct(q, selected), now = new Date().toISOString(); s.answers[q.id] = { selected, correct: right, at: now }; s.complete = Object.keys(s.answers).length === s.ids.length; delete s.drafts?.[q.id]; s.updatedAt = now; const r = ensureRecord(b, q); r.attempts++; r[right ? 'right' : 'wrong']++; r.lastCorrect = right; if (!right) r.inWrong = true; r.history.push({ at: now, correct: right, selected }); r.history = r.history.slice(-20); state.activity ||= {}; const today = state.activity[dateKey()] ||= { attempts: 0, right: 0 }; today.attempts++; today.right += right ? 1 : 0; await save(); render(); if (mobileScreen.matches) $('.answer-panel')?.scrollIntoView({ block: 'center', behavior: 'auto' }); if (right ? state.settings.autoCorrect : state.settings.autoWrong) { const session = s, current = q.id; clearTimeout(nextTimer); nextTimer = setTimeout(() => { if (ui.view === 'practice' && !$('#overlay').children.length && state.session === session && session.ids[session.index] === current) next().catch(report); }, 1600); } }
  async function navigateQuestion(index) { ui.answerSheet = false; clearTimeout(nextTimer); clearTimeout(noteTimer); if (!state.session) return; state.session.index = Math.max(0, Math.min(index, state.session.ids.length - 1)); ui.draft = [...(state.session.drafts?.[state.session.ids[state.session.index]] || [])]; state.session.updatedAt = new Date().toISOString(); ui.showNote = false; ui.cardPage = Math.floor(state.session.index / 100); await save(); render(); window.scrollTo(0, 0); }
  async function next() { const { s } = sessionContext(); if (!s) return; if (s.index === s.ids.length - 1) { clearTimeout(nextTimer); ui.view = 'complete'; render(); window.scrollTo(0, 0); } else await navigateQuestion(s.index + 1); }
  async function toggleFavorite(b, q) { const r = ensureRecord(b, q); r.favorite = !r.favorite; await save(); render(); toast(r.favorite ? '已加入收藏。' : '已取消收藏。'); }
  const examAnswered = exam => Object.values(exam.answers).filter(a => a.length).length;
  const examTime = seconds => { seconds = Math.max(0, Math.ceil(seconds)); return String(Math.floor(seconds / 3600)).padStart(2, '0') + ':' + String(Math.floor(seconds / 60) % 60).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); };
  const examRemaining = exam => (Date.parse(exam.deadline) - Date.now()) / 1000;
  function examConfig() {
    if (state.activeExam) { ui.view = 'exam'; render(); toast('请先完成当前考试，再开始新的考试。'); return; }
    const b = bank(); if (!b) return importDialog();
    modal('模拟考试 · 组卷设置', '<p class="help exam-rules">满分 100 分，每题等分。多选全部选对才得分，错选、漏选和未答不得分。交卷后统一显示答案和解析。</p><div class="form-field"><label for="exam-bank">考试题库</label><select id="exam-bank">' + bankOptions(b.id) + '</select></div><div class="form-field"><label for="exam-chapter">章节范围</label><select id="exam-chapter">' + chapterOptions(b) + '</select></div><div class="exam-counts">' + C.TYPES.map((type, i) => '<div class="form-field"><label for="exam-count-' + i + '">' + type + '</label><input id="exam-count-' + i + '" type="number" min="0" step="1" value="' + Math.min(i ? 10 : 20, b.questions.filter(q => q.type === type).length) + '"><span class="help" id="exam-available-' + i + '"></span></div>').join('') + '</div><div class="exam-settings-grid"><div class="form-field"><label for="exam-duration">考试时长（分钟）</label><input id="exam-duration" type="number" min="1" max="240" step="1" value="60"></div><div class="form-field"><label for="exam-pass">及格分数（满分 100）</label><input id="exam-pass" type="number" min="0" max="100" step="1" value="60"></div></div><div class="mode-progress-summary" id="exam-config-summary" role="status"></div><p class="help">随机抽题、不重复出题。暂离或关闭页面不会暂停计时；时间到自动交卷。普通练习的当前进度会保留。</p>', '<button class="button" data-action="close-modal">取消</button><button class="button primary" data-action="exam-start">开始考试' + icon('arrow') + '</button>');
    updateExamConfig(true);
  }
  function updateExamConfig(clamp = false) {
    if (!$('#exam-chapter')) return;
    const b = banks().find(b => b.id === $('#exam-bank').value), chapter = $('#exam-chapter').value;
    const pool = b.questions.filter(q => !chapter || q.chapter === chapter || q.chapter.startsWith(chapter + '/'));
    let total = 0, valid = true;
    C.TYPES.forEach((type, i) => {
      const count = pool.filter(q => q.type === type).length, input = $('#exam-count-' + i); input.max = count;
      if (clamp && Number(input.value) > count) input.value = count;
      $('#exam-available-' + i).textContent = '可选 ' + count + ' 道';
      const n = Number(input.value); total += n;
      if (!input.value.trim() || !Number.isInteger(n) || n < 0 || n > count) valid = false;
    });
    const duration = Number($('#exam-duration').value), pass = Number($('#exam-pass').value);
    valid = valid && total >= 1 && total <= 500 && Number.isInteger(duration) && duration >= 1 && duration <= 240 && $('#exam-pass').value.trim() !== '' && Number.isInteger(pass) && pass >= 0 && pass <= 100;
    $('#exam-config-summary').textContent = valid ? '共 ' + total + ' 道题 · ' + duration + ' 分钟 · ' + pass + ' 分及格 · 满分 100 分' : '请检查题量（合计 1–500 道且不超过可选数量）、时长（1–240 分钟）和及格线（0–100 分）。';
    $('[data-action=exam-start]').disabled = !valid;
  }
  async function startExam() {
    if (state.activeExam) return;
    updateExamConfig(); if ($('[data-action=exam-start]').disabled) return;
    const b = banks().find(b => b.id === $('#exam-bank').value), counts = Object.fromEntries(C.TYPES.map((type, i) => [type, Number($('#exam-count-' + i).value)]));
    const questions = C.examPaper(b.questions, counts, $('#exam-chapter').value), durationMinutes = Number($('#exam-duration').value), now = Date.now();
    state.activeExam = { id: uid(), bankId: b.id, bankName: b.name, questions, index: 0, answers: {}, marked: {}, durationMinutes, passScore: Number($('#exam-pass').value), startedAt: new Date(now).toISOString(), deadline: new Date(now + durationMinutes * 60000).toISOString() };
    clearTimeout(nextTimer); ui.examPage = 0; ui.view = 'exam'; await save(); closeModal(); render(); window.scrollTo(0, 0);
  }
  function currentExam() { return ui.view === 'exam' ? state.activeExam : (state.exams || []).find(e => e.id === ui.examId); }
  function examIndices(exam, review) { return exam.questions.map((q, i) => i).filter(i => !review || !ui.examFilter || (ui.examFilter === 'unanswered' ? !exam.answers[exam.questions[i].id]?.length : !C.correct(exam.questions[i], exam.answers[exam.questions[i].id] || []))); }
  function examGrid(exam, review) {
    const indices = examIndices(exam, review), pages = Math.max(1, Math.ceil(indices.length / 100)); ui.examPage = Math.min(ui.examPage || 0, pages - 1);
    const index = review ? ui.examIndex : exam.index;
    return '<div class="answer-grid">' + indices.slice(ui.examPage * 100, (ui.examPage + 1) * 100).map(i => {
      const q = exam.questions[i], selected = exam.answers[q.id] || [], status = review ? selected.length ? C.correct(q, selected) ? '答对' : '答错' : '未答' : selected.length ? '已答' : '未答';
      return '<button class="number-button ' + (review ? selected.length ? C.correct(q, selected) ? 'good ' : 'bad ' : '' : selected.length ? 'exam-answered ' : '') + (exam.marked[q.id] ? 'exam-marked ' : '') + (i === index ? 'current' : '') + '" data-action="exam-jump" data-index="' + i + '" aria-label="第 ' + (i + 1) + ' 题，' + status + (exam.marked[q.id] ? '，待检查' : '') + '" title="' + status + '" ' + (i === index ? 'aria-current="true"' : '') + '>' + (i + 1) + '</button>';
    }).join('') + '</div>' + (pages > 1 ? '<div class="card-pager"><button data-action="exam-card-prev" ' + (!ui.examPage ? 'disabled' : '') + '>上一组</button><span>' + (ui.examPage + 1) + ' / ' + pages + '</span><button data-action="exam-card-next" ' + (ui.examPage === pages - 1 ? 'disabled' : '') + '>下一组</button></div>' : '');
  }
  function examView(review = false) {
    const exam = currentExam(); if (!exam) return empty('没有可查看的考试', '回到模拟考试页面开始一场考试。', '<button class="button" data-action="nav" data-view="exams">返回模拟考试</button>');
    const index = review ? ui.examIndex || 0 : exam.index, q = exam.questions[index], selected = exam.answers[q.id] || [], answered = examAnswered(exam), indices = examIndices(exam, review), position = indices.indexOf(index);
    const right = review && selected.length && C.correct(q, selected);
    let html = '<div class="practice-layout exam-layout"><article class="question-card"><div class="question-meta"><span class="chapter" title="' + esc(exam.bankName) + '">' + esc(q.chapter.replaceAll('/', ' / ')) + '</span><span class="question-count"><strong>' + (index + 1) + '</strong> / ' + exam.questions.length + '</span></div><div class="question-labels"><span class="chip green">' + q.type + '</span><span class="history-badge">' + (review ? '考后回顾' : '模拟考试 · 交卷后判分') + '</span></div><h2 class="question-text">' + esc(q.text) + '</h2><p class="question-instruction">' + (review ? '查看本次考试的答案与解析。' : q.type === '多选题' ? '选择所有正确选项，选择后自动保存，可随时修改。' : '选择一个答案，选择后自动保存，可随时修改。') + '</p><div class="options" role="group" aria-label="考试选项">';
    for (const o of q.options) html += '<button class="option ' + (q.type === '多选题' ? 'multiple ' : '') + (selected.includes(o.label) ? 'selected ' : '') + (review && q.answer.includes(o.label) ? 'correct ' : '') + (review && selected.includes(o.label) && !q.answer.includes(o.label) ? 'incorrect ' : '') + '" data-action="exam-choose" data-label="' + o.label + '" aria-pressed="' + selected.includes(o.label) + '" ' + (review ? 'disabled' : '') + '><span class="option-letter">' + o.label + '</span><span class="option-content">' + esc(o.text) + '</span></button>';
    html += '</div>';
    if (review) html += '<div class="answer-panel ' + (right ? 'good' : 'bad') + '"><div class="answer-verdict">' + icon(right ? 'check' : 'wrong') + (right ? '回答正确' : selected.length ? '回答错误' : '本题未作答') + '</div><div class="answer-values"><span>正确答案：<strong>' + formatAnswer(q, q.answer) + '</strong></span><span>你的答案：<strong>' + (selected.length ? formatAnswer(q, selected) : '未作答') + '</strong></span></div><div class="analysis"><strong>题目解析</strong>' + (q.analysis ? esc(q.analysis) : '原题库未提供解析。') + '</div></div>';
    html += '<div class="question-footer"><button class="button" data-action="exam-prev" ' + (position <= 0 ? 'disabled' : '') + '>' + icon('left') + '上一题</button><button class="button primary" data-action="exam-next">' + (position === indices.length - 1 ? review ? '返回成绩' : '检查并交卷' : '下一题') + icon('arrow') + '</button></div>';
    if (!review) html += '<div class="question-tools"><button class="tool-button ' + (exam.marked[q.id] ? 'on' : '') + '" data-action="exam-mark">' + icon('star') + (exam.marked[q.id] ? '已标记待检查' : '标记待检查') + '</button><button class="tool-button" data-action="exam-clear" ' + (!selected.length ? 'disabled' : '') + '>' + icon('refresh') + '清空本题答案</button><button class="tool-button exam-hand-in" data-action="exam-submit">' + icon('check') + '交卷</button></div>';
    html += '</article><aside class="practice-aside"><div class="aside-card answer-card">';
    if (!review) html += '<div class="exam-timer"><span>' + icon('clock') + '剩余时间</span><strong class="exam-clock" role="timer" aria-label="考试剩余时间">' + examTime(examRemaining(exam)) + '</strong><small>暂离或刷新后继续计时</small></div>';
    html += '<h3>' + (review ? '考试回顾' : '考试答题卡') + '<span>' + answered + ' / ' + exam.questions.length + ' 已答</span></h3>';
    if (review) html += '<select id="exam-review-filter" class="field-control exam-review-filter" aria-label="筛选回顾题目"><option value="">全部题目</option><option value="wrong" ' + (ui.examFilter === 'wrong' ? 'selected' : '') + '>错题与未答</option><option value="unanswered" ' + (ui.examFilter === 'unanswered' ? 'selected' : '') + '>仅未答题目</option></select>';
    else html += '<div class="session-mini"><div><strong>' + answered + '</strong><span>已答</span></div><div><strong>' + (exam.questions.length - answered) + '</strong><span>未答</span></div><div><strong>' + Object.values(exam.marked).filter(Boolean).length + '</strong><span>待检查</span></div></div>';
    html += examGrid(exam, review) + '<div class="legend">' + (review ? '<span><i class="good"></i>答对</span><span><i class="bad"></i>答错</span><span><i></i>未答</span>' : '<span><i class="exam-answered"></i>已答</span><span><i></i>未答</span><span><i class="exam-marked"></i>待检查</span>') + '</div><div class="focus-actions"><button class="button" data-action="' + (review ? 'exam-result' : 'nav') + '" ' + (review ? 'data-id="' + esc(exam.id) + '"' : 'data-view="home"') + '>' + (review ? '返回成绩' : '暂离考试') + '</button><button class="button ' + (review ? '' : 'primary') + '" data-action="' + (review ? 'nav' : 'exam-submit') + '" ' + (review ? 'data-view="exams"' : '') + '>' + (review ? '考试记录' : '交卷') + '</button></div><p class="focus-save save-indicator" role="status">' + esc(saveLabel()) + '</p></div></aside></div>';
    return html;
  }
  async function examChoose(label) {
    const exam = state.activeExam; if (!exam || ui.view !== 'exam') return;
    if (examRemaining(exam) <= 0) return finishExam(true);
    const q = exam.questions[exam.index]; if (!q.options.some(o => o.label === label)) return;
    const selected = exam.answers[q.id] || [];
    exam.answers[q.id] = q.type === '多选题' ? selected.includes(label) ? selected.filter(a => a !== label) : [...selected, label] : [label];
    render(); await save();
  }
  async function examJump(index) {
    ui.answerSheet = false;
    const exam = currentExam(); if (!exam || index < 0 || index >= exam.questions.length) return;
    if (ui.view === 'exam') { if (examRemaining(exam) <= 0) return finishExam(true); exam.index = index; }
    else ui.examIndex = index;
    ui.examPage = Math.floor(examIndices(exam, ui.view === 'exam-review').indexOf(index) / 100); render(); window.scrollTo(0, 0); if (ui.view === 'exam') await save();
  }
  function confirmExamSubmit() {
    const exam = state.activeExam; if (!exam) return;
    if (examRemaining(exam) <= 0) return finishExam(true).catch(report);
    ask('确认交卷？', '已答 <strong>' + examAnswered(exam) + '</strong> / ' + exam.questions.length + ' 道，未答 <strong>' + (exam.questions.length - examAnswered(exam)) + '</strong> 道，待检查 <strong>' + Object.values(exam.marked).filter(Boolean).length + '</strong> 道。<br>未答题按零分计，交卷后不能修改答案。', () => finishExam(false));
  }
  async function finishExam(autoSubmitted) {
    const exam = state.activeExam; if (!exam) return;
    // Move out of active state before saving so timer and manual submission cannot grade twice.
    state.activeExam = null; exam.finishedAt = new Date(Math.max(Date.parse(exam.startedAt), Math.min(Date.now(), Date.parse(exam.deadline)))).toISOString(); exam.autoSubmitted = autoSubmitted;
    state.exams ||= []; state.exams.unshift(exam);
    const b = banks().find(b => b.id === exam.bankId);
    if (b) for (const q of exam.questions) {
      if (!b.questions.some(item => item.id === q.id)) continue;
      const selected = exam.answers[q.id] || [], right = selected.length > 0 && C.correct(q, selected), r = ensureRecord(b, q);
      if (!right) r.inWrong = true;
      if (!selected.length) continue;
      r.attempts++; r[right ? 'right' : 'wrong']++; r.lastCorrect = right; r.history.push({ at: exam.finishedAt, correct: right, selected: [...selected] }); r.history = r.history.slice(-20);
      state.activity ||= {}; const today = state.activity[dateKey(exam.finishedAt)] ||= { attempts: 0, right: 0 }; today.attempts++; today.right += right ? 1 : 0;
    }
    ui.examId = exam.id; ui.view = 'exam-result'; closeModal();
    try { await save(); } catch (e) { report(e); }
    render(); window.scrollTo(0, 0); if (autoSubmitted) toast('考试时间已到，已自动交卷。');
  }
  function examTick() {
    const exam = state?.activeExam; if (!exam || accountLocked) return;
    const remaining = examRemaining(exam);
    document.querySelectorAll('.exam-clock').forEach(clock => { clock.textContent = examTime(remaining); clock.classList.toggle('bad-text', remaining <= 300); });
    if (remaining <= 0) finishExam(true).catch(report);
  }
  function examsView() {
    const active = state.activeExam, exams = state.exams || [];
    let html = pageHead('TEST YOURSELF', '模拟考试', '限时自测，交卷后查看成绩与解析。', '<button class="button primary" data-action="exam-config">' + icon('plus') + '新建考试</button>');
    if (active) html += '<div class="data-card"><div class="mode-icon">' + icon('clock') + '</div><div class="grow"><h3>考试进行中 · ' + esc(active.bankName) + '</h3><p>已答 ' + examAnswered(active) + ' / ' + active.questions.length + ' 道 · 剩余 <span class="exam-clock" role="timer">' + examTime(examRemaining(active)) + '</span></p></div><button class="button primary" data-action="exam-resume">继续考试</button></div>';
    if (!exams.length) return html + empty('第一场模拟考试，从这里开始', '选择题库、章节和各题型题量，设置考试时长与及格线。成绩和试卷自动保存在本机。');
    html += '<div class="exam-history">' + exams.map(exam => { const r = C.examResult(exam); return '<article class="data-card"><div class="exam-history-score ' + (r.passed ? 'good-text' : 'bad-text') + '">' + r.score + '<small>分</small></div><div class="grow"><h3>' + esc(exam.bankName) + '</h3><p>' + new Date(exam.finishedAt).toLocaleString('zh-CN') + ' · ' + exam.questions.length + ' 道 · ' + (r.passed ? '及格' : '未及格') + (exam.autoSubmitted ? ' · 到时交卷' : '') + '</p></div><button class="button" data-action="exam-result" data-id="' + esc(exam.id) + '">查看成绩' + icon('chevron') + '</button></article>'; }).join('') + '</div>';
    return html;
  }
  function examResultView() {
    const exam = currentExam(); if (!exam) return empty('没有找到考试记录', '请返回模拟考试页面。', '<button class="button" data-action="nav" data-view="exams">返回模拟考试</button>');
    const r = C.examResult(exam), elapsed = (Date.parse(exam.finishedAt) - Date.parse(exam.startedAt)) / 1000;
    return pageHead('EXAM RESULT', '考试成绩', esc(exam.bankName), '<button class="button" data-action="nav" data-view="exams">考试记录</button>') + '<section class="exam-result-card"><div class="eyebrow">' + (exam.autoSubmitted ? '考试到时 · 自动交卷' : '考试完成') + '</div><div class="exam-score ' + (r.passed ? 'good-text' : 'bad-text') + '">' + r.score + '<small>/ 100</small></div><h2>' + (r.passed ? '本次考试及格' : '继续巩固，下次进步') + '</h2><p class="help">及格线 ' + exam.passScore + ' 分 · 用时 ' + examTime(elapsed) + ' · ' + new Date(exam.finishedAt).toLocaleString('zh-CN') + '</p><div class="complete-stats"><div><strong class="good-text">' + r.right + '</strong><span>答对</span></div><div><strong class="bad-text">' + r.wrong + '</strong><span>答错</span></div><div><strong>' + r.unanswered + '</strong><span>未答</span></div></div><div class="exam-breakdown">' + C.TYPES.filter(type => r.byType[type].total).map(type => '<div><strong>' + type + '</strong><span>' + r.byType[type].total + ' 道</span><span>答对 ' + r.byType[type].right + ' · 答错 ' + r.byType[type].wrong + ' · 未答 ' + r.byType[type].unanswered + '</span></div>').join('') + '</div><p class="help exam-result-note">答错与未答题已加入错题本；已答题计入学习记录。每题等分，多选题全部选对才得分。</p><div class="exam-result-actions"><button class="button primary" data-action="exam-review" data-filter="">查看整卷解析</button><button class="button" data-action="exam-review" data-filter="wrong" ' + (!(r.wrong + r.unanswered) ? 'disabled' : '') + '>查看错题与未答</button><button class="button" data-action="nav" data-view="home">返回题库</button></div></section>';
  }

  function settingsDialog() { const s = state.settings; modal('刷题设置', (ui.view === 'practice' ? '<div class="setting-row"><div><strong>当前练习进度</strong><p>已自动保存，重新进入会回到当前位置。</p></div><button class="button" data-action="restart-practice">重新练习</button></div>' + (['chapter', 'random', 'type', 'custom'].includes(state.session.mode) && !state.session.filters.scope ? '<button class="text-button" data-action="configure-mode" data-mode="' + state.session.mode + '">' + (state.session.mode === 'chapter' ? '选择章节' : '调整练习范围') + '</button>' : '') : '') + (cloud ? '<button class="account-setting" data-action="account"><strong>' + accountName() + ' · 账号与同步</strong><span class="cloud-status">' + cloudLabel() + '</span>' + icon('chevron') + '</button>' : '') + '<div class="setting-row theme-setting"><strong>界面主题</strong><p>为专注选择合适的背景</p><div class="theme-options">' + C.THEMES.map(([value, name]) => '<button class="theme-choice ' + (s.theme === value ? 'active' : '') + '" data-action="setting-theme" data-value="' + value + '" aria-pressed="' + (s.theme === value) + '"><span class="theme-swatch" data-palette="' + value + '" aria-hidden="true"></span>' + name + '</button>').join('') + '</div></div><div class="setting-row"><div><strong>题目字号</strong><p>同时调整题干与选项</p></div><div class="segment">' + [[16, '小'], [18, '中'], [20, '大'], [23, '特大']].map(([value, name]) => '<button class="' + (Number(s.font) === value ? 'active' : '') + '" data-action="setting-font" data-value="' + value + '">' + name + '</button>').join('') + '</div></div>' + [['autoCorrect', '答对自动下一题', '显示结果约 1.6 秒后切换'], ['autoWrong', '答错自动下一题', '建议关闭，留出时间理解错题'], ['analysis', '答题后显示解析', '提交前始终隐藏答案与解析'], ['notes', '显示已有笔记', '也可以在题目下方手动打开']].map(([key, title, description]) => '<label class="setting-row"><span><strong>' + title + '</strong><p>' + description + '</p></span><input class="toggle" type="checkbox" data-setting="' + key + '" ' + (s[key] ? 'checked' : '') + ' aria-label="' + title + '"></label>').join(''), (['practice', 'exam', 'exam-review'].includes(ui.view) && !desktopCard.matches ? '<button class="button" data-action="settings-card">打开答题卡</button>' : '') + '<button class="button primary" data-action="close-modal">完成</button>'); }
  function download(content, type, name) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
  async function restore(file) {
    if (!file) return;
    if (file.size > 80 * 1024 * 1024) throw new Error('备份文件超过 80 MB，无法读取。');
    let restored;
    try { restored = C.validateState(JSON.parse(await file.text())); } catch (e) { throw new Error('备份读取失败：' + e.message); }
    if (cloud && ((restored.accountId && restored.accountId !== localOwner) || (!canManageBanks() && restored.accountId !== localOwner))) throw new Error('请选择当前账号导出的备份，不能恢复其他账号的学习记录。');
    if (!canManageBanks()) restored.banks = structuredClone(banks());
    delete restored.accountId;
    restored.settings = { ...defaultSettings, ...restored.settings };
    const n = restored.banks.reduce((s, b) => s + b.questions.length, 0);
    ask(canManageBanks() ? '恢复备份 · 将替换当前全部数据' : '恢复当前账号的学习记录', canManageBanks() ? '备份包含 <strong>' + restored.banks.length + ' 个题库、' + n + ' 道题目</strong>及学习记录。确认后会替换当前数据并同步，请先导出当前备份。' : '只替换当前账号的练习进度、错题、收藏、笔记和考试记录，共享题库由管理员维护。建议先导出当前备份。', async () => {
      const old = state; state = restored; C.restorePractice(state);
      try { await save(); } catch (e) { state = old; throw e; }
      ui = { ...ui, view: 'home', bankId: state.selectedBank || banks()[0]?.id || '', query: '', type: '', chapter: '', collectionBank: '' };
      closeModal(); render(); examTick(); toast('备份已恢复。');
    });
  }
  function report(error) { console.error(error); toast(error.message || '操作没有完成，请重试。'); }
  async function perform(action, el) {
    if (accountLocked || accountBusy) return;
    if (bankActions.has(action)) requireBankAdmin();
    if (['jump', 'exam-jump', 'nav', 'summary', 'exam-submit', 'exam-result', 'exam-review'].includes(action)) { ui.answerSheet = false; syncAnswerSheet(); }
    if (!['choose', 'submit'].includes(action)) clearTimeout(nextTimer);
    switch (action) {
      case 'account': accountDialog(); break;
      case 'sync-now': {
        accountBusy = true; closeModal();
        try { await saveQueue; await cloud.run(); } finally { accountBusy = false; if (!accountLocked) accountDialog(); }
        break;
      }
      case 'sync-local':
      case 'sync-remote': {
        accountBusy = true; closeModal(); ui.view = 'home';
        modal('正在同步', '<p class="help">正在保存并同步学习记录…</p>');
        try { await cloud.resolve(action === 'sync-local' ? 'local' : 'remote'); }
        finally { accountBusy = false; closeModal(); render(); if (!accountLocked) accountDialog(); }
        break;
      }
      case 'sync-backups': closeModal(); ui.view = 'manage'; render(); break;
      case 'export-sync-backup': {
        const item = syncBackups.find(b => b.id === el.dataset.id);
        if (item) download(JSON.stringify({ ...item.payload, accountId: localOwner || undefined }, null, 2), 'application/json', '题间同步备份_' + item.id + '.json');
        break;
      }
      case 'account-logout': {
        accountBusy = true; cloud.stop(); clearTimeout(nextTimer);
        try { if (noteTimer) { clearTimeout(noteTimer); await save(); } await saveQueue; await cloud.running; await cloud.client.logout(); accountLocked = true; closeModal(); }
        finally { accountBusy = false; render(); }
        break;
      }
      case 'note-done': clearTimeout(noteTimer); await save(); $('#question-note')?.blur(); document.body.classList.remove('editing-note'); if ($('#note-status')) $('#note-status').textContent = '已保存'; break;
      case 'settings-card': closeModal(); setAnswerSheet(true); break;
      case 'mobile-card-open': setAnswerSheet(true); break;
      case 'mobile-card-close': setAnswerSheet(false); break;
      case 'exam-config': examConfig(); break;
      case 'exam-start': await startExam(); break;
      case 'exam-resume': if (state.activeExam) { ui.view = 'exam'; ui.examPage = Math.floor(state.activeExam.index / 100); render(); examTick(); window.scrollTo(0, 0); } break;
      case 'exam-choose': await examChoose(el.dataset.label); break;
      case 'exam-jump': await examJump(Number(el.dataset.index)); break;
      case 'exam-prev':
      case 'exam-next': { const exam = currentExam(); if (!exam) break; const indices = examIndices(exam, ui.view === 'exam-review'), index = indices.indexOf(ui.view === 'exam' ? exam.index : ui.examIndex || 0), target = indices[index + (action === 'exam-prev' ? -1 : 1)]; if (target !== undefined) await examJump(target); else if (action === 'exam-next') { if (ui.view === 'exam') confirmExamSubmit(); else { ui.view = 'exam-result'; render(); window.scrollTo(0, 0); } } break; }
      case 'exam-mark': { const exam = state.activeExam; if (!exam) break; if (examRemaining(exam) <= 0) { await finishExam(true); break; } const id = exam.questions[exam.index].id; exam.marked[id] = !exam.marked[id]; await save(); render(); break; }
      case 'exam-clear': { const exam = state.activeExam; if (!exam) break; if (examRemaining(exam) <= 0) { await finishExam(true); break; } delete exam.answers[exam.questions[exam.index].id]; await save(); render(); break; }
      case 'exam-submit': confirmExamSubmit(); break;
      case 'exam-card-prev': ui.examPage--; render(); break;
      case 'exam-card-next': ui.examPage++; render(); break;
      case 'exam-result': ui.examId = el.dataset.id; ui.view = 'exam-result'; render(); window.scrollTo(0, 0); break;
      case 'exam-review': { const exam = currentExam(); if (!exam) break; ui.examFilter = el.dataset.filter; ui.examIndex = examIndices(exam, true)[0] || 0; ui.examPage = 0; ui.view = 'exam-review'; render(); window.scrollTo(0, 0); break; }
      case 'nav': ui.view = el.dataset.view; ui.query = ''; ui.type = ''; ui.chapter = ''; ui.status = ''; ui.collectionBank = ''; ui.listPage = 0; render(); window.scrollTo(0, 0); break;
      case 'search-view': ui.view = 'search'; ui.query = ''; ui.type = ''; ui.status = ''; ui.collectionBank = ''; ui.listPage = 0; render(); $('#question-search')?.focus(); break;
      case 'import': importDialog(); break;
      case 'choose-csv': $('#csv-file').value = ''; $('#csv-file').click(); break;
      case 'template': download(C.template(), 'text/csv;charset=utf-8', '题间_题库导入模板.csv'); toast('模板已下载；选项列可继续扩展。'); break;
      case 'close-modal': if (editorIndex !== null && $('#edit-text')) { editorIndex = null; importPreview(); } else closeModal(); break;
      case 'confirm': if (confirmAction) { const fn = confirmAction; confirmAction = null; await fn(); } break;
      case 'select-bank': ui.bankId = el.dataset.id; state.selectedBank = ui.bankId; await save(); ui.view = 'home'; render(); window.scrollTo(0, 0); break;
      case 'rename-bank': { const b = banks().find(b => b.id === el.dataset.id); modal('重命名题库', '<div class="form-field"><label for="bank-new-name">题库名称</label><input id="bank-new-name" maxlength="100" value="' + esc(b.name) + '"></div>', '<button class="button" data-action="close-modal">取消</button><button class="button primary" data-action="save-bank-name" data-id="' + esc(b.id) + '">保存</button>'); break; }
      case 'save-bank-name': { const name = $('#bank-new-name').value.trim(); if (!name) return toast('题库名称不能为空。'); banks().find(b => b.id === el.dataset.id).name = name; await save(); closeModal(); render(); break; }
      case 'delete-bank': { const id = el.dataset.id, b = banks().find(b => b.id === id); if (state.activeExam?.bankId === id) return toast('这个题库有正在进行的考试，请先交卷再删除。'); ask('删除这个题库？', '将删除「' + esc(b.name) + '」及其全部练习记录、错题、收藏和笔记。建议先导出备份。', async () => { state.banks = banks().filter(b => b.id !== id); for (const k of Object.keys(state.records)) if (k.startsWith(id + '/')) delete state.records[k]; if (state.session?.bankId === id) state.session = null; C.restorePractice(state); if (ui.bankId === id) ui.bankId = banks()[0]?.id || ''; state.selectedBank = ui.bankId; await save(); closeModal(); render(); toast('题库已删除。'); }, true); break; }
      case 'continue': { const s = latestPractice(bank()); if (s) await activatePractice(s); else await configure('sequential'); break; }
      case 'mode': await configure(el.dataset.mode); break;
      case 'configure-mode': await configure(el.dataset.mode, true); break;
      case 'restart-practice': restartPractice(); break;
      case 'next-random-round': await startMode('random', state.session.filters, true); break;
      case 'start-configured': await startMode(el.dataset.mode, { chapter: $('#mode-chapter').value, type: $('#mode-type').value, status: $('#mode-status').value, count: $('#mode-count') ? Number($('#mode-count').value) : undefined }); break;
      case 'choose': await choose(el.dataset.label); break;
      case 'submit': await submit(); break;
      case 'next': await next(); break;
      case 'previous': await navigateQuestion(state.session.index - 1); break;
      case 'jump': await navigateQuestion(Number(el.dataset.index)); break;
      case 'card-prev': ui.cardPage--; render(); break;
      case 'card-next': ui.cardPage++; render(); break;
      case 'summary': ui.view = 'complete'; render(); window.scrollTo(0, 0); break;
      case 'resume-unanswered': { const s = state.session; s.index = s.ids.findIndex(id => !s.answers[id]); ui.view = 'practice'; await navigateQuestion(s.index); break; }
      case 'retry-session-wrong': { const { s, b } = sessionContext(); await requestSession(b, b.questions.filter(q => s.ids.includes(q.id) && s.answers[q.id] && !s.answers[q.id].correct), 'wrong', { scope: 'retry:' + C.practiceKey(s.bankId, s.mode, s.filters) }, true); break; }
      case 'favorite': { const { b, q } = sessionContext(); await toggleFavorite(b, q); break; }
      case 'toggle-note': ui.showNote = !ui.showNote; render(); if (ui.showNote) $('#question-note')?.focus(); break;
      case 'remove-wrong-current': { const { b, q } = sessionContext(); askRemoveWrong(b, q); break; }
      case 'list-favorite': { const b = banks().find(b => b.id === el.dataset.bank), q = b.questions.find(q => q.id === el.dataset.id); await toggleFavorite(b, q); break; }
      case 'list-remove-wrong': { const b = banks().find(b => b.id === el.dataset.bank), q = b.questions.find(q => q.id === el.dataset.id); askRemoveWrong(b, q); break; }
      case 'practice-one': { const b = banks().find(b => b.id === el.dataset.bank), q = b.questions.find(q => q.id === el.dataset.id); await requestSession(b, [q], ui.view === 'wrong' ? 'wrong' : ui.view === 'favorite' ? 'favorite' : 'custom', { scope: 'one:' + ui.view + ':' + q.id }); break; }
      case 'practice-filtered': { const qs = visibleQuestions(); if (!qs.length) break; const uniqueBanks = new Set(qs.map(x => x.b.id)); if (uniqueBanks.size > 1) return toast('请先选择一个题库，再练习筛选结果。'); await requestSession(qs[0].b, qs.map(x => x.q), ui.view === 'wrong' ? 'wrong' : ui.view === 'favorite' ? 'favorite' : 'custom', { scope: JSON.stringify(['collection', ui.view, ui.query, ui.type, ui.chapter, ui.status]) }); break; }
      case 'list-prev': ui.listPage--; render(); window.scrollTo(0, 0); break;
      case 'list-next': ui.listPage++; render(); window.scrollTo(0, 0); break;
      case 'settings': settingsDialog(); break;
      case 'setting-theme': state.settings.theme = el.dataset.value; await save(); render(); settingsDialog(); break;
      case 'setting-font': state.settings.font = Number(el.dataset.value); await save(); render(); settingsDialog(); break;
      case 'export-bank': {
        if (!canExportBanks()) throw new Error('只有 admin 账号可以导出题库。');
        const b = banks().find(b => b.id === (el.dataset.id || $('#export-bank')?.value));
        if (!b?.questions.length) return toast('这个题库没有可导出的题目。');
        const name = b.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim().slice(0, 100) || '题库';
        download(C.exportBank(b), 'text/csv;charset=utf-8', name + '_' + dateKey() + '.csv');
        toast('已导出「' + b.name + '」共 ' + b.questions.length + ' 道题目。');
        break;
      }
      case 'export-backup': state.lastBackup = new Date().toISOString(); download(JSON.stringify({ ...state, accountId: localOwner || undefined }, null, 2), 'application/json', '题间备份_' + dateKey() + '.json'); await save(); if (ui.view === 'manage') render(); toast('完整备份已导出，请妥善保存。'); break;
      case 'restore-backup': $('#backup-file').value = ''; $('#backup-file').click(); break;
      case 'preview-prev': captureImport(); previewPage--; importPreview(); break;
      case 'preview-next': captureImport(); previewPage++; importPreview(); break;
      case 'edit-import': captureImport(); editImport(Number(el.dataset.index)); break;
      case 'delete-import': captureImport(); pendingImport.entries.splice(Number(el.dataset.index), 1); importPreview(); break;
      case 'cancel-edit': editorIndex = null; importPreview(); break;
      case 'add-edit-option': captureEditor(); { const used = new Set(editorFields.map(o => o.label)); let i = 0; while (used.has(C.label(i))) i++; editorFields.push({ label: C.label(i), text: '' }); $('#editor-options').innerHTML = editorOptions(); $('#edit-option-' + (editorFields.length - 1)).focus(); } break;
      case 'save-edit': { captureEditor(); const raw = { '题目ID': $('#edit-id').value, '题型': $('#edit-type').value, '章节': $('#edit-chapter').value, '题目': $('#edit-text').value, '答案': $('#edit-answer').value, '解析': $('#edit-analysis').value }; editorFields.forEach(o => raw['选项' + o.label] = o.text); try { C.normalize(raw, editorIndex); } catch (e) { $('#edit-error').textContent = e.message; return; } pendingImport.entries[editorIndex] = { line: pendingImport.entries[editorIndex].line, raw, error: '' }; editorIndex = null; importPreview(); break; }
      case 'confirm-import': await confirmImport(); break;
    }
  }
  function captureImport() { if (pendingImport && $('#import-name')) { pendingImport.name = $('#import-name').value; pendingImport.target = $('#import-target').value; pendingImport.skip = !!$('#skip-invalid')?.checked; } }
  function askRemoveWrong(b, q) { ask('移出错题本？', '这道题的历史错误次数会保留，以后再次答错仍会自动加入错题本。', async () => { ensureRecord(b, q).inWrong = false; await save(); closeModal(); render(); toast('已移出错题本。'); }); }
  let swipeGesture = null, swipeBusy = false, swipeClickUntil = 0;
  async function swipeQuestion(direction) {
    if (ui.view === 'practice') {
      const s = state.session; if (!s) return;
      const index = s.index + direction;
      if (index < 0 || index >= s.ids.length) return toast(index < 0 ? '已经是第一题了。' : '已经是最后一题了。');
      await navigateQuestion(index);
    } else {
      const exam = currentExam(); if (!exam) return;
      const review = ui.view === 'exam-review', indices = examIndices(exam, review), position = indices.indexOf(review ? ui.examIndex || 0 : exam.index), target = indices[position + direction];
      if (target === undefined) return toast(direction < 0 ? '已经是第一题了。' : '已经是最后一题了。');
      await examJump(target);
    }
  }
  document.addEventListener('touchstart', event => {
    swipeGesture = null;
    if (swipeBusy) return;
    // A new intentional touch can select an option immediately after a swipe.
    swipeClickUntil = 0;
    if (!mobileScreen.matches || event.touches.length !== 1 || !['practice', 'exam', 'exam-review'].includes(ui.view) || ui.answerSheet || $('#overlay').children.length || document.body.classList.contains('editing-note') || window.getSelection()?.isCollapsed === false) return;
    const target = event.target, card = target.closest('.question-card');
    if (!card || target.closest('input,textarea,select,a,[contenteditable],button:not(.option),.question-tools,.question-footer')) return;
    const touch = event.touches[0];
    // Leave the screen edges to Safari's back/forward gestures.
    if (touch.clientX < 24 || touch.clientX > innerWidth - 24) return;
    swipeGesture = { card, view: ui.view, id: touch.identifier, x: touch.clientX, y: touch.clientY, scroll: scrollY, at: performance.now(), horizontal: false };
  }, { passive: true });
  document.addEventListener('touchmove', event => {
    const gesture = swipeGesture; if (!gesture) return;
    if (event.touches.length !== 1) { swipeGesture = null; return; }
    const touch = Array.from(event.touches).find(t => t.identifier === gesture.id); if (!touch) { swipeGesture = null; return; }
    const dx = Math.abs(touch.clientX - gesture.x), dy = Math.abs(touch.clientY - gesture.y);
    if (!gesture.horizontal && dy > 12 && dy >= dx * .9) { swipeGesture = null; return; }
    if (!gesture.horizontal && dx > 16 && dx > dy * 1.8) { gesture.horizontal = true; clearTimeout(nextTimer); }
    if (gesture.horizontal) {
      if (event.cancelable) event.preventDefault();
      swipeClickUntil = performance.now() + 450;
    }
  }, { passive: false });
  document.addEventListener('touchend', event => {
    const gesture = swipeGesture; swipeGesture = null;
    if (!gesture || !gesture.horizontal) return;
    if (event.cancelable) event.preventDefault();
    swipeClickUntil = performance.now() + 450;
    const touch = Array.from(event.changedTouches).find(t => t.identifier === gesture.id);
    if (!touch || event.touches.length || !gesture.card.isConnected || ui.view !== gesture.view || !mobileScreen.matches || ui.answerSheet || $('#overlay').children.length || performance.now() - gesture.at > 1000 || Math.abs(scrollY - gesture.scroll) > 8 || window.getSelection()?.isCollapsed === false) return;
    const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    swipeBusy = true;
    swipeQuestion(dx < 0 ? 1 : -1).catch(report).finally(() => { swipeBusy = false; });
  }, { passive: false });
  document.addEventListener('touchcancel', () => { swipeGesture = null; }, { passive: true });
  document.addEventListener('click', event => {
    if (performance.now() < swipeClickUntil && event.target.closest('.option')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('submit', event => { if (event.target.id !== 'login-form') return; event.preventDefault(); if (!accountBusy) signIn($('#login-username').value, $('#login-password').value); });
  document.addEventListener('click', e => { const el = e.target.closest('[data-action]'); if (!el || el.disabled) return; perform(el.dataset.action, el).catch(report); });
  document.addEventListener('change', e => {
    if (accountLocked || accountBusy) return;
    const el = e.target;
    (async () => {
      if (el.id === 'exam-bank') { const b = banks().find(b => b.id === el.value); $('#exam-chapter').innerHTML = chapterOptions(b); updateExamConfig(true); }
      else if (el.id === 'exam-chapter') updateExamConfig(true);
      else if (el.id === 'exam-review-filter') { const exam = currentExam(), previous = ui.examFilter; ui.examFilter = el.value; const indices = examIndices(exam, true); if (!indices.length) { ui.examFilter = previous; el.value = previous || ''; toast('这个范围内没有题目。'); } else { ui.examIndex = indices[0]; ui.examPage = 0; render(); } }
      else if (el.id === 'csv-file') await readCSV(el.files[0]);
      else if (el.id === 'backup-file') await restore(el.files[0]);
      else if (el.id === 'home-bank') { ui.bankId = el.value; state.selectedBank = el.value; await save(); render(); }
      else if (el.id === 'collection-bank') { ui.collectionBank = el.value; ui.listPage = 0; render(); }
      else if (el.id === 'collection-status') { ui.status = el.value; ui.listPage = 0; render(); }
      else if (['mode-chapter', 'mode-type', 'mode-status'].includes(el.id)) updateModeProgress();
      else if (el.id === 'collection-type') { ui.type = el.value; ui.listPage = 0; render(); }
      else if (el.id === 'skip-invalid') { captureImport(); importPreview(); }
      else if (el.dataset.setting) { state.settings[el.dataset.setting] = el.checked; await save(); render(); }
    })().catch(report);
  });
  document.addEventListener('input', e => {
    if (accountLocked || accountBusy) return;
    const el = e.target;
    if (/^exam-(count-\d|duration|pass)$/.test(el.id)) updateExamConfig();
    if (el.id === 'bank-search') $('#bank-list').innerHTML = bankRows(el.value);
    if (el.id === 'question-search') { const start = el.selectionStart; ui.query = el.value; ui.listPage = 0; render(); const target = $('#question-search'); target.focus(); target.setSelectionRange(start, start); }
    if (el.id === 'question-note') { const { b, q } = sessionContext(); ensureRecord(b, q).note = el.value; $('#note-status').textContent = '正在保存…'; clearTimeout(noteTimer); noteTimer = setTimeout(() => save().then(() => { if ($('#note-status')) $('#note-status').textContent = '已保存'; }).catch(report), 350); }
    if (el.id === 'import-name') captureImport();
  });
  document.addEventListener('dragover', e => { const drop = e.target.closest('#drop-zone'); if (drop) { e.preventDefault(); drop.classList.add('dragging'); } });
  document.addEventListener('dragleave', e => e.target.closest('#drop-zone')?.classList.remove('dragging'));
  document.addEventListener('drop', e => { const drop = e.target.closest('#drop-zone'); if (drop) { e.preventDefault(); drop.classList.remove('dragging'); readCSV(e.dataTransfer.files[0]).catch(report); } });
  document.addEventListener('keydown', e => {
    if (accountLocked || accountBusy) return;
    if ($('#overlay').children.length) {
      if (e.key === 'Escape') { e.preventDefault(); if ($('#edit-text')) { editorIndex = null; importPreview(); } else closeModal(); }
      if (e.key === 'Tab') { const controls = [...$('#overlay').querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]')].filter(x => x.offsetParent !== null); const first = controls[0], last = controls.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.id === 'drop-zone') { e.preventDefault(); $('#csv-file').value = ''; $('#csv-file').click(); }
      return;
    }
    if (document.body.classList.contains('answer-sheet-open')) {
      if (e.key === 'Escape') { e.preventDefault(); setAnswerSheet(false); }
      if (e.key === 'Tab') { const controls = [...$('.answer-card').querySelectorAll('button:not(:disabled),select')].filter(el => el.offsetParent !== null), first = controls[0], last = controls.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
      return;
    }
    if (['exam', 'exam-review'].includes(ui.view) && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
      if (e.key.length === 1 && /^[a-z]$/i.test(e.key) && ui.view === 'exam') { e.preventDefault(); examChoose(e.key.toUpperCase()).catch(report); }
      else if (['ArrowRight', 'Enter', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); perform(e.key === 'ArrowLeft' ? 'exam-prev' : 'exam-next', {}).catch(report); }
      return;
    }
    if (ui.view !== 'practice' || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    const { q, answer } = sessionContext(); if (!q) return;
    if (/^[a-z]$/i.test(e.key) && q.options.some(o => o.label === e.key.toUpperCase())) { e.preventDefault(); choose(e.key.toUpperCase()).catch(report); }
    else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); (answer ? next() : q.type === '多选题' ? submit() : Promise.resolve()).catch(report); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next().catch(report); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); navigateQuestion(state.session.index - 1).catch(report); }
  });
  document.addEventListener('focusin', e => { if (e.target.id === 'question-note') document.body.classList.add('editing-note'); });
  document.addEventListener('focusout', e => { if (e.target.id === 'question-note') document.body.classList.remove('editing-note'); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state?.settings.theme === 'system') applyTheme(); });
  window.addEventListener('beforeunload', () => { if (noteTimer) { clearTimeout(noteTimer); save().catch(() => {}); } });
  function freshState(withSeed) {
    const questions = withSeed ? C.inspect(C.parseCSV(window.QUIZ_SEED_CSV || C.template())).filter(r => r.q && !r.duplicate).map(r => r.q) : [];
    return { version: 1, banks: withSeed ? [{ id: 'builtin-theory', name: '计算机程序设计员 · 三级', questions, createdAt: new Date().toISOString() }] : [], records: {}, session: null, practiceSessions: {}, practiceLast: {}, settings: { ...defaultSettings }, activity: {}, selectedBank: withSeed ? 'builtin-theory' : '', exams: [], activeExam: null };
  }
  async function loadAccount(user) {
    await saveQueue;
    localOwner = user.id;
    let saved = db ? await readDB(localKey('main')) : null;
    cloudMeta = db ? await readDB(localKey('cloud-meta')) || {} : {};
    syncBackups = db ? await readDB(localKey('sync-backups')) || [] : [];
    // Only the original administrator can adopt the pre-account local workspace.
    if (!saved && cloudClient.isAdmin && db) {
      const legacyMeta = await readDB('cloud-meta') || {};
      if (!legacyMeta.userId || legacyMeta.userId === user.id) {
        saved = await readDB('main'); cloudMeta = legacyMeta;
        syncBackups = await readDB('sync-backups') || [];
      }
    }
    state = saved ? C.validateState(saved) : freshState(cloudClient.isAdmin);
    state.settings = { ...defaultSettings, ...state.settings }; state.exams ||= []; state.activeExam ||= null; state.activity ||= dailyData();
    C.restorePractice(state);
    ui = { view: 'home', bankId: state.selectedBank || banks()[0]?.id || '', query: '', type: '', chapter: '', listPage: 0, draft: [], showNote: false, cardPage: 0, collectionBank: '' };
    pendingImport = null; editorIndex = null; confirmAction = null;
    if (db) await persistLocal();
  }
  try {
    db = await openDB();
    if (cloudClient?.session) await loadAccount(cloudClient.session.user);
    else if (cloudConfig.enabled) state = freshState(false);
    else { state = await readDB(); cloudMeta = await readDB('cloud-meta') || {}; syncBackups = await readDB('sync-backups') || []; }
    if (state) C.validateState(state);
  } catch (e) { state = null; db = null; storageOK = false; storageError = '本地存储不可用，请在关闭前导出备份'; console.error(e); }
  if (!state) {
    state = freshState(!cloudConfig.enabled || !!cloudClient?.isAdmin);
    try { await save(); } catch (e) { report(e); }
  }
  state.settings = { ...defaultSettings, ...state.settings }; state.activity ||= dailyData(); C.restorePractice(state); ui.bankId = state.selectedBank || banks()[0]?.id || ''; ui.collectionBank = ''; state.exams ||= []; state.activeExam ||= null; initCloud(); render(); examTick(); setInterval(examTick, 500); if (cloud && !accountLocked) cloud.run();
  if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  if (!storageOK) toast('本地存储不可用。你仍可练习，但请在关闭前导出完整备份。');
})();
