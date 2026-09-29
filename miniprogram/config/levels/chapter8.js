// 第 8 章：资金与经营决策（PawPal 宠物梳）
const choice = (id, text, explanation, valid, extra = {}) => ({ id, text, explanation, valid, ...extra });

const pricingPlans = [
  choice('regular', '原价 $16.99｜预计120单｜毛利率 45%', '利润率高，但销量增速一般。', true, { priceUSD: 16.99, expectedOrders: 120, costPerUnitUSD: 9.32 }),
  choice('light', '轻促销 $15.99｜预计145单｜利润与转化平衡', '在利润红线以上提高转化，适合作为测试方案。', true, { priceUSD: 15.99, expectedOrders: 145, costPerUnitUSD: 9.32 }),
  choice('deep', '深度促销 $12.99｜预计190单｜低于利润安全线', '订单更多但固定成本占比过高，利润率跌破30%。', false, { priceUSD: 12.99, expectedOrders: 190, costPerUnitUSD: 9.32 }),
];
const purchasePlans = [
  choice('100', '采购100件｜¥16/件｜资金占用¥1600｜约33天', '资金压力低，但补货频率较高。', true, { units: 100, unitPriceCNY: 16 }),
  choice('300', '采购300件｜¥14/件｜资金占用¥4200｜约100天', '单价低但超过周期，容易造成库存积压。', false, { units: 300, unitPriceCNY: 14 }),
  choice('500', '采购500件｜¥13/件｜资金占用¥6500｜约166天', '现金占用和积压风险都过高。', false, { units: 500, unitPriceCNY: 13 }),
];
const riskItems = [
  { id: 'cash', title: '可用现金低于安全线', options: [choice('cash-save', '暂停低效广告并保留售后预留金', '先保护现金流，避免经营中断。', true), choice('cash-more', '继续加大所有广告预算', '会进一步放大现金压力。', false)] },
  { id: 'stock', title: '库存只够8天', options: [choice('stock-reorder', '核对补货点并安排可控时效的补货', '断货风险优先级高于素材测试。', true), choice('stock-discount', '先做深度折扣清库存', '可能让低库存更快见底。', false)] },
  { id: 'refund', title: '退款率连续上升', options: [choice('refund-check', '按退款原因占比排查商品与页面', '先找原因，再制定可验证的改进。', true), choice('refund-hide', '隐藏退款数据', '隐藏数据无法改善体验。', false)] },
];
const bossTargets = { minEndingCash: 3000, minMargin: 0.30, minCoverageDays: 20, maxAdBudgetRate: 0.40, minReserve: 1000 };

module.exports = [
  { id: '8-1', chapter: 8, name: '资金盘点', type: 'practice', goal: '区分账面资产与可用现金', passScore: 70, steps: [{ type: 'cashFlowCalc', scenario: '根据 PawPal 当前资金情况，计算账面资产、可用现金和短期缺口。', data: { accountBalance: 18000, pendingReceivable: 6800, inTransitValue: 5100, sellableInventoryCost: 8500, shortTermExpenses: 4200 }, fields: [
    { key: 'bookAssets', label: '账面资产', answer: 38400, unit: '¥' }, { key: 'availableCash', label: '扣除7日支出后的可用现金', answer: 13800, unit: '¥' }, { key: 'safeCashAfterExpenses', label: '含待回款的安全余额', answer: 20600, unit: '¥' }, { key: 'shortfall', label: '短期资金缺口', answer: 0, unit: '¥' },
  ], tolerance: 0.01, reviewPrompt: '账面资产不等于今天能花的钱，先看可用现金再安排经营动作。' }] },
  { id: '8-2', chapter: 8, name: '费用与利润', type: 'practice', goal: '计算实际利润与盈亏平衡售价', passScore: 70, steps: [{ type: 'financeCalc', scenario: 'PawPal 宠物梳：采购¥15、头程¥3、仓配$3.22，汇率6.8，佣金15%、退货5%、汇损1%。', data: { supplyCNY: 15, freightCNY: 3, fulfillmentUSD: 3.22, returnRate: 0.05, fxLossRate: 0.01, commissionRate: 0.15, fxRate: 6.8 }, fields: [{ key: 'breakEvenPrice', label: '盈亏平衡售价', answer: 50.5, unit: '¥' }], tolerance: 0.1, reviewPrompt: '盈亏平衡价要把固定成本和按售价变化的比例费用一起考虑。' }] },
  { id: '8-3', chapter: 8, name: '定价与促销', type: 'practice', goal: '平衡订单增长与利润安全线', passScore: 70, steps: [{ type: 'pricingChoice', scenario: '选择既能提升转化、又不跌破30%利润红线的价格方案。', options: pricingPlans, targetMargin: 0.30, reviewPrompt: '订单最多不一定利润最高，先确认每单利润和总利润。' }] },
  { id: '8-4', chapter: 8, name: '采购批量决策', type: 'practice', goal: '平衡采购单价、资金占用和库存周期', passScore: 70, steps: [{ type: 'purchaseChoice', scenario: '可用采购资金¥5000，日销量3件，交期8天，安全库存5天，周期30天。', options: purchasePlans, data: { dailySales: 3, availableCash: 5000, leadTimeDays: 8, cycleDays: 30, safetyDays: 5 }, reviewPrompt: '首批采购要为现金流和补货留空间，不要只追求最低单价。' }] },
  { id: '8-5', chapter: 8, name: '经营风险控制', type: 'practice', goal: '按经营优先级处理资金、库存和售后风险', passScore: 70, steps: [{ type: 'riskChoice', scenario: '逐项处理 PawPal 当前经营风险。', items: riskItems, reviewPrompt: '先保护现金流和不断货，再处理可以延后的优化事项。' }] },
  { id: '8-6', chapter: 8, name: '店铺经营 Boss', type: 'boss', goal: '在有限资金下完成可持续经营方案', passScore: 80, steps: [{ type: 'financeBoss', scenario: '总可用预算¥20000，提交采购、广告、物流、售后预留和期末经营方案。', data: { budget: 20000, purchase: 6000, advertising: 4000, logistics: 4500, reserve: 1500, endingCash: 4000, margin: 0.34, coverageDays: 25 }, targets: bossTargets, fields: [
    { key: 'purchase', label: '采购预算', answer: 6000, unit: '¥' }, { key: 'advertising', label: '广告预算', answer: 4000, unit: '¥' }, { key: 'logistics', label: '物流预算', answer: 4500, unit: '¥' }, { key: 'reserve', label: '售后预留金', answer: 1500, unit: '¥' }, { key: 'endingCash', label: '期末现金', answer: 4000, unit: '¥' }, { key: 'margin', label: '预计毛利率', answer: 34, unit: '%' }, { key: 'coverageDays', label: '库存覆盖天数', answer: 25, unit: '天' },
  ], reviewPrompt: '经营方案必须同时满足预算、现金、利润、库存和售后安全线。' }] },
];
