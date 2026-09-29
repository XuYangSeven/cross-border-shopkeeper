// 全局常量配置（对应《商品库与数值配置.md》2.1/2.4 节）
module.exports = {
  // 汇率
  FX_RATE: 6.8,            // USD -> CNY
  // 平台费率
  COMMISSION_RATE: 0.15,   // 销售佣金
  RETURN_LOSS_RATE: 0.05,  // 退货损耗
  FX_LOSS_RATE: 0.01,      // 汇损
  // 现金流
  PAYOUT_CYCLE_DAYS: 14,   // 回款周期
  // 健康目标线（结算评分用，对应 2.4 节）
  HEALTH_TARGETS: {
    grossMargin: 0.30,     // 毛利率 ≥30%
    acos: 0.30,            // ACOS ≤30%
    conversion: 0.10,      // 转化率 ≥10%
    turnoverDays: 60,      // 库存周转 ≤60 天
    shopRating: 4.5,       // 店铺评分 ≥4.5
  },
  // 评分与星数（对应 4.3 节）
  SCORE_WEIGHTS: { objective: 0.6, efficiency: 0.25, quiz: 0.15 },
  STAR_THRESHOLDS: [85, 70, 60], // 三星/两星/一星分数线
  // 金币奖励（对应 5 节）
  COIN_REWARD: { 3: 30, 2: 20, 1: 10 },
  HINT_COST: 50,
  // 初始资金
  INITIAL_FUND_CNY: 34000, // $5,000
  // 等级体系（对应主策划案 5.1 节）
  LEVEL_TITLES: [
    { lv: 1, title: '运营助理' },
    { lv: 11, title: '运营专员' },
    { lv: 26, title: '运营主管' },
    { lv: 46, title: '店长' },
  ],
};
