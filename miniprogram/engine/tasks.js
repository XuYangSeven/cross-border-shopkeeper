const TASKS = [
  { id: 'ad_efficiency', title: '广告效率', description: '将本周 ACOS 控制在 35% 以内', target: 35, unit: '%', metric: 'acos', direction: 'lte', module: 'ads' },
  { id: 'inventory_stability', title: '库存稳定', description: '本周保持不断货', target: 0, unit: '天', metric: 'stockoutDays', direction: 'eq', module: 'inventory' },
  { id: 'sales_growth', title: '销售增长', description: '本周完成至少 10 笔订单', target: 10, unit: '单', metric: 'orders', direction: 'gte', module: 'dashboard' },
  { id: 'service_quality', title: '服务质量', description: '解决率达到 90% 且评分达到 4.3', target: 90, unit: '%', metric: 'resolutionRate', ratingTarget: 4.3, direction: 'service', module: 'orders' },
  { id: 'profit_operation', title: '利润经营', description: '本周保持盈利', target: 0, unit: '美元', metric: 'profit', direction: 'gt', module: 'dashboard' },
  { id: 'cash_safety', title: '现金安全', description: '期末现金不少于 ¥3,000', target: 3000, unit: '元', metric: 'endingCash', direction: 'gte', module: 'dashboard' },
];

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function createTasks() {
  return TASKS.map(task => ({ ...task, status: '未开始', current: 0, completed: false }));
}

function evaluateTask(task, settlement, shop) {
  const source = settlement || {};
  let current = Number(source[task.metric] || 0);
  let completed = false;
  if (task.direction === 'lte') completed = current > 0 && current <= task.target;
  if (task.direction === 'eq') completed = current === task.target;
  if (task.direction === 'gte') completed = current >= task.target;
  if (task.direction === 'gt') completed = current > task.target;
  if (task.direction === 'service') {
    current = Number(shop && shop.service && shop.service.resolutionRate || 0);
    completed = current >= task.target && Number(shop.service.rating || 0) >= task.ratingTarget;
  }
  return { ...task, current, status: completed ? '已完成' : (settlement ? '未完成' : '进行中'), completed };
}

function evaluateTasks(tasks, settlement, shop) {
  return (tasks && tasks.length ? tasks : createTasks()).map(task => evaluateTask(task, settlement, shop));
}

function countCompleted(tasks) { return tasks.filter(task => task.completed).length; }

function calculateReward(tasks) {
  const count = countCompleted(tasks);
  return { coins: count * 10 + (count === tasks.length ? 50 : 0), exp: count * 5 + (count === tasks.length ? 20 : 0) };
}

function summarize(tasks, settlement) {
  const completed = countCompleted(tasks);
  return { completed, total: tasks.length, allCompleted: completed === tasks.length, rating: settlement ? settlement.rating : '进行中', reward: calculateReward(tasks) };
}

module.exports = { TASKS: clone(TASKS), createTasks, evaluateTask, evaluateTasks, countCompleted, calculateReward, summarize };
