// 第 3~8 章教学样板配置校验：与第 1~2 章同口径
// 1) 元数据完整（objectives / abilityDims / goal / passScore）
// 2) 教学锚点覆盖（每章 ≥2 关迁移题、≥2 关复述；Boss 必须两者齐备）
// 3) 迁移题与复述题配置合法，且用标准答案回放必须通过
// 4) 数值答案必须与真实引擎实算一致（ads / inventory / customer / analytics / finance）
// 5) 合规红线：禁止真实平台名
const assert = require('assert');

const chapter3 = require('../miniprogram/config/levels/chapter3');
const chapter4 = require('../miniprogram/config/levels/chapter4');
const chapter5 = require('../miniprogram/config/levels/chapter5');
const chapter6 = require('../miniprogram/config/levels/chapter6');
const chapter7 = require('../miniprogram/config/levels/chapter7');
const chapter8 = require('../miniprogram/config/levels/chapter8');

const learning = require('../miniprogram/engine/learning');
const ads = require('../miniprogram/engine/ads');
const inventory = require('../miniprogram/engine/inventory');
const analytics = require('../miniprogram/engine/analytics');
const customer = require('../miniprogram/engine/customer');
const finance = require('../miniprogram/engine/finance');
const registry = require('../miniprogram/config/levels/index.js');

const CHAPTERS = [
  { id: 3, levels: chapter3, dim: 'listing' },
  { id: 4, levels: chapter4, dim: 'ads' },
  { id: 5, levels: chapter5, dim: 'supply' },
  { id: 6, levels: chapter6, dim: 'service' },
  { id: 7, levels: chapter7, dim: 'analytics' },
  { id: 8, levels: chapter8, dim: 'finance' },
];
const allLevels = CHAPTERS.reduce((acc, c) => acc.concat(c.levels), []);
const byId = id => allLevels.find(l => l.id === id);

// ===== 1. 关卡元数据完整，能力维度与章节归属一致 =====
CHAPTERS.forEach(({ id, levels, dim }) => {
  assert.ok(levels.length >= 5, `第 ${id} 章关卡数偏少（${levels.length}）`);
  levels.forEach(level => {
    assert.strictEqual(level.chapter, id, `${level.id} chapter 字段与所在章不一致`);
    assert.ok(level.goal, `${level.id} 缺少 goal`);
    assert.ok(level.passScore > 0, `${level.id} 缺少 passScore`);
    assert.ok(Array.isArray(level.objectives) && level.objectives.length >= 2, `${level.id} objectives 至少 2 条`);
    level.objectives.forEach(o => assert.ok(String(o).trim().length >= 6, `${level.id} 学习目标过短：${o}`));
    assert.ok(Array.isArray(level.abilityDims) && level.abilityDims.length, `${level.id} 缺少 abilityDims`);
    level.abilityDims.forEach(key => {
      assert.ok(learning.DIMENSION_MAP[key], `${level.id} 能力维度 ${key} 未在 DIMENSIONS 中定义`);
    });
    // 同一章应归属同一能力维度，教学证据才可聚合
    assert.deepStrictEqual(level.abilityDims, [dim], `${level.id} 的能力维度应为 ['${dim}']，实际 ${JSON.stringify(level.abilityDims)}`);
  });
});

// 关卡 id 全局唯一
const ids = allLevels.map(l => l.id);
assert.strictEqual(new Set(ids).size, ids.length, '第 3~8 章存在重复关卡 id');
const registryTotal = registry.chapters.reduce((n, c) => n + c.levels.length, 0);
assert.strictEqual(allLevels.length, registryTotal - chapter1Count() - chapter2Count(), '第 3~8 章关卡数与注册表不一致');

function chapter1Count() { return registry.chapters.find(c => c.id === 1).levels.length; }
function chapter2Count() { return registry.chapters.find(c => c.id === 2).levels.length; }

// ===== 2. 教学锚点覆盖：Boss 必须有迁移 + 复述；每章至少 2 关有迁移、2 关有复述 =====
CHAPTERS.forEach(({ id, levels }) => {
  const bosses = levels.filter(l => l.type === 'boss');
  assert.ok(bosses.length >= 1, `第 ${id} 章缺少 Boss 关`);
  bosses.forEach(boss => {
    assert.ok(boss.steps.some(s => s.type === 'transfer'), `${boss.id} Boss 关缺少迁移题`);
    assert.ok(boss.steps.some(s => s.type === 'reflection'), `${boss.id} Boss 关缺少结构化复述`);
  });
  const withTransfer = levels.filter(l => l.steps.some(s => s.type === 'transfer'));
  const withReflection = levels.filter(l => l.steps.some(s => s.type === 'reflection'));
  assert.ok(withTransfer.length >= 2, `第 ${id} 章仅 ${withTransfer.length} 关有迁移题，应 ≥2`);
  assert.ok(withReflection.length >= 2, `第 ${id} 章仅 ${withReflection.length} 关有复述题，应 ≥2`);
});

