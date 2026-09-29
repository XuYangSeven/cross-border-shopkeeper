// 第 7 章：数据分析与运营复盘（PawPal 宠物梳）
const metric = (id, title, value, target, direction, options) => ({ id, title, value, target, direction, options });
const pick = (id, text, explanation, valid, action) => ({ id, text, explanation, valid, action });

const funnel = { impressions: 100000, clicks: 3000, visitors: 2700, carts: 420, orders: 135, salesUSD: 2293.65, adSpendUSD: 720 };
const listingItems = [
  metric('traffic', '流量不足', 2700, 4000, 'higher', [pick('traffic-action', '增加精准词覆盖并检查广告曝光', '访客低于目标，优先补充精准流量。', true, '扩展精准词并观察访客变化'), pick('traffic-wrong', '先提高售价', '价格不能直接解决访客不足。', false, '')]),
  metric('click', '点击率不足', 3, 5, 'higher', [pick('click-action', '优化主图和标题前半段', '点击率低说明曝光后的点击吸引力不足。', true, '做主图与标题A/B测试'), pick('click-wrong', '立即补货', '库存不是当前点击率主因。', false, '')]),
  metric('conversion', '转化率不足', 5, 10, 'higher', [pick('conversion-action', '检查页面卖点、评价和价格', '点击后成交低，优先排查页面说服力。', true, '优化Listing并复核价格'), pick('conversion-wrong', '只提高广告竞价', '增加点击不能自动解决页面转化问题。', false, '')]),
];
const adItems = [
  metric('ad-ctr', '广告高曝光低点击', 2.5, 5, 'higher', [pick('ad-ctr-action', '检查搜索词相关性并优化素材', '曝光有了但点击弱，优先处理相关性和素材。', true, '清理低相关词并测试主图'), pick('ad-ctr-wrong', '继续提高竞价', '提高竞价可能只会增加低质量曝光。', false, '')]),
  metric('ad-acos', '广告高点击低转化', 42, 30, 'lower', [pick('ad-acos-action', '检查Listing转化并降低无效词预算', '点击不等于订单，应同时优化页面和词包。', true, '降低无效词出价并优化页面'), pick('ad-acos-wrong', '全面扩大预算', '会放大低效花费。', false, '')]),
  metric('ad-roas', '高ROAS但预算不足', 5.2, 3, 'higher', [pick('ad-roas-action', '保留高转化词并小幅增加预算', '高ROAS且受预算限制，适合渐进放量。', true, '分时段增加高转化词预算'), pick('ad-roas-wrong', '直接暂停广告', '会丢失已有有效流量。', false, '')]),
];
const healthItems = [
  metric('stock', '库存断货风险', 8, 15, 'higher', [pick('stock-action', '优先安排补货并确认在途库存', '可售天数低于目标，断货会伤害后续经营。', true, '核对补货点和到货时间'), pick('stock-wrong', '先做主图测试', '素材优化不能替代库存风险处理。', false, '')]),
  metric('refund', '退款率上升', 8, 5, 'lower', [pick('refund-action', '抽查退货原因并修正页面预期', '退款超过目标，需要从商品和描述中找原因。', true, '按原因占比制定改进动作'), pick('refund-wrong', '删除所有差评', '不能用评价操作掩盖产品问题。', false, '')]),
  metric('cash', '现金流压力', 72, 50, 'lower', [pick('cash-action', '暂停低效花费并分批补货', '现金占用超过安全线，应先保护现金流。', true, '降低无效预算并调整批次'), pick('cash-wrong', '同时加大所有广告', '会进一步增加现金压力。', false, '')]),
];
const bossItems = [
  { id: 'boss-priority', title: '第一优先级', options: [pick('stock', '库存断货风险', '库存只有8天，应优先防止断货。', true, '安排补货'), pick('image', '主图点击率', '重要但不是当前最高风险。', false, '')] },
  { id: 'boss-cause', title: '转化下降原因', options: [pick('listing', '页面卖点、评价或价格竞争力不足', '点击仍在但成交下降，先排查页面转化因素。', true, '复核Listing'), pick('traffic', '曝光一定不够', '不能跳过漏斗数据直接归因。', false, '')] },
  { id: 'boss-ad', title: '广告动作', options: [pick('cut', '降低高ACOS无效词预算，保留高ROAS词', '区分低效和高效流量，避免一刀切。', true, '重分配广告预算'), pick('pause', '暂停全部广告', '会损失高ROAS词带来的有效订单。', false, '')] },
  { id: 'boss-refund', title: '退款动作', options: [pick('reason', '按退款原因占比修正页面和商品体验', '先找原因，再制定可验证的改进。', true, '建立退款原因看板'), pick('hide', '隐藏退款数据', '隐藏数据不能改善退款率。', false, '')] },
  { id: 'boss-goal', title: '下周目标', options: [pick('goal', '库存可售天数≥15、ACOS≤30%、转化率≥10%', '目标具体、可量化且覆盖主要风险。', true, '每日复盘目标差异'), pick('vague', '下周表现更好', '缺少可验证的数字目标。', false, '')] },
];

