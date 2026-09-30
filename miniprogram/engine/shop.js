// 店铺经营引擎
// 职责：① 把「经营决策」推导成「预测指标」；② 执行带约束的店铺操作；③ 跑 7 日经营模拟并结算；④ 把结算转成决策评分与能力证据。
// 约束：纯函数，不依赖 wx，不读写存储，不修改入参，不使用随机数。

const ads = require('./ads');
const inventoryEngine = require('./inventory');

// ===== 通用工具 =====
function round(value, digits) {
  const p = Math.pow(10, digits === undefined ? 2 : digits);
  return Math.round(value * p) / p;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function number(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return fallback === undefined ? 0 : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readPath(target, path) {
  return String(path).split('.').reduce((acc, key) => (acc === undefined || acc === null ? undefined : acc[key]), target);
}

function writePath(target, path, value) {
  const keys = String(path).split('.');
  let node = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (!node[keys[i]] || typeof node[keys[i]] !== 'object' || Array.isArray(node[keys[i]])) node[keys[i]] = {};
    node = node[keys[i]];
  }
  node[keys[keys.length - 1]] = value;
  return target;
}

// ===== 经营模型（决策 → 预测指标）=====
// 全部参数集中在此：调数值不改逻辑，测试直接引用 MODEL 校验单调性。
const MODEL = {
  baseNaturalVisitors: 1700,          // 基准周自然访客
  listingWeight: { titleScore: 0.4, imageScore: 0.35, bulletScore: 0.25 },
  baseNaturalCvr: 0.030,              // Listing 质量最低时的自然转化率
  listingCvrGain: 0.030,              // Listing 质量拉满时的转化率增量
  referencePrice: 16.99,              // 定价基准（与商品默认价一致）
  priceElasticity: 1.2,               // 售价相对基准每涨 1%，转化降 1.2%
  referenceRating: 4.0,               // 评分基准
  ratingTrafficGain: 0.5,             // 评分每高 1 分，自然流量 +50%
  ratingCvrGain: 0.4,                 // 评分每高 1 分，转化 +40%
  adsStructureBase: 50,               // 广告结构基准分
  adsStructureMin: 0.85,              // 结构 0 分时的付费转化系数
  adsStructureMax: 1.15,              // 结构 100 分时的付费转化系数
  stockoutRiskDays: 14,               // 库存低于该覆盖天数开始产生断货风险
  stockoutCvrPenalty: 0.35,           // 断货风险拉满时最多损失 35% 转化
  unitCostUSD: 2.21,                  // 单件成本（¥15 ÷ 6.8）
  defaultDailySales: 18,              // 缺省日均需求（用于库存覆盖天数）
  daysPerWeek: 7,                     // 经营周长度（在途到仓覆盖折算用）
  stockoutRedlineDays: 2,             // 断货超过该天数视为经营红线
};

function listingQuality(shop) {
  const listing = (shop && shop.listing) || {};
  const w = MODEL.listingWeight;
  const raw = number(listing.titleScore) * w.titleScore
    + number(listing.imageScore) * w.imageScore
    + number(listing.bulletScore) * w.bulletScore;
  return clamp(raw / 100, 0, 1);
}

function ratingOf(shop) {
  return clamp(number((shop && shop.service || {}).rating, MODEL.referenceRating), 0, 5);
}

function adsStructureFactor(shop) {
  const structure = clamp(number((shop && shop.ads || {}).structureScore, MODEL.adsStructureBase), 0, 100);
  return MODEL.adsStructureMin + (MODEL.adsStructureMax - MODEL.adsStructureMin) * (structure / 100);
}

// 把当前决策推导成"这一周会怎样"，不写存储、不影响上周既成事实
// 关键约束：按「日」计算后再成周，与 7 日模拟完全同源，避免「推演说达标、结算说不达标」
function deriveKpis(shop) {
  const source = shop || {};
  const product = source.product || {};
  const adsCfg = source.ads || {};
  const inventory = source.inventory || {};

  const quality = listingQuality(source);
  const rating = ratingOf(source);
  const price = Math.max(0.01, number(product.price, MODEL.referencePrice));

  // 自然流量：Listing 质量 + 店铺评分（按日取整，与模拟一致）
  const trafficFactor = 0.55 + 0.45 * quality;
  const ratingTraffic = clamp(1 + (rating - MODEL.referenceRating) * MODEL.ratingTrafficGain, 0.6, 1.6);
  const naturalDailyVisitors = Math.max(0, Math.floor(MODEL.baseNaturalVisitors / 7 * trafficFactor * ratingTraffic));
  const naturalVisitors = naturalDailyVisitors * 7;

  // 转化率：Listing 质量 × 价格弹性 × 店铺评分
  const priceCvrFactor = Math.pow(MODEL.referencePrice / price, MODEL.priceElasticity);
  const ratingCvr = clamp(1 + (rating - MODEL.referenceRating) * MODEL.ratingCvrGain, 0.6, 1.6);
  const naturalCvrRaw = clamp((MODEL.baseNaturalCvr + MODEL.listingCvrGain * quality) * priceCvrFactor * ratingCvr, 0, 0.5);

  // 库存覆盖与断货风险：可售库存 + 本周能赶上的在途到仓量
  const available = Math.max(0, number(inventory.available));
  const dailySales = Math.max(1, number(inventory.dailySales, MODEL.defaultDailySales));
  const shipments = Array.isArray(inventory.shipments) ? inventory.shipments : [];
  const inTransitCover = shipments.reduce((acc, item) => {
    const units = Math.max(0, number(item.units));
    const arrivalDay = clamp(number(item.arrivalDay, MODEL.daysPerWeek), 1, MODEL.daysPerWeek);
    const share = clamp((MODEL.daysPerWeek - arrivalDay + 1) / MODEL.daysPerWeek, 0, 1);
    return acc + units * share;
  }, 0);
  const coverUnits = available + inTransitCover;
  const stockDays = round(coverUnits / dailySales, 1);
  const stockoutRisk = clamp((MODEL.stockoutRiskDays - stockDays) / MODEL.stockoutRiskDays, 0, 1);
  const stockFactor = 1 - MODEL.stockoutCvrPenalty * stockoutRisk;

  const naturalCvr = naturalCvrRaw * stockFactor;

  // 付费流量：预算 ÷ 竞价；结构分影响付费转化
  const adsOn = adsCfg.enabled === true;
  const budgetPerDay = Math.max(0, number(adsCfg.dailyBudget));
  const bid = Math.max(0.01, number(adsCfg.bid, 0.65));
  const paidClicksPerDay = adsOn ? Math.floor(budgetPerDay / bid) : 0;
  const paidClicks = paidClicksPerDay * 7;
  const paidCvr = naturalCvr * adsStructureFactor(source);

  const naturalDailyOrders = Math.floor(naturalDailyVisitors * naturalCvr);
  const paidDailyOrders = Math.floor(paidClicksPerDay * paidCvr);
  const naturalOrders = naturalDailyOrders * 7;
  const paidOrders = paidDailyOrders * 7;
  const orders = naturalOrders + paidOrders;

  const adSpend = round(paidClicks * bid);
  const sales = round(orders * price);
  const visitors = naturalVisitors + paidClicks;
  const conversion = visitors ? round(orders / visitors * 100, 1) : 0;
  const acos = sales ? round(adSpend / sales * 100, 1) : 0;
  const roas = adSpend ? round(sales / adSpend, 2) : 0;

  const unitCost = number(product.unitCost, MODEL.unitCostUSD);
  const cogs = round(orders * unitCost);
  const grossProfit = round(sales - cogs);
  const netProfit = round(grossProfit - adSpend);
  const margin = sales ? round(grossProfit / sales * 100, 1) : 0;

  const notes = [
    { key: 'listing', text: `Listing 质量 ${Math.round(quality * 100)} 分 → 自然流量系数 ${round(trafficFactor, 2)}` },
    { key: 'rating', text: `店铺评分 ${rating} → 流量 ×${round(ratingTraffic, 2)}、转化 ×${round(ratingCvr, 2)}` },
    { key: 'price', text: Math.abs(price - MODEL.referencePrice) < 0.01 ? `定价 $${price} 等于基准价，转化不受价格影响` : `定价 $${price} 相对基准 $${MODEL.referencePrice} → 转化 ×${round(priceCvrFactor, 2)}` },
    { key: 'stock', text: stockoutRisk > 0 ? `可售 + 本周到仓够 ${stockDays} 天 → 断货风险 ${Math.round(stockoutRisk * 100)}%，转化 ×${round(stockFactor, 2)}` : `库存够卖 ${stockDays} 天，无断货风险` },
    { key: 'ads', text: adsOn ? `广告日预算 $${budgetPerDay}、竞价 $${bid} → 周点击 ${paidClicks}、花费 $${adSpend}` : '广告未投放，本周没有付费流量' },
  ];

  return {
    quality, rating, price, unitCost,
    naturalDailyVisitors, paidClicksPerDay,
    naturalVisitors, naturalOrders, naturalCvr: round(naturalCvr, 6),
    paidClicks, paidOrders, paidCvr: round(paidCvr, 6),
    visitors, conversion, orders, sales,
    adSpend, acos, roas,
    stockDays, stockoutRisk: round(stockoutRisk, 2), coverUnits: round(coverUnits, 1), inTransitCover: round(inTransitCover, 1),
    cogs, grossProfit, netProfit, margin,
    notes,
  };
}

// ===== 操作目录（每项操作都有代价、上限与前置条件）=====
// delta：数值增量；布尔值表示直接置位。bounds：[下限, 上限]。
// shipment：补货类操作，成本由运费表实算，货按交期到仓。
const ACTIONS = [
  // 商品力
  { id: 'listing_title', module: 'listing', label: '重写标题结构', desc: '品牌 + 核心词 + 关键属性 + 使用场景，可读性优先', costCNY: 0, points: 1, limit: 3, delta: { 'listing.titleScore': 9 }, bounds: { 'listing.titleScore': [0, 100] } },
  { id: 'listing_image', module: 'listing', label: '重做主图（白底 + 场景）', desc: '主图决定点击率，白底图与场景图搭配', costCNY: 120, points: 1, limit: 3, delta: { 'listing.imageScore': 10 }, bounds: { 'listing.imageScore': [0, 100] } },
  { id: 'listing_bullet', module: 'listing', label: '重写五点描述', desc: '每条一个卖点，写清使用场景与差异', costCNY: 0, points: 1, limit: 3, delta: { 'listing.bulletScore': 9 }, bounds: { 'listing.bulletScore': [0, 100] } },

  // 流量效率
  { id: 'ads_enable', module: 'ads', label: '开启广告投放', desc: '先用小预算测试，达标后再放量', costCNY: 0, points: 1, limit: 1, delta: { 'ads.enabled': true }, gate: { requiresAdsOff: true } },
  { id: 'ads_trim', module: 'ads', label: '下调日预算 $20', desc: 'ACOS 超标时最直接的止血动作', costCNY: 0, points: 1, limit: 4, delta: { 'ads.dailyBudget': -20 }, bounds: { 'ads.dailyBudget': [0, 400] }, gate: { requiresAdsOn: true } },
  { id: 'ads_scale', module: 'ads', label: '上调日预算 $15', desc: '放量前先确认 ACOS 已达标', costCNY: 0, points: 1, limit: 3, delta: { 'ads.dailyBudget': 15 }, bounds: { 'ads.dailyBudget': [0, 400] }, gate: { requiresAdsOn: true } },
  { id: 'ads_bid_down', module: 'ads', label: '下调竞价 $0.10', desc: '竞价过高会推高 CPC 与 ACOS', costCNY: 0, points: 1, limit: 4, delta: { 'ads.bid': -0.1 }, bounds: { 'ads.bid': [0.2, 5] }, gate: { requiresAdsOn: true } },
  { id: 'ads_structure', module: 'ads', label: '重构广告结构（词组分拆 + 否定词）', desc: '让预算花在会成交的词上，提升付费转化', costCNY: 0, points: 1, limit: 3, delta: { 'ads.structureScore': 12 }, bounds: { 'ads.structureScore': [0, 100] }, gate: { requiresAdsOn: true } },

  // 库存健康
  { id: 'inv_reorder_local', module: 'inventory', label: '本地仓加急补货 150 件（3 天到仓）', desc: '单价最高但到货最快，已经临断货时用它抢救', points: 1, limit: 2, shipment: { units: 150, weightKg: 0.5, freightKey: 'local' } },
  { id: 'inv_reorder_express', module: 'inventory', label: '快递补货 200 件（5 天到仓）', desc: '时效较快，但要留出需求爬升的余量', points: 1, limit: 2, shipment: { units: 200, weightKg: 0.5, freightKey: 'express' } },
  { id: 'inv_reorder_air', module: 'inventory', label: '空运补货 200 件（8 天到仓）', desc: '时效与成本折中；本周到不了仓', points: 1, limit: 2, shipment: { units: 200, weightKg: 0.5, freightKey: 'air' } },
  { id: 'inv_reorder_sea', module: 'inventory', label: '海运补货 400 件（35 天到仓）', desc: '单价最低，适合常规备货；本周到不了仓', points: 1, limit: 2, shipment: { units: 400, weightKg: 0.5, freightKey: 'sea' } },

  // 服务口碑
  { id: 'svc_ticket', module: 'orders', label: '加急处理待回复工单', desc: '提高解决率与及时响应率', costCNY: 0, points: 1, limit: 3, delta: { 'service.resolutionRate': 4, 'service.responseRate': 3 }, bounds: { 'service.resolutionRate': [0, 100], 'service.responseRate': [0, 100] } },
  { id: 'svc_recover', module: 'orders', label: '售后补偿 + 主动回访', desc: '成本 ¥200/次，直接提升店铺评分', costCNY: 200, points: 1, limit: 4, delta: { 'service.rating': 0.06, 'orders.refundRate': -0.4 }, bounds: { 'service.rating': [0, 5], 'orders.refundRate': [0, 100] } },
  { id: 'svc_training', module: 'orders', label: '客服话术培训', desc: '成本 ¥300/次，稳步提升评分与解决率', costCNY: 300, points: 1, limit: 3, delta: { 'service.rating': 0.04, 'service.resolutionRate': 1 }, bounds: { 'service.rating': [0, 5], 'service.resolutionRate': [0, 100] } },

  // 成本结构
  { id: 'cost_negotiate', module: 'dashboard', label: '与供应商重谈采购价', desc: '每次降低单件成本 $0.06', costCNY: 500, points: 1, limit: 3, delta: { 'product.unitCost': -0.06 }, bounds: { 'product.unitCost': [1.5, 20] } },
];

const ACTION_MAP = ACTIONS.reduce((acc, item) => { acc[item.id] = item; return acc; }, {});

function getAction(id) {
  return ACTION_MAP[id] || null;
}

// 操作成本：显式 costCNY 优先，补货类按运费表实算
function actionCost(action) {
  if (!action) return 0;
  if (action.shipment) {
    const info = inventoryEngine.calculateShipment({
      units: action.shipment.units,
      weightKg: action.shipment.weightKg,
      freightKey: action.shipment.freightKey,
    });
    return info.costCNY;
  }
  return number(action.costCNY, 0);
}

function actionsOfModule(module) {
  return ACTIONS.filter(item => item.module === module);
}

// 只返回可序列化的字段（供页面 setData 使用，不含函数）
function describeActions(shop, module) {
  const state = shop || {};
  const list = module ? actionsOfModule(module) : ACTIONS.slice();
  return list.map(action => {
    const plan = planAction(state, action.id);
    return {
      id: action.id,
      module: action.module,
      label: action.label,
      desc: action.desc,
      points: action.points,
      limit: action.limit,
      usedTimes: plan.usedTimes,
      remainingTimes: Math.max(0, action.limit - plan.usedTimes),
      costCNY: actionCost(action),
      gateText: plan.gateText || '',
      available: plan.ok,
      reason: plan.reason,
    };
  });
}

function gateOf(action, shop) {
  const gate = (action && action.gate) || {};
  const state = shop || {};
  const adsOn = (state.ads || {}).enabled === true;
  if (gate.requiresAdsOn && !adsOn) return { ok: false, reason: '需先开启广告投放', gateText: '需广告开启' };
  if (gate.requiresAdsOff && adsOn) return { ok: false, reason: '广告已处于开启状态', gateText: '广告已开启' };
  if (gate.minCashCNY && number((state.finance || {}).cash, 0) < gate.minCashCNY) return { ok: false, reason: `现金需不低于 ¥${gate.minCashCNY}`, gateText: `需现金 ¥${gate.minCashCNY}` };
  return { ok: true, reason: '', gateText: '' };
}

// 校验一项操作能否执行，不产生任何副作用
function planAction(shop, actionId) {
  const action = getAction(actionId);
  if (!action) return { ok: false, reason: '未知操作', action: null, usedTimes: 0, costCNY: 0, gateText: '' };
  const state = shop || {};
  const points = state.actionPoints || {};
  const total = number(points.total, 12);
  const used = number(points.used, 0);
  const usedTimes = number((state.decisions || {})[actionId], 0);
  const costCNY = actionCost(action);
  const gate = gateOf(action, state);
  const base = { action, usedTimes, costCNY, gateText: gate.gateText };

  if (gate.ok === false) return { ...base, ok: false, reason: gate.reason };
  if (usedTimes >= action.limit) return { ...base, ok: false, reason: `本周次数已用完（上限 ${action.limit} 次）` };
  if (used + action.points > total) return { ...base, ok: false, reason: `行动点不足（剩 ${Math.max(0, total - used)} 点，本操作需 ${action.points} 点）` };
  const cash = number((state.finance || {}).cash, 0);
  if (costCNY > cash) return { ...base, ok: false, reason: `现金不足（需 ¥${costCNY}，现有 ¥${round(cash)}）` };
  return { ...base, ok: true, reason: '', remainingPoints: total - used - action.points };
}

// 执行操作：返回 { ok, reason, next, action, kpis }
// next 是新的店铺状态（深拷贝，不修改入参）
function applyAction(shop, actionId) {
  const plan = planAction(shop, actionId);
  const base = shop || {};
  if (!plan.ok) return { ok: false, reason: plan.reason, action: plan.action, next: clone(base) };
  const action = plan.action;
  const next = clone(base);

  // 1) 数值增量
  Object.keys(action.delta || {}).forEach(path => {
    const raw = action.delta[path];
    const bound = (action.bounds || {})[path] || [null, null];
    let value;
    if (typeof raw === 'boolean') {
      value = raw;
    } else if (raw && typeof raw === 'object' && raw.op === 'set') {
      value = raw.value;
    } else {
      const current = number(readPath(next, path), 0);
      value = round(current + number(raw), 4);
      if (bound[0] !== null && bound[0] !== undefined) value = Math.max(number(bound[0]), value);
      if (bound[1] !== null && bound[1] !== undefined) value = Math.min(number(bound[1]), value);
    }
    writePath(next, path, value);
  });

  // 2) 补货：扣现金、记在途、排到仓日
  let shipmentNote = '';
  const costCNY = actionCost(action);
  if (action.shipment) {
    const info = inventoryEngine.calculateShipment({
      units: action.shipment.units,
      weightKg: action.shipment.weightKg,
      freightKey: action.shipment.freightKey,
    });
    const inv = next.inventory || (next.inventory = {});
    const shipments = Array.isArray(inv.shipments) ? inv.shipments.slice() : [];
    const arrivalDay = Math.max(1, Math.round(info.leadTimeDays));
    shipments.push({
      units: info.units,
      freightKey: info.freightKey,
      freightName: info.freightName,
      arrivalDay,
      costCNY: info.costCNY,
      placedAt: number(base.weeks, 0),
    });
    inv.shipments = shipments;
    inv.inTransit = number(inv.inTransit, 0) + info.units;
    shipmentNote = `${info.freightName} ${info.units} 件已下单，第 ${arrivalDay} 天到仓，运费 ¥${info.costCNY}`;
  }

  // 3) 扣现金、记次数与行动点
  if (costCNY > 0) {
    const finance = next.finance || (next.finance = {});
    finance.cash = round(number(finance.cash, 0) - costCNY, 2);
  }
  const decisions = next.decisions || (next.decisions = {});
  decisions[action.id] = number(decisions[action.id], 0) + 1;
  const points = next.actionPoints || (next.actionPoints = { total: 12, used: 0 });
  points.used = number(points.used, 0) + action.points;

  return {
    ok: true,
    reason: '',
    action,
    costCNY,
    shipmentNote,
    next,
    kpis: deriveKpis(next),
  };
}

// ===== 7 日经营模拟 =====
function createSimulationState(shop, config) {
  const source = clone(shop || {});
  const cfg = Object.assign({ days: 7 }, config || {});
  const kpis = deriveKpis(source);
  const adsCfg = Object.assign({}, source.ads || {}, cfg.ads || {});

  // 到仓排期：把补货单折成「第 N 天到货多少件」
  const arrivals = {};
  const shipments = ((source.inventory || {}).shipments || []);
  shipments.forEach(item => {
    const day = Math.max(1, Math.round(number(item.arrivalDay, 3)));
    arrivals[day] = number(arrivals[day], 0) + number(item.units, 0);
  });

  return {
    day: 0,
    ads: Object.assign({ dailyBudget: 0, bid: 0.65, enabled: false, structureScore: MODEL.adsStructureBase }, adsCfg),
    inventory: {
      available: Math.max(0, number((source.inventory || {}).available, 0)),
      inTransit: Math.max(0, number((source.inventory || {}).inTransit, 0)),
    },
    finance: { cash: number((source.finance || {}).cash, 0) },
    product: { price: number((source.product || {}).price, MODEL.referencePrice), unitCost: number((source.product || {}).unitCost, MODEL.unitCostUSD) },
    // 自然流量与转化由经营模型推导，保证「预测」与「模拟」同源
    model: {
      naturalDailyVisitors: kpis.naturalDailyVisitors,
      naturalCvr: kpis.naturalCvr,
      paidCvr: kpis.paidCvr,
    },
    arrivals,
    metrics: { impressions: 0, clicks: 0, orders: 0, sales: 0, adSpend: 0, cogs: 0, stockoutDays: 0, lostOrders: 0, naturalOrders: 0, paidOrders: 0 },
    snapshots: [],
    events: [],
    config: cfg,
  };
}

function simulateDay(simulation) {
  if (simulation.day >= simulation.config.days) return { simulation: clone(simulation), done: true };
  const day = simulation.day + 1;
  const cfg = simulation.config;
  const model = simulation.model || { naturalDailyVisitors: 0, naturalCvr: 0, paidCvr: 0 };
  const enabled = simulation.ads.enabled === true;

  const paid = enabled
    ? ads.simulateDay({
      budget: Math.max(0, number(simulation.ads.dailyBudget)),
      bid: Math.max(0.01, number(simulation.ads.bid, 0.65)),
      ctr: number(cfg.ctr, 0.03),
      cvr: number(cfg.cvr, model.paidCvr),
      priceUSD: simulation.product.price,
      quality: number(cfg.quality, 1),
    })
    : { impressions: 0, clicks: 0, spend: 0, orders: 0, sales: 0 };

  const naturalCvr = number(cfg.naturalCvr, model.naturalCvr);
  const naturalOrders = Math.floor(model.naturalDailyVisitors * naturalCvr);
  const paidOrders = Math.floor(paid.orders);
  const requestedOrders = naturalOrders + paidOrders;

  const stockAvailable = Math.floor(Math.max(0, simulation.inventory.available));
  const soldUnits = Math.min(requestedOrders, stockAvailable);
  const lostOrders = requestedOrders - soldUnits;
  const stockout = lostOrders > 0;

  const arrival = number((simulation.arrivals || {})[day], 0);
  const available = Math.max(0, simulation.inventory.available + arrival - soldUnits);
  const dailySales = round(soldUnits * simulation.product.price);
  const dailyCogs = round(soldUnits * simulation.product.unitCost);
  const cash = simulation.finance.cash + dailySales - paid.spend - dailyCogs;

  const next = clone(simulation);
  next.day = day;
  next.inventory.available = available;
  next.inventory.inTransit = Math.max(0, simulation.inventory.inTransit - arrival);
  next.finance.cash = round(cash);
  next.metrics.impressions += paid.impressions;
  next.metrics.clicks += paid.clicks;
  next.metrics.orders += soldUnits;
  next.metrics.naturalOrders += soldUnits === 0 ? 0 : Math.min(soldUnits, naturalOrders);
  next.metrics.paidOrders += soldUnits === 0 ? 0 : Math.max(0, soldUnits - naturalOrders);
  next.metrics.sales = round(next.metrics.sales + dailySales);
  next.metrics.adSpend = round(next.metrics.adSpend + paid.spend);
  next.metrics.cogs = round(next.metrics.cogs + dailyCogs);
  if (stockout) next.metrics.stockoutDays += 1;
  next.metrics.lostOrders += lostOrders;
  next.snapshots.push({
    day, impressions: paid.impressions, clicks: paid.clicks, orders: soldUnits, sales: dailySales,
    adSpend: paid.spend, cogs: dailyCogs, inventory: available, cash: next.finance.cash, stockout, lostOrders,
  });
  if (arrival) next.events.push({ day, type: 'arrival', units: arrival });
  if (stockout) next.events.push({ day, type: 'stockout', units: lostOrders });
  return { simulation: next, done: day >= simulation.config.days, snapshot: next.snapshots[next.snapshots.length - 1] };
}

function simulateWeek(shop, config) {
  let simulation = createSimulationState(shop, config);
  while (simulation.day < simulation.config.days) simulation = simulateDay(simulation).simulation;
  return { simulation, settlement: calculateWeekSettlement(simulation, shop) };
}

function calculateWeekSettlement(simulation, shop) {
  const metrics = simulation.metrics;
  const sales = metrics.sales;
  const adSpend = metrics.adSpend;
  const ctr = metrics.impressions ? round(metrics.clicks / metrics.impressions * 100, 2) : 0;
  const cvr = metrics.clicks ? round(metrics.orders / metrics.clicks * 100, 2) : 0;
  const acos = sales ? round(adSpend / sales * 100, 2) : 0;
  const roas = adSpend ? round(sales / adSpend, 2) : 0;
  const cogs = metrics.cogs === undefined ? round(metrics.orders * MODEL.unitCostUSD) : round(metrics.cogs);
  const profit = round(sales - adSpend - cogs);
  const margin = sales ? round((sales - cogs) / sales * 100, 2) : 0;
  const days = simulation.day;

  let rating = '需改进';
  if (metrics.stockoutDays === 0 && acos <= 30 && simulation.finance.cash > 0 && profit > 0) rating = '优秀';
  else if (metrics.stockoutDays <= 1 && acos <= 40 && simulation.finance.cash >= 0) rating = '合格';

  const settlement = {
    days,
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    orders: metrics.orders,
    naturalOrders: metrics.naturalOrders || 0,
    paidOrders: metrics.paidOrders || 0,
    lostOrders: metrics.lostOrders || 0,
    sales,
    adSpend,
    cogs,
    ctr,
    cvr,
    acos,
    roas,
    margin,
    stockoutDays: metrics.stockoutDays,
    endingInventory: simulation.inventory.available,
    endingCash: simulation.finance.cash,
    profit,
    rating,
    snapshots: simulation.snapshots,
    events: simulation.events,
  };
  settlement.decision = scoreDecisions(shop, settlement);
  return settlement;
}

// ===== 决策评分（五个维度加权，输出可解释的行）=====
const DECISION_DIMENSIONS = [
  { key: 'product', label: '商品力', weight: 0.2, ability: 'listing' },
  { key: 'traffic', label: '流量效率', weight: 0.25, ability: 'ads' },
  { key: 'stock', label: '库存健康', weight: 0.25, ability: 'supply' },
  { key: 'service', label: '服务口碑', weight: 0.2, ability: 'service' },
  { key: 'cash', label: '资金安全', weight: 0.1, ability: 'finance' },
];

function masteryLevel(score) {
  if (score >= 85) return '优秀';
  if (score >= 70) return '合格';
  if (score >= 60) return '及格';
  return '待改进';
}

function scoreDecisions(shop, settlement) {
  const s = shop || {};
  const st = settlement || {};
  const kpis = deriveKpis(s);
  const service = s.service || {};

  // 商品力：Listing 质量
  const productScore = Math.round(kpis.quality * 100);

  // 流量效率：必须真实投放才有分，避免「不投广告 ACOS=0」白送
  const adSpend = number(st.adSpend, kpis.adSpend);
  const acos = number(st.acos, kpis.acos);
  let trafficScore = 45;
  let trafficAdvice = '本周没有产生广告花费，无法评估投放效率；开广告后才有付费流量';
  if (adSpend > 0) {
    if (acos <= 20) trafficScore = 100;
    else if (acos <= 30) trafficScore = 88;
    else if (acos <= 35) trafficScore = 76;
    else if (acos <= 45) trafficScore = 58;
    else if (acos <= 60) trafficScore = 40;
    else trafficScore = 25;
    trafficAdvice = trafficScore >= 76 ? 'ACOS 在健康区间，可考虑逐步放量' : 'ACOS 偏高，优先下调预算或竞价止血';
  }

  // 库存健康：断货天数 + 期末库存
  const stockoutDays = number(st.stockoutDays, 0);
  const endingInventory = number(st.endingInventory, kpis.stockDays);
  let stockScore = 100;
  if (stockoutDays >= 3) stockScore = 25;
  else if (stockoutDays === 2) stockScore = 55;
  else if (stockoutDays === 1) stockScore = 78;
  if (endingInventory <= 0) stockScore = Math.min(stockScore, 40);
  else if (endingInventory < 20) stockScore = Math.min(stockScore, 70);
  const stockAdvice = stockScore >= 85 ? '库存节奏健康，无断货' : (stockoutDays > 0 ? '发生断货，说明补货交期没有算进备货计划' : '期末库存偏低，下周有断货风险');

  // 服务口碑：解决率 + 评分
  const resolution = number(service.resolutionRate, 0);
  const rating = number(service.rating, 0);
  const serviceScore = Math.round(clamp(
    clamp((resolution - 60) / 35, 0, 1) * 0.6 + clamp((rating - 3.5) / 0.8, 0, 1) * 0.4,
    0, 1,
  ) * 100);
  const serviceAdvice = serviceScore >= 85 ? '解决率与评分双高' : (resolution < 90 ? '解决率未到 90，去订单模块加急处理工单' : '评分偏低，做售后回访或话术培训');

  // 资金安全：期末现金
  const cash = number((s.finance || {}).cash, 0);
  let cashScore;
  if (cash < 0) cashScore = 0;
  else if (cash < 2000) cashScore = 45;
  else if (cash < 5000) cashScore = 70;
  else if (cash < 12000) cashScore = 88;
  else cashScore = 100;
  const cashAdvice = cashScore >= 88 ? '现金储备充足' : (cash < 0 ? '现金已为负，属于经营红线' : '现金偏紧，谨慎安排采购与广告预算');

  const scoreOf = { product: productScore, traffic: trafficScore, stock: stockScore, service: serviceScore, cash: cashScore };
  const adviceOf = { product: productScore >= 80 ? 'Listing 质量良好' : '标题 / 主图 / 五点还有优化空间，去 Listing 模块', traffic: trafficAdvice, stock: stockAdvice, service: serviceAdvice, cash: cashAdvice };

  const rows = DECISION_DIMENSIONS.map(dim => ({
    key: dim.key,
    label: dim.label,
    ability: dim.ability,
    weight: dim.weight,
    score: scoreOf[dim.key],
    advice: adviceOf[dim.key],
  }));
  const score = Math.round(rows.reduce((acc, row) => acc + row.score * row.weight, 0));
  const weak = rows.filter(row => row.score < 70).map(row => row.label);

  return {
    rows,
    score,
    level: masteryLevel(score),
    weak,
    allGood: weak.length === 0,
    summary: weak.length === 0
      ? `决策结构完整，综合 ${score} 分，可以尝试放量或优化边际指标。`
      : `综合 ${score} 分，待补强：${weak.join('、')}。`,
  };
}

// ===== 结算 → 能力证据（回写教学闭环）=====
const REDLINE_LABEL = { cash: '期末现金为负', stockout: '断货超过 2 天' };

function findRedlines(settlement) {
  const st = settlement || {};
  const list = [];
  if (number(st.endingCash, 0) < 0) list.push(REDLINE_LABEL.cash);
  if (number(st.stockoutDays, 0) > MODEL.stockoutRedlineDays) list.push(REDLINE_LABEL.stockout);
  return list;
}

function buildSettlementEvidence(shop, settlement) {
  const decision = (settlement && settlement.decision) || scoreDecisions(shop, settlement);
  const rows = decision.rows || [];
  const covered = rows.filter(row => row.score >= 60).length;
  const strong = rows.filter(row => row.score >= 75).length;
  const total = rows.length || 1;
  const cashRow = rows.find(row => row.key === 'cash');
  const redlines = findRedlines(settlement);

  return {
    levelId: `shop-week-${number(shop && shop.weeks, 0) + 1}`,
    chapter: 0,
    dimensions: rows.filter(row => row.score >= 55).map(row => row.ability).filter(Boolean),
    knowledge: covered / total,
    transfer: decision.score / 100,
    reflection: strong / total,
    efficiency: (cashRow ? cashRow.score : 70) / 100,
    complianceErrors: redlines.length,
    redlines,
    decisionScore: decision.score,
    decisionLevel: decision.level,
    weak: decision.weak,
    at: Date.now(),
  };
}

module.exports = {
  MODEL, ACTIONS, DECISION_DIMENSIONS,
  listingQuality, deriveKpis,
  getAction, actionsOfModule, actionCost, describeActions, planAction, applyAction,
  createSimulationState, simulateDay, simulateWeek, calculateWeekSettlement,
  scoreDecisions, masteryLevel, findRedlines, buildSettlementEvidence,
};