// ===== 3. 迁移题配置合法 + 标准答案可回放通过 =====
const transferSteps = [];
allLevels.forEach(level => level.steps.filter(s => s.type === 'transfer').forEach(step => transferSteps.push({ level, step })));
assert.ok(transferSteps.length >= 12, `迁移题数量偏少：${transferSteps.length}`);

transferSteps.forEach(({ level, step }) => {
  assert.ok(step.scenario, `${level.id} 迁移题缺少 scenario`);
  assert.ok(Array.isArray(step.questions) && step.questions.length >= 3, `${level.id} 迁移题应至少 3 题`);
  assert.ok(step.passRatio > 0 && step.passRatio <= 1, `${level.id} 迁移题 passRatio 非法`);
  // 3 题时 passRatio 必须 ≤ 2/3 + ε，否则答对 2 题仍不通过
  if (step.questions.length === 3) {
    assert.ok(step.passRatio <= 0.67, `${level.id} 3 题时 passRatio=${step.passRatio} 会导致 2/3 不通过`);
  }
  const answers = step.questions.map((q, i) => {
    assert.ok(q.id, `${level.id} 迁移题第 ${i + 1} 题缺少 id`);
    assert.ok(q.question, `${level.id} 迁移题第 ${i + 1} 题缺少题干`);
    assert.ok(q.explain, `${level.id} 迁移题第 ${i + 1} 题缺少解析（教学必备）`);
    if (q.kind === 'number') {
      assert.strictEqual(typeof q.answer, 'number', `${level.id} 第 ${i + 1} 题数值答案必须是 number`);
      assert.ok(q.tolerance > 0, `${level.id} 第 ${i + 1} 题缺少容差`);
      assert.ok(q.unit, `${level.id} 第 ${i + 1} 题缺少单位`);
      return String(q.answer);
    }
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `${level.id} 第 ${i + 1} 题选项不足`);
    assert.ok(q.options.some(o => o.key === q.answer), `${level.id} 第 ${i + 1} 题标准答案不在选项中`);
    // 每个选项都要有独立解释，避免"只有一个解释"
    q.options.forEach(o => assert.ok(o.text, `${level.id} 第 ${i + 1} 题存在空选项`));
    return q.answer;
  });
  const result = learning.evaluateTransfer(step, answers);
  assert.strictEqual(result.passed, true, `${level.id} 迁移题标准答案未能通过`);
  assert.strictEqual(result.correctCount, result.total, `${level.id} 迁移题标准答案应全对`);

  // 反例：全部答错必须不通过，杜绝"答错也放行"
  const wrong = step.questions.map(q => (q.kind === 'number'
    ? String(q.answer + 1000)
    : (q.options.find(o => o.key !== q.answer) || {}).key));
  assert.strictEqual(learning.evaluateTransfer(step, wrong).passed, false, `${level.id} 全错迁移题不得判定为通过`);
});

// ===== 4. 结构化复述配置合法 + 参考表述能通过 =====
const reflectSteps = [];
allLevels.forEach(level => level.steps.filter(s => s.type === 'reflection').forEach(step => reflectSteps.push({ level, step })));
assert.ok(reflectSteps.length >= 12, `复述题数量偏少：${reflectSteps.length}`);

reflectSteps.forEach(({ level, step }) => {
  assert.ok(step.prompt, `${level.id} 复述缺少 prompt`);
  assert.ok(Array.isArray(step.fields) && step.fields.length >= 2, `${level.id} 复述应至少 2 段`);
  assert.ok(step.passScore <= step.fields.length, `${level.id} 复述 passScore 不得超过段数`);
  step.fields.forEach(field => {
    assert.ok(field.label && field.placeholder, `${level.id} 复述字段缺少标签或提示`);
    assert.ok(field.sample, `${level.id} 复述字段缺少参考表述`);
    assert.ok(Array.isArray(field.keywords) && field.keywords.length, `${level.id} 复述字段缺少关键词`);
    field.keywords.forEach(group => {
      const alts = Array.isArray(group) ? group : [group];
      assert.ok(alts.length && alts.every(a => String(a).trim()), `${level.id} 复述关键词组存在空值`);
    });
  });
  // 关键字去重：同一段内不应出现完全重复的关键词组
  const flat = step.fields.map(f => f.keywords.map(g => (Array.isArray(g) ? g.join('|') : g).toLowerCase()));
  flat.forEach((list, i) => {
    assert.strictEqual(new Set(list).size, list.length, `${level.id} 复述第 ${i + 1} 段存在重复关键词组`);
  });
  // 参考表述必须能通过，否则学生照着示例写也不达标
  const result = learning.evaluateReflection(step, step.fields.map(f => f.sample));
  assert.strictEqual(result.passed, true, `${level.id} 复述参考答案未达标（关键词与示例不匹配）`);
  // 反面：空白答案必须不通过
  const blank = learning.evaluateReflection(step, step.fields.map(() => ''));
  assert.strictEqual(blank.passed, false, `${level.id} 空白复述不得判定为达标`);
});

