const assert = require('assert');
const finance = require('../miniprogram/engine/finance');
const chapter8 = require('../miniprogram/config/levels/chapter8');

const cash = finance.calculateCashFlow(chapter8[0].steps[0].data);
assert.strictEqual(cash.bookAssets, 38400);
assert.strictEqual(cash.availableCash, 13800);
assert.strictEqual(cash.safeCashAfterExpenses, 20600);
assert.strictEqual(cash.shortfall, 0);

const breakEven = finance.calculateBreakEvenPrice(chapter8[1].steps[0].data);
assert.strictEqual(breakEven, 50.5);
assert.strictEqual(finance.evaluatePricingPlan({ priceUSD: 15.99, expectedOrders: 145, costPerUnitUSD: 9.32, targetMargin: 0.30 }).meetsTarget, true);
assert.strictEqual(finance.evaluatePricingPlan({ priceUSD: 12.99, expectedOrders: 190, costPerUnitUSD: 9.32, targetMargin: 0.30 }).meetsTarget, false);

const purchase = chapter8[3].steps[0];
assert.strictEqual(finance.evaluatePurchasePlan({ ...purchase.options[0], ...purchase.data }).valid, true);
assert.strictEqual(finance.evaluatePurchasePlan({ ...purchase.options[1], ...purchase.data }).valid, false);

const boss = chapter8[5].steps[0];
const result = finance.evaluateFinanceBoss({ ...boss.data, targets: boss.targets });
assert.strictEqual(result.passed, true);
assert.strictEqual(result.totalBudget, 16000);
assert.strictEqual(finance.evaluateFinanceBoss({ ...boss.data, advertising: 10000, targets: boss.targets }).passed, false);
console.log('finance tests passed');
