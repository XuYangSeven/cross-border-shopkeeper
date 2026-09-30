// 全局常量配置（对应《商品库与数值配置.md》2.1/2.4 节）
module.exports = {
  // 版本号：包内单一来源（app.js 与存档 meta 都取这里）。
  // 必须与 package.json 的 version 一致，由 tests/version-consistency.test.js 锁定。
  APP_VERSION: '0.6.0-hints',
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
  // ===== 求助提示分级定价 =====
  // L1 免费是刻意的教育设计：提示系统的首要目的是降低「卡关即流失」，
  // 若第一级就收费，舍不得花金币的学生会继续卡着，反而放大了流失。
  // 真正的代价是「用了任何一级就失去本关零提示奖励」（见 NO_HINT_MULTIPLIER）。
  HINT_TIERS: [
    { tier: 1, key: 'idea', label: '思路', price: 0, desc: '这题在考什么、第一步做什么' },
    { tier: 2, key: 'clue', label: '线索', price: 30, desc: '关键公式，或该回看哪一章' },
    { tier: 3, key: 'answer', label: '解析', price: 80, desc: '正确答案与完整过程' },
  ],
  // 零提示通关加成：整关未使用任何提示时，通关金币 × 该系数。
  // 这是「省着用」的正向激励，比扣分惩罚求助更符合学习伦理——
  // 求助本身是好的学习行为，不该被罚，但它不该同时拿挑战奖励。
  NO_HINT_MULTIPLIER: 1.5,
  // 零提示连胜：连续第 N 关零提示通关，额外 +STREAK_BONUS_STEP×min(N, CAP) 金币。
  //
  // 参数是算出来的，不是拍的（全程 46 关、按三星 base 30 估算）：
  //   收入上限 ≈ 1380(base) + 690(零提示加成) + 675(连胜) = 2745
  //   每关都用线索提示 = 46 × 30 = 1380，恰好等于 base 总和
  // 即：一路靠线索提示通关的人刚好花光基础收益、攒不下钱；
  // 想有余钱就得少用提示。而解析（80）相当于两三关的收益，是明确的奢侈品。
  // 这样既让「求助」有真实分量，又不会紧缺到让学生不敢求助（L1 永远免费）。
  STREAK_BONUS_STEP: 5,
  STREAK_BONUS_CAP: 3,
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
