// 关卡页守卫与失败反馈测试：提交去重、结算幂等、初筛失败态、复述错题、续学统计
const assert = require('assert');

// ===== wx / Page 桩 =====
const store = {};
const calls = { redirect: [], toast: [], modal: [] };
global.wx = {
  getStorageSync: (key) => (key in store ? JSON.parse(JSON.stringify(store[key])) : ''),
  setStorageSync: (key, value) => { store[key] = JSON.parse(JSON.stringify(value)); },
  removeStorageSync: (key) => { delete store[key]; },
  setNavigationBarTitle: () => {},
  showToast: (o) => calls.toast.push(o),
  showModal: (o) => calls.modal.push(o),
  redirectTo: (o) => calls.redirect.push(o.url),
  navigateTo: () => {},
  switchTab: () => {},
};
let pageConfig = null;
global.Page = (cfg) => { pageConfig = cfg; };

require('../miniprogram/pages/level/level');
const levels = require('../miniprogram/config/levels/index');
const state = require('../miniprogram/engine/state');
state.init();

function setPath(target, path, value) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]];
  node[parts[parts.length - 1]] = value;
}

function makePage(overrides) {
  const inst = Object.create(pageConfig);
  inst.data = JSON.parse(JSON.stringify(pageConfig.data));
  inst.setData = function (patch, cb) {
    Object.keys(patch).forEach(key => {
      if (key.indexOf('.') >= 0) setPath(this.data, key, patch[key]);
      else this.data[key] = patch[key];
    });
    if (cb) cb();
  };
  Object.assign(inst, overrides || {});
  return inst;
}

function findLevelById(id) {
  for (const ch of levels.chapters) {
    const lv = ch.levels.find(l => l.id === id);
    if (lv) return lv;
  }
  return null;
}

// ===== 1. 提交去重：本步已完成时不再重复提交 =====
{
  const page = makePage({ data: Object.assign(JSON.parse(JSON.stringify(pageConfig.data)), { view: { done: true } }) });
  assert.strictEqual(page.guardSubmit(), true, 'view.done 为真时应拦截重复提交');
}

// ===== 2. 提交去重：同一步骤内连点被拦截 =====
{
  const page = makePage({ data: Object.assign(JSON.parse(JSON.stringify(pageConfig.data)), { view: { done: false } }) });
  assert.strictEqual(page.guardSubmit(), false, '首次提交应放行');
  assert.strictEqual(page.guardSubmit(), true, '350ms 内的第二次提交应被拦截');
}

// ===== 3. 换步后去抖清零，新步骤首次提交不被旧连点挡住 =====
{
  const page = makePage();
  page.data.level = findLevelById('1-1');
  page.data.stepIndex = 0;
  page.guardSubmit();
  page.renderStep();
  assert.strictEqual(page._lastSubmitAt, 0, '换步应清零提交去抖时间戳');
}

