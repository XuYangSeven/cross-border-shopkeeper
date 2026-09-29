const assert = require('assert');
const profit = require('../miniprogram/engine/profit');
const skus = require('../miniprogram/config/skus');

function answers(id) {
  const result = profit.calcProfit(skus.find(sku => sku.id === id));
  return [result.supplyUSD, result.freightUSD, result.fbaFeeUSD, result.commissionUSD, result.returnLossUSD + result.fxLossUSD, Math.round(result.margin * 100)];
}

function accepted(id, values) {
  const expected = answers(id);
  return expected.every((answer, i) => {
    const ok = i === expected.length - 1
      ? Math.abs(Number(values[i]) - answer) <= 3
      : Math.abs(Number(values[i]) - answer) <= Math.max(0.06, answer * 0.03);
    return ok;
  });
}

assert(accepted('SKU-004', answers('SKU-004')));
assert(accepted('SKU-010', answers('SKU-010')));
assert(!accepted('SKU-004', [0, 0, 0, 0, 0, 0]));
console.log('chapter 2 profit submit tests passed');
