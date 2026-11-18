(function (root) {
  'use strict';
  const TYPES = ['单选题', '多选题', '判断题'];
  const THEMES = [['system', '跟随系统'], ['classic-light', '明亮'], ['classic-dark', '黑夜'], ['classic-eye', '护眼'], ['light', '浅色'], ['dark', '深色'], ['eye', '护眼绿'], ['solar', '暖米黄']];
  function hash(value) { let h = 2166136261; for (const c of value) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function label(index) { let s = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; }
  function parseCSV(text) {
    text = String(text).replace(/^\uFEFF/, '');
    const rows = []; let row = [], field = '', quoted = false, closed = false, line = 1, start = 1;
    function pushRow() { row.push(field); if (row.some(x => x.trim())) rows.push({ cells: row, line: start }); row = []; field = ''; closed = false; start = line; }
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } } else { field += c; if (c === '\n') line++; } continue; }
      if (c === '"') { if (field.trim() || closed) throw new Error('第 ' + line + ' 行的引号格式不正确。'); quoted = true; field = ''; }
      else if (c === ',') { row.push(field); field = ''; closed = false; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; line++; pushRow(); start = line; }
      else { if (closed && c.trim()) throw new Error('第 ' + line + ' 行：结束引号后只能是逗号或换行。'); if (!closed) field += c; }
    }
    if (quoted) throw new Error('第 ' + start + ' 行的双引号没有闭合。');
    if (field || row.length || closed) pushRow();
    if (rows.length < 2) throw new Error('CSV 需要包含一行列名和至少一道题目。');
    const headers = rows.shift().cells.map(x => x.trim());
    if (new Set(headers.map(x => x.toLowerCase())).size !== headers.length || headers.some(x => !x)) throw new Error('列名不能为空或重复。');
    return rows.map(r => ({ line: r.line, raw: Object.fromEntries(headers.map((h, i) => [h, r.cells[i] || ''])), error: r.cells.length !== headers.length ? '列数与表头不一致，请检查逗号和双引号。' : '' }));
  }
  function pick(raw, keys) { const entries = Object.entries(raw); for (const key of keys) { const found = entries.find(([k]) => k.trim().toLowerCase() === key.toLowerCase()); if (found) return String(found[1] ?? '').trim(); } return ''; }
  function optionLabel(key) { const m = key.trim().match(/^选项\s*([A-Z]+)$/i) || key.trim().match(/^([A-Z]{1,3})$/); return m ? m[1].toUpperCase() : null; }
  function signature(q) { return JSON.stringify([q.type, q.text.trim(), q.options.map(o => [o.label, o.text.trim()]), [...q.answer].sort()]); }
  function normalize(raw, index = 0) {
    const givenType = pick(raw, ['题型', 'typeName', 'type']);
    const type = ({ '单选': '单选题', '多选': '多选题', '判断': '判断题', single: '单选题', multiple: '多选题', boolean: '判断题' })[givenType.toLowerCase()] || givenType;
    const text = pick(raw, ['题目', '题干', 'question', 'text']);
    if (!TYPES.includes(type)) throw new Error('题型应为单选题、多选题或判断题。');
    if (!text) throw new Error('题目内容不能为空。');
    let options = [];
    for (const [key, value] of Object.entries(raw)) { const option = optionLabel(key); if (option && String(value).trim()) options.push({ label: option, text: String(value).trim() }); }
    options.sort((a, b) => a.label.length - b.label.length || a.label.localeCompare(b.label));
    if (new Set(options.map(o => o.label)).size !== options.length) throw new Error('同一选项字母出现多次。');
    let answerText = pick(raw, ['答案', '正确答案', 'answerText', 'answer']).toUpperCase(), answer;
    if (type === '判断题') {
      options = [{ label: 'A', text: '正确' }, { label: 'B', text: '错误' }];
      if (['正确', '对', '是', 'TRUE', '√', '✓', '1', 'A'].includes(answerText)) answer = ['A'];
      else if (['错误', '错', '否', 'FALSE', '×', '✗', '0', 'B'].includes(answerText)) answer = ['B'];
      else throw new Error('判断题答案填写“正确”或“错误”（原题库 A=正确、B=错误）。');
    } else {
      if (options.length < 2) throw new Error('选择题至少需要两个非空选项。');
      const separated = /[|、,，;；\s]/.test(answerText);
      answer = separated ? answerText.split(/[|、,，;；\s]+/).filter(Boolean) : (options.some(o => o.label.length > 1) ? [answerText] : answerText.split(''));
      answer = [...new Set(answer)].sort();
      if (!answer.length) throw new Error('正确答案不能为空。');
      if (type === '单选题' && answer.length !== 1) throw new Error('单选题只能有一个正确答案。');
      if (type === '多选题' && answer.length < 2) throw new Error('多选题应填写至少两个正确选项。');
      if (answer.some(a => !options.some(o => o.label === a))) throw new Error('答案引用了不存在或内容为空的选项：' + answer.filter(a => !options.some(o => o.label === a)).join('、'));
    }
    let chapter = pick(raw, ['章节', '分类', 'chapter', 'classificationName']);
    if (!pick(raw, ['章节', '分类', 'chapter']) && chapter.includes('/')) chapter = chapter.split('/').slice(1).join('/');
    chapter = chapter.split('/').map(s => s.trim()).filter(Boolean).join('/') || '未分类';
    let analysis = pick(raw, ['解析', 'analysis']); if (['无', '暂无', 'null'].includes(analysis.toLowerCase())) analysis = '';
    const q = { id: pick(raw, ['题目ID', 'testId', 'id']) || 'q-' + hash(JSON.stringify(raw)) + '-' + index, type, text, options, answer: [...answer].sort(), chapter, analysis };
    return q;
  }
  function inspect(entries) {
    const signatures = new Set(), ids = new Set();
    return entries.map((entry, i) => {
      try { if (entry.error) throw new Error(entry.error); const q = normalize(entry.raw, i); const sig = signature(q); const duplicate = signatures.has(sig); if (!duplicate && ids.has(q.id)) throw new Error('题目ID重复且题目内容不同，请修改ID。'); signatures.add(sig); ids.add(q.id); return { ...entry, q, duplicate, validation: '' }; }
      catch (e) { return { ...entry, q: null, duplicate: false, validation: e.message }; }
    });
  }
  function correct(q, selected) { return [...new Set(selected)].sort().join('|') === [...q.answer].sort().join('|'); }
  function shuffled(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  function examPaper(questions, counts, chapter = '', random = Math.random) {
    const pool = questions.filter(q => !chapter || q.chapter === chapter || q.chapter.startsWith(chapter + '/'));
    const paper = [];
    for (const type of TYPES) {
      const count = counts[type], available = pool.filter(q => q.type === type);
      if (!Number.isInteger(count) || count < 0) throw new Error('各题型题量须为不小于 0 的整数。');
      if (count > available.length) throw new Error(type + '只有 ' + available.length + ' 道，请减少题量。');
      paper.push(...shuffled(available, random).slice(0, count));
    }
    if (!paper.length || paper.length > 500) throw new Error('每场考试请选择 1–500 道题目。');
    return structuredClone(shuffled(paper, random));
  }
  function examResult(exam) {
    const result = { total: exam.questions.length, answered: 0, right: 0, wrong: 0, unanswered: 0, byType: {} };
    for (const type of TYPES) result.byType[type] = { total: 0, right: 0, wrong: 0, unanswered: 0 };
    for (const q of exam.questions) {
      const selected = exam.answers[q.id] || [], row = result.byType[q.type]; row.total++;
      if (!selected.length) { result.unanswered++; row.unanswered++; }
      else { result.answered++; const status = correct(q, selected) ? 'right' : 'wrong'; result[status]++; row[status]++; }
    }
    result.score = Math.round(result.right / result.total * 1000) / 10;
    result.passed = result.score >= exam.passScore;
    return result;
  }
  function validateExam(exam, finished = false) {
    if (!exam || typeof exam.id !== 'string' || !exam.id || typeof exam.bankId !== 'string' || typeof exam.bankName !== 'string' || !Array.isArray(exam.questions) || !exam.questions.length || exam.questions.length > 500 || !Number.isInteger(exam.index) || exam.index < 0 || exam.index >= exam.questions.length || !exam.answers || typeof exam.answers !== 'object' || Array.isArray(exam.answers) || !exam.marked || typeof exam.marked !== 'object' || Array.isArray(exam.marked) || !Number.isInteger(exam.durationMinutes) || exam.durationMinutes < 1 || exam.durationMinutes > 240 || !Number.isInteger(exam.passScore) || exam.passScore < 0 || exam.passScore > 100 || !Number.isFinite(Date.parse(exam.startedAt)) || !Number.isFinite(Date.parse(exam.deadline)) || Date.parse(exam.deadline) !== Date.parse(exam.startedAt) + exam.durationMinutes * 60000) throw new Error('备份中的模拟考试信息无效。');
    // Reuse question validation; this temporary state has no nested exams.
    validateState({ version: 1, banks: [{ id: exam.bankId, name: exam.bankName, questions: exam.questions }], records: {}, settings: {} });
    for (const [id, selected] of Object.entries(exam.answers)) {
      const q = exam.questions.find(q => q.id === id);
      if (!q || !Array.isArray(selected) || new Set(selected).size !== selected.length || (q.type !== '多选题' && selected.length > 1) || selected.some(label => !q.options.some(o => o.label === label))) throw new Error('备份中的考试作答无效。');
    }
    if (Object.entries(exam.marked).some(([id, flag]) => typeof flag !== 'boolean' || !exam.questions.some(q => q.id === id))) throw new Error('备份中的考试标记无效。');
    if (finished && (!Number.isFinite(Date.parse(exam.finishedAt)) || Date.parse(exam.finishedAt) < Date.parse(exam.startedAt) || typeof exam.autoSubmitted !== 'boolean')) throw new Error('备份中的考试成绩记录无效。');
    return exam;
  }
  function escapeCSV(value) { const s = String(value ?? ''); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function exportBank(bank) {
    const labels = [...new Set(bank.questions.flatMap(q => q.options.map(o => o.label)))].sort((a, b) => a.length - b.length || a.localeCompare(b));
    const headers = ['题目ID', '题型', '章节', '题目', ...labels.map(label => '选项' + label), '答案', '解析'];
    const rows = bank.questions.map(q => {
      const options = new Map(q.options.map(o => [o.label, o.text]));
      return [q.id, q.type, q.chapter, q.text, ...labels.map(label => options.get(label) || ''), q.type === '判断题' ? q.answer.includes('A') ? '正确' : '错误' : q.answer.join('|'), q.analysis];
    });
    return '\uFEFF' + [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\r\n');
  }
  function template() {
    const headers = ['题目ID', '题型', '章节', '题目', ...Array.from({ length: 8 }, (_, i) => '选项' + label(i)), '答案', '解析'];
    const rows = [
      ['sample-001', '单选题', '第一章/Java基础', 'Java 源文件的扩展名是？', '.class', '.java', '.js', '.jar', '', '', '', '', 'B', 'Java 源文件扩展名为 .java。'],
      ['sample-002', '多选题', '第一章/编程基础', '以下哪些属于编程语言？', 'Java', 'Python', 'C', 'C++', 'JavaScript', 'Go', 'Rust', '', 'A|B|C|D|E|F|G', '以上七项均属于编程语言。'],
      ['sample-003', '判断题', '第二章/数据库基础', 'SQL 查询可以使用 WHERE 子句筛选记录。', '', '', '', '', '', '', '', '', '正确', 'WHERE 子句用于按条件筛选记录。']
    ];
    return '\uFEFF' + [headers, ...rows].map(r => r.map(escapeCSV).join(',')).join('\r\n');
  }
  const practiceTypes = { single: '单选题', multiple: '多选题', judgment: '判断题' };
  const practiceModes = ['sequential', 'random', 'chapter', 'single', 'multiple', 'judgment', 'wrong', 'favorite', 'type', 'custom'];
  function practiceKey(bankId, mode, filters = {}) {
    return JSON.stringify([bankId, mode, filters.chapter || '', practiceTypes[mode] || filters.type || '', filters.status || '', mode === 'random' ? Number(filters.count) || 20 : '', filters.scope || '']);
  }
  const practicePlace = (bankId, mode) => JSON.stringify([bankId, mode]);
  function reconcilePractice(session, bank) {
    if (!session || !bank || !practiceModes.includes(session.mode) || !Array.isArray(session.ids) || !session.ids.length || !Number.isInteger(session.index) || session.index < 0 || session.index >= session.ids.length || !session.answers || typeof session.answers !== 'object') return null;
    const questions = new Map(bank.questions.map(q => [q.id, q])), savedFilters = session.filters || {};
    const filters = { chapter: typeof savedFilters.chapter === 'string' ? savedFilters.chapter : '', type: TYPES.includes(savedFilters.type) ? savedFilters.type : '', status: ['new', 'done'].includes(savedFilters.status) ? savedFilters.status : '' };
    if (session.mode === 'random') filters.count = Number.isInteger(savedFilters.count) && savedFilters.count > 0 ? savedFilters.count : 20;
    if (typeof savedFilters.scope === 'string' && savedFilters.scope) filters.scope = savedFilters.scope;
    const ids = [...new Set(session.ids.filter(id => questions.has(id)))];
    // Keep this round's answered questions even when they no longer match "unpracticed" or a review filter.
    if (!filters.scope && !filters.status && ['sequential', 'chapter', 'single', 'multiple', 'judgment', 'type'].includes(session.mode)) {
      const known = new Set(ids);
      for (const q of bank.questions) if (!known.has(q.id) && (!filters.chapter || q.chapter === filters.chapter || q.chapter.startsWith(filters.chapter + '/')) && (!(practiceTypes[session.mode] || filters.type) || q.type === (practiceTypes[session.mode] || filters.type))) { ids.push(q.id); known.add(q.id); }
    }
    if (!ids.length) return null;
    const answers = {}, drafts = {};
    const validSelection = (q, selected) => Array.isArray(selected) && selected.length && new Set(selected).size === selected.length && (q.type === '多选题' || selected.length === 1) && selected.every(label => q.options.some(o => o.label === label));
    for (const id of ids) {
      const q = questions.get(id), answer = session.answers[id], draft = session.drafts?.[id];
      if (answer && validSelection(q, answer.selected)) answers[id] = { ...answer, correct: correct(q, answer.selected) };
      else if (validSelection(q, draft)) drafts[id] = [...draft];
    }
    const present = new Set(ids), current = session.ids[session.index], next = session.ids.slice(session.index).find(id => present.has(id));
    return { ...session, bankId: bank.id, filters, ids, index: Math.max(0, ids.indexOf(present.has(current) ? current : next || ids[Math.min(session.index, ids.length - 1)])), answers, drafts, complete: Object.keys(answers).length === ids.length };
  }
  function rememberPractice(state) {
    state.practiceSessions ||= {}; state.practiceLast ||= {};
    const s = state.session; if (!s) return;
    const id = practiceKey(s.bankId, s.mode, s.filters);
    state.practiceSessions[id] = s;
    if (!s.filters?.scope) state.practiceLast[practicePlace(s.bankId, s.mode)] = id;
  }
  function restorePractice(state) {
    const sessions = {}, previous = state.practiceLast || {};
    for (const s of Object.values(state.practiceSessions || {})) {
      const clean = reconcilePractice(s, state.banks.find(b => b.id === s?.bankId));
      if (clean) sessions[practiceKey(clean.bankId, clean.mode, clean.filters)] = clean;
    }
    const active = reconcilePractice(state.session, state.banks.find(b => b.id === state.session?.bankId));
    state.practiceSessions = sessions; state.practiceLast = {};
    for (const s of Object.values(sessions).sort((a, b) => String(a.updatedAt || a.startedAt || '').localeCompare(String(b.updatedAt || b.startedAt || '')))) if (!s.filters?.scope) state.practiceLast[practicePlace(s.bankId, s.mode)] = practiceKey(s.bankId, s.mode, s.filters);
    for (const [place, id] of Object.entries(previous)) if (Object.hasOwn(sessions, id) && !sessions[id].filters.scope && practicePlace(sessions[id].bankId, sessions[id].mode) === place) state.practiceLast[place] = id;
    state.session = active;
    rememberPractice(state);
    return state;
  }
  function validateState(s) {
    if (!s || s.version !== 1 || !Array.isArray(s.banks) || !s.records || typeof s.records !== 'object' || Array.isArray(s.records) || !s.settings || typeof s.settings !== 'object') throw new Error('不是有效的题间备份文件。');
    for (const field of ['practiceSessions', 'practiceLast']) if (s[field] !== undefined && (!s[field] || typeof s[field] !== 'object' || Array.isArray(s[field]))) throw new Error('备份中的练习进度无效。');
    const bankIds = new Set();
    for (const b of s.banks) { if (!b.id || bankIds.has(b.id) || typeof b.name !== 'string' || !Array.isArray(b.questions)) throw new Error('备份中的题库信息无效。'); bankIds.add(b.id); const ids = new Set(); for (const q of b.questions) { if (!q.id || ids.has(q.id) || !TYPES.includes(q.type) || typeof q.text !== 'string' || !q.text.trim() || !Array.isArray(q.options) || q.options.length < 2 || !Array.isArray(q.answer) || !q.answer.length || typeof q.chapter !== 'string' || typeof q.analysis !== 'string') throw new Error('备份中的题目格式无效。'); ids.add(q.id); const labels = new Set(q.options.map(o => o.label)); if (labels.size !== q.options.length || q.options.some(o => typeof o.label !== 'string' || !/^[A-Z]+$/.test(o.label) || typeof o.text !== 'string') || q.answer.some(a => !labels.has(a)) || (q.type !== '多选题' && q.answer.length !== 1)) throw new Error('备份中的答案或选项无效。'); } }
    for (const r of Object.values(s.records)) { if (!r || typeof r !== 'object' || !Number.isFinite(r.attempts) || r.attempts < 0 || !Number.isFinite(r.right) || r.right < 0 || !Number.isFinite(r.wrong) || r.wrong < 0 || typeof r.note !== 'string' || !Array.isArray(r.history) || r.history.some(h => !h || typeof h.at !== 'string' || typeof h.correct !== 'boolean')) throw new Error('备份中的练习记录无效。'); }
    if (s.activity !== undefined && (!s.activity || typeof s.activity !== 'object' || Array.isArray(s.activity) || Object.entries(s.activity).some(([day, a]) => !/^\d{4}-\d{2}-\d{2}$/.test(day) || !a || !Number.isInteger(a.attempts) || a.attempts < 1 || !Number.isInteger(a.right) || a.right < 0 || a.right > a.attempts))) throw new Error('备份中的每日统计无效。');
    if (s.settings.font !== undefined && ![16, 18, 20, 23].includes(Number(s.settings.font))) throw new Error('备份中的字号设置无效。');
    if (s.settings.theme !== undefined && !THEMES.some(([id]) => id === s.settings.theme)) throw new Error('备份中的主题设置无效。');
    if (s.settings.mobileFullscreen !== undefined && typeof s.settings.mobileFullscreen !== 'boolean') throw new Error('备份中的手机全屏设置无效。');
    if (s.settings.autoNextDelay !== undefined && (!Number.isFinite(s.settings.autoNextDelay) || s.settings.autoNextDelay < 0 || s.settings.autoNextDelay > 60)) throw new Error('自动下一题等待时间须为 0–60 秒。');
    if (s.exams !== undefined) {
      if (!Array.isArray(s.exams)) throw new Error('备份中的考试记录无效。');
      const ids = new Set();
      for (const exam of s.exams) { validateExam(exam, true); if (ids.has(exam.id)) throw new Error('备份中的考试记录重复。'); ids.add(exam.id); }
      if (s.activeExam && ids.has(s.activeExam.id)) throw new Error('备份中的考试状态冲突。');
    }
    if (s.activeExam != null) validateExam(s.activeExam);
    return s;
  }
  const api = { TYPES, THEMES, hash, label, optionLabel, parseCSV, normalize, inspect, correct, signature, template, exportBank, validateState, examPaper, examResult, validateExam, practiceKey, practicePlace, reconcilePractice, rememberPractice, restorePractice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.QuizCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
