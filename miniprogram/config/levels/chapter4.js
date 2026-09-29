// 第 4 章：广告投放深度模拟（PawPal 宠物梳）
const terms = [
  { term: 'self cleaning slicker brush', kind: '核心词' }, { term: 'pet grooming brush', kind: '核心词' },
  { term: 'dog brush for shedding', kind: '长尾词' }, { term: 'cat brush gentle', kind: '长尾词' },
  { term: 'best brush', kind: '泛词' }, { term: 'free brush', kind: '风险词' },
];
const metrics = [{ label: 'CTR', answer: 6, unit: '%' }, { label: 'CPC', answer: 0.5, unit: '$' }, { label: 'CVR', answer: 10, unit: '%' }, { label: 'ACOS', answer: 16.7, unit: '%' }];
module.exports = [
  { id: '4-1', chapter: 4, name: '广告指标计算', type: 'practice', goal: '根据 PawPal 投放数据计算核心指标', passScore: 70, duration: '约 8 分钟', steps: [{ type: 'dialog', speaker: '老陈', text: '广告不是把预算烧出去，而是用 CTR、CPC、CVR 和 ACOS 判断每一美元是否有效。' }, { type: 'adMetricCalc', scenario: '今日：曝光 10,000，点击 600，花费 $300，订单 60，售价 $30。填写 CTR、CPC、CVR、ACOS。', blanks: metrics }] },
  { id: '4-2', chapter: 4, name: '搜索词排序', type: 'practice', goal: '按相关性与风险给搜索词分类', passScore: 70, duration: '约 8 分钟', steps: [{ type: 'searchTermSort', terms }] },
  { id: '4-3', chapter: 4, name: '广告位选择', type: 'practice', goal: '为新品选择高效广告位', passScore: 70, duration: '约 8 分钟', steps: [{ type: 'adPlacement', placements: [{ id: 'top', name: '搜索结果顶部', multiplier: 1.2, valid: true }, { id: 'rest', name: '搜索结果其余位置', multiplier: 1, valid: false }, { id: 'detail', name: '商品详情页', multiplier: 0.8, valid: false }] }] },
  { id: '4-4', chapter: 4, name: '关键词广告组', type: 'practice', goal: '配置核心词、长尾词与匹配方式', passScore: 70, duration: '约 10 分钟', steps: [{ type: 'keywordCampaign', groups: [{ id: 'core', name: '核心词组', valid: true }, { id: 'long', name: '长尾词组', valid: true }, { id: 'broad', name: '泛词组', valid: false }], matches: [{ id: 'exact', name: '精准匹配', valid: true }, { id: 'phrase', name: '词组匹配', valid: true }, { id: 'broad', name: '广泛匹配', valid: false }] }] },
  { id: '4-5', chapter: 4, name: '预算竞价模拟', type: 'practice', goal: '设置可控竞价并查看预估结果', passScore: 70, duration: '约 10 分钟', steps: [{ type: 'bidBudgetSim', budget: 100, bid: 0.5, ctr: 0.06, cvr: 0.1, priceUSD: 30, placementMultiplier: 1, quality: 1 }] },
  { id: '4-6', chapter: 4, name: '新品启动策略', type: 'practice', goal: '选择先验证再放量的新品策略', passScore: 70, duration: '约 8 分钟', steps: [{ type: 'launchStrategy', options: [{ id: 'test', text: '先用精准词小预算测试，达标后逐步放量', valid: true }, { id: 'all', text: '第一天全部词高价抢量', valid: false }, { id: 'off', text: '新品不上广告，等待自然流量', valid: false }] }] },
  { id: '4-7', chapter: 4, name: '否定词分类', type: 'practice', goal: '识别无关、低意图与风险搜索词', passScore: 70, duration: '约 8 分钟', steps: [{ type: 'negativeKeyword', items: [{ term: 'free pet brush', kind: '否定词' }, { term: 'pet grooming brush', kind: '保留' }, { term: 'human hair brush', kind: '否定词' }, { term: 'self cleaning slicker brush', kind: '保留' }] }] },
  { id: '4-8', chapter: 4, name: '广告投放 Boss', type: 'boss', goal: '完成 7 日广告投放并达成 ACOS、预算与订单目标', passScore: 80, duration: '约 15 分钟', steps: [{ type: 'adBoss', days: 7, budget: 100, priceUSD: 30, target: { acos: 0.3, adOrderRate: 0.4 } }] },
];
