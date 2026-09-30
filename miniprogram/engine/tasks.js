// 本周经营任务引擎
// 职责：把「经营结果」对照 6 项目标判定达成，输出进度、差距、奖励与复盘结论。
// 设计约束：
//   ① 每项任务都必须「可达成」——目标值经过 shop-decisions.test.js 的完整解回放验证；
//   ② 不允许白送——广告效率必须真实投放并产生订单才计入，避免「不投广告 ACOS=0」直接达标；
//   ③ 实时阶段用经营推演（engine/shop.deriveKpis）估算，结算阶段用真实结果锁定。

const shopEngine = require('./shop');

const TASKS = [
  {
    id: 'ad_efficiency', title: '广告效率', description: 'ACOS ≤ 35% 且广告带来至少 5 单',
    chapter: 4, cardId: 'K4-01',
    target: 35, unit: '%', metric: 'acos', direction: 'acos_healthy', minPaidOrders: 5,
    module: 'ads', targetPage: '/pages/shop-ads/shop-ads',
    advice: 'ACOS 超标时先下调预算或竞价止血；预算压到没有订单也不算达标。',
  },
  {
    id: 'inventory_stability', title: '库存稳定', description: '本周零断货',
    chapter: 5, cardId: 'K5-03',
    target: 0, unit: '天', metric: 'stockoutDays', direction: 'eq',
    module: 'inventory', targetPage: '/pages/shop-inventory/shop-inventory',
    advice: '按「日需求 × 交期」倒推补货时点；交期超过一周的方式救不了本周。',
  },
  {
    id: 'sales_growth', title: '销售增长', description: '本周完成至少 100 笔订单',
    chapter: 1, cardId: 'K1-01',
    target: 100, unit: '单', metric: 'orders', direction: 'gte',
    module: 'listing', targetPage: '/pages/shop-listing/shop-listing',
    advice: '订单 = 访客 × 转化率。Listing 提升转化，广告提升访客，两者要一起做。',
  },
  {
    id: 'service_quality', title: '服务质量', description: '解决率 ≥ 90% 且评分 ≥ 4.3',
    chapter: 6, cardId: 'K6-04',
    target: 90, unit: '%', metric: 'resolutionRate', ratingTarget: 4.3, direction: 'service',
    module: 'orders', targetPage: '/pages/shop-orders/shop-orders',
    advice: '加急处理工单拉解决率，售后回访与话术培训拉评分，两个指标都要动。',
  },
  {
    id: 'profit_operation', title: '利润经营', description: '本周利润为正',
    chapter: 8, cardId: 'K8-02',
    target: 0, unit: '美元', metric: 'profit', direction: 'gt',
    module: 'dashboard', targetPage: '/pages/shop-dashboard/shop-dashboard',
    advice: '利润 = 销售额 − 广告费 − 货品成本；打折冲量前先算每单还剩多少。',
  },
  {
    id: 'cash_safety', title: '现金安全', description: '期末现金不少于 ¥3,000',
    chapter: 8, cardId: 'K8-01',
    target: 3000, unit: '元', metric: 'endingCash', direction: 'gte',
    module: 'dashboard', targetPage: '/pages/shop-dashboard/shop-dashboard',
    advice: '补货与售后补偿都要花现金，给下周留足周转。',
  },
];

// 推演口径下的字段别名：经营推演的键名与结算键名不完全一致
const FORECAST_ALIAS = { profit: 'netProfit', endingCash: 'cash' };

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function createTasks() {
  return TASKS.map(task => ({ ...task, status: '未开始', current: null, gap: null, completed: false, locked: false }));
}

function findTask(taskId) {
  return TASKS.find(item => item.id === taskId) || null;
}

// 以结算结果为准；实时阶段回退到店铺经营推演
// 推演缺字段（如「本周断货天数」）时补一次轻量周模拟，避免实时进度显示为「未开始」
const PROJECTION_CACHE = new WeakMap();

function projectionOf(shop) {
  if (!shop || typeof shop !== 'object') return null;
  if (PROJECTION_CACHE.has(shop)) return PROJECTION_CACHE.get(shop);
  let projected = null;
  try {
    projected = shopEngine.simulateWeek(shop, { days: 7 }).settlement;
  } catch (e) {
    projected = null;
  }
  PROJECTION_CACHE.set(shop, projected);
  return projected;
}

function resolveSource(task, settlement, shop) {
  if (settlement) return { source: settlement, live: false };
  if (!shop) return { source: null, live: true };

  // 实时阶段以「当前决策的经营推演」为准，保证改一次决策任务进度立刻跟着动
  const forecast = shopEngine.deriveKpis(shop);
  const key = FORECAST_ALIAS[task.metric] || task.metric;
  if (key === 'cash') {
    const cash = Number((shop.finance || {}).cash);
    if (Number.isFinite(cash)) return { source: { endingCash: cash }, live: true };
  }
  if (forecast[key] !== undefined && forecast[key] !== null) return { source: forecast, live: true };

  // 推演没有的字段（如「本周断货天数」）补一次轻量周模拟
  const projected = projectionOf(shop);
  if (projected && projected[task.metric] !== undefined && projected[task.metric] !== null) {
    return { source: projected, live: true };
  }

  // 最后才回退到上一周的既成快照
  const snapshot = shop.metrics || {};
  if (snapshot[task.metric] !== undefined && snapshot[task.metric] !== null) return { source: snapshot, live: true };
  return { source: null, live: true };
}

