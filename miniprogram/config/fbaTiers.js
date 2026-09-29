// A-仓配费用分档（对应《商品库与数值配置.md》2.3 节）
// 条件判断按顺序取第一个满足项
module.exports = [
  { key: 'small_standard',  name: '小标准件', maxWeightKg: 0.34, maxThicknessCm: 2.5, feeUSD: 3.22 },
  { key: 'large_standard',  name: '大标准件', maxWeightKg: 0.68, maxThicknessCm: 999, feeUSD: 4.13 },
  { key: 'oversize_1',      name: '超大件1',  maxWeightKg: 1.36, maxThicknessCm: 999, feeUSD: 5.08 },
  { key: 'oversize_2',      name: '超大件2',  maxWeightKg: 999,  maxThicknessCm: 999, feeUSD: 7.50 },
];