// ===== 4. 情报卡初筛：失败保留结果态、可重做、重做后判定全部清空 =====
{
  const page = makePage();
  const list = [
    { id: 'A', isCandidate: true, tags: [], verdict: 'out', reason: null, reasonText: '' },
    { id: 'B', isCandidate: false, tags: ['liquid'], verdict: 'in', reason: null, reasonText: '' },
    { id: 'C', isCandidate: true, tags: [], verdict: 'out', reason: null, reasonText: '' },
    { id: 'D', isCandidate: true, tags: [], verdict: 'in', reason: 'candidate', reasonText: '可做' },
    { id: 'E', isCandidate: true, tags: [], verdict: 'in', reason: 'candidate', reasonText: '可做' },
  ];
  page.data.view = { type: 'skuFilter', list: JSON.parse(JSON.stringify(list)), reasons: { liquid: '液体不可运' }, done: false };
  page.data.objTotal = 1;
  page.data.objDone = 0;
  page.onSkuFilterSubmit();
  assert.strictEqual(page.data.view.done, false, '正确率不足时不应放行');
  assert.ok(page.data.view.result && page.data.view.result.passed === false, '失败应写入结果态而不是自动跳步');
  assert.strictEqual(page.data.view.list.find(i => i.id === 'B').correct, false, '错卡应标记判定有误');
  assert.strictEqual(page.data.view.list.find(i => i.id === 'B').correctVerdictText, '淘汰', '错卡应给出正确判定');
  assert.strictEqual(page.data.objDone, 0, '未通过不应计入目标完成度');

  page.onSkuFilterRetry();
  assert.strictEqual(page.data.view.result, null, '重做应清空结果态');
  assert.ok(page.data.view.list.every(i => i.verdict === null), '重做应清空全部判定');

  page.data.view.list.forEach(i => {
    const verdict = i.isCandidate ? 'in' : 'out';
    i.verdict = verdict;
    i.reason = verdict === 'out' ? (i.tags.find(t => page.data.view.reasons[t]) || null) : 'candidate';
  });
  page.onSkuFilterSubmit();
  assert.strictEqual(page.data.view.done, true, '全部判定正确时应通过');
  assert.strictEqual(page.data.objDone, 1, '通过时目标完成度只加一次');
}

// ===== 5. 结构化复述失败写入错题，重复提交不产生重复错题 =====
{
  const level = findLevelById('1-3');
  const step = level.steps.find(s => s.type === 'reflection');
  state.clearMistakes();
  const page = makePage();
  page.data.level = level;
  page.data.stepIndex = level.steps.indexOf(step);
  page.data.view = {
    type: 'reflection', prompt: step.prompt, passScore: step.passScore, done: false,
    fields: step.fields.map(f => ({ ...f, input: '随便写', matched: null, matchedWords: '' })),
  };
  page.data.objDone = 0;
  page.data.retries = 0;
  page.data.mistakeCount = 0;
  page.onReflectionSubmit();
  const first = state.getMistakes().length;
  assert.ok(first > 0, '复述未达标应写入错题');
  assert.ok(state.getMistakes().every(m => m.stepType === 'reflection'), '复述错题应带 reflection 题型');
  assert.strictEqual(page.data.view.done, false, '复述未达标不应判定完成');

  page._lastSubmitAt = 0;
  page.onReflectionSubmit();
  assert.strictEqual(state.getMistakes().length, first, '同一段复述重复提交不应重复记录错题');
}

// ===== 6. 结算幂等：重复调用 finish 只结算并跳转一次 =====
{
  const level = findLevelById('1-1');
  calls.redirect.length = 0;
  const before = (state.getAbility() && state.getAbility().records.length) || 0;
  const page = makePage();
  page.data.level = level;
  page.data.stepIndex = level.steps.length - 1;
  page.data.quizTotal = 4;
  page.data.quizCorrect = 4;
  page.data.objTotal = 3;
  page.data.objDone = 3;
  page.data.retries = 0;
  page.data.collectedCards = [];
  page.finish();
  page.finish();
  assert.strictEqual(calls.redirect.length, 1, '重复调用 finish 应只跳转一次');
  const after = state.getAbility().records.length;
  assert.strictEqual(after - before, 1, '重复调用 finish 应只记录一条能力证据');
}

// ===== 7. 结算明细走临时存档，结果页不再依赖长 URL =====
{
  const payload = wx.getStorageSync('kuajing_result_payload');
  assert.ok(payload && payload.levelId === '1-1', '结算应写入临时结果存档');
  assert.ok(Array.isArray(payload.rows), '临时存档应包含学习结果行');
  const url = calls.redirect[calls.redirect.length - 1];
  assert.ok(url.indexOf('rows=') < 0, '结果页 URL 不应携带 rows 长参数');
}

