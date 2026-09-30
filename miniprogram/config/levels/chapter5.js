// 第 5 章：物流与库存（固定 30 天周期，PawPal 宠物梳）
// 教学样板要素：objectives / abilityDims / transfer / reflection（见 chapter3.js 顶部说明）
// 教学锚点：5-4（补货点）与 5-6（Boss）必须同时具备迁移题与结构化复述。
module.exports = [
  {
    id: '5-1', chapter: 5, name: '物流基础', type: 'practice',
    goal: '理解头程物流与库存周期', passScore: 70, duration: '约 8 分钟',
    objectives: ['说出海运/空运/快递在时效与单价上的差别', '理解补货点为什么要覆盖交期需求', '知道断货对链接的代价'],
    abilityDims: ['supply'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: 'PawPal 宠物梳按固定 30 天库存周期规划。先掌握运输时效、成本与库存的关系。' },
      { type: 'card', cardId: 'K5-01' },
      { type: 'card', cardId: 'K1-04' },
      { type: 'quiz', question: '固定 30 天周期中，哪项最能降低断货风险？', options: [
        { key: 'A', text: '只看采购价，库存越少越好', correct: false, explain: '忽略交期会带来断货。' },
        { key: 'B', text: '用日销量×（交期+安全天数）计算补货点', correct: true, explain: '补货点覆盖交期需求并留出安全库存。' },
        { key: 'C', text: '所有货都选最贵的快递', correct: false, explain: '应结合时效、重量和预算决策。' },
      ] },
    ], rewards: {},
  },
  {
    id: '5-2', chapter: 5, name: '运输方式选择', type: 'practice',
    goal: '按时效与成本选择运输方式', passScore: 70, duration: '约 8 分钟',
    objectives: ['按时效与单价为不同批次选择运输方式', '说清「首批宁快、常规宁省」的取舍理由'],
    abilityDims: ['supply'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '首批 100 件要在 30 天周期内上架开卖。海运、空运、快递摆在你面前，时效和单价差得很远。' },
      { type: 'card', cardId: 'K5-01' },
      { type: 'transportChoice', scenario: 'PawPal 宠物梳首批 100 件、单件 0.5kg，需在 30 天周期内稳定补货。选择合理方式。', options: [
      { id: 'sea', text: '海运｜35天｜¥9/kg', valid: false, reason: '超过 30 天周期，首批会错过销售窗口。' },
      { id: 'air', text: '空运｜8天｜¥30/kg', valid: true, reason: '8天时效与预算平衡，适合本关首批。' },
      { id: 'express', text: '快递｜5天｜¥45/kg', valid: false, reason: '时效快但成本过高，不是常规补货首选。' },
    ] }], rewards: {},
  },
  {
    id: '5-3', chapter: 5, name: '头程成本计算', type: 'practice',
    goal: '计算不同运输方式的头程成本', passScore: 70, duration: '约 8 分钟',
    objectives: ['用「总重量 × 单价」算出头程成本', '比较不同运输方式的总成本差距'],
    abilityDims: ['supply'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '运输方式定了，接下来算钱：这批货的头程到底要花多少。' },
      { type: 'card', cardId: 'K5-05' },
      { type: 'freightCalc', scenario: 'PawPal 宠物梳运输 100 件、单件 0.5kg。空运单价 ¥30/kg。计算：总重量 × 空运单价 = 头程成本。填写空运头程成本（¥）。', blanks: [{ label: '空运成本', answer: 1500, unit: '¥' }] },
    ], rewards: {},
  },
  {
    id: '5-4', chapter: 5, name: '安全库存与补货点', type: 'practice',
    goal: '计算 30 天周期的安全库存与补货点', passScore: 70, duration: '约 10 分钟',
    objectives: ['用「日销量×交期+安全库存」算出补货点', '说出交期缩短后补货点会怎么变', '把同一套补货规则迁移到新销量与新交期'],
    abilityDims: ['supply'],
    steps: [
      { type: 'card', cardId: 'K5-02' },
      { type: 'reorderCalc', scenario: '日销量 3 件，空运交期 8 天，安全库存 5 天。补货点=日销量×交期+安全库存件数。', fields: [
        { key: 'dailySales', label: '日销量', answer: 3, unit: '件/天' }, { key: 'leadTimeDays', label: '交期', answer: 8, unit: '天' }, { key: 'safetyDays', label: '安全库存天数', answer: 5, unit: '天' }, { key: 'reorderPoint', label: '补货点', answer: 29, unit: '件' },
      ] },
      { type: 'transfer', scenario: '换一个商品：日销量 5 件，海运交期 35 天，安全库存 7 天。公式不变，重新算一遍。', questions: [
        { id: '5-4-t1', kind: 'number', question: '走海运时，补货点应该是多少件？', answer: 182, tolerance: 1, unit: '件',
          explain: '补货点 = 日销量 × 交期 + 安全库存 = 5 × 35 + 7 = 182 件。交期越长，需要提前备的量越大。' },
        { id: '5-4-t2', kind: 'number', question: '如果改用空运（交期 8 天），补货点会降到多少件？', answer: 47, tolerance: 1, unit: '件',
          explain: '5 × 8 + 7 = 47 件。交期从 35 天缩到 8 天，补货点同步大幅下降，库存占用和现金压力都会变小。' },
        { id: '5-4-t3', kind: 'choice', question: '为什么日销量从 3 提到 5 之后，补货点不是「加一点」，而是明显上移？', answer: 'A', options: [
          { key: 'A', text: '因为交期在公式里是乘数，销量越大、交期越长，补货点被放大得越多' },
          { key: 'B', text: '因为安全库存会随销量自动翻倍' },
          { key: 'C', text: '因为运输方式变了' } ],
          explain: '补货点 = 日销量 × 交期 + 安全库存，交期是乘数不是加数。销量和交期任何一项变大，补货点都会被乘数效应放大。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用两句话说明你的补货策略（第一句给补货点结论，第二句给风险依据）', fields: [
        { key: 'decision', label: '我定的补货点是', placeholder: '例：海运 182 件，改空运会降到 47 件',
          keywords: [['182', '补货点'], ['47', '空运', '交期'], ['件']], minHits: 1,
          sample: '我定的海运补货点是 182 件；如果改用空运，交期缩短到 8 天，补货点会降到 47 件。' },
        { key: 'evidence', label: '我依据的数据是', placeholder: '例：日销 5 件、海运交期 35 天、安全库存 7 天',
          keywords: [['日销', '销量', '5'], ['交期', '35', '8'], ['安全', '7'], ['库存', '件']], minHits: 2,
          sample: '我依据的是日销量 5 件、海运交期 35 天、安全库存 7 天，代入补货点公式算出来的；空运交期 8 天同理。' },
      ], passScore: 2 },
    ], rewards: {},
  },
  {
    id: '5-5', chapter: 5, name: '物流异常处理', type: 'practice',
    goal: '识别异常并选择应对方案', passScore: 70, duration: '约 8 分钟',
    objectives: ['识别延误、仓容、查验、地址四类异常', '为每类异常选择合规的应对动作'],
    abilityDims: ['supply'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '货在路上的这 30 天不会一直太平。四类异常摆出来，逐个选应对方案。' },
      { type: 'card', cardId: 'K5-04' },
      { type: 'logisticsIncident', incidents: [
      { id: 'delay', name: '运输延误', text: '空运延误 3 天', options: [{ id: 'air', text: '切换快递并通知客户', valid: true }, { id: 'wait', text: '不处理，等自然到货', valid: false }] },
      { id: 'capacity', name: '仓容不足', text: '仓库可用容量不足', options: [{ id: 'split', text: '拆分入仓并调整补货批次', valid: true }, { id: 'ship', text: '继续一次性发全部库存', valid: false }] },
      { id: 'inspection', name: '海关查验', text: '货物进入查验', options: [{ id: 'docs', text: '补齐合规单证并跟进查验', valid: true }, { id: 'hide', text: '修改申报信息规避查验', valid: false }] },
      { id: 'address', name: '地址错误', text: '承运商反馈收货地址错误', options: [{ id: 'confirm', text: '核实地址后重新派送', valid: true }, { id: 'cancel', text: '直接取消订单', valid: false }] },
    ] }], rewards: {},
  },
  {
    id: '5-6', chapter: 5, name: '库存管理 Boss', type: 'boss',
    goal: '在固定 30 天周期内完成无断货库存方案', passScore: 80, duration: '约 15 分钟',
    objectives: ['在 30 天周期内做出无断货的补货方案', '在时效与成本之间给出可解释的取舍', '说清方案的风险与备选动作'],
    abilityDims: ['supply'],
    steps: [
      { type: 'card', cardId: 'K5-03' },
      { type: 'inventoryBoss', days: 30, initialStock: 100, dailySales: 3, shipmentUnits: 100, leadTimeDays: 8, safetyDays: 5, reorderPoint: 29, budgetCNY: 2000, options: [
        { id: 'air', text: '空运：8天，合理平衡时效与成本', valid: true, freightKey: 'air' },
        { id: 'sea', text: '海运：35天，低价但超出周期', valid: false, freightKey: 'sea' },
        { id: 'express', text: '快递：5天，成本过高', valid: false, freightKey: 'express' },
      ] },
      { type: 'transfer', scenario: '换一组库存数据：初始库存 150 件、日销量 4 件、交期 10 天、安全库存 6 天、周期 30 天。规则不变。', questions: [
        { id: '5-6-t1', kind: 'number', question: '这组数据的补货点是多少件？', answer: 46, tolerance: 1, unit: '件',
          explain: '补货点 = 4 × 10 + 6 = 46 件。' },
        { id: '5-6-t2', kind: 'number', question: '150 件库存按日销 4 件，可以卖多少天（保留一位小数）？', answer: 37.5, tolerance: 0.5, unit: '天',
          explain: '150 ÷ 4 = 37.5 天，已经超过 30 天周期。说明初始库存偏多，该考虑控制占用，而不是再加急补货。' },
        { id: '5-6-t3', kind: 'choice', question: '海运 35 天 / 空运 8 天 / 快递 5 天；周期 30 天、日销 4 件、现有库存可卖 37.5 天。最合理的方案是？', answer: 'A', options: [
          { key: 'A', text: '继续走海运：库存够撑过周期，海运单价最低' },
          { key: 'B', text: '改走快递：时效最快最保险' },
          { key: 'C', text: '三种方式各发一批，分散风险' } ],
          explain: '库存能覆盖周期时，决策天平倒向成本——海运单价最低，交期虽长但仍在可控范围内。快递成本是海运的数倍；分批混发只会同时放大费用和仓储占用。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用三句话复盘这次库存方案：结论、依据、风险', fields: [
        { key: 'decision', label: '我的库存方案是', placeholder: '例：继续走海运，等库存降到补货点 46 件再补',
          keywords: [['海运', '空运', '快递'], ['补货点', '46', '库存'], ['30', '周期']], minHits: 1,
          sample: '我的库存方案是继续走海运，等库存降到补货点 46 件左右再下单补货。' },
        { key: 'evidence', label: '我依据的数据是', placeholder: '例：初始库存 150 件、日销 4 件、可售 37.5 天',
          keywords: [['150', '库存'], ['4', '日销', '销量'], ['375', '37'], ['35', '8', '10', '交期'], ['46', '补货点']], minHits: 2,
          sample: '我依据的是初始库存 150 件、日销 4 件、可售 37.5 天，以及交期 10 天对应补货点 46 件。' },
        { key: 'risk', label: '不这么做会有什么风险', placeholder: '例：加急会让头程成本失控，不补又会断货',
          keywords: [['断货', '缺货', '见底'], ['积压', '占用', '现金', '资金'], ['滞销', '仓储', '仓储费'], ['排名', '权重', '流量']], minHits: 1,
          sample: '不这么做的风险是：一味加急会让头程成本失控、现金被大量占用，而完全不补货又会在库存见底时断货，拖累排名和权重。' },
      ], passScore: 2 },
    ], rewards: {},
  },
];
