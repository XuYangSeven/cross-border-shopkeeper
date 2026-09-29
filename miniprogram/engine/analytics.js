function number(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name || '数值'}无效`);
  return n;
}

function percent(value) {
  return Math.round(value * 10000) / 100;
}

function calculateFunnel({ impressions, clicks, visitors, carts, orders, salesUSD, adSpendUSD }) {
  const values = { impressions, clicks, visitors, carts, orders };
  Object.keys(values).forEach(key => {
    const value = number(values[key], key);
    if (!Number.isInteger(value) || value < 0) throw new Error(`${key}必须是非负整数`);
    values[key] = value;
  });
  if (clicks > impressions || visitors > clicks || carts > visitors || orders > carts) throw new Error('漏斗数据顺序不合理');
  const sales = number(salesUSD, '销售额');
  const spend = number(adSpendUSD, '广告花费');
  return {
    ...values,
    salesUSD: sales,
    adSpendUSD: spend,
    ctr: impressions ? percent(clicks / impressions) : null,
    visitorRate: clicks ? percent(visitors / clicks) : null,
    cartRate: visitors ? percent(carts / visitors) : null,
    conversionRate: visitors ? percent(orders / visitors) : null,
    cartPaymentRate: carts ? percent(orders / carts) : null,
    averageOrderValue: orders ? Math.round(sales / orders * 100) / 100 : null,
    acos: sales ? percent(spend / sales) : null,
    roas: spend ? Math.round(sales / spend * 100) / 100 : null,
  };
}

function classifyMetric({ value, target, direction }) {
  const actual = number(value, '指标值');
  const goal = number(target, '目标值');
  const good = direction === 'higher' ? actual >= goal : actual <= goal;
  return { value: actual, target: goal, good, status: good ? '健康' : '需关注' };
}

function evaluateReview({ selections, items, targets }) {
  if (!selections || !Array.isArray(items) || !targets) throw new Error('复盘配置无效');
  const results = items.map(item => {
    const selected = selections[item.id];
    if (!selected) throw new Error(`复盘项未选择：${item.id}`);
    const option = item.options.find(entry => entry.id === selected);
    if (!option) throw new Error(`复盘选项无效：${selected}`);
    return { itemId: item.id, title: item.title, optionId: option.id, valid: !!option.valid, explanation: option.explanation, action: option.action };
  });
  const validCount = results.filter(item => item.valid).length;
  const passed = validCount >= targets.minValidCount;
  return { results, validCount, total: results.length, passed, score: Math.round(validCount / results.length * 100) };
}

module.exports = { calculateFunnel, classifyMetric, evaluateReview };