// ===== 5. 数值一致性：迁移题答案必须与真实引擎实算对齐 =====
function numberQuestion(levelId, qid) {
  const level = byId(levelId);
  const step = level.steps.find(s => s.type === 'transfer');
  const q = step.questions.find(x => x.id === qid);
  assert.ok(q, `${levelId} 缺少迁移题 ${qid}`);
  assert.strictEqual(q.kind, 'number', `${levelId} ${qid} 应为数值题`);
  return q;
}
function assertClose(actual, expected, tol, message) {
  assert.ok(Math.abs(actual - expected) <= tol, `${message}：答案 ${actual}，引擎实算 ${expected}，容差 ${tol}`);
}

// 4-1：曝光 20000 / 点击 1000 / 花费 400 / 订单 80 / 售价 25
const m41 = ads.calcMetrics({ impressions: 20000, clicks: 1000, spend: 400, orders: 80, priceUSD: 25 });
assertClose(numberQuestion('4-1', '4-1-t1').answer, m41.ctr * 100, 0.1, '4-1 CTR 与 ads 引擎不一致');
assertClose(numberQuestion('4-1', '4-1-t2').answer, m41.cvr * 100, 0.2, '4-1 CVR 与 ads 引擎不一致');
assertClose(numberQuestion('4-1', '4-1-t3').answer, m41.acos * 100, 0.3, '4-1 ACOS 与 ads 引擎不一致');

// 4-8：花费 360 / 45 单 / 客单价 30
assertClose(numberQuestion('4-8', '4-8-t1').answer, 360 / (45 * 30) * 100, 0.5, '4-8 ACOS 与实算不一致');

// 5-4：日销 5 / 海运 35 天 / 安全 7 天；空运 8 天
assertClose(numberQuestion('5-4', '5-4-t1').answer, inventory.calculateReorderPoint({ dailySales: 5, leadTimeDays: 35, safetyDays: 7 }), 1, '5-4 海运补货点与 inventory 引擎不一致');
assertClose(numberQuestion('5-4', '5-4-t2').answer, inventory.calculateReorderPoint({ dailySales: 5, leadTimeDays: 8, safetyDays: 7 }), 1, '5-4 空运补货点与 inventory 引擎不一致');
// 5-4 关卡本体答案也要与引擎一致
const reorderStep = byId('5-4').steps.find(s => s.type === 'reorderCalc');
const reorderPointField = reorderStep.fields.find(f => f.key === 'reorderPoint');
assertClose(reorderPointField.answer, inventory.calculateReorderPoint({ dailySales: 3, leadTimeDays: 8, safetyDays: 5 }), 0.001, '5-4 关卡本体补货点与引擎不一致');

// 5-6：日销 4 / 交期 10 / 安全 6；150 件按日销 4 件
assertClose(numberQuestion('5-6', '5-6-t1').answer, inventory.calculateReorderPoint({ dailySales: 4, leadTimeDays: 10, safetyDays: 6 }), 1, '5-6 补货点与 inventory 引擎不一致');
assertClose(numberQuestion('5-6', '5-6-t2').answer, 150 / 4, 0.5, '5-6 可售天数与实算不一致');

