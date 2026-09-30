// 求助提示与金币经济：三级提示的生成质量、定价唯一性、降级的诚实性，
// 以及关卡页的真实集成（购买扣费、免费档、金币不足、用过提示不加成）。
const assert = require('assert');
const path = require('path');

const MP = path.join(__dirname, '..', 'miniprogram');
const hints = require(path.join(MP, 'engine/hints'));
const CONSTANTS = require(path.join(MP, 'config/constants'));
const registry = require(path.join(MP, 'config/levels/index'));
const learning = require(path.join(MP, 'engine/learning'));

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function eachStep(fn) {
  registry.chapters.forEach(ch => {
    ch.levels.forEach(lv => {
      lv.steps.forEach((s, i) => fn(s, lv, ch, i));
    });
  });
}

// ===== 1. 定价只有一处来源，且逐级递增 =====
{
  assert.deepStrictEqual(hints.TIERS, CONSTANTS.HINT_TIERS, '提示定价只能有一处来源，不得出现第二份');
  const prices = CONSTANTS.HINT_TIERS.map(t => t.price);
  assert.strictEqual(prices[0], 0, 'L1 思路必须免费——第一级就收费会让舍不得花金币的学生继续卡着');
  assert.ok(prices[1] > prices[0] && prices[2] > prices[1], '价格必须逐级递增');
  assert.strictEqual(hints.priceOf(1), 0);
  assert.strictEqual(hints.priceOf(3), prices[2]);
  assert.strictEqual(hints.priceOf(99), 0, '未知等级应返回 0 而不是抛异常');
  assert.strictEqual(hints.priceUpTo(3), prices[0] + prices[1] + prices[2]);
}

// ===== 2. 全部可求助步骤都要有完整三级内容（不允许空壳） =====
{
  let askable = 0;
  const notReady = [];
  eachStep((step, lv, ch) => {
    if (!hints.isAskable(step)) return;
    askable++;
    const built = hints.buildHints(step, {
      chapterId: ch.id,
      chapterName: ch.name,
      abilityLabels: (lv.abilityDims || []).map(k => learning.DIMENSION_MAP[k]).filter(Boolean),
    });
    assert.strictEqual(built.available, true, `${step.type} 应可求助`);
    assert.strictEqual(built.tiers.length, 3, '必须是三级');
    built.tiers.forEach(t => {
      if (!t.ready || !t.text) notReady.push(`${lv.id}/${step.type}/L${t.tier}`);
      assert.strictEqual(typeof t.price, 'number', '价格必须来自 constants');
    });
  });
  assert.ok(askable > 100, `可求助步骤数异常偏少：${askable}`);
  assert.deepStrictEqual(notReady, [], `有等级的提示取不到内容：${notReady.slice(0, 5).join('、')}`);
}

// ===== 3. 没有对错的步骤不提供求助 =====
{
  ['dialog', 'card', 'profitDemo'].forEach(type => {
    assert.strictEqual(hints.isAskable({ type }), false, `${type} 没有对错，不应提供求助`);
    assert.strictEqual(hints.buildHints({ type, text: 'x' }).available, false);
  });
  assert.strictEqual(hints.buildHints(null).available, false, '空步骤应安全返回');
  assert.strictEqual(hints.buildHints(undefined).available, false);
}

// ===== 4. L2 不得泄露答案 =====
// 回归保护：L2 最初是把「错项 explain」拼成「常见误区」，实测有两处问题——
// ① 三选项题排除两个等于白送答案（L2 只卖 20，L3 才卖 50）；
// ② 错项 explain 脱离上下文会被误读成在肯定错误选项。
// 现在 L2 改为「考点定位 + 复习指引」，这里锁死它不得引用任何选项文本或错项解析。
{
  let checked = 0;
  eachStep(step => {
    if (step.type !== 'quiz' || !Array.isArray(step.options) || step.options.length < 3) return;
    const built = hints.buildHints(step, { chapterId: 1, chapterName: '入职培训', abilityLabels: ['经营基础'] });
    const clue = built.tiers[1].text;
    step.options.forEach(o => {
      assert.ok(clue.indexOf(o.text) < 0, `L2 泄露了选项文本「${o.text}」`);
      if (!o.correct && o.explain) {
        assert.ok(clue.indexOf(o.explain) < 0, `L2 引用了错项解析「${o.explain}」`);
      }
    });
    checked++;
  });
  assert.ok(checked > 0, '没有找到多选项 quiz，该断言未真正生效');
}

