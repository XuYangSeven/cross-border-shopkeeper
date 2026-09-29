// 第 5 章：物流与库存（固定 30 天周期，PawPal 宠物梳）
module.exports = [
  { id: '5-1', chapter: 5, name: '物流基础', type: 'practice', goal: '理解头程物流与库存周期', passScore: 70, steps: [
    { type: 'dialog', speaker: '老陈', text: 'PawPal 宠物梳按固定 30 天库存周期规划。先掌握运输时效、成本与库存的关系。' },
    { type: 'card', cardId: 'K1-04' },
    { type: 'quiz', question: '固定 30 天周期中，哪项最能降低断货风险？', options: [
      { key: 'A', text: '只看采购价，库存越少越好', correct: false, explain: '忽略交期会带来断货。' },
      { key: 'B', text: '用日销量×（交期+安全天数）计算补货点', correct: true, explain: '补货点覆盖交期需求并留出安全库存。' },
      { key: 'C', text: '所有货都选最贵的快递', correct: false, explain: '应结合时效、重量和预算决策。' },
    ] },
  ] },
  { id: '5-2', chapter: 5, name: '运输方式选择', type: 'practice', goal: '按时效与成本选择运输方式', passScore: 70, steps: [{ type: 'transportChoice', scenario: 'PawPal 宠物梳首批 100 件、单件 0.5kg，需在 30 天周期内稳定补货。选择合理方式。', options: [
    { id: 'sea', text: '海运｜35天｜¥9/kg', valid: false, reason: '超过 30 天周期，首批会错过销售窗口。' },
    { id: 'air', text: '空运｜8天｜¥30/kg', valid: true, reason: '8天时效与预算平衡，适合本关首批。' },
    { id: 'express', text: '快递｜5天｜¥45/kg', valid: false, reason: '时效快但成本过高，不是常规补货首选。' },
  ] }] },
  { id: '5-3', chapter: 5, name: '头程成本计算', type: 'practice', goal: '计算不同运输方式的头程成本', passScore: 70, steps: [{ type: 'freightCalc', scenario: 'PawPal 宠物梳运输 100 件、单件 0.5kg。空运单价 ¥30/kg。计算：总重量 × 空运单价 = 头程成本。填写空运头程成本（¥）。', blanks: [{ label: '空运成本', answer: 1500, unit: '¥' }] }] },
  { id: '5-4', chapter: 5, name: '安全库存与补货点', type: 'practice', goal: '计算 30 天周期的安全库存与补货点', passScore: 70, steps: [{ type: 'reorderCalc', scenario: '日销量 3 件，空运交期 8 天，安全库存 5 天。补货点=日销量×交期+安全库存件数。', fields: [
    { key: 'dailySales', label: '日销量', answer: 3, unit: '件/天' }, { key: 'leadTimeDays', label: '交期', answer: 8, unit: '天' }, { key: 'safetyDays', label: '安全库存天数', answer: 5, unit: '天' }, { key: 'reorderPoint', label: '补货点', answer: 29, unit: '件' },
  ] }] },
  { id: '5-5', chapter: 5, name: '物流异常处理', type: 'practice', goal: '识别异常并选择应对方案', passScore: 70, steps: [{ type: 'logisticsIncident', incidents: [
    { id: 'delay', name: '运输延误', text: '空运延误 3 天', options: [{ id: 'air', text: '切换快递并通知客户', valid: true }, { id: 'wait', text: '不处理，等自然到货', valid: false }] },
    { id: 'capacity', name: '仓容不足', text: '仓库可用容量不足', options: [{ id: 'split', text: '拆分入仓并调整补货批次', valid: true }, { id: 'ship', text: '继续一次性发全部库存', valid: false }] },
    { id: 'inspection', name: '海关查验', text: '货物进入查验', options: [{ id: 'docs', text: '补齐合规单证并跟进查验', valid: true }, { id: 'hide', text: '修改申报信息规避查验', valid: false }] },
    { id: 'address', name: '地址错误', text: '承运商反馈收货地址错误', options: [{ id: 'confirm', text: '核实地址后重新派送', valid: true }, { id: 'cancel', text: '直接取消订单', valid: false }] },
  ] }] },
  { id: '5-6', chapter: 5, name: '库存管理 Boss', type: 'boss', goal: '在固定 30 天周期内完成无断货库存方案', passScore: 80, steps: [{ type: 'inventoryBoss', days: 30, initialStock: 100, dailySales: 3, shipmentUnits: 100, leadTimeDays: 8, safetyDays: 5, reorderPoint: 29, budgetCNY: 2000, options: [
    { id: 'air', text: '空运：8天，合理平衡时效与成本', valid: true, freightKey: 'air' },
    { id: 'sea', text: '海运：35天，低价但超出周期', valid: false, freightKey: 'sea' },
    { id: 'express', text: '快递：5天，成本过高', valid: false, freightKey: 'express' },
  ] }] },
];
