// 第 4 章：广告投放深度模拟（PawPal 宠物梳）
// 教学样板要素：objectives / abilityDims / transfer / reflection（见 chapter3.js 顶部说明）
// 教学锚点：4-1（广告指标）与 4-8（Boss）必须同时具备迁移题与结构化复述。
const terms = [
  { term: 'self cleaning slicker brush', kind: '核心词' }, { term: 'pet grooming brush', kind: '核心词' },
  { term: 'dog brush for shedding', kind: '长尾词' }, { term: 'cat brush gentle', kind: '长尾词' },
  { term: 'best brush', kind: '泛词' }, { term: 'free brush', kind: '风险词' },
];
const metrics = [{ label: 'CTR', answer: 6, unit: '%' }, { label: 'CPC', answer: 0.5, unit: '$' }, { label: 'CVR', answer: 10, unit: '%' }, { label: 'ACOS', answer: 16.7, unit: '%' }];

module.exports = [
  {
    id: '4-1', chapter: 4, name: '广告指标计算', type: 'practice',
    goal: '根据 PawPal 投放数据计算核心指标', passScore: 70, duration: '约 8 分钟',
    objectives: ['用曝光、点击、花费算出 CTR、CPC、CVR 和 ACOS', '说出 ACOS 衡量的到底是什么', '换一组数据也能套同一套公式算出来'],
    abilityDims: ['ads'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '广告不是把预算烧出去，而是用 CTR、CPC、CVR 和 ACOS 判断每一美元是否有效。' },
      { type: 'card', cardId: 'K4-01' },
      { type: 'adMetricCalc', scenario: '今日：曝光 10,000，点击 600，花费 $300，订单 60，售价 $30。填写 CTR、CPC、CVR、ACOS。', blanks: metrics },
      { type: 'transfer', scenario: '换一组投放数据：曝光 20,000，点击 1,000，花费 $400，订单 80，售价 $25。公式不变，数据全变，重新算一遍。', questions: [
        { id: '4-1-t1', kind: 'number', question: 'CTR 是多少（百分比，填数字，例如 5）？', answer: 5, tolerance: 0.1, unit: '%',
          explain: 'CTR = 点击 ÷ 曝光 = 1,000 ÷ 20,000 = 5%。它衡量的是曝光之后的点击吸引力。' },
        { id: '4-1-t2', kind: 'number', question: 'CVR 是多少（百分比，填数字）？', answer: 8, tolerance: 0.2, unit: '%',
          explain: 'CVR = 订单 ÷ 点击 = 80 ÷ 1,000 = 8%。注意分母是点击，不是访客，也不是曝光。' },
        { id: '4-1-t3', kind: 'number', question: 'ACOS 是多少（百分比，保留一位小数以内）？', answer: 20, tolerance: 0.3, unit: '%',
          explain: 'ACOS = 广告花费 ÷ 广告销售额 = 400 ÷ (80 × 25) = 400 ÷ 2,000 = 20%。它衡量每卖出 1 美元，广告吃掉多少。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用两句话说明你判断这组投放是否健康的标准（第一句给结论，第二句给数据）', fields: [
        { key: 'decision', label: '我的结论是', placeholder: '例：整体健康，ACOS 20% 在可接受范围内',
          keywords: [['acos', '广告'], ['健康', '正常', '达标', '不达标', '超标'], ['放量', '扩量', '优化', '控制', '观察']], minHits: 1,
          sample: '我的结论是这组投放整体健康，ACOS 20% 在可接受范围内，可以小步放量并继续观察。' },
        { key: 'evidence', label: '我依据的数据是', placeholder: '例：CTR 5%、CVR 8%、ACOS 20%',
          keywords: [['ctr', '点击率', '点击'], ['5', '5%'], ['8', 'cvr', '转化'], ['20', '20%', 'acos']], minHits: 1,
          sample: '我依据的数据是 CTR 5%、CVR 8%、ACOS 20%，三项都在健康区间，说明点击效率与转化承接都不差。' },
      ], passScore: 2 },
    ], rewards: {},
  },
  {
    id: '4-2', chapter: 4, name: '搜索词排序', type: 'practice',
    goal: '按相关性与风险给搜索词分类', passScore: 70, duration: '约 8 分钟',
    objectives: ['说出核心词、长尾词、泛词、风险词的差别', '按相关性把一批搜索词正确归类'],
    abilityDims: ['ads'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '搜索词报表导出来了。同一个产品，买家搜的词千差万别——先把它们按相关性和风险分开。' },
      { type: 'card', cardId: 'K4-03' },
      { type: 'searchTermSort', terms },
    ], rewards: {},
  },
  {
    id: '4-3', chapter: 4, name: '广告位选择', type: 'practice',
    goal: '为新品选择高效广告位', passScore: 70, duration: '约 8 分钟',
    objectives: ['为新品选出曝光效率更高的广告位', '说出广告位乘数如何影响实际出价成本'],
    abilityDims: ['ads'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '同一个关键词，投在不同广告位，实际点击成本不一样。新品期要先把钱砸在效率最高的位置。' },
      { type: 'card', cardId: 'K4-01' },
      { type: 'adPlacement', placements: [{ id: 'top', name: '搜索结果顶部', multiplier: 1.2, valid: true }, { id: 'rest', name: '搜索结果其余位置', multiplier: 1, valid: false }, { id: 'detail', name: '商品详情页', multiplier: 0.8, valid: false }] },
    ], rewards: {},
  },
  {
    id: '4-4', chapter: 4, name: '关键词广告组', type: 'practice',
    goal: '配置核心词、长尾词与匹配方式', passScore: 70, duration: '约 10 分钟',
    objectives: ['给核心词和长尾词分别配置匹配方式', '说出为什么泛词不该单独成组'],
    abilityDims: ['ads'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '接下来是广告结构：什么词放一组、用什么匹配方式，直接决定你的预算花得值不值。' },
      { type: 'card', cardId: 'K4-03' },
      { type: 'keywordCampaign', groups: [{ id: 'core', name: '核心词组', valid: true }, { id: 'long', name: '长尾词组', valid: true }, { id: 'broad', name: '泛词组', valid: false }], matches: [{ id: 'exact', name: '精准匹配', valid: true }, { id: 'phrase', name: '词组匹配', valid: true }, { id: 'broad', name: '广泛匹配', valid: false }] },
    ], rewards: {},
  },
  {
    id: '4-5', chapter: 4, name: '预算竞价模拟', type: 'practice',
    goal: '设置可控竞价并查看预估结果', passScore: 70, duration: '约 10 分钟',
    objectives: ['用预算与竞价预估点击量、订单量与 ACOS', '说出质量分对实际单次点击成本的影响'],
    abilityDims: ['ads'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '预算和竞价是可以先算再投的。调一下参数，看看预估点击、订单和 ACOS 会怎么变。' },
      { type: 'card', cardId: 'K4-02' },
      { type: 'bidBudgetSim', budget: 100, bid: 0.5, ctr: 0.06, cvr: 0.1, priceUSD: 30, placementMultiplier: 1, quality: 1 },
    ], rewards: {},
  },
  {
    id: '4-6', chapter: 4, name: '新品启动策略', type: 'practice',
    goal: '选择先验证再放量的新品策略', passScore: 70, duration: '约 8 分钟',
    objectives: ['选择「先小预算验证、达标再放量」的新品策略', '说出新品期最该先验证的指标'],
    abilityDims: ['ads'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '新品上广告，最容易犯的错是第一天就全力开火。先想清楚：用什么策略起步？' },
      { type: 'card', cardId: 'K4-01' },
      { type: 'launchStrategy', options: [{ id: 'test', text: '先用精准词小预算测试，达标后逐步放量', valid: true }, { id: 'all', text: '第一天全部词高价抢量', valid: false }, { id: 'off', text: '新品不上广告，等待自然流量', valid: false }] },
    ], rewards: {},
  },
  {
    id: '4-7', chapter: 4, name: '否定词分类', type: 'practice',
    goal: '识别无关、低意图与风险搜索词', passScore: 70, duration: '约 8 分钟',
    objectives: ['识别无关词、低意图词与风险词', '说出否定词省的是成本还是流量'],
    abilityDims: ['ads'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '花钱买来的点击里，混着不少永远不会下单的人。否定词就是把这些人挡在门外的那道闸。' },
      { type: 'card', cardId: 'K4-04' },
      { type: 'negativeKeyword', items: [{ term: 'free pet brush', kind: '否定词' }, { term: 'pet grooming brush', kind: '保留' }, { term: 'human hair brush', kind: '否定词' }, { term: 'self cleaning slicker brush', kind: '保留' }] },
    ], rewards: {},
  },
  {
    id: '4-8', chapter: 4, name: '广告投放 Boss', type: 'boss',
    goal: '完成 7 日广告投放并达成 ACOS、预算与订单目标', passScore: 80, duration: '约 15 分钟',
    objectives: ['在 7 天预算内把 ACOS 压到 30% 目标线以内', '让广告订单占比达到 40% 目标', '说清每一轮调价与否词的动作依据'],
    abilityDims: ['ads'],
    steps: [
      { type: 'card', cardId: 'K4-02' },
      { type: 'adBoss', days: 7, budget: 100, priceUSD: 30, target: { acos: 0.3, adOrderRate: 0.4 } },
      { type: 'transfer', scenario: '换一组新品投放数据复盘，规则不变：目标 ACOS ≤ 30%。', questions: [
        { id: '4-8-t1', kind: 'number', question: '某广告组 7 天花费 $360，带来广告订单 45 单、客单价 $30。ACOS 是多少（百分比，保留一位小数以内）？', answer: 26.7, tolerance: 0.5, unit: '%',
          explain: 'ACOS = 花费 ÷ 广告销售额 = 360 ÷ (45 × 30) = 360 ÷ 1,350 ≈ 26.7%，低于 30% 目标线，属于达标。' },
        { id: '4-8-t2', kind: 'choice', question: '如果一组广告曝光很高、点击很少，最该先检查什么？', answer: 'A', options: [
          { key: 'A', text: '搜索词相关性和主图素材' },
          { key: 'B', text: '直接提高竞价抢更多曝光' },
          { key: 'C', text: '马上把这组广告关掉' } ],
          explain: '曝光有、点击弱，说明曝光之后的吸引力或相关性不足。应先清理低相关词并测试素材，而不是加价（只会买更多低效曝光）或一刀切关停（会丢掉还有潜力的流量）。' },
        { id: '4-8-t3', kind: 'choice', question: '某关键词点击很多但几乎不出单，ACOS 已经 80%，正确动作是？', answer: 'B', options: [
          { key: 'A', text: '继续加价，靠量把成本摊薄' },
          { key: 'B', text: '先降竞价止损，若仍不出单则加入否定词' },
          { key: 'C', text: '把整个广告活动暂停一周' } ],
          explain: '点击多不出单说明搜索意图不匹配或页面承接不足。先降价控制成本，验证后仍无单就否掉；直接暂停整个活动会误伤同组里的有效词。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用三句话复盘这次投放：先给 ACOS 结论，再给数据依据，最后说清下一轮动作', fields: [
        { key: 'decision', label: '我的投放结论是', placeholder: '例：ACOS 已压到目标线以内，但仍有低效词',
          keywords: [['acos', '广告'], ['达标', '超标', '健康', '目标', '30'], ['放量', '扩量', '控制', '优化', '降']], minHits: 1,
          sample: '我的投放结论是整体 ACOS 已经压到 30% 目标线以内，但仍有低效词在拉高成本，需要继续优化。' },
        { key: 'evidence', label: '我依据的数据是', placeholder: '例：花费 $360、45 单、客单价 $30，ACOS 约 26.7%',
          keywords: [['267', '26', 'acos'], ['360', '1350'], ['45', '订单'], ['30', '30%']], minHits: 1,
          sample: '我依据的是 7 天花费 $360、广告订单 45 单、客单价 $30，算得 ACOS 约 26.7%，低于 30% 目标线。' },
        { key: 'risk', label: '我识别的问题与下一轮动作是', placeholder: '例：高花费零单的词降竞价并加否定，预算转给高效词',
          keywords: [['降价', '降竞价', '降出价', '止损'], ['否定', '否词'], ['预算', '放量', '扩量', '加预算'], ['素材', '主图', '相关性']], minHits: 1,
          sample: '我识别的问题是部分词点击多却不出单，下一轮动作是对这些词降竞价并加否定，把释放的预算转给高转化词小幅放量，同时优化点击弱的主图素材。' },
      ], passScore: 2 },
    ], rewards: {},
  },
];