// ===== 5. 取不到权威答案时必须如实降级，不得编造 =====
{
  // 主观复述题没有唯一答案：应给参考表述并标 exact=false
  let reflectionSeen = 0;
  eachStep(step => {
    if (step.type !== 'reflection') return;
    reflectionSeen++;
    const built = hints.buildHints(step, { chapterId: 1, chapterName: '入职培训', abilityLabels: [] });
    assert.strictEqual(built.tiers[2].exact, false, '复述题不是标准答案，必须标为不精确');
    assert.ok(built.tiers[2].text.length > 0, '仍应给出参考表述');
    if (reflectionSeen === 1) {
      // 参考表述原样呈现即可：sample 已是完整句子，再拼字段名会读成「我依据的数据是：我依据的是…」
      const sampleField = step.fields.find(f => f && typeof f.sample === 'string' && f.sample.trim());
      assert.ok(sampleField, '复述题应有参考表述');
      assert.ok(built.tiers[2].text.indexOf(sampleField.sample) >= 0, '参考表述应原样呈现');
    }
  });
  assert.ok(reflectionSeen > 0, '没有找到复述题');

  // 伪造一个没有任何答案字段的步骤：应如实说明而不是编造
  const built = hints.buildHints({ type: 'quiz', question: '凭空的问题', options: [] }, {});
  assert.strictEqual(built.tiers[2].exact, false, '取不到答案时必须标 exact=false');
  assert.ok(built.tiers[2].text.indexOf('没有唯一标准答案') >= 0, '应如实说明取不到答案');
}

// ===== 6. 纯函数：不修改入参 =====
{
  const sample = registry.chapters[0].levels[0].steps.find(s => hints.isAskable(s));
  assert.ok(sample, '第 1 章第 1 关应有可求助步骤');
  const before = JSON.stringify(sample);
  hints.buildHints(sample, { chapterId: 1, chapterName: '入职培训', abilityLabels: ['经营基础'] });
  assert.strictEqual(JSON.stringify(sample), before, '不得修改传入的步骤');

  // 同一输入必须完全可复现
  const a = JSON.stringify(hints.buildHints(sample, { chapterId: 1, chapterName: 'x', abilityLabels: [] }));
  const b = JSON.stringify(hints.buildHints(sample, { chapterId: 1, chapterName: 'x', abilityLabels: [] }));
  assert.strictEqual(a, b, '同一输入必须得到同一输出');
}

// ===== 7. 金币经济：零提示加成与连胜 =====
const statePath = path.join(MP, 'engine/state.js');
function makeWx(seed) {
  const store = Object.assign({}, seed || {});
  return {
    store,
    getStorageSync: k => store[k],
    setStorageSync: (k, v) => { store[k] = v; },
    removeStorageSync: k => { delete store[k]; },
  };
}
function freshState(wx) {
  global.wx = wx;
  delete require.cache[require.resolve(statePath)];
  return require(statePath);
}

