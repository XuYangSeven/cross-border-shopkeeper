// 第 1~2 章教学样板配置校验：结构完整 + 标准答案可通过 + 文案数值与引擎实算一致
const assert = require('assert');
const chapter1 = require('../miniprogram/config/levels/chapter1');
const chapter2 = require('../miniprogram/config/levels/chapter2');
const learning = require('../miniprogram/engine/learning');
const profitEngine = require('../miniprogram/engine/profit');
const skus = require('../miniprogram/config/skus');

const levels = chapter1.concat(chapter2);

// ===== 1. 关卡元数据完整 =====
levels.forEach(level => {
  assert.ok(level.objectives && level.objectives.length >= 2, `${level.id} 缺少 objectives`);
  assert.ok(Array.isArray(level.abilityDims) && level.abilityDims.length, `${level.id} 缺少 abilityDims`);
  level.abilityDims.forEach(dim => {
    assert.ok(learning.DIMENSION_MAP[dim], `${level.id} 的能力维度 ${dim} 未在 DIMENSIONS 中定义`);
  });
  assert.ok(level.goal, `${level.id} 缺少 goal`);
  assert.ok(level.passScore > 0, `${level.id} 缺少 passScore`);
});

// ===== 2. 迁移题与复述题覆盖到位 =====
const expectTransfer = ['1-2', '1-3', '2-3', '2-6'];
const expectReflection = ['1-2', '1-3', '2-6'];
expectTransfer.forEach(id => {
  const level = levels.find(l => l.id === id);
  assert.ok(level.steps.some(s => s.type === 'transfer'), `${id} 缺少迁移题`);
});
expectReflection.forEach(id => {
  const level = levels.find(l => l.id === id);
  assert.ok(level.steps.some(s => s.type === 'reflection'), `${id} 缺少结构化复述`);
});
// Boss 关必须同时具备迁移与复述（教学闭环的验收硬条件）
levels.filter(l => l.type === 'boss').forEach(boss => {
  assert.ok(boss.steps.some(s => s.type === 'transfer'), `${boss.id} Boss 关缺少迁移题`);
  assert.ok(boss.steps.some(s => s.type === 'reflection'), `${boss.id} Boss 关缺少结构化复述`);
});

// ===== 3. 迁移题配置合法 + 标准答案可通过 =====
const transferSteps = [];
levels.forEach(level => level.steps.filter(s => s.type === 'transfer').forEach(s => transferSteps.push({ level, step: s })));
transferSteps.forEach(({ level, step }) => {
  assert.ok(step.scenario, `${level.id} 迁移题缺少 scenario`);
  assert.ok(step.questions.length >= 3, `${level.id} 迁移题应至少 3 题`);
  const answers = step.questions.map((q, i) => {
    assert.ok(q.question, `${level.id} 第 ${i + 1} 题缺少题干`);
    assert.ok(q.explain, `${level.id} 第 ${i + 1} 题缺少解析（教学必备）`);
    if (q.kind === 'number') {
      assert.strictEqual(typeof q.answer, 'number', `${level.id} 第 ${i + 1} 题数值答案必须是 number`);
      assert.ok(q.tolerance > 0, `${level.id} 第 ${i + 1} 题缺少容差`);
      return String(q.answer);
    }
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `${level.id} 第 ${i + 1} 题选项不足`);
    assert.ok(q.options.some(o => o.key === q.answer), `${level.id} 第 ${i + 1} 题标准答案不在选项中`);
    return q.answer;
  });
  // 用标准答案回放，必须能通过，否则该迁移题不可解
  const result = learning.evaluateTransfer(step, answers);
  assert.strictEqual(result.passed, true, `${level.id} 迁移题标准答案未能通过`);
  assert.strictEqual(result.correctCount, result.total, `${level.id} 迁移题标准答案应全对`);
});

// ===== 4. 结构化复述配置合法 + 参考表述能通过 =====
const reflectSteps = [];
levels.forEach(level => level.steps.filter(s => s.type === 'reflection').forEach(s => reflectSteps.push({ level, step: s })));
reflectSteps.forEach(({ level, step }) => {
  assert.ok(step.prompt, `${level.id} 复述缺少 prompt`);
  assert.ok(step.fields.length >= 2, `${level.id} 复述应至少 2 段`);
  assert.ok(step.passScore <= step.fields.length, `${level.id} 复述 passScore 不得超过段数`);
  step.fields.forEach(field => {
    assert.ok(field.label && field.placeholder, `${level.id} 复述字段缺少标签或提示`);
    assert.ok(field.sample, `${level.id} 复述字段缺少参考表述`);
    assert.ok(Array.isArray(field.keywords) && field.keywords.length, `${level.id} 复述字段缺少关键词`);
  });
  // 参考表述必须能通过，否则学生照着示例写也不达标
  const result = learning.evaluateReflection(step, step.fields.map(f => f.sample));
  assert.strictEqual(result.passed, true, `${level.id} 复述参考答案未达标（关键词与示例不匹配）`);
});