function sourceValue(task, settlement, shop) {
  if (task.direction === 'service') {
    const service = (shop && shop.service) || {};
    if (settlement && settlement.service) {
      return { current: settlement.service.resolutionRate, rating: settlement.service.rating };
    }
    if (service.resolutionRate === undefined && service.rating === undefined) return null;
    return { current: service.resolutionRate, rating: service.rating };
  }
  const { source } = resolveSource(task, settlement, shop);
  if (!source) return null;
  const raw = source[task.metric];
  if (raw === undefined || raw === null || Number.isNaN(Number(raw))) return null;
  if (task.direction === 'acos_healthy') {
    return {
      current: Number(raw),
      adSpend: Number(source.adSpend || 0),
      paidOrders: Number(source.paidOrders || 0),
    };
  }
  return { current: Number(raw) };
}

function evaluateTaskProgress(task, state, phase) {
  const shop = state && (state.shop || state.shopState || state);
  const settlement = state && state.settlement;
  const locked = phase === 'settlement';
  const value = sourceValue(task, locked ? settlement : null, shop);
  if (!value || value.current === undefined || value.current === null || Number.isNaN(Number(value.current))) {
    return { ...task, current: null, gap: null, status: '未开始', completed: false, locked: false, note: '' };
  }

  const current = Number(value.current);
  let completed = false;
  let note = '';

  if (task.direction === 'lte') completed = current <= task.target;
  if (task.direction === 'eq') completed = current === task.target;
  if (task.direction === 'gte') completed = current >= task.target;
  if (task.direction === 'gt') completed = current > task.target;
  if (task.direction === 'service') completed = current >= task.target && Number(value.rating) >= task.ratingTarget;
  if (task.direction === 'acos_healthy') {
    const tested = Number(value.adSpend) > 0 && Number(value.paidOrders) >= Number(task.minPaidOrders || 0);
    completed = tested && current <= task.target;
    if (!tested) note = `广告需产生至少 ${task.minPaidOrders} 单才能计入效率`;
  }

  let gap;
  if (task.direction === 'lte' || task.direction === 'acos_healthy') gap = Math.max(0, current - task.target);
  else if (task.direction === 'eq') gap = Math.abs(current - task.target);
  else gap = Math.max(0, task.target - current);
  if (task.direction === 'service') gap = Math.max(0, task.target - current, task.ratingTarget - Number(value.rating || 0));

  const status = locked
    ? (completed ? '已锁定' : (task.direction === 'acos_healthy' && note ? '未计入' : '未完成'))
    : (completed ? '已完成' : '进行中');

  return {
    ...task,
    current,
    rating: value.rating,
    adSpend: value.adSpend,
    paidOrders: value.paidOrders,
    gap: Math.round(gap * 100) / 100,
    status,
    completed,
    locked,
    note,
  };
}

function evaluateTask(task, settlement, shop) {
  return evaluateTaskProgress(task, { settlement, shop }, settlement ? 'settlement' : 'realtime');
}

function evaluateWeeklyTasks(tasks, state, phase) {
  return (tasks && tasks.length ? tasks : createTasks()).map(task => evaluateTaskProgress(task, state, phase || 'realtime'));
}

function evaluateTasks(tasks, settlement, shop) {
  return evaluateWeeklyTasks(tasks, { settlement, shop }, settlement ? 'settlement' : 'realtime');
}

function countCompleted(tasks) { return (tasks || []).filter(task => task.completed).length; }

function calculateReward(tasks) {
  const list = tasks || [];
  const count = countCompleted(list);
  const allDone = count === list.length && count > 0;
  return { coins: count * 10 + (allDone ? 50 : 0), exp: count * 10 + (allDone ? 50 : 0) };
}

function summarizeTaskSettlement(results) {
  const list = results || [];
  const completed = countCompleted(list);
  const failed = list.filter(task => !task.completed);
  return {
    completed,
    total: list.length,
    allCompleted: completed === list.length && list.length > 0,
    reward: calculateReward(list),
    review: completed === list.length && list.length > 0
      ? `本周 ${list.length} 项任务全部达成，经营节奏稳定。`
      : `本周完成 ${completed}/${list.length} 项。待处理：${failed.map(task => task.title).join('、')}。`,
  };
}

function summarize(tasks, settlement) {
  return { ...summarizeTaskSettlement(tasks), rating: settlement ? settlement.rating : '进行中' };
}

function getTaskTargetPage(taskId) {
  const task = findTask(taskId);
  return task ? task.targetPage : '/pages/shop/shop';
}

module.exports = {
  TASKS: clone(TASKS), createTasks, findTask,
  evaluateTask, evaluateTaskProgress, evaluateTasks, evaluateWeeklyTasks,
  countCompleted, calculateReward, summarize, summarizeTaskSettlement, getTaskTargetPage,
};