module.exports = [
  { id: '7-1', chapter: 7, name: '数据看板入门', type: 'practice', goal: '理解核心运营指标及其含义', passScore: 70, steps: [{ type: 'metricIdentify', scenario: '把指标放到正确的数据类别。', items: [
    { id: 'traffic', text: '访客数', answer: '流量', options: ['流量', '转化', '效率'] },
    { id: 'ctr', text: '点击率 CTR', answer: '流量', options: ['流量', '转化', '效率'] },
    { id: 'cvr', text: '转化率 CVR', answer: '转化', options: ['流量', '转化', '效率'] },
    { id: 'aov', text: '客单价', answer: '效率', options: ['流量', '转化', '效率'] },
    { id: 'acos', text: 'ACOS', answer: '效率', options: ['流量', '转化', '效率'] },
  ], reviewPrompt: '看板指标要先归类，再判断它影响的是流量、转化还是经营效率。' }] },
  { id: '7-2', chapter: 7, name: '漏斗数据诊断', type: 'practice', goal: '根据漏斗数据定位流失环节', passScore: 70, steps: [{ type: 'funnelCalc', scenario: '根据 PawPal 一周漏斗数据计算指标。', data: funnel, fields: [
    { key: 'ctr', label: '曝光→点击 CTR', answer: 3, unit: '%' },
    { key: 'conversionRate', label: '访客→订单 CVR', answer: 5, unit: '%' },
    { key: 'averageOrderValue', label: '客单价', answer: 16.99, unit: '$' },
    { key: 'acos', label: '广告 ACOS', answer: 31.45, unit: '%' },
  ], reviewPrompt: '漏斗要从前到后看：曝光、点击、访客、加购、订单，每一步都可能流失。' }] },
  { id: '7-3', chapter: 7, name: 'Listing问题定位', type: 'practice', goal: '把数据异常匹配到页面优化动作', passScore: 70, steps: [{ type: 'diagnoseChoice', scenario: '根据指标状态选择主要问题和对应动作。', items: listingItems, reviewPrompt: '先定位漏斗环节，再选择动作，不能看到任何下降都去加广告。' }] },
  { id: '7-4', chapter: 7, name: '广告数据复盘', type: 'practice', goal: '识别广告表现并选择优化动作', passScore: 70, steps: [{ type: 'diagnoseChoice', scenario: '根据广告指标选择下一步动作。', items: adItems, reviewPrompt: '广告复盘同时看曝光、点击、订单和成本，不只看单一指标。' }] },
  { id: '7-5', chapter: 7, name: '店铺健康分析', type: 'practice', goal: '按经营风险优先级处理多指标问题', passScore: 70, steps: [{ type: 'diagnoseChoice', scenario: '综合库存、退款和现金流指标，选择优先动作。', items: healthItems, reviewPrompt: '先处理会导致经营中断或现金流失控的问题，再优化转化和素材。' }] },
  { id: '7-6', chapter: 7, name: '运营复盘 Boss', type: 'boss', goal: '完成一份有数据、有优先级、有目标的运营复盘', passScore: 80, steps: [{ type: 'reviewBoss', scenario: '完成 PawPal 一周运营复盘：选择问题、原因、动作和下周目标。', items: bossItems, targets: { minValidCount: 4 }, reviewPrompt: '优秀复盘不是罗列数据，而是用数据说明问题、原因、动作和可验证目标。' }] },
];