function coinEconomyTests() {
  // 零提示首关：基础 30 + 零提示 15 + 连胜 5
  {
    const state = freshState(makeWx({}));
    state.init();
    const r = state.settleLevelReward('1-1', 3, 95, { usedHint: false });
    assert.strictEqual(r.base, 30);
    assert.strictEqual(r.noHintBonus, 15, '零提示加成应为基础奖励的 50%');
    assert.strictEqual(r.streakBonus, CONSTANTS.STREAK_BONUS_STEP, '连胜第 1 关加成');
    assert.strictEqual(r.total, 30 + 15 + CONSTANTS.STREAK_BONUS_STEP);
    assert.strictEqual(state.get().coins, r.total);
  }

  // 连胜加成递增到上限后封顶
  {
    const state = freshState(makeWx({}));
    state.init();
    const ids = ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7'];
    const step = CONSTANTS.STREAK_BONUS_STEP;
    const cap = CONSTANTS.STREAK_BONUS_CAP;
    const bonuses = ids.map(id => state.settleLevelReward(id, 3, 95, { usedHint: false }).streakBonus);
    const expected = ids.map((id, i) => step * Math.min(i + 1, cap));
    assert.deepStrictEqual(bonuses, expected, '连胜加成应递增到上限后封顶');
    assert.strictEqual(state.getStudyStreak(), ids.length);
  }

  // 用提示：没有零提示加成，且中断连胜
  {
    const state = freshState(makeWx({}));
    state.init();
    state.settleLevelReward('1-1', 3, 95, { usedHint: false });
    const r = state.settleLevelReward('1-2', 3, 95, { usedHint: true });
    assert.strictEqual(r.noHintBonus, 0, '用过提示就没有零提示加成');
    assert.strictEqual(r.streakBonus, 0);
    assert.strictEqual(r.total, 30, '只保留基础奖励');
    assert.strictEqual(r.brokeStreak, true, '应报告连胜被中断');
    assert.strictEqual(state.getStudyStreak(), 0);
  }

  // 免费档也是「用过提示」：L1 不扣金币但会失去加成
  {
    const state = freshState(makeWx({}));
    state.init();
    const coinsBefore = state.get().coins;
    assert.strictEqual(state.spendCoins(CONSTANTS.HINT_TIERS[0].price, { type: 'hint', label: '思路提示' }), true);
    assert.strictEqual(state.get().coins, coinsBefore, 'L1 免费，不应扣金币');
    const r = state.settleLevelReward('1-1', 3, 95, { usedHint: true });
    assert.strictEqual(r.total, 30, '用了免费的思路提示同样失去加成——这是它的真实代价');
  }

  // 重刷已通关且未升星：不发奖励、不动连胜（否则可无限刷金币）
  {
    const state = freshState(makeWx({}));
    state.init();
    state.settleLevelReward('1-1', 3, 95, { usedHint: false });
    state.settleLevelReward('1-2', 3, 95, { usedHint: false });
    const coinsBefore = state.get().coins;
    const streakBefore = state.getStudyStreak();
    const r = state.settleLevelReward('1-1', 3, 98, { usedHint: false });
    assert.strictEqual(r.total, 0, '重刷不应给任何金币');
    assert.strictEqual(state.get().coins, coinsBefore);
    assert.strictEqual(state.getStudyStreak(), streakBefore, '重刷不该影响连胜');
  }

  // 未通关（0 星）不给奖励，也不消耗连胜
  {
    const state = freshState(makeWx({}));
    state.init();
    state.settleLevelReward('1-1', 3, 95, { usedHint: false });
    const r = state.settleLevelReward('1-2', 0, 40, { usedHint: false });
    assert.strictEqual(r.total, 0);
    assert.strictEqual(state.getStudyStreak(), 1, '失败不该把之前的连胜耗掉');
  }

  // 金币账本：新的在前、金额正负正确、有上限
  {
    const state = freshState(makeWx({}));
    state.init();
    const first = state.settleLevelReward('1-1', 3, 95, { usedHint: false });
    const price = CONSTANTS.HINT_TIERS[1].price;
    state.spendCoins(price, { type: 'hint', label: '线索提示' });
    const ledger = state.getCoinLedger();
    assert.strictEqual(ledger[0].amount, -price, '最新一条应排在最前，且金额为负');
    assert.strictEqual(ledger[0].type, 'hint');
    assert.strictEqual(ledger[2].type, 'level');
    assert.strictEqual(state.get().coins, first.total - price);

    state.get().coins = 1000;
    for (let i = 0; i < 40; i++) state.spendCoins(1, { type: 'hint', label: 'i' + i });
    assert.ok(state.getCoinLedger(100).length <= 20, '账本必须裁剪，不能无限增长');
  }

  // spendCoins 在 init 之前调用不应抛异常（修复前 cache 为 null 会崩）
  {
    const state = freshState(makeWx({}));
    assert.strictEqual(state.spendCoins(10, { type: 'hint', label: 'x' }), false, '未初始化时应安全返回 false');
  }
}
coinEconomyTests();

