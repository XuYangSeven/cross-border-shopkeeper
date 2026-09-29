// 随机事件池（对应《商品库与数值配置.md》4.2 节，MVP 先实现带★标记 4 个）
module.exports = [
  { id: 'EVT_DELAY',      name: '物流延误',   weight: 20, unlockChapter: 2, mvp: true,
    desc: '在途库存延迟 7 天到货', tip: '安全库存的意义', icon: 'delay' },
  { id: 'EVT_PRICE_WAR',  name: '竞品降价',   weight: 20, unlockChapter: 2, mvp: true,
    desc: '该品转化率下降 15%（3 日）', tip: '价格战 vs 差异化', icon: 'pricecut' },
  { id: 'EVT_STOCK_WARN', name: '断货预警',   weight: 20, unlockChapter: 5, mvp: true,
    desc: '库存低于 10 天销量', tip: '补货计算', icon: 'stock' },
  { id: 'EVT_TREND',      name: '流量红利',   weight: 10, unlockChapter: 7,
    desc: '类目流量上涨 40%（7 日）', tip: '流量红利抢滩', icon: 'trend' },
  { id: 'EVT_BADREVIEW',  name: '差评轰炸',   weight: 15, unlockChapter: 6,
    desc: '店铺评分降 0.3，转化率降 8%', tip: '售后处理', icon: 'review' },
  { id: 'EVT_CLICKFRAUD', name: '恶意点击',   weight: 10, unlockChapter: 4,
    desc: '当日广告费翻倍且零产出', tip: '数据异常识别', icon: 'fraud' },
  { id: 'EVT_INFRINGE',   name: '侵权投诉',   weight: 5, unlockChapter: 8,
    desc: 'Listing 下架，资金冻结 30 日', tip: '知识产权合规', icon: 'law' },
  { id: 'EVT_FX',         name: '汇率波动',   weight: 10, unlockChapter: 8,
    desc: '汇损在 ±3% 内波动', tip: '换汇时机', icon: 'fx' },
];

// 触发规则（对应 4.1 节）
module.exports.RULES = {
  baseChance: 0.15,        // 基础概率 15%
  chapterScale: (ch) => Math.min(2.0, 1.0 + (ch - 2) * 0.2), // 难度系数
  cooldownDays: 30,        // 同类事件冷却
  safeWindowDays: 3,       // Boss 前后 3 日无事件
};