// ===== 5. 数值一致性：迁移题答案与引擎实算对齐 =====
// 1-2 销售额 = 访客 × 转化率 × 客单价
const t12 = chapter1.find(l => l.id === '1-2').steps.find(s => s.type === 'transfer');
const expectSales = 1500 * 0.06 * 32;
assert.strictEqual(t12.questions[0].answer, expectSales, '1-2 销售额答案与公式不一致');
assert.strictEqual(t12.questions[1].answer, 1500 * 0.12 * 32, '1-2 转化率翻倍后的销售额不一致');

// 2-3 毛利率答案必须与利润引擎对 SKU-011 的实算一致（容差 1 个百分点）
const towel = skus.find(s => s.id === 'SKU-011');
const towelProfit = profitEngine.calcProfit(towel);
const t23 = chapter2.find(l => l.id === '2-3').steps.find(s => s.type === 'transfer');
const marginQuestion = t23.questions.find(q => q.kind === 'number');
assert.ok(Math.abs(marginQuestion.answer - towelProfit.margin * 100) <= 1,
  `2-3 毛利率答案 ${marginQuestion.answer} 与引擎实算 ${(towelProfit.margin * 100).toFixed(2)} 不一致`);

// 2-3 体积重选项必须与引擎一致：30×30×4 ÷ 6000 = 0.6kg
const volumeQuestion = t23.questions.find(q => q.kind === 'choice');
const correctVolume = volumeQuestion.options.find(o => o.key === volumeQuestion.answer);
assert.ok(correctVolume.text.indexOf('0.6kg') >= 0, '2-3 体积重正确答案应为 0.6kg');
assert.ok(Math.abs(profitEngine.volumeWeight(towel.dimCm) - 0.6) < 0.001, '宠物毛巾体积重应为 0.6kg');
assert.ok(Math.abs(profitEngine.chargeableWeight(towel) - 0.6) < 0.001, '宠物毛巾计费重应为 0.6kg');

// ===== 6. 轻抛货陷阱文案必须与引擎实算一致（原文案尺寸/档位/费用三项均错）=====
const trapStep = chapter2.find(l => l.id === '2-3').steps.find(s => s.type === 'profitCalc' && s.trap);
const sandpaper = skus.find(s => s.id === 'SKU-010');
const spProfit = profitEngine.calcProfit(sandpaper);
assert.ok(Math.abs(spProfit.volumeWeightKg - 1.2) < 0.001, '防抓沙发贴体积重应为 1.2kg');
assert.strictEqual(spProfit.fbaTier, 'oversize_1');
assert.strictEqual(spProfit.fbaFeeUSD, 5.08);
assert.ok(trapStep.trapExplain.indexOf('1.2kg') >= 0, '陷阱文案未写明体积重 1.2kg');
assert.ok(trapStep.trapExplain.indexOf('5.08') >= 0, '陷阱文案未写明仓配费 $5.08');
assert.ok(trapStep.trapExplain.indexOf('超大件1') >= 0, '陷阱文案未写明档位');
assert.ok(trapStep.trapExplain.indexOf('15.2') >= 0, '陷阱文案未写明实际毛利率');
assert.ok(trapStep.trapExplain.indexOf('90×40') >= 0, '陷阱文案尺寸应为 90×40cm');

// ===== 7. 2-4 选项文本中的分数必须与加权引擎一致 =====
const weights = { market: 0.25, competition: 0.25, profit: 0.25, logistics: 0.15, risk: 0.10 };
const comb = profitEngine.weightedScore(skus.find(s => s.id === 'SKU-001').expertScores, weights);
const bowl = profitEngine.weightedScore(skus.find(s => s.id === 'SKU-004').expertScores, weights);
const board = profitEngine.weightedScore(skus.find(s => s.id === 'SKU-007').expertScores, weights);
const quiz24 = chapter2.find(l => l.id === '2-4').steps.find(s => s.type === 'quiz' && s.question.indexOf('主推品') >= 0);
const bowlOption = quiz24.options.find(o => o.text.indexOf('慢食碗') >= 0);
const boardOption = quiz24.options.find(o => o.text.indexOf('猫抓板') >= 0);
assert.ok(bowlOption.explain.indexOf(String(bowl)) >= 0, `2-4 慢食碗分数应写 ${bowl}，实际文案：${bowlOption.explain}`);
assert.ok(boardOption.explain.indexOf(String(board)) >= 0, `2-4 猫抓板分数应写 ${board}，实际文案：${boardOption.explain}`);
assert.ok(quiz24.options.find(o => o.correct).explain.indexOf(String(comb)) >= 0, `2-4 主推品分数应写 ${comb}`);

// ===== 8. 禁用真实平台名（合规红线）=====
const banned = ['亚马逊', 'Amazon', 'Shopify', 'eBay', 'TikTok', '沃尔玛', 'Walmart'];
const raw = JSON.stringify(chapter1) + JSON.stringify(chapter2);
banned.forEach(word => {
  assert.strictEqual(raw.indexOf(word) >= 0, false, `第 1~2 章出现真实平台名：${word}`);
});

console.log('chapter1-2 teaching template tests passed');
