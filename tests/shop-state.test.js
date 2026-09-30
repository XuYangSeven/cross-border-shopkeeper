const assert = require('assert');
const state = require('../miniprogram/engine/state');
const shopEngine = require('../miniprogram/engine/shop');

let storage;
global.wx = { getStorageSync: () => storage, setStorageSync: (key, value) => { storage = JSON.parse(JSON.stringify(value)); } };
state.init();

const initial = state.getShopState();
assert.strictEqual(initial.mode, 'save');
assert.strictEqual(initial.inventory.available, 70);

// 校准不变量：初始快照必须等于默认决策的经营推演结果
const kpis = shopEngine.deriveKpis(state.SHOP_DEFAULT);
assert.strictEqual(initial.metrics.visitors, kpis.visitors, '初始快照访客应与推演一致');
assert.ok(Math.abs(initial.metrics.sales - kpis.sales) < 0.01, '初始快照销售额应与推演一致');
assert.strictEqual(initial.metrics.acos, kpis.acos, '初始快照 ACOS 应与推演一致');
assert.strictEqual(initial.metrics.stockDays, kpis.stockDays, '初始快照库存水位应与推演一致');

// 经营决策：行动点预算、计数、现金扣减
assert.deepStrictEqual(state.getShopActionPoints(), { total: 12, used: 0, remaining: 12 });
const before = state.getShopState().finance.cash;
const ok = state.applyShopAction('listing_image');
assert.strictEqual(ok.ok, true);
assert.strictEqual(state.getShopState().decisions.listing_image, 1);
assert.strictEqual(state.getShopActionPoints().used, 1);
assert.strictEqual(state.getShopState().finance.cash, before - 120, '主图改造应扣 ¥120');
assert.strictEqual(state.getShopActionLog().length, 1);

// 次数上限：listing_image 每周最多 3 次
state.applyShopAction('listing_image');
state.applyShopAction('listing_image');
const blocked = state.applyShopAction('listing_image');
assert.strictEqual(blocked.ok, false);
assert.ok(blocked.reason.indexOf('次数已用完') >= 0, `超限应给出明确原因，实际：${blocked.reason}`);

// 前置条件：广告未开启时不能放量（先关掉广告）
state.updateShopState({ ads: { ...state.getShopState().ads, enabled: false } }, 'test_disable_ads');
const gated = state.applyShopAction('ads_scale');
assert.strictEqual(gated.ok, false);
assert.ok(gated.reason.indexOf('开启广告') >= 0, `前置条件应给出明确原因，实际：${gated.reason}`);

// 只读校验不产生副作用
const logBefore = state.getShopActionLog().length;
state.planShopAction('listing_title');
assert.strictEqual(state.getShopActionLog().length, logBefore, 'planShopAction 不应写日志');

// 练习模式与正式存档隔离
state.setShopMode('practice');
state.updateShopState({ metrics: { ...state.getShopState().metrics, acos: 60 } }, 'practice_update');
assert.strictEqual(state.getShopState().metrics.acos, 60);

// 重置本周：回到不变量状态，但保留已累积的周数
state.resetShopWeek();
assert.strictEqual(state.getShopState().metrics.acos, kpis.acos);
assert.strictEqual(state.getShopState().metrics.visitors, kpis.visitors);
assert.deepStrictEqual(state.getShopActionPoints(), { total: 12, used: 0, remaining: 12 });
assert.deepStrictEqual(state.getShopState().decisions, {}, '重置后操作计数应清空');
assert.strictEqual(state.getShopActionLog().length, 0);

console.log('shop state tests passed');
