function money(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name || '金额'}必须是非负数字`);
  return Math.round(n * 100) / 100;
}

function calculateCashFlow({ accountBalance, pendingReceivable, inTransitValue, sellableInventoryCost, shortTermExpenses }) {
  const account = money(accountBalance, '账户余额');
  const receivable = money(pendingReceivable, '待回款');
  const transit = money(inTransitValue, '在途货值');
  const inventory = money(sellableInventoryCost, '库存成本');
  const expenses = money(shortTermExpenses, '短期支出');
  return {
    bookAssets: Math.round((account + receivable + transit + inventory) * 100) / 100,
    availableCash: Math.round((account - expenses) * 100) / 100,
    safeCashAfterExpenses: Math.round((account + receivable - expenses) * 100) / 100,
    shortfall: Math.max(0, Math.round((expenses - account) * 100) / 100),
  };
}

function calculateBreakEvenPrice({ supplyCNY, freightCNY, fulfillmentUSD, returnRate, fxLossRate, commissionRate, fxRate }) {
  const supply = money(supplyCNY, '采购成本');
  const freight = money(freightCNY, '头程成本');
  const fulfillment = money(fulfillmentUSD, '仓配费用') * Number(fxRate);
  const fixed = supply + freight + fulfillment;
  const variableRate = Number(returnRate) + Number(fxLossRate) + Number(commissionRate);
  if (!Number.isFinite(variableRate) || variableRate < 0 || variableRate >= 1) throw new Error('费用比例无效');
  return Math.round(fixed / (1 - variableRate) * 100) / 100;
}

function evaluatePricingPlan({ priceUSD, expectedOrders, costPerUnitUSD, targetMargin }) {
  const price = money(priceUSD, '售价');
  const orders = money(expectedOrders, '预计订单');
  const cost = money(costPerUnitUSD, '单位成本');
  const margin = price ? Math.round((price - cost) / price * 10000) / 10000 : 0;
  return {
    priceUSD: price,
    expectedOrders: orders,
    salesUSD: Math.round(price * orders * 100) / 100,
    profitUSD: Math.round((price - cost) * orders * 100) / 100,
    margin,
    meetsTarget: margin >= Number(targetMargin),
  };
}

function evaluatePurchasePlan({ units, unitPriceCNY, dailySales, availableCash, leadTimeDays, cycleDays, safetyDays }) {
  const quantity = money(units, '采购数量');
  const unit = money(unitPriceCNY, '采购单价');
  const sales = money(dailySales, '日销量');
  const cash = money(availableCash, '可用资金');
  const coverageDays = sales ? Math.floor(quantity / sales) : 0;
  const cashUsed = Math.round(quantity * unit * 100) / 100;
  const cashOk = cashUsed <= cash;
  const stockOk = coverageDays >= Number(leadTimeDays) + Number(safetyDays) && coverageDays <= Number(cycleDays) * 2;
  return { units: quantity, cashUsed, coverageDays, cashOk, stockOk, valid: cashOk && stockOk };
}

function evaluateFinanceBoss({ budget, purchase, advertising, logistics, reserve, endingCash, margin, coverageDays, targets }) {
  const total = money(purchase, '采购预算') + money(advertising, '广告预算') + money(logistics, '物流预算') + money(reserve, '售后预留金');
  const failures = [];
  if (total > Number(budget)) failures.push('总预算超支');
  if (Number(endingCash) < targets.minEndingCash) failures.push('期末现金低于安全余额');
  if (Number(margin) < targets.minMargin) failures.push('预计毛利率低于安全线');
  if (Number(coverageDays) < targets.minCoverageDays) failures.push('库存覆盖天数不足');
  if (Number(advertising) > Number(budget) * targets.maxAdBudgetRate) failures.push('广告预算占比过高');
  if (Number(reserve) < targets.minReserve) failures.push('售后预留金不足');
  return { totalBudget: Math.round(total * 100) / 100, failures, passed: failures.length === 0 };
}

module.exports = { calculateCashFlow, calculateBreakEvenPrice, evaluatePricingPlan, evaluatePurchasePlan, evaluateFinanceBoss };
