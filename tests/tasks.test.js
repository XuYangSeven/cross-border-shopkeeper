const assert = require('assert');
const tasks = require('../miniprogram/engine/tasks');

// ===== 1. 结算阶段：六项全部达成的口径 =====
const goodSettlement = {
  acos: 32, adSpend: 480, paidOrders: 40,
  stockoutDays: 0, orders: 133, profit: 1337, endingCash: 15917,
};
const shop = { service: { resolutionRate: 92, rating: 4.4 }, metrics: {}, finance: { cash: 15917 }, inventory: { available: 87, dailySales: 15 } };
const done = tasks.evaluateTasks(tasks.createTasks(), goodSettlement, shop);
assert.strictEqual(done.length, 6);
assert.strictEqual(tasks.countCompleted(done), 6);
assert.strictEqual(tasks.summarize(done, goodSettlement).allCompleted, true);
assert.strictEqual(tasks.calculateReward(done).coins, 110);

// ===== 2. 广告效率不允许「不投广告白送」 =====
const noAds = { ...goodSettlement, acos: 0, adSpend: 0, paidOrders: 0 };
const adTask = tasks.evaluateTasks(tasks.createTasks(), noAds, shop).find(item => item.id === 'ad_efficiency');
assert.strictEqual(adTask.completed, false, '未产生广告花费时不得判定广告效率达标');
assert.strictEqual(adTask.status, '未计入');
assert.ok(adTask.note.indexOf('至少 5 单') >= 0);

// ACOS 达标但广告订单太少，同样不计入
const fewAds = { ...goodSettlement, acos: 20, adSpend: 300, paidOrders: 2 };
assert.strictEqual(tasks.evaluateTasks(tasks.createTasks(), fewAds, shop).find(item => item.id === 'ad_efficiency').completed, false);

// ===== 3. 服务任务必须两个指标同时达标 =====
const halfService = { ...goodSettlement };
const halfShop = { ...shop, service: { resolutionRate: 95, rating: 4.1 } };
const svcRows = tasks.evaluateTasks(tasks.createTasks(), halfService, halfShop);
assert.strictEqual(svcRows.find(item => item.id === 'service_quality').completed, false, '解决率高但评分未达标不得通过');
assert.strictEqual(svcRows.find(item => item.id === 'service_quality').rating, 4.1);

// ===== 4. 实时阶段：没有结算数据时回退到经营推演，不显示「未开始」 =====
const realtimeShop = {
  product: { price: 16.99, unitCost: 2.21 },
  listing: { titleScore: 58, imageScore: 55, bulletScore: 52 },
  ads: { dailyBudget: 110, bid: 0.65, enabled: true, structureScore: 50 },
  inventory: { available: 70, dailySales: 15, shipments: [], inTransit: 0 },
  service: { resolutionRate: 78, rating: 4.1 },
  finance: { cash: 20000 },
  metrics: {},
};
const live = tasks.evaluateWeeklyTasks(tasks.createTasks(), { shop: realtimeShop }, 'realtime');
const liveAd = live.find(item => item.id === 'ad_efficiency');
assert.ok(liveAd.current !== null, '实时阶段应拿到经营推演的 ACOS');
assert.ok(liveAd.current > 35, `默认决策的推演 ACOS 应超标，实际 ${liveAd.current}`);
assert.strictEqual(liveAd.completed, false);
const liveStock = live.find(item => item.id === 'inventory_stability');
assert.strictEqual(liveStock.current, 2, '默认库存会断货 2 天');

// ===== 5. 任务必须可定位到知识与模块，且不引用真实平台名 =====
const banned = /亚马逊|Amazon|Shopify|eBay|TikTok|沃尔玛|Walmart/i;
tasks.TASKS.forEach(task => {
  assert.ok(task.chapter >= 1 && task.chapter <= 8, `${task.id} 缺少章节归属`);
  assert.ok(task.cardId && task.cardId.indexOf(`K${task.chapter}-`) === 0, `${task.id} 的知识卡应与章节一致`);
  assert.ok(task.advice, `${task.id} 缺少改进建议`);
  assert.ok(task.targetPage.indexOf('/pages/shop') === 0, `${task.id} 的跳转目标应指向店铺子页`);
  assert.ok(!banned.test(task.title + task.description + task.advice), `${task.id} 出现真实平台名`);
});

// ===== 6. 复盘结论要说清未完成项 =====
const partial = tasks.evaluateTasks(tasks.createTasks(), noAds, shop);
const summary = tasks.summarize(partial, noAds);
assert.strictEqual(summary.allCompleted, false);
assert.ok(summary.review.indexOf('广告效率') >= 0, '复盘应点名未完成的任务');

console.log('tasks tests passed');