// ===== 8. 关卡页真实集成 =====
{
  const wx = makeWx({});
  const state = freshState(wx);
  state.init();
  wx.setNavigationBarTitle = () => {};
  wx.showToast = () => {};
  wx.redirectTo = () => {};
  wx.switchTab = () => {};

  let captured = null;
  global.Page = obj => { captured = obj; };
  const levelPagePath = path.join(MP, 'pages/level/level.js');
  delete require.cache[require.resolve(levelPagePath)];
  require(levelPagePath);

  function setByPath(target, keyPath, value) {
    const parts = keyPath.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
  const page = Object.assign({}, captured);
  page.data = clone(captured.data);
  page.setData = function (patch, cb) {
    Object.keys(patch || {}).forEach(key => {
      if (key.indexOf('.') >= 0) setByPath(page.data, key, patch[key]);
      else page.data[key] = patch[key];
    });
    if (typeof cb === 'function') cb();
  };

  const modulePage = registry.chapters[0].levels.find(l => l.id === '1-1');
  const askIndex = modulePage.steps.findIndex(s => hints.isAskable(s));
  assert.ok(askIndex >= 0, '1-1 应有可求助步骤');

  state.get().coins = 200; // 先给测试币，否则付费档会因金币不足而买不动
  page.onLoad({ id: '1-1' });
  page.data.stepIndex = askIndex;
  page.renderStep();

  assert.ok(page.data.view.hint && page.data.view.hint.available, '可判定步骤应出现求助坞');
  assert.strictEqual(page.data.view.hint.tiers.length, 3);
  assert.ok(page.data.view.hint.tiers.every(t => t.unlocked === false), '初始都不应解锁');

  // 阅读型步骤不应有求助坞
  const dialogIndex = modulePage.steps.findIndex(s => s.type === 'dialog');
  if (dialogIndex >= 0) {
    page.data.stepIndex = dialogIndex;
    page.renderStep();
    assert.ok(!page.data.view.hint, '阅读型步骤不应出现求助坞');
    page.data.stepIndex = askIndex;
    page.renderStep();
  }

  // 展开
  page.onToggleHint();
  assert.strictEqual(page.data.view.hint.open, true);

  // 免费档：不扣金币，但计入「用过提示」
  const coins0 = state.get().coins;
  page.onBuyHint({ currentTarget: { dataset: { tier: 1 } } });
  assert.strictEqual(state.get().coins, coins0, 'L1 免费不应扣金币');
  assert.strictEqual(page.data.view.hint.tiers[0].unlocked, true, 'L1 应解锁');
  assert.strictEqual(page.data.view.hint.tiers[1].unlocked, false, '不该连带解锁 L2');
  assert.strictEqual(page.data.hintsUsed, 1, '免费档也要计入用过提示');
  assert.strictEqual(page.data.hintsSpent, 0);

  // 付费档
  page.onBuyHint({ currentTarget: { dataset: { tier: 2 } } });
  assert.strictEqual(state.get().coins, coins0 - CONSTANTS.HINT_TIERS[1].price, 'L2 应按 constants 定价扣费');
  assert.strictEqual(page.data.hintsUsed, 2);
  assert.strictEqual(page.data.hintsSpent, CONSTANTS.HINT_TIERS[1].price);

  // 金币不足：不解锁、不计入、扣不到钱
  state.get().coins = 0;
  const usedBefore = page.data.hintsUsed;
  page.onBuyHint({ currentTarget: { dataset: { tier: 3 } } });
  assert.strictEqual(page.data.view.hint.tiers[2].unlocked, false, '金币不足不应解锁');
  assert.strictEqual(page.data.hintsUsed, usedBefore, '失败不应计入使用次数');
  assert.strictEqual(state.get().coins, 0, '失败不应扣成负数');

  // 金币充足：买最高档应把低级一并带出
  state.get().coins = 500;
  page.onBuyHint({ currentTarget: { dataset: { tier: 3 } } });
  assert.ok(page.data.view.hint.tiers.every(t => t.unlocked), '买解析应同时带出思路与线索');

  // 重复购买同一档不应重复扣费
  const coinsAfter = state.get().coins;
  page.onBuyHint({ currentTarget: { dataset: { tier: 3 } } });
  assert.strictEqual(state.get().coins, coinsAfter, '已解锁的档位不该再次扣费');

  // 用过提示后通关：没有任何加成
  const reward = state.settleLevelReward('1-1', 3, 95, { usedHint: page.data.hintsUsed > 0 });
  assert.strictEqual(reward.noHintBonus, 0, '用过提示不该拿零提示加成');
  assert.strictEqual(reward.streakBonus, 0);

  // 求助记录必须能随「退出续学」保存：否则退出重进就能洗掉记录、白拿加成
  page.onUnload();
  const saved = state.getLearningProgress();
  assert.ok(saved, 'onUnload 应保存续学进度');
  assert.strictEqual(saved.hintsUsed, page.data.hintsUsed, 'hintsUsed 必须一起存下去');
  assert.strictEqual(saved.hintsSpent, page.data.hintsSpent);

  // 重进关卡应恢复「用过提示」。
  // 这里必须用一关「未通关」的关卡：既有设计会把已通关关卡的续学点判为过期，
  // 那是另一条规则（已通关不必续学），不是这里要验证的行为。
  const resumeLevel = registry.chapters[0].levels.find(l => l.id === '1-3');
  assert.ok(resumeLevel && resumeLevel.steps.length > 1, '测试前提：1-3 应有多个步骤');
  assert.ok(!state.isLevelCleared(resumeLevel.id), '测试前提：1-3 尚未通关');
  state.saveLearningProgress({
    levelId: resumeLevel.id, levelName: resumeLevel.name, stepIndex: 1,
    stepTotal: resumeLevel.steps.length, hintsUsed: 3, hintsSpent: 70,
  });
  const page2 = Object.assign({}, captured);
  page2.data = clone(captured.data);
  page2.setData = function (patch, cb) {
    Object.keys(patch || {}).forEach(key => {
      if (key.indexOf('.') >= 0) setByPath(page2.data, key, patch[key]);
      else page2.data[key] = patch[key];
    });
    if (typeof cb === 'function') cb();
  };
  page2.onLoad({ id: resumeLevel.id });
  assert.strictEqual(page2.data.hintsUsed, 3, '重进关卡应恢复已用提示次数');
  assert.strictEqual(page2.data.hintsSpent, 70, '已花金币也要一并恢复');
}

console.log('hint economy passed：8 组断言（定价唯一 / 覆盖完整 / 不泄露 / 不编造 / 纯函数 / 连胜 / 账本 / 页面集成）');