// 6-6：工单 25/20/19、订单 200/8、评价 20/16
const sm66 = customer.calculateServiceMetrics({ ticketCount: 25, timelyCount: 20, resolvedCount: 19, orderCount: 200, refundedOrderCount: 8, ratingCount: 20, satisfiedCount: 16 });
assertClose(numberQuestion('6-6', '6-6-t1').answer, sm66.timelyResponseRate * 100, 0.5, '6-6 及时响应率与 customer 引擎不一致');
assertClose(numberQuestion('6-6', '6-6-t2').answer, sm66.refundRate * 100, 0.2, '6-6 退款订单率与 customer 引擎不一致');
assertClose(numberQuestion('6-6', '6-6-t3').answer, sm66.satisfactionRate * 100, 0.5, '6-6 满意度与 customer 引擎不一致');
// 6-5 关卡本体四项指标也要与引擎一致
const metricsStep = byId('6-5').steps.find(s => s.type === 'serviceMetrics');
const sm65 = customer.calculateServiceMetrics(metricsStep.stats);
[['timelyResponseRate', sm65.timelyResponseRate], ['resolutionRate', sm65.resolutionRate], ['refundRate', sm65.refundRate], ['satisfactionRate', sm65.satisfactionRate]].forEach(([key, value]) => {
  const field = metricsStep.fields.find(f => f.key === key);
  assertClose(field.answer, value * 100, 0.1, `6-5 ${key} 与 customer 引擎不一致`);
});

// 7-2：漏斗 200000/8000/7200/900/288/4320/1296
const f72 = analytics.calculateFunnel({ impressions: 200000, clicks: 8000, visitors: 7200, carts: 900, orders: 288, salesUSD: 4320, adSpendUSD: 1296 });
assertClose(numberQuestion('7-2', '7-2-t1').answer, f72.ctr, 0.1, '7-2 CTR 与 analytics 引擎不一致');
assertClose(numberQuestion('7-2', '7-2-t2').answer, f72.conversionRate, 0.1, '7-2 转化率与 analytics 引擎不一致');
assertClose(numberQuestion('7-2', '7-2-t3').answer, f72.acos, 0.3, '7-2 ACOS 与 analytics 引擎不一致');
// 7-2 关卡本体四项指标也要与引擎一致
const funnelStep = byId('7-2').steps.find(s => s.type === 'funnelCalc');
const f72Base = analytics.calculateFunnel(funnelStep.data);
[['ctr', f72Base.ctr], ['conversionRate', f72Base.conversionRate], ['averageOrderValue', f72Base.averageOrderValue], ['acos', f72Base.acos]].forEach(([key, value]) => {
  const field = funnelStep.fields.find(f => f.key === key);
  assertClose(field.answer, value, 0.05, `7-2 ${key} 与 analytics 引擎不一致`);
});

// 8-3：单位成本 9.32；A 17.99/110、B 13.99/170、C 12.49/210
const planA = finance.evaluatePricingPlan({ priceUSD: 17.99, expectedOrders: 110, costPerUnitUSD: 9.32, targetMargin: 0.30 });
const planB = finance.evaluatePricingPlan({ priceUSD: 13.99, expectedOrders: 170, costPerUnitUSD: 9.32, targetMargin: 0.30 });
const planC = finance.evaluatePricingPlan({ priceUSD: 12.49, expectedOrders: 210, costPerUnitUSD: 9.32, targetMargin: 0.30 });
assertClose(numberQuestion('8-3', '8-3-t1').answer, planA.margin * 100, 1, '8-3 方案 A 毛利率与 finance 引擎不一致');
assertClose(numberQuestion('8-3', '8-3-t2').answer, planA.profitUSD, 15, '8-3 方案 A 总利润与 finance 引擎不一致');
assert.strictEqual(planB.meetsTarget, true, '8-3 方案 B 应在 30% 红线以上');
assert.strictEqual(planC.meetsTarget, false, '8-3 方案 C 应跌破 30% 红线');
// 选项或题干里写明的毛利率必须与引擎实算一致
const t83 = byId('8-3').steps.find(s => s.type === 'transfer').questions.find(q => q.id === '8-3-t3');
assert.ok(Math.abs(planB.margin * 100 - 33.4) < 0.05, `8-3 方案 B 毛利率应为 33.4%，实算 ${(planB.margin * 100).toFixed(2)}`);
assert.ok(Math.abs(planC.margin * 100 - 25.4) < 0.05, `8-3 方案 C 毛利率应为 25.4%，实算 ${(planC.margin * 100).toFixed(2)}`);
assert.ok(t83.question.indexOf('33.4') >= 0, '8-3 题干未写明方案 B 毛利率 33.4%');
assert.ok(t83.question.indexOf('25.4') >= 0, '8-3 题干未写明方案 C 毛利率 25.4%');

