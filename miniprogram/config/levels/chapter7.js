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

// 教学样板要素：objectives / abilityDims / transfer / reflection（见 chapter3.js 顶部说明）
// 教学锚点：7-2（漏斗计算）与 7-6（Boss）必须同时具备迁移题与结构化复述。
module.exports = [
  { id: '7-1', chapter: 7, name: '数据看板入门', type: 'practice',
    goal: '理解核心运营指标及其含义', passScore: 70,
    objectives: ['把指标归类到流量、转化、效率三类', '说出每类指标影响的是哪一段经营结果'],
    abilityDims: ['analytics'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '看板上一堆数字，别急着下结论。第一步是给每个指标归好类。' },
      { type: 'card', cardId: 'K7-01' },
      { type: 'metricIdentify', scenario: '把指标放到正确的数据类别。', items: [
    { id: 'traffic', text: '访客数', answer: '流量', options: ['流量', '转化', '效率'] },
    { id: 'ctr', text: '点击率 CTR', answer: '流量', options: ['流量', '转化', '效率'] },
    { id: 'cvr', text: '转化率 CVR', answer: '转化', options: ['流量', '转化', '效率'] },
    { id: 'aov', text: '客单价', answer: '效率', options: ['流量', '转化', '效率'] },
    { id: 'acos', text: 'ACOS', answer: '效率', options: ['流量', '转化', '效率'] },
  ], reviewPrompt: '看板指标要先归类，再判断它影响的是流量、转化还是经营效率。' }] },
  { id: '7-2', chapter: 7, name: '漏斗数据诊断', type: 'practice',
    goal: '根据漏斗数据定位流失环节', passScore: 70,
    objectives: ['用漏斗数据算出 CTR、转化率、客单价与 ACOS', '定位漏斗里真正流失的那一环', '换一组漏斗数据也能算出同一套指标'],
    abilityDims: ['analytics'],
    steps: [
      { type: 'card', cardId: 'K7-02' },
      { type: 'funnelCalc', scenario: '根据 PawPal 一周漏斗数据计算指标。', data: funnel, fields: [
    { key: 'ctr', label: '曝光→点击 CTR', answer: 3, unit: '%' },
    { key: 'conversionRate', label: '访客→订单 CVR', answer: 5, unit: '%' },
    { key: 'averageOrderValue', label: '客单价', answer: 16.99, unit: '$' },
    { key: 'acos', label: '广告 ACOS', answer: 31.39, unit: '%' },
  ], reviewPrompt: '漏斗要从前到后看：曝光、点击、访客、加购、订单，每一步都可能流失。' },
      { type: 'transfer', scenario: '换一周漏斗数据：曝光 200,000、点击 8,000、访客 7,200、加购 900、订单 288、销售额 $4,320、广告花费 $1,296。公式不变，重新算一遍。', questions: [
        { id: '7-2-t1', kind: 'number', question: '曝光→点击的 CTR 是多少（百分比，填数字）？', answer: 4, tolerance: 0.1, unit: '%',
          explain: 'CTR = 点击 ÷ 曝光 = 8,000 ÷ 200,000 = 4%。' },
        { id: '7-2-t2', kind: 'number', question: '访客→订单的转化率是多少（百分比，填数字）？', answer: 4, tolerance: 0.1, unit: '%',
          explain: '转化率 = 订单 ÷ 访客 = 288 ÷ 7,200 = 4%。注意分母是访客，不是点击。' },
        { id: '7-2-t3', kind: 'number', question: '广告 ACOS 是多少（百分比，填数字）？', answer: 30, tolerance: 0.3, unit: '%',
          explain: 'ACOS = 广告花费 ÷ 销售额 = 1,296 ÷ 4,320 = 30%。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用两句话说明你的判断（第一句给结论，第二句给漏斗依据）', fields: [
        { key: 'decision', label: '我的结论是', placeholder: '例：瓶颈在访客到订单的转化，先优化页面别急着加广告',
          keywords: [['漏斗', '流失', '转化', '点击'], ['ctr', '点击率'], ['acos', '广告'], ['优化', '提升', '补强']], minHits: 1,
          sample: '我的结论是这周漏斗的主要瓶颈在访客到订单的转化环节，应该优先优化页面而不是继续加广告。' },
        { key: 'evidence', label: '我依据的数据是', placeholder: '例：CTR 4%、转化率只有 4%、ACOS 30%',
          keywords: [['4', 'ctr', '点击率'], ['288', '7200', '转化'], ['1296', '4320', '30', 'acos'], ['8000', '200000']], minHits: 1,
          sample: '我依据的数据是 CTR 4%、访客到订单转化率只有 4%、ACOS 30%，说明点击效率不差，但承接环节漏得更多。' },
      ], passScore: 2 },
    ] },
  { id: '7-3', chapter: 7, name: 'Listing问题定位', type: 'practice',
    goal: '把数据异常匹配到页面优化动作', passScore: 70,
    objectives: ['把 Listing 数据异常匹配到具体优化动作', '说出为什么不能一看到下降就去加广告'],
    abilityDims: ['analytics'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: 'Listing 数据掉了，先定位漏斗的哪一环出问题，再决定改页面还是改商品。' },
      { type: 'card', cardId: 'K7-02' },
      { type: 'diagnoseChoice', scenario: '根据指标状态选择主要问题和对应动作。', items: listingItems, reviewPrompt: '先定位漏斗环节，再选择动作，不能看到任何下降都去加广告。' },
    ] },
  { id: '7-4', chapter: 7, name: '广告数据复盘', type: 'practice',
    goal: '识别广告表现并选择优化动作', passScore: 70,
    objectives: ['同时看曝光、点击、订单与成本复盘广告', '区分「词不对」与「页面不行」'],
    abilityDims: ['analytics'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '广告复盘最容易犯的错是只看一个指标。曝光、点击、订单、成本，四个一起看才看得准。' },
      { type: 'card', cardId: 'K7-02' },
      { type: 'diagnoseChoice', scenario: '根据广告指标选择下一步动作。', items: adItems, reviewPrompt: '广告复盘同时看曝光、点击、订单和成本，不只看单一指标。' },
    ] },
  { id: '7-5', chapter: 7, name: '店铺健康分析', type: 'practice',
    goal: '按经营风险优先级处理多指标问题', passScore: 70,
    objectives: ['按经营风险优先级排列多指标问题', '先处理会导致经营中断的风险，再优化体验'],
    abilityDims: ['analytics'],
    steps: [
      { type: 'dialog', speaker: 'Lisa 总', text: '库存、退款、现金流同时报警。资源有限，你必须排出先后顺序。' },
      { type: 'card', cardId: 'K7-03' },
      { type: 'diagnoseChoice', scenario: '综合库存、退款和现金流指标，选择优先动作。', items: healthItems, reviewPrompt: '先处理会导致经营中断或现金流失控的问题，再优化转化和素材。' },
    ] },
  { id: '7-6', chapter: 7, name: '运营复盘 Boss', type: 'boss',
    goal: '完成一份有数据、有优先级、有目标的运营复盘', passScore: 80,
    objectives: ['完成一份有数据、有优先级、有目标的复盘', '说清问题、原因、动作三者的对应关系', '给出可量化的下周目标'],
    abilityDims: ['analytics'],
    steps: [
      { type: 'dialog', speaker: 'Lisa 总', text: '最后一关：一份完整的周复盘。记住，复盘必须有可验证的目标才算合格。' },
      { type: 'card', cardId: 'K7-04' },
      { type: 'reviewBoss', scenario: '完成 PawPal 一周运营复盘：选择问题、原因、动作和下周目标。', items: bossItems, targets: { minValidCount: 4 }, reviewPrompt: '优秀复盘不是罗列数据，而是用数据说明问题、原因、动作和可验证目标。' },
      { type: 'transfer', scenario: '换一组数据做复盘判断，规则不变：先定位环节，再选动作，最后定可验证目标。', questions: [
        { id: '7-6-t1', kind: 'choice', question: '某周：访客 6,000（目标 4,000 已达标）、CTR 2%（目标 5%）、转化率 11%（目标 10%）、ACOS 22%（目标 ≤30%）。最该先处理哪一项？', answer: 'B', options: [
          { key: 'A', text: '访客不足' },
          { key: 'B', text: '点击率不足' },
          { key: 'C', text: '转化率与 ACOS 都已达标，无需处理' } ],
          explain: '访客已达标、转化与 ACOS 都在安全线内，唯一未达标的是 CTR 2% < 5%。曝光之后的点击吸引力不够，应先处理主图与标题前半段。' },
        { id: '7-6-t2', kind: 'choice', question: '库存只剩 6 天、ACOS 42%（超目标）、退款率 9%（超目标）同时出现，第一优先级是？', answer: 'B', options: [
          { key: 'A', text: '先压 ACOS，广告是最烧钱的一环' },
          { key: 'B', text: '先解决库存断货风险' },
          { key: 'C', text: '先处理退款率，客户体验最重要' } ],
          explain: '断货会直接中断经营并伤害排名，优先级高于成本优化与体验优化——先保住「还能继续卖」，再谈卖得好不好。' },
        { id: '7-6-t3', kind: 'choice', question: '下面哪个是合格的「下周目标」？', answer: 'B', options: [
          { key: 'A', text: '下周表现更好，销量更高' },
          { key: 'B', text: '库存可售天数 ≥ 15 天、ACOS ≤ 30%、转化率 ≥ 10%' },
          { key: 'C', text: '尽力把广告效果做上来' } ],
          explain: '合格目标必须具体、可量化、可复盘。A 和 C 都没有可验证的数字，下周无法判断到底做没做到。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用三句话完成这次复盘：结论、依据、下周目标', fields: [
        { key: 'decision', label: '我复盘的结论是', placeholder: '例：瓶颈在点击率，同时库存与退款率也要处理',
          keywords: [['ctr', '点击率'], ['库存', '断货'], ['acos', '广告'], ['退款'], ['优先级', '先']], minHits: 1,
          sample: '我复盘的结论是本周最大瓶颈在点击率，同时库存与退款率也需要处理，按经营中断风险排优先级。' },
        { key: 'evidence', label: '我依据的数据是', placeholder: '例：CTR 2% 低于 5% 目标、库存只剩 6 天、ACOS 42%',
          keywords: [['2', 'ctr'], ['5', '目标'], ['6', '库存', '天'], ['42', 'acos'], ['9', '退款']], minHits: 2,
          sample: '我依据的数据是 CTR 只有 2% 低于 5% 目标、库存仅剩 6 天、ACOS 42% 超标、退款率 9% 超标，四项指向不同环节。' },
        { key: 'risk', label: '我下周的目标是', placeholder: '例：CTR ≥ 5%、库存 ≥ 15 天、ACOS ≤ 30%、转化 ≥ 10%',
          keywords: [['ctr', '点击率', '5'], ['库存', '15'], ['acos', '30'], ['转化', '10'], ['退款']], minHits: 1,
          sample: '我下周的目标是 CTR ≥ 5%、库存可售天数 ≥ 15 天、ACOS ≤ 30%、转化率 ≥ 10%，并把退款率压回目标线以内。' },
      ], passScore: 2 },
    ] },
];