// ===== 8. 结果页：非法关卡与越界星级被兜住 =====
{
  let resultConfig = null;
  global.Page = (cfg) => { resultConfig = cfg; };
  delete require.cache[require.resolve('../miniprogram/pages/result/result')];
  require('../miniprogram/pages/result/result');
  const page = Object.create(resultConfig);
  page.data = JSON.parse(JSON.stringify(resultConfig.data));
  page.setData = function (patch) { Object.assign(this.data, patch); };
  page.onLoad({ level: '9-9', stars: '7', total: '80', passed: '1', cards: '', coin: '0' });
  assert.strictEqual(page.data.levelValid, false, '不存在的关卡应被标记为非法');
  assert.strictEqual(page.data.stars, 3, '星级应被限制在 0~3');
  assert.strictEqual(page.data.passed, false, '非法关卡不应视为通过');
  assert.strictEqual(page.data.rows.length, 0, '无有效临时存档时学习结果为空而不是报错');

  page.onLoad({ level: '1-1', stars: '2', total: '80', passed: '1', cards: '', coin: '10' });
  assert.strictEqual(page.data.levelValid, true);
  assert.strictEqual(page.data.starsText, '★★☆', '星级文案应与星级一致');
  assert.ok(page.data.rows.length > 0, '有效关卡应从临时存档恢复学习结果');
  assert.strictEqual(page.data.nextLevelId, '1-2', '通过后应给出已解锁的下一关');
}

// ===== 9. 错题复盘页：非法关卡参数回退、自然排序、题型标签 =====
{
  let reviewConfig = null;
  global.Page = (cfg) => { reviewConfig = cfg; };
  delete require.cache[require.resolve('../miniprogram/pages/review/review')];
  require('../miniprogram/pages/review/review');
  const page = Object.create(reviewConfig);
  page.data = JSON.parse(JSON.stringify(reviewConfig.data));
  page.setData = function (patch, cb) { Object.assign(this.data, patch); if (cb) cb(); };
  page.onLoad({ level: 'not-a-level' });
  assert.strictEqual(page.data.filterLevel, '', '非法关卡参数应回退为全部关卡');

  state.clearMistakes();
  state.addMistakes([
    { levelId: '1-10', chapter: 1, stepIndex: 1, stepType: 'quiz', question: 'q10', userAnswer: 'a', correctAnswer: 'b', explain: 'e', at: 1 },
    { levelId: '1-2', chapter: 1, stepIndex: 1, stepType: 'reflection', question: 'q2', userAnswer: 'a', correctAnswer: 'b', explain: 'e', at: 2 },
    { levelId: '1-2', chapter: 1, stepIndex: 2, stepType: 'unknownType', question: 'q2b', userAnswer: 'a', correctAnswer: 'b', explain: 'e', at: 3 },
  ]);
  page.refresh();
  assert.strictEqual(page.data.total, 3);
  assert.deepStrictEqual(page.data.groups.map(g => g.levelId), ['1-2', '1-10'], '关卡应按数字顺序排序，1-10 不早于 1-2');
  const types = page.data.groups.flatMap(g => g.items.map(i => i.typeLabel));
  assert.ok(types.indexOf('结构化复述') >= 0, '复述题型应有中文标签');
  assert.ok(types.indexOf('其他题型') >= 0, '未知题型应有兜底标签');
  assert.ok(page.data.groups.every(g => g.items.every(i => i.expanded === false)), '错题默认折叠');
}

// ===== 10. 存档深拷贝：重置后默认结构之间不共享引用 =====
{
  state.reset();
  const a = state.get();
  a.progress['9-9'] = { stars: 3 };
  a.seenDialogs.push('x');
  state.reset();
  const b = state.get();
  assert.strictEqual(b.progress['9-9'], undefined, '重置不应残留上一轮的进度');
  assert.strictEqual(b.seenDialogs.length, 0, '重置不应残留已读剧情');
  assert.notStrictEqual(a.cards, b.cards, '重置后的数组不应与旧存档共享引用');
}

console.log('level guard tests passed');