// 8-6：预算 24000；采购 7000 / 广告 5000 / 物流 5200 / 售后 1800
assertClose(numberQuestion('8-6', '8-6-t1').answer, 7000 + 5000 + 5200 + 1800, 1, '8-6 总支出与实算不一致');
const t86 = byId('8-6').steps.find(s => s.type === 'transfer').questions.find(q => q.id === '8-6-t2');
const adOptA = t86.options.find(o => o.key === 'A');
assert.ok(Math.abs(5000 / 24000 * 100 - 20.8) < 0.05, `8-6 广告占比应为 20.8%，实算 ${(5000 / 24000 * 100).toFixed(2)}`);
assert.ok(adOptA.text.indexOf('20.8') >= 0, '8-6 广告占比正确答案未写明 20.8%');
// 8-6 关卡本体字段与 finance 引擎实算一致
const bossStep = byId('8-6').steps.find(s => s.type === 'financeBoss');
const bossResult = finance.evaluateFinanceBoss({ ...bossStep.data, targets: bossStep.targets });
assert.strictEqual(bossResult.passed, true, `8-6 关卡本体标准方案应通过，实际失败项：${bossResult.failures.join('、')}`);

// ===== 6. 合规红线：第 3~8 章与知识卡片不得出现真实平台名 =====
const banned = ['亚马逊', 'Amazon', 'Shopify', 'eBay', 'TikTok', '沃尔玛', 'Walmart', '淘宝', '京东', 'Prime'];
const cardsSrc = require('fs').readFileSync(require('path').join(__dirname, '../miniprogram/config/cards.js'), 'utf8');
const raw = JSON.stringify(allLevels) + cardsSrc;
banned.forEach(word => {
  assert.strictEqual(raw.indexOf(word) >= 0, false, `第 3~8 章或知识卡片出现真实平台名：${word}`);
});
// amazon choice 变体（大小写不敏感）也要拦
assert.strictEqual(/amaz?on\s*choice/i.test(raw), false, '仍存在「Amazon Choice」类平台标记词');

// ===== 7. 渲染器必须支持新增步骤类型 =====
['transfer', 'reflection'].forEach(type => {
  assert.ok(learning.STAGE_LABEL[type], `STAGE_LABEL 缺少 ${type} 阶段标签`);
});

// ===== 8. 知识卡片完整性（第 3~8 章必须有自家卡片，且全站引用的 cardId 必须存在）=====
const cards = require('../miniprogram/config/cards');
const cardById = cards;

CHAPTERS.forEach(({ id, levels }) => {
  const own = Object.values(cards).filter(c => c.chapter === id);
  assert.ok(own.length >= 4, `第 ${id} 章自带知识卡片偏少（${own.length}），应 ≥4`);
  own.forEach(card => {
    assert.ok(card.id && card.title && card.text && card.interview, `${card.id} 卡片字段不完整`);
    assert.ok(card.text.length >= 30, `${card.id} 卡片正文过短`);
    assert.ok(card.interview.indexOf('？') >= 0 || card.interview.indexOf('?') >= 0, `${card.id} 面试问法应为疑问句`);
  });
  // 本章每一关都应有知识卡铺垫（教学闭环第一环：知道概念）
  levels.forEach(level => {
    assert.ok(level.steps.some(s => s.type === 'card'), `${level.id} 没有任何知识卡片步骤`);
  });
});

// 全站（含第 1~2 章）引用的 cardId 必须都在卡片库中，否则卡片步骤会渲染成空白
const referenced = [];
registry.chapters.forEach(ch => ch.levels.forEach(level => level.steps
  .filter(s => s.type === 'card')
  .forEach(s => referenced.push({ levelId: level.id, cardId: s.cardId }))));
assert.ok(referenced.length >= 40, `卡片引用数量偏少：${referenced.length}`);
referenced.forEach(({ levelId, cardId }) => {
  assert.ok(cardById[cardId], `${levelId} 引用了不存在的知识卡片 ${cardId}`);
});

// 卡片库每张卡都必须被某个关卡引用（否则手册页会出现永远收集不到的死卡）
const referencedIds = new Set(referenced.map(r => r.cardId));
Object.keys(cards).forEach(id => {
  assert.ok(referencedIds.has(id), `知识卡片 ${id} 未被任何关卡引用，学生永远无法收集`);
});

// 卡片 id 与 chapter 字段必须自洽
Object.values(cards).forEach(card => {
  assert.ok(card.id.indexOf(`K${card.chapter}-`) === 0, `${card.id} 的 id 前缀与 chapter=${card.chapter} 不一致`);
});

console.log(`chapter3-8 teaching template tests passed（${allLevels.length} 关 / ${transferSteps.length} 迁移题 / ${reflectSteps.length} 复述题 / ${referenced.length} 处卡片引用）`);
