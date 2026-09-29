// 利润引擎（对应《商品库与数值配置.md》第 1 节派生计算公式）
const CONSTANTS = require('../config/constants');
const FREIGHT = require('../config/freight');
const FBA_TIERS = require('../config/fbaTiers');

// 体积重 = 长×宽×高(cm) / 6000
function volumeWeight(dimCm) {
  return (dimCm[0] * dimCm[1] * dimCm[2]) / 6000;
}

// 计费重 = max(实重, 体积重)，保留 2 位
function chargeableWeight(sku) {
  return Math.max(sku.weightKg, volumeWeight(sku.dimCm));
}

// 仓配档位判定（按厚度+重量顺序取首个满足）
function fbaTier(sku) {
  const thickness = Math.min(...sku.dimCm);
  const volW = volumeWeight(sku.dimCm);
  const effWeight = Math.max(sku.weightKg, volW);
  for (const t of FBA_TIERS) {
    if (thickness <= t.maxThicknessCm && effWeight <= t.maxWeightKg) return t;
  }
  return FBA_TIERS[FBA_TIERS.length - 1];
}

// 头程运费（美元）
function headFreightUSD(sku, mode = 'sea') {
  const f = FREIGHT[mode] || FREIGHT.sea;
  const cny = chargeableWeight(sku) * f.pricePerKgCNY;
  return cny / CONSTANTS.FX_RATE;
}

// 完整利润核算
function calcProfit(sku, opts = {}) {
  const price = opts.priceUSD || sku.priceUSD;
  const supplyUSD = sku.supplyPriceCNY / CONSTANTS.FX_RATE;
  const freight = headFreightUSD(sku, opts.freightMode || 'sea');
  const tier = fbaTier(sku);
  const commission = price * CONSTANTS.COMMISSION_RATE;
  const returnLoss = price * CONSTANTS.RETURN_LOSS_RATE;
  const fxLoss = price * CONSTANTS.FX_LOSS_RATE;
  const cost = supplyUSD + freight + tier.feeUSD + commission + returnLoss + fxLoss;
  const profit = price - cost;
  const margin = profit / price;
  return {
    price, supplyUSD, freightUSD: round2(freight), fbaFeeUSD: tier.feeUSD, fbaTier: tier.key,
    commissionUSD: round2(commission), returnLossUSD: round2(returnLoss), fxLossUSD: round2(fxLoss),
    costUSD: round2(cost), profitUSD: round2(profit), margin: round4(margin),
    chargeableWeightKg: round2(chargeableWeight(sku)), volumeWeightKg: round2(volumeWeight(sku.dimCm)),
  };
}

// 五维加权总分
function weightedScore(expertScores, weights) {
  let total = 0;
  for (const [dim, w] of Object.entries(weights)) total += expertScores[dim] * w;
  return round2(total);
}

// 选品五维初筛判定（教学规则引擎）
// 规则：配置 tags 中的"显性陷阱"阻断初筛；trap_volumeweight（体积重）为隐性陷阱，
// 按教学设计允许通过初筛、在利润核算环节暴露（对应 MVP 关卡 2-2/2-3）
const BLOCKING_TRAPS = [
  'trap_battery', 'trap_liquid', 'trap_magnetic', 'trap_patent',
  'trap_season', 'trap_competition', 'trap_lowprice', 'trap_market', 'trap_fragile',
];
function screenSKU(sku) {
  const traps = sku.tags.filter(t => BLOCKING_TRAPS.includes(t));
  const profit = calcProfit(sku);
  return { pass: traps.length === 0, traps, margin: profit.margin };
}

function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }

module.exports = { volumeWeight, chargeableWeight, fbaTier, headFreightUSD, calcProfit, weightedScore, screenSKU };
