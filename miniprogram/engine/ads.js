function round(value, digits) {
  const p = Math.pow(10, digits || 2);
  return Math.round(value * p) / p;
}

function calcMetrics({ impressions = 0, clicks = 0, spend = 0, orders = 0, priceUSD = 0 }) {
  const sales = orders * priceUSD;
  return {
    impressions: Math.round(impressions), clicks: Math.round(clicks), spend: round(spend), orders: Math.round(orders), sales: round(sales),
    ctr: impressions ? round(clicks / impressions, 4) : 0,
    cpc: clicks ? round(spend / clicks) : 0,
    cvr: clicks ? round(orders / clicks, 4) : 0,
    acos: sales ? round(spend / sales, 4) : 0,
    roas: spend ? round(sales / spend) : 0,
  };
}

function simulateDay({ budget = 0, bid = 0, ctr = 0, cvr = 0, cpc, placementMultiplier = 1, quality = 1, priceUSD = 29.99 }) {
  const effectiveCpc = cpc || Math.max(0.01, bid / Math.max(0.5, quality));
  const spend = Math.min(Math.max(0, budget), Math.max(0, budget) * placementMultiplier);
  const clicks = Math.floor(spend / effectiveCpc);
  const impressions = ctr ? Math.floor(clicks / ctr) : 0;
  const orders = Math.floor(clicks * cvr);
  return calcMetrics({ impressions, clicks, spend: clicks * effectiveCpc, orders, priceUSD });
}

function simulateCampaign({ days = [], budget = 100, priceUSD = 29.99 } = {}) {
  const plan = Array.isArray(days) ? days : [];
  let remaining = budget;
  const daily = plan.map(day => {
    const result = simulateDay({ ...day, budget: Math.min(Number(day.budget || remaining), remaining), priceUSD });
    remaining = round(remaining - result.spend);
    return result;
  });
  const totals = daily.reduce((acc, item) => ({
    impressions: acc.impressions + item.impressions, clicks: acc.clicks + item.clicks, spend: acc.spend + item.spend, orders: acc.orders + item.orders, sales: acc.sales + item.sales,
  }), { impressions: 0, clicks: 0, spend: 0, orders: 0, sales: 0 });
  return { days: daily, budget, remaining: round(remaining), ...calcMetrics({ ...totals, priceUSD }) };
}

module.exports = { calcMetrics, simulateDay, simulateCampaign };
