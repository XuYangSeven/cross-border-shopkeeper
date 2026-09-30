// 头程运费表（对应《商品库与数值配置.md》2.2 节）
module.exports = {
  sea:    { key: 'sea',    name: '海运', pricePerKgCNY: 9,  days: 35, unlockChapter: 2 },
  air:    { key: 'air',    name: '空运', pricePerKgCNY: 30, days: 8,  unlockChapter: 5 },
  express:{ key: 'express',name: '快递', pricePerKgCNY: 45, days: 5,  unlockChapter: 5 },
  local:  { key: 'local',  name: '本地仓加急', pricePerKgCNY: 60, days: 3, unlockChapter: 5 },
};
