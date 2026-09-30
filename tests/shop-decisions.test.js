// 店铺决策沙盘测试
// 覆盖五件事：
//   ① 经营模型的单调性（改一个决策，指标必须朝正确方向动）
//   ② 初始快照与推演的校准不变量（不然学生看到的两套数字会打架）
//   ③ 推演与 7 日模拟同源（无断货时订单数必须一致）
//   ④ 操作约束（行动点 / 现金 / 次数 / 前置条件）与六项任务可达性
//   ⑤ 六个店铺子页面 + 模拟/结算页的渲染冒烟（用 wx/Page 桩跑真 onShow）

const assert = require('assert');
const path = require('path');
const shop = require('../miniprogram/engine/shop');
const tasks = require('../miniprogram/engine/tasks');
const learning = require('../miniprogram/engine/learning');
const state = require('../miniprogram/engine/state');

// ===== wx / Page 桩 =====
let storage = null;
const toasts = [];
const navs = [];
global.wx = {
  getStorageSync: () => storage,
  setStorageSync: (key, value) => { storage = JSON.parse(JSON.stringify(value)); },
  removeStorageSync: () => { storage = null; },
  setNavigationBarTitle: () => {},
  navigateTo: opt => navs.push(opt && opt.url),
  navigateBack: () => {},
  switchTab: opt => navs.push(opt && opt.url),
  showToast: opt => toasts.push(opt),
  showModal: () => {},
  vibrateShort: () => {},
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
const BASE = clone(state.SHOP_DEFAULT);

// ===== 1. 经营模型单调性 =====
function qualityUp() {
  const next = clone(BASE);
  next.listing = { titleScore: 90, imageScore: 90, bulletScore: 90 };
  return next;
}
const lowQ = shop.deriveKpis(BASE);
const highQ = shop.deriveKpis(qualityUp());
assert.ok(highQ.quality > lowQ.quality, 'Listing 分数提高后质量分应上升');
assert.ok(highQ.visitors >= lowQ.visitors, 'Listing 提高后自然流量不应下降');

const cheaper = clone(BASE); cheaper.product.price = 12.99;
const pricier = clone(BASE); pricier.product.price = 22.99;
assert.ok(shop.deriveKpis(cheaper).conversion > shop.deriveKpis(pricier).conversion, '降价应提升转化率，涨价应降低转化率');
assert.ok(shop.deriveKpis(cheaper).naturalVisitors === shop.deriveKpis(pricier).naturalVisitors, '价格只影响转化，不应影响流量');

const betterRated = clone(BASE); betterRated.service.rating = 4.6;
assert.ok(shop.deriveKpis(betterRated).visitors > lowQ.visitors, '评分提高应带来更多自然流量');
assert.ok(shop.deriveKpis(betterRated).conversion > lowQ.conversion, '评分提高应提升转化率');

const bigBudget = clone(BASE); bigBudget.ads.dailyBudget = 200;
assert.ok(shop.deriveKpis(bigBudget).adSpend > lowQ.adSpend, '预算提高应增加广告花费');
assert.ok(shop.deriveKpis(bigBudget).acos > lowQ.acos, '预算提高、转化不变时应推高 ACOS');

const goodStructure = clone(BASE); goodStructure.ads.structureScore = 95;
assert.ok(shop.deriveKpis(goodStructure).paidOrders >= lowQ.paidOrders, '广告结构分提高不应减少付费订单');
assert.ok(shop.deriveKpis(goodStructure).acos <= lowQ.acos, '广告结构分提高不应推高 ACOS');

const stocked = clone(BASE); stocked.inventory.available = 400;
assert.ok(shop.deriveKpis(stocked).stockDays > lowQ.stockDays, '库存变多，覆盖天数应上升');
assert.ok(shop.deriveKpis(stocked).stockoutRisk < lowQ.stockoutRisk, '库存变多，断货风险应下降');
assert.ok(shop.deriveKpis(stocked).conversion > lowQ.conversion, '断货风险下降应改善转化');

// ===== 2. 校准不变量：初始快照 = 默认决策的推演 =====
const calibrated = shop.deriveKpis(BASE);
assert.strictEqual(BASE.metrics.visitors, calibrated.visitors, '初始快照访客必须等于推演结果');
assert.strictEqual(BASE.metrics.acos, calibrated.acos, '初始快照 ACOS 必须等于推演结果');
assert.strictEqual(BASE.metrics.stockDays, calibrated.stockDays, '初始快照库存水位必须等于推演结果');
assert.ok(Math.abs(BASE.metrics.sales - calibrated.sales) < 0.01, '初始快照销售额必须等于推演结果');

// ===== 3. 推演与模拟同源 =====
const noStockoutPressure = clone(BASE);
noStockoutPressure.inventory.available = 600;   // 库存充足，本周不会断货
const forecast = shop.deriveKpis(noStockoutPressure);
const settled = shop.simulateWeek(noStockoutPressure, { days: 7 }).settlement;
assert.strictEqual(settled.stockoutDays, 0, '该场景不应断货');
assert.strictEqual(settled.orders, forecast.orders, `推演与模拟的订单数必须一致：推演 ${forecast.orders} / 结算 ${settled.orders}`);
assert.ok(Math.abs(settled.acos - forecast.acos) < 0.06, `推演与模拟的 ACOS 必须一致：推演 ${forecast.acos} / 结算 ${settled.acos}`);
assert.ok(Math.abs(settled.sales - forecast.sales) < 0.02, '推演与模拟的销售额必须一致');
// 断货时模拟订单应少于推演，差额即丢单
const pressured = clone(BASE);
const pressuredSettlement = shop.simulateWeek(pressured, { days: 7 }).settlement;
assert.ok(pressuredSettlement.stockoutDays > 0, '默认库存下应当发生断货');
assert.ok(pressuredSettlement.orders < shop.deriveKpis(pressured).orders, '断货应导致实际订单少于推演需求');

// ===== 4. 操作约束 =====
assert.strictEqual(shop.applyAction(BASE, 'not_exist').ok, false, '未知操作应被拒绝');

const noPoints = clone(BASE);
noPoints.actionPoints = { total: 1, used: 1 };
assert.strictEqual(shop.applyAction(noPoints, 'listing_title').ok, false, '行动点用尽应被拒绝');
assert.ok(shop.planAction(noPoints, 'listing_title').reason.indexOf('行动点不足') >= 0);

const noCash = clone(BASE);
noCash.finance.cash = 50;
assert.strictEqual(shop.applyAction(noCash, 'cost_negotiate').ok, false, '现金不足应被拒绝');
assert.ok(shop.planAction(noCash, 'cost_negotiate').reason.indexOf('现金不足') >= 0);

const adsOff = clone(BASE);
adsOff.ads.enabled = false;
assert.strictEqual(shop.applyAction(adsOff, 'ads_scale').ok, false, '广告未开启时不应允许调整预算');
assert.strictEqual(shop.applyAction(adsOff, 'ads_enable').ok, true, '广告未开启时应允许开启');

const limited = clone(BASE);
let applied = 0;
for (let i = 0; i < 5; i += 1) {
  const result = shop.applyAction(limited, 'ads_bid_down');
  if (result.ok) { applied += 1; limited.ads = result.next.ads; limited.actionPoints = result.next.actionPoints; limited.decisions = result.next.decisions; limited.finance = result.next.finance; }
}
assert.strictEqual(applied, 4, 'ads_bid_down 的每周上限应为 4 次');

// 补货必须真实扣现金、记在途、排到仓日
const reorder = shop.applyAction(BASE, 'inv_reorder_local');
assert.strictEqual(reorder.ok, true);
assert.strictEqual(reorder.next.inventory.inTransit, BASE.inventory.inTransit + 150);
assert.strictEqual(reorder.next.inventory.shipments.length, 1);
assert.strictEqual(reorder.next.inventory.shipments[0].arrivalDay, 3, '本地仓加急应为 3 天到仓');
assert.ok(reorder.costCNY > 0 && reorder.next.finance.cash === BASE.finance.cash - reorder.costCNY, '补货必须扣现金');
assert.ok(reorder.kpis.stockDays > shop.deriveKpis(BASE).stockDays, '补货下单后推演的库存覆盖应上升');

// applyAction 不修改入参
const frozen = clone(BASE);
shop.applyAction(frozen, 'listing_title');
assert.deepStrictEqual(frozen, BASE, 'applyAction 不得修改入参');

// ===== 5. 任务可达性：默认 2/6，12 点全用尽可达 6/6 =====
function evaluate(shopState) {
  const settlement = shop.simulateWeek(shopState, { days: 7 }).settlement;
  const rows = tasks.evaluateTasks(shopState.weeklyTasks, settlement, shopState);
  return { settlement, rows, done: tasks.countCompleted(rows) };
}

const baseline = evaluate(BASE);
assert.strictEqual(baseline.done, 2, `默认决策应只达成 2 项任务，实际 ${baseline.done}`);
assert.ok(baseline.settlement.decision.score < 60, `默认决策分应低于 60，实际 ${baseline.settlement.decision.score}`);
assert.strictEqual(baseline.settlement.decision.level, '待改进');

// 完整解：3 项 Listing + 压预算 + 本地仓加急 + 3 次工单 + 4 次售后回访 = 12 行动点
const SOLUTION = [
  'listing_title', 'listing_image', 'listing_bullet',
  'ads_trim',
  'inv_reorder_local',
  'svc_ticket', 'svc_ticket', 'svc_ticket',
  'svc_recover', 'svc_recover', 'svc_recover', 'svc_recover',
];
let solved = clone(BASE);
SOLUTION.forEach(id => {
  const result = shop.applyAction(solved, id);
  assert.strictEqual(result.ok, true, `完整解中的 ${id} 应可执行：${result.reason}`);
  solved = result.next;
});
assert.strictEqual(solved.actionPoints.used, solved.actionPoints.total, '完整解应恰好用尽 12 点行动点');
const solvedResult = evaluate(solved);
assert.strictEqual(solvedResult.done, 6, `完整解应达成 6 项任务，实际 ${solvedResult.done}：${solvedResult.rows.filter(r => !r.completed).map(r => r.title).join('、')}`);
assert.ok(solvedResult.settlement.decision.score >= 80, `完整解的决策分应达到 80 以上，实际 ${solvedResult.settlement.decision.score}`);
assert.strictEqual(solvedResult.settlement.decision.level, '优秀');
// 12 点预算下必然要取舍：跟本周任务挂钩的三个维度必须补起来，商品力允许留到下周
['traffic', 'stock', 'service'].forEach(key => {
  const row = solvedResult.settlement.decision.rows.find(item => item.key === key);
  assert.ok(row && row.score >= 70, `完整解中「${key}」维度应达到 70 分以上，实际 ${row && row.score}`);
});
assert.ok(solvedResult.settlement.decision.weak.length <= 1, '完整解最多只应剩 1 个待补强维度（一周预算内的取舍）');
// 完整解必须能覆盖「广告效率」的可计入条件
const solvedAd = solvedResult.rows.find(r => r.id === 'ad_efficiency');
assert.ok(solvedAd.adSpend > 0 && solvedAd.paidOrders >= solvedAd.minPaidOrders, '广告效率任务必须建立在真实投放之上');

// ===== 6. 决策评分与红线 =====
const redlines = shop.findRedlines({ endingCash: -100, stockoutDays: 3 });
assert.strictEqual(redlines.length, 2, '期末现金为负 + 断货超过 2 天应命中两条红线');
assert.strictEqual(shop.findRedlines({ endingCash: 5000, stockoutDays: 2 }).length, 0, '现金为正且断货 2 天不应触发红线');

const noAdsScore = shop.scoreDecisions(adsOff, { ...baseline.settlement, adSpend: 0, acos: 0, paidOrders: 0 });
assert.strictEqual(noAdsScore.rows.find(r => r.key === 'traffic').score, 45, '没有广告花费时流量效率分应为基准 45，不得因 ACOS=0 而得高分');

const settlementWithRedline = { ...solvedResult.settlement, endingCash: -1 };
const evidence = shop.buildSettlementEvidence(solved, settlementWithRedline);
assert.strictEqual(evidence.complianceErrors, 1, '触发红线应写入 1 条合规问题');
const evidenceClean = shop.buildSettlementEvidence(solved, solvedResult.settlement);
assert.strictEqual(evidenceClean.complianceErrors, 0);
assert.ok(evidenceClean.dimensions.length >= 4, '完整解应覆盖至少 4 个能力维度');
assert.ok(evidenceClean.transfer > 0.8 && evidenceClean.transfer <= 1, '决策分应折算成 0~1 的迁移证据');
assert.ok(evidenceClean.knowledge > 0 && evidenceClean.knowledge <= 1);
assert.deepStrictEqual(evidenceClean.redlines, []);

// 合规封顶：带了合规问题，能力分不得超过 60
const capped = learning.recordEvidence(null, { ...evidence, dimensions: ['listing'], knowledge: 1, transfer: 1, reflection: 1, efficiency: 1, complianceErrors: 1 });
assert.strictEqual(learning.summarizeAbility(capped).list[0].score, 60, '合规问题应把该维度评分封顶到 60');

// ===== 7. 状态层：结算写入能力证据与学习事件 =====
global.wx = { ...global.wx, getStorageSync: () => storage, setStorageSync: (key, value) => { storage = JSON.parse(JSON.stringify(value)); } };
storage = null;
state.init();
let live = clone(state.SHOP_DEFAULT);
SOLUTION.forEach(id => {
  const result = state.applyShopAction(id);
  assert.strictEqual(result.ok, true, `状态层执行 ${id} 应成功：${result.reason}`);
});
live = state.getShopState();
state.updateShopState({ weekSimulation: shop.createSimulationState(live, { days: 7 }) }, 'test_start');
const liveSimulation = state.getShopState().weekSimulation;
while (liveSimulation.day < 7) {
  const advanced = shop.simulateDay(liveSimulation);
  liveSimulation.day = advanced.simulation.day;
  liveSimulation.snapshots = advanced.simulation.snapshots;
  liveSimulation.metrics = advanced.simulation.metrics;
  liveSimulation.inventory = advanced.simulation.inventory;
  liveSimulation.finance = advanced.simulation.finance;
  liveSimulation.events = advanced.simulation.events;
}
const liveSettlement = shop.calculateWeekSettlement(liveSimulation, state.getShopState());
const coinsBefore = state.get().coins;
state.saveShopSettlement(liveSettlement);
const abilityAfter = state.getAbility();
assert.ok(abilityAfter && abilityAfter.records.length === 1, '结算后应有 1 条能力记录');
assert.ok(abilityAfter.dims.ads && abilityAfter.dims.ads.attempts === 1, '应写入广告维度证据');
assert.ok(state.get().coins > coinsBefore, '达成任务应发放金币');
assert.strictEqual(state.getShopState().weeks, 1, '结算后经营周数应 +1');
assert.ok(state.get().learningEvents.some(e => e.type === 'shop_week_settled'), '应写入店铺结算学习事件');
assert.strictEqual(state.getShopState().settlementHistory.length, 1, '应写入一条经营周趋势');

// 重复保存不重复发奖励
const coinsAfterFirst = state.get().coins;
state.saveShopSettlement(liveSettlement);
assert.strictEqual(state.get().coins, coinsAfterFirst, '同一周重复锁定不应重复发放金币');

// ===== 8. 页面冒烟：六页子模块 + 模拟 + 结算全部能跑通 onShow =====
function loadPage(relative) {
  const target = path.join(__dirname, '..', relative);
  let captured = null;
  global.Page = obj => { captured = obj; };
  delete require.cache[require.resolve(target)];
  require(target);
  return captured;
}

function makeInstance(pageDef) {
  const instance = Object.assign({}, pageDef);
  instance.data = clone(pageDef.data || {});
  instance.setData = function setData(patch, cb) {
    Object.keys(patch || {}).forEach(key => { instance.data[key] = patch[key]; });
    if (typeof cb === 'function') cb();
  };
  return instance;
}

const PAGES = [
  { file: 'miniprogram/pages/shop/shop.js', key: 'kpiTiles', min: 6 },
  { file: 'miniprogram/pages/shop-dashboard/shop-dashboard.js', key: 'decisionRows', min: 5 },
  { file: 'miniprogram/pages/shop-listing/shop-listing.js', key: 'actions', min: 3 },
  { file: 'miniprogram/pages/shop-ads/shop-ads.js', key: 'actions', min: 5 },
  { file: 'miniprogram/pages/shop-inventory/shop-inventory.js', key: 'actions', min: 4 },
  { file: 'miniprogram/pages/shop-orders/shop-orders.js', key: 'actions', min: 3 },
  { file: 'miniprogram/pages/shop-health/shop-health.js', key: 'rows', min: 5 },
  { file: 'miniprogram/pages/shop-simulation/shop-simulation.js', key: 'frozenAt', min: 0 },
  { file: 'miniprogram/pages/shop-settlement/shop-settlement.js', key: 'settlement', min: 0 },
];

PAGES.forEach(entry => {
  const def = loadPage(entry.file);
  assert.ok(def && typeof def.onShow === 'function', `${entry.file} 应导出带 onShow 的页面`);
  const instance = makeInstance(def);
  if (typeof instance.onLoad === 'function') instance.onLoad.call(instance);
  instance.onShow.call(instance);
  const value = instance.data[entry.key];
  if (entry.min > 0) {
    assert.ok(Array.isArray(value) ? value.length >= entry.min : value !== undefined && value !== null,
      `${entry.file} 的 ${entry.key} 应有内容（要求 ≥ ${entry.min}）`);
  }
});

// 模块页面的操作按钮应禁用态正确：行动点耗尽后所有按钮都不该可点
const listingDef = loadPage('miniprogram/pages/shop-listing/shop-listing.js');
const listingInstance = makeInstance(listingDef);
state.updateShopState({ actionPoints: { total: 12, used: 12 } }, 'test_exhaust');
listingInstance.onShow.call(listingInstance);
assert.ok(listingInstance.data.actions.every(action => action.available === false), '行动点耗尽后所有操作都应显示为不可用');
assert.ok(listingInstance.data.actions[0].reason.indexOf('行动点不足') >= 0, '不可用原因应写明行动点不足');

console.log('shop decisions tests passed');
