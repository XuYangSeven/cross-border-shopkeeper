const ads = require('./ads');

function round(value, digits) {
  const p = Math.pow(10, digits === undefined ? 2 : digits);
  return Math.round(value * p) / p;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSimulationState(shop, config) {
  const source = clone(shop);
  return {
    day: 0,
    ads: { ...source.ads, ...config.ads, enabled: true },
    inventory: { ...source.inventory, available: Number(source.inventory.available || 0), inTransit: Number(source.inventory.inTransit || 0) },
    finance: { ...source.finance, cash: Number(source.finance.cash || 0) },
    product: { ...source.product, price: Number(source.product.price || 16.99) },
    metrics: { impressions: 0, clicks: 0, orders: 0, sales: 0, adSpend: 0, stockoutDays: 0 },
    snapshots: [],
    events: [],
    config: { days: 7, ...config },
  };
}

function simulateDay(simulation) {
  if (simulation.day >= simulation.config.days) return { simulation: clone(simulation), done: true };
  const day = simulation.day + 1;
  const daily = ads.simulateDay({
    budget: simulation.ads.dailyBudget,
    bid: simulation.ads.bid,
    ctr: simulation.config.ctr,
    cvr: simulation.config.cvr,
    priceUSD: simulation.product.price,
    quality: simulation.config.quality,
  });
  const requestedOrders = Math.min(daily.orders, Math.floor(simulation.inventory.available));
  const stockout = requestedOrders < daily.orders;
  const soldUnits = requestedOrders;
  const arrival = simulation.config.shipment && simulation.config.shipment.arrivalDay === day ? simulation.config.shipment.units : 0;
  const available = Math.max(0, simulation.inventory.available + arrival - soldUnits);
  const cash = simulation.finance.cash + daily.sales - daily.spend;
  const next = clone(simulation);
  next.day = day;
  next.inventory.available = available;
  next.inventory.inTransit = Math.max(0, simulation.inventory.inTransit - arrival);
  next.finance.cash = round(cash);
  next.metrics.impressions += daily.impressions;
  next.metrics.clicks += daily.clicks;
  next.metrics.orders += soldUnits;
  next.metrics.sales = round(next.metrics.sales + soldUnits * simulation.product.price);
  next.metrics.adSpend = round(next.metrics.adSpend + daily.spend);
  if (stockout) next.metrics.stockoutDays += 1;
  next.snapshots.push({ day, impressions: daily.impressions, clicks: daily.clicks, orders: soldUnits, sales: round(soldUnits * simulation.product.price), adSpend: daily.spend, inventory: available, cash: next.finance.cash, stockout });
  if (arrival) next.events.push({ day, type: 'arrival', units: arrival });
  if (stockout) next.events.push({ day, type: 'stockout', units: daily.orders - soldUnits });
  return { simulation: next, done: day >= simulation.config.days, snapshot: next.snapshots[next.snapshots.length - 1] };
}

function simulateWeek(shop, config) {
  let simulation = createSimulationState(shop, config);
  while (simulation.day < simulation.config.days) simulation = simulateDay(simulation).simulation;
  return { simulation, settlement: calculateWeekSettlement(simulation) };
}

function calculateWeekSettlement(simulation) {
  const metrics = simulation.metrics;
  const sales = metrics.sales;
  const adSpend = metrics.adSpend;
  const ctr = metrics.impressions ? round(metrics.clicks / metrics.impressions * 100, 2) : 0;
  const cvr = metrics.clicks ? round(metrics.orders / metrics.clicks * 100, 2) : 0;
  const acos = sales ? round(adSpend / sales * 100, 2) : 0;
  const roas = adSpend ? round(sales / adSpend, 2) : 0;
  const estimatedProductCost = round(metrics.orders * 2.21);
  const profit = round(sales - adSpend - estimatedProductCost);
  let rating = '需改进';
  if (metrics.stockoutDays === 0 && acos <= 30 && simulation.finance.cash > 0 && profit > 0) rating = '优秀';
  else if (metrics.stockoutDays <= 1 && acos <= 40 && simulation.finance.cash >= 0) rating = '合格';
  return { days: simulation.day, impressions: metrics.impressions, clicks: metrics.clicks, orders: metrics.orders, sales, adSpend, ctr, cvr, acos, roas, stockoutDays: metrics.stockoutDays, endingInventory: simulation.inventory.available, endingCash: simulation.finance.cash, profit, rating, snapshots: simulation.snapshots, events: simulation.events };
}

module.exports = { createSimulationState, simulateDay, simulateWeek, calculateWeekSettlement };
