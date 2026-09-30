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

// 教学样板要素：objectives / abilityDims / transfer / reflection（见 chapter3.js 顶部说明）
// 教学锚点：8-3（定价与利润红线）与 8-6（Boss）必须同时具备迁移题与结构化复述。
module.exports = [
  { id: '8-1', chapter: 8, name: '资金盘点', type: 'practice',
    goal: '区分账面资产与可用现金', passScore: 70,
    objectives: ['区分账面资产与真正能花的可用现金', '算出扣除短期支出后的可用现金与安全余额'],
    abilityDims: ['finance'],
    steps: [
      { type: 'dialog', speaker: 'Lisa 总', text: '经营决策的第一步不是看赚了多少，而是看手里有多少钱能动。' },
      { type: 'card', cardId: 'K8-01' },
      { type: 'cashFlowCalc', scenario: '根据 PawPal 当前资金情况，计算账面资产、可用现金和短期缺口。', data: { accountBalance: 18000, pendingReceivable: 6800, inTransitValue: 5100, sellableInventoryCost: 8500, shortTermExpenses: 4200 }, fields: [
    { key: 'bookAssets', label: '账面资产', answer: 38400, unit: '¥' }, { key: 'availableCash', label: '扣除7日支出后的可用现金', answer: 13800, unit: '¥' }, { key: 'safeCashAfterExpenses', label: '含待回款的安全余额', answer: 20600, unit: '¥' }, { key: 'shortfall', label: '短期资金缺口', answer: 0, unit: '¥' },
  ], tolerance: 0.01, reviewPrompt: '账面资产不等于今天能花的钱，先看可用现金再安排经营动作。' },
    ] },
  { id: '8-2', chapter: 8, name: '费用与利润', type: 'practice',
    goal: '计算实际利润与盈亏平衡售价', passScore: 70,
    objectives: ['算出盈亏平衡售价', '说出固定成本与比例费用在定价里的不同作用'],
    abilityDims: ['finance'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '定价不能靠感觉。先把盈亏平衡价算出来，你才知道自己有多少降价空间。' },
      { type: 'card', cardId: 'K8-02' },
      { type: 'financeCalc', scenario: 'PawPal 宠物梳：采购¥15、头程¥3、仓配$3.22，汇率6.8，佣金15%、退货5%、汇损1%。', data: { supplyCNY: 15, freightCNY: 3, fulfillmentUSD: 3.22, returnRate: 0.05, fxLossRate: 0.01, commissionRate: 0.15, fxRate: 6.8 }, fields: [{ key: 'breakEvenPrice', label: '盈亏平衡售价', answer: 50.5, unit: '¥' }], tolerance: 0.1, reviewPrompt: '盈亏平衡价要把固定成本和按售价变化的比例费用一起考虑。' },
    ] },
  { id: '8-3', chapter: 8, name: '定价与促销', type: 'practice',
    goal: '平衡订单增长与利润安全线', passScore: 70,
    objectives: ['算出每个价格方案的毛利率与总利润', '在 30% 利润红线以上选择能提转化的价格方案', '说出订单最多为什么不等于利润最高'],
    abilityDims: ['finance'],
    steps: [
      { type: 'dialog', speaker: 'Lisa 总', text: '促销要冲单量，但不能冲掉利润。红线记住：毛利率 30%。' },
      { type: 'card', cardId: 'K8-03' },
      { type: 'pricingChoice', scenario: '选择既能提升转化、又不跌破30%利润红线的价格方案。', options: pricingPlans, targetMargin: 0.30, reviewPrompt: '订单最多不一定利润最高，先确认每单利润和总利润。' },
      { type: 'transfer', scenario: '换一组价格方案（单位成本 $9.32、利润红线 30%），规则不变，重新判断。', questions: [
        { id: '8-3-t1', kind: 'number', question: '方案 A：售价 $17.99、预计 110 单。毛利率是多少（百分比，保留一位小数）？', answer: 48.2, tolerance: 1, unit: '%',
          explain: '毛利率 =（售价 − 单位成本）÷ 售价 =（17.99 − 9.32）÷ 17.99 ≈ 48.2%，远高于 30% 红线。' },
        { id: '8-3-t2', kind: 'number', question: '方案 A 的总利润是多少美元（四舍五入到整数）？', answer: 954, tolerance: 15, unit: '$',
          explain: '总利润 =（售价 − 单位成本）× 预计订单 =（17.99 − 9.32）× 110 = 8.67 × 110 = $953.7，约 $954。' },
        { id: '8-3-t3', kind: 'choice', question: '方案 B：售价 $13.99、预计 170 单、毛利率 33.4%；方案 C：售价 $12.49、预计 210 单、毛利率 25.4%。应该选哪个？', answer: 'A', options: [
          { key: 'A', text: '方案 B：订单增长且毛利率仍在 30% 红线以上' },
          { key: 'B', text: '方案 C：订单最多，薄利多销更划算' },
          { key: 'C', text: '方案 A：毛利率最高，一定最好' } ],
          explain: 'B 在保住利润红线的前提下换来更多订单，是最优平衡；C 已跌破 30% 红线属危险区间，费用一波动就亏；A 虽安全但主动放弃了可争取的订单增长。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用两句话说明你的定价判断（第一句给结论，第二句给数据依据）', fields: [
        { key: 'decision', label: '我选的方案是', placeholder: '例：方案 B，它在红线以上还能换来更多订单',
          keywords: [['方案b', 'b', '1399', '13.99'], ['33', '334', '红线', '30'], ['订单', '转化', '销量']], minHits: 1,
          sample: '我选方案 B：售价 $13.99、预计 170 单，因为它在 30% 利润红线以上还能换来更多订单。' },
        { key: 'evidence', label: '我依据的数据是', placeholder: '例：单位成本 $9.32，B 毛利率 33.4%，C 只有 25.4%',
          keywords: [['1399', '13.99'], ['33', '334'], ['30', '红线'], ['932', '9.32', '成本'], ['170', '订单'], ['254', '25.4']], minHits: 2,
          sample: '我依据的数据是单位成本 $9.32、方案 B 毛利率约 33.4% 仍高于 30% 红线、预计订单 170 单，而方案 C 只有 25.4% 已跌破红线。' },
      ], passScore: 2 },
    ] },
  { id: '8-4', chapter: 8, name: '采购批量决策', type: 'practice',
    goal: '平衡采购单价、资金占用和库存周期', passScore: 70,
    objectives: ['平衡采购单价、资金占用与库存覆盖天数', '为首批采购留出现金缓冲'],
    abilityDims: ['finance'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '采购单价越低越好？不一定。单价、资金占用、库存覆盖天数，三个约束要一起看。' },
      { type: 'card', cardId: 'K8-04' },
      { type: 'purchaseChoice', scenario: '可用采购资金¥5000，日销量3件，交期8天，安全库存5天，周期30天。', options: purchasePlans, data: { dailySales: 3, availableCash: 5000, leadTimeDays: 8, cycleDays: 30, safetyDays: 5 }, reviewPrompt: '首批采购要为现金流和补货留空间，不要只追求最低单价。' },
    ] },
  { id: '8-5', chapter: 8, name: '经营风险控制', type: 'practice',
    goal: '按经营优先级处理资金、库存和售后风险', passScore: 70,
    objectives: ['按经营优先级处理资金、库存与售后风险', '说出「先保现金流、先不断货」的理由'],
    abilityDims: ['finance'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '现金、库存、售后三面同时报警，先处理哪个？想清楚判断标准再动手。' },
      { type: 'card', cardId: 'K8-05' },
      { type: 'riskChoice', scenario: '逐项处理 PawPal 当前经营风险。', items: riskItems, reviewPrompt: '先保护现金流和不断货，再处理可以延后的优化事项。' },
    ] },
  { id: '8-6', chapter: 8, name: '店铺经营 Boss', type: 'boss',
    goal: '在有限资金下完成可持续经营方案', passScore: 80,
    objectives: ['在有限资金下做出可持续的经营方案', '让预算、现金、利润、库存、售后五条线同时达标', '说清每一项预算的分配依据'],
    abilityDims: ['finance'],
    steps: [
      { type: 'dialog', speaker: 'Lisa 总', text: '最后一次考试：¥20000 预算，一份能让店铺活下去的方案。五条安全线，一条都不能破。' },
      { type: 'card', cardId: 'K8-05' },
      { type: 'financeBoss', scenario: '总可用预算¥20000，提交采购、广告、物流、售后预留和期末经营方案。', data: { budget: 20000, purchase: 6000, advertising: 4000, logistics: 4500, reserve: 1500, endingCash: 4000, margin: 0.34, coverageDays: 25 }, targets: bossTargets, fields: [
    { key: 'purchase', label: '采购预算', answer: 6000, unit: '¥' }, { key: 'advertising', label: '广告预算', answer: 4000, unit: '¥' }, { key: 'logistics', label: '物流预算', answer: 4500, unit: '¥' }, { key: 'reserve', label: '售后预留金', answer: 1500, unit: '¥' }, { key: 'endingCash', label: '期末现金', answer: 4000, unit: '¥' }, { key: 'margin', label: '预计毛利率', answer: 34, unit: '%' }, { key: 'coverageDays', label: '库存覆盖天数', answer: 25, unit: '天' },
  ], reviewPrompt: '经营方案必须同时满足预算、现金、利润、库存和售后安全线。' },
      { type: 'transfer', scenario: '换一组经营参数（总预算 ¥24,000、利润红线 30%、期末现金安全线 ¥3,500、售后预留最低 ¥1,200），规则不变。', questions: [
        { id: '8-6-t1', kind: 'number', question: '若采购 ¥7,000、广告 ¥5,000、物流 ¥5,200、售后预留 ¥1,800，总支出是多少（元）？', answer: 19000, tolerance: 1, unit: '¥',
          explain: '7,000 + 5,000 + 5,200 + 1,800 = ¥19,000，未超过 ¥24,000 总预算。' },
        { id: '8-6-t2', kind: 'choice', question: '总预算 ¥24,000、广告预算 ¥5,000，广告占比是多少？是否超过 40% 上限？', answer: 'A', options: [
          { key: 'A', text: '约 20.8%，没有超过上限' },
          { key: 'B', text: '约 20.8%，已经超过上限' },
          { key: 'C', text: '约 41.7%，已经超过上限' } ],
          explain: '5,000 ÷ 24,000 ≈ 20.8%，低于 40% 上限，属于健康区间。选项 C 是把分母错当成广告花费算出来的。' },
        { id: '8-6-t3', kind: 'choice', question: '期末现金只剩 ¥2,800，低于 ¥3,500 安全线；同时毛利率 34% 达标、库存覆盖 25 天达标。最合理的调整是？', answer: 'A', options: [
          { key: 'A', text: '削减广告预算并压缩采购批量，把期末现金补回安全线上' },
          { key: 'B', text: '把毛利率目标降到 25%，这样就合规了' },
          { key: 'C', text: '维持现状，只要毛利率达标就算通过' } ],
          explain: '经营方案必须同时满足预算、现金、利润、库存与售后五条线。现金跌破安全线就要优先补回；下调利润目标属于改标准而不是解决问题，C 则直接遗漏了安全线约束。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用三句话复盘这次经营方案：结论、依据、风险', fields: [
        { key: 'decision', label: '我的经营结论是', placeholder: '例：总支出控制在预算内，现金、利润、库存、售后四条线都要达标',
          keywords: [['预算', '24000', '总预算'], ['现金', '期末'], ['毛利', '利润', '30', '34'], ['库存', '覆盖'], ['售后', '预留']], minHits: 2,
          sample: '我的经营结论是：总支出要控制在 ¥24,000 以内，同时期末现金、毛利率、库存覆盖和售后预留四条线都要达标。' },
        { key: 'evidence', label: '我依据的数据是', placeholder: '例：四项合计 ¥19,000、广告占比 20.8%、期末现金 ¥2,800 低于 ¥3,500',
          keywords: [['19000', '1900'], ['24000', '2400'], ['5000', '2080', '208'], ['2800', '3500', '现金'], ['34', '毛利'], ['25', '库存']], minHits: 2,
          sample: '我依据的数据是四项支出合计 ¥19,000 未超 ¥24,000、广告占比约 20.8% 低于 40%、期末现金 ¥2,800 低于 ¥3,500 安全线，而毛利率 34% 与库存覆盖 25 天均已达标。' },
        { key: 'risk', label: '最大的风险与我的应对是', placeholder: '例：现金跌破安全线，压缩广告与采购批量补回来',
          keywords: [['现金', '现金流', '安全线'], ['断货', '库存'], ['积压', '占用', '资金'], ['削减', '压缩', '调整', '降广告'], ['预留', '售后']], minHits: 1,
          sample: '最大的风险是期末现金跌破安全线，一旦售后或退货集中发生就会周转困难；我的应对是压缩广告预算和采购批量，先把现金补回安全线上。' },
      ], passScore: 2 },
    ] },
];
