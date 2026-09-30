// 第 2 章关卡配置（对应《MVP详细设计_第1-2章.md》第 2 章 6 关）
// 额外步骤类型：
//   skuFilter 情报卡初筛 { skuIds[], candidates[], reasons: tag->reasonName }
//   profitCalc 利润核算 { skuIds[], blanksPerSku }
//   radarScore 五维打分 { skuIds[], weights }
//   negotiate 供应商谈判 { factories[] }
//   transfer 迁移题 { scenario, questions[], passRatio }
//   reflection 结构化复述 { prompt, fields[], passScore }
// 关卡元数据：objectives 学习目标 / abilityDims 能力维度

const REASONS = {
  trap_battery: '物流风险：含电池',
  trap_liquid: '物流风险：液体',
  trap_magnetic: '物流风险：磁性',
  trap_patent: '侵权风险：外观专利',
  trap_season: '季节陷阱：淡旺季极端',
  trap_competition: '竞争红海：头部垄断',
  trap_lowprice: '利润陷阱：客单价过低',
  trap_market: '容量不足：蛋糕太小',
  trap_fragile: '物流风险：易碎高破损',
  candidate: '通过初筛，进入候选',
};

module.exports = [
  {
    id: '2-1', chapter: 2, name: '认识选品五维', type: 'tutorial',
    goal: '理解五维模型：容量/竞争/利润/风险/物流',
    passScore: 70, duration: '约 8 分钟',
    objectives: ['说出选品五维分别看什么数据', '记住毛利率 30% 红线与侵权一票否决'],
    abilityDims: ['sourcing'],
    steps: [
      { type: 'dialog', speaker: 'Lisa 总', text: '公司决定开拓宠物用品新品线，选品的任务交给你。做好心理准备，这一章教你一套吃饭的本事。' },
      { type: 'card', cardId: 'K2-01' },
      { type: 'card', cardId: 'K2-02' },
      { type: 'card', cardId: 'K2-02b' },
      { type: 'card', cardId: 'K2-03' },
      { type: 'card', cardId: 'K2-04' },
      { type: 'quiz', question: '「月搜索量 5 万」对应哪个维度？', options: [
        { key: 'A', text: '市场容量', correct: true, explain: '搜索量是需求的直接体现。' },
        { key: 'B', text: '竞争强度', correct: false, explain: '竞争看的是评论数分布。' },
        { key: 'C', text: '物流友好', correct: false, explain: '物流看重量体积与属性。' } ] },
      { type: 'quiz', question: '「BSR 前 10 平均 1200 条评论」说明什么？', options: [
        { key: 'A', text: '市场容量大', correct: false, explain: '评论多≠市场大，是竞争激烈。' },
        { key: 'B', text: '红海竞争，慎入', correct: true, explain: '评论是护城河，千评=壁垒高。' },
        { key: 'C', text: '产品质量好', correct: false, explain: '跟质量无关。' } ] },
      { type: 'quiz', question: '发现候选品疑似仿冒大牌外观，应该？', options: [
        { key: 'A', text: '利润高就做', correct: false, explain: '侵权收益远小于风险。' },
        { key: 'B', text: '一票否决，直接排除', correct: true, explain: '侵权=下架+资金冻结，一票否决。' },
        { key: 'C', text: '先卖卖看', correct: false, explain: '侥幸心理是跨境大忌。' } ] },
      { type: 'quiz', question: '「带锂电池的玩具」卡在哪个维度？', options: [
        { key: 'A', text: '物流友好', correct: true, explain: '电池属危险品，头程受限、费用高。' },
        { key: 'B', text: '市场容量', correct: false, explain: '容量看搜索量。' },
        { key: 'C', text: '利润空间', correct: false, explain: '利润看核算。' } ] },
      { type: 'quiz', question: '毛利率红线是多少？', options: [
        { key: 'A', text: '15%', correct: false, explain: '太低，费用波动就亏。' },
        { key: 'B', text: '30%', correct: true, explain: '30% 是跨境的安全垫。' },
        { key: 'C', text: '50%', correct: false, explain: '50% 很理想但不是红线。' } ] },
      { type: 'dialog', speaker: '老陈', text: '五个维度记住了。明天发你一批情报卡，实战筛一遍。' },
    ],
    rewards: {},
  },
  {
    id: '2-2', chapter: 2, name: '情报卡片初筛', type: 'practice',
    goal: '从 10 张情报卡筛出 4 个候选品',
    passScore: 70, duration: '约 12 分钟',
    objectives: ['识别电池/液体/磁性/侵权/季节/垄断六类淘汰项', '为每个淘汰项写出理由'],
    abilityDims: ['sourcing'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '这是选品软件导出的 10 个宠物用品情报卡。逐一判定：进候选还是淘汰？淘汰要说得出理由。' },
      { type: 'skuFilter', skuIds: ['SKU-001','SKU-002','SKU-003','SKU-004','SKU-005','SKU-006','SKU-007','SKU-008','SKU-009','SKU-010'], reasons: REASONS },
      { type: 'card', cardId: 'K2-05' },
      { type: 'card', cardId: 'K2-06' },
      { type: 'dialog', speaker: '老陈', text: '陷阱全排干净了？很好。但初筛只是排雷——到底赚不赚钱，得算账。' },
    ],
    rewards: {},
  },
  {
    id: '2-3', chapter: 2, name: '利润核算', type: 'practice',
    goal: '用完整利润公式算出候选品真实毛利率',
    passScore: 70, duration: '约 15 分钟',
    objectives: ['独立算出六项成本与毛利率', '识别体积重导致的仓配跳档', '判断毛利率是否越过 30% 红线'],
    abilityDims: ['sourcing'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '记住这个公式：毛利 = 售价 −（采购+头程+仓配+佣金+退货+汇损）。跟我一步一步算第一件。' },
      { type: 'profitDemo', skuId: 'SKU-001' },
      { type: 'profitCalc', skuId: 'SKU-004' },
      { type: 'profitCalc', skuId: 'SKU-007' },
      { type: 'profitCalc', skuId: 'SKU-010', trap: true, trapExplain: '防抓沙发贴实重仅 0.1kg，但 90×40cm 的面积让体积重达到 90×40×2÷6000=1.2kg，计费重取大值 1.2kg，仓配费直接跳到"超大件1"档 $5.08——毛利率只剩 15.2%，低于 30% 红线，轻抛货陷阱！' },
      { type: 'card', cardId: 'K2-07' },
      { type: 'card', cardId: 'K2-08' },
      { type: 'card', cardId: 'K2-09' },
      { type: 'quiz', question: '防抓沙发贴毛利率远低于表面估算，元凶是？', options: [
        { key: 'A', text: '体积重超标拉高仓配费', correct: true, explain: '轻抛货按体积重计费，费用档位跳档。' },
        { key: 'B', text: '佣金太高', correct: false, explain: '佣金按售价 15% 是固定比例。' },
        { key: 'C', text: '采购价贵了', correct: false, explain: '采购价 ¥11 并不贵。' } ] },
      { type: 'transfer', scenario: '迁移到新商品：宠物毛巾（售价 $9.99、实重 0.2kg、尺寸 30×30×4cm）。这次只给数据，结论自己下。', questions: [
        { id: '2-3-t1', kind: 'choice', question: '物流会按哪个重量向这个品计费？', answer: 'B', options: [
          { key: 'A', text: '0.2kg（实重）' },
          { key: 'B', text: '0.6kg（体积重）' },
          { key: 'C', text: '1.2kg（体积重）' } ],
          explain: '体积重 = 30×30×4 ÷ 6000 = 0.6kg，大于实重 0.2kg，计费重取 0.6kg。' },
        { id: '2-3-t2', kind: 'number', question: '这个品的毛利率大约是多少（百分比，保留一位小数即可）？', answer: 20.9, tolerance: 1, unit: '%',
          explain: '成本 = 采购 $0.88 + 头程 $0.79 + 仓配 $4.13 + 佣金 $1.50 + 退货 $0.50 + 汇损 $0.10 ≈ $7.90，毛利率 ≈ (9.99−7.90)/9.99 ≈ 20.9%。' },
        { id: '2-3-t3', kind: 'choice', question: '基于毛利率结论，你应该怎么处理这个候选品？', answer: 'A', options: [
          { key: 'A', text: '淘汰，毛利率 20.9% 低于 30% 红线' },
          { key: 'B', text: '直接下单，价格便宜好卖' },
          { key: 'C', text: '先把售价提到 $19.99 再看' } ],
          explain: '低于 30% 红线的品，费用一波动就亏，应直接淘汰。' },
      ], passRatio: 0.66 },
      { type: 'dialog', speaker: '老陈', text: '算完账还敢拍脑袋选品吗？接下来给幸存的品打个分。' },
    ],
    rewards: {},
  },
  {
    id: '2-4', chapter: 2, name: '五维打分', type: 'practice',
    goal: '给 3 个幸存品打分并选出主推品',
    passScore: 70, duration: '约 10 分钟',
    objectives: ['为每个维度给出有数据支撑的分数', '用加权总分选出主推品'],
    abilityDims: ['sourcing'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '轮到打分环节。每个维度拖滑杆打 1~5 星，系统会跟专家分对比——看看你的手感靠不靠谱。' },
      { type: 'card', cardId: 'K2-10' },
      { type: 'radarScore', skuIds: ['SKU-001', 'SKU-004', 'SKU-007'], weights: { market: 0.25, competition: 0.25, profit: 0.25, logistics: 0.15, risk: 0.10 } },
      { type: 'quiz', question: '综合五维加权分，主推品应该选谁？', options: [
        { key: 'A', text: '硅胶宠物梳', correct: true, explain: '唯一 4.5 分：物流与利润双优。' },
        { key: 'B', text: '慢食碗', correct: false, explain: '3.6 分，各维度平平。' },
        { key: 'C', text: '猫抓板', correct: false, explain: '3.8 分，瓦楞纸大件拖累物流。' } ] },
      { type: 'card', cardId: 'K2-11' },
      { type: 'dialog', speaker: '老陈', text: '老板拍板了，主推硅胶宠物梳！接下来的任务：找工厂下单。' },
    ],
    rewards: {},
  },
  {
    id: '2-5', chapter: 2, name: '供应商谈判', type: 'side',
    goal: '比价、谈判、打样、下单一条龙',
    passScore: 70, duration: '约 10 分钟',
    objectives: ['至少比价 3 家并说清取舍', '用筹码谈出更优价格', '决定打样与首批订货量'],
    abilityDims: ['sourcing'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '询价的基本盘：至少 3 家工厂。这是三家的报价，你的谈判筹码有 3 个：批量承诺、长期合作、现款现货。' },
      { type: 'negotiate', factories: [
        { name: '老牌大厂', basePriceCNY: 18.5, quality: 92, leadDays: 25, note: '价高质稳交期稳' },
        { name: '新建小厂', basePriceCNY: 14.5, quality: 70, leadDays: 30, note: '便宜 15%，质量存疑' },
        { name: '中型工厂', basePriceCNY: 16.0, quality: 88, leadDays: 20, note: '均衡之选' } ],
        chips: ['批量承诺(-4%)', '长期合作(-3%)', '现款现货(-5%)'] },
      { type: 'card', cardId: 'K2-12' },
      { type: 'card', cardId: 'K2-13' },
      { type: 'card', cardId: 'K2-14' },
      { type: 'quiz', question: '打样环节怎么处理最专业？', options: [
        { key: 'A', text: '省下打样费直接下单', correct: false, explain: '$50 打样避免的是 $5000 级事故。' },
        { key: 'B', text: '打样并做拉力/跌落实测', correct: true, explain: '打样+实测是标准流程。' },
        { key: 'C', text: '看图片差不多就行', correct: false, explain: '图片看不出材质与工艺缺陷。' } ] },
      { type: 'quiz', question: '首批订货量怎么定？', options: [
        { key: 'A', text: '100 件试水，好卖追单', correct: true, explain: '首批宁少勿多，数据说话。' },
        { key: 'B', text: '直接 1000 件压成本', correct: false, explain: '资金与风险双杀。' },
        { key: 'C', text: '等老板定', correct: false, explain: '运营要有自己的判断。' } ] },
      { type: 'dialog', speaker: '老陈', text: '订单下了，货在路上。最后一关——独立完成一次完整选品，敢不敢？' },
    ],
    rewards: {},
  },
  {
    id: '2-6', chapter: 2, name: '首单决策 Boss', type: 'boss',
    goal: '综合运用全章技能，独立完成选品决策',
    passScore: 75, duration: '约 15 分钟', noHint: false,
    objectives: ['独立完成初筛→核算→打分→定夺全流程', '在新类目里复用同一套判断标准', '说清决策依据与承担的风险'],
    abilityDims: ['sourcing'],
    steps: [
      { type: 'dialog', speaker: 'Lisa 总', text: '厨房小物品类，8 个候选品。这次没有老陈带——初筛、核算、打分、定夺，全流程你自己来。' },
      { type: 'skuFilter', skuIds: ['SKU-101','SKU-102','SKU-103','SKU-104','SKU-105','SKU-106','SKU-107','SKU-108'], reasons: REASONS },
      { type: 'profitCalc', skuId: 'SKU-101' },
      { type: 'profitCalc', skuId: 'SKU-107' },
      { type: 'profitCalc', skuId: 'SKU-110' },
      { type: 'radarScore', skuIds: ['SKU-101', 'SKU-107', 'SKU-110'], weights: { market: 0.25, competition: 0.25, profit: 0.25, logistics: 0.15, risk: 0.10 } },
      { type: 'quiz', question: '综合所有数据，最终主推品选谁？', options: [
        { key: 'A', text: '硅胶铲勺5件套', correct: true, explain: '五维均衡，毛利率 40%+，Boss 标准答案。' },
        { key: 'B', text: '保鲜膜切割器', correct: false, explain: '候选合格但容量与利润略逊。' },
        { key: 'C', text: '迷你榨汁杯', correct: false, explain: '电池+千评红海，初筛就该淘汰。' } ] },
      { type: 'card', cardId: 'K2-15' },
      { type: 'transfer', scenario: '最后一组判断题：换类目、换商品，规则不变。用你已经掌握的标准直接下判断。', questions: [
        { id: '2-6-t1', kind: 'choice', question: '某候选品月搜索量 3 万，但 BSR 前 10 平均 1400 条评论。怎么处理？', answer: 'B', options: [
          { key: 'A', text: '直接做，容量够大就行' },
          { key: 'B', text: '放弃，评论数是新店越不过的护城河' },
          { key: 'C', text: '降价抢单，用价格打穿' } ],
          explain: '平均千评以上属红海，新店的评论壁垒无法靠降价解决。' },
        { id: '2-6-t2', kind: 'choice', question: '某品通过初筛、表面毛利率 42%，但包装 80×50×3cm、实重 0.3kg。下一步做什么？', answer: 'A', options: [
          { key: 'A', text: '先算体积重：80×50×3÷6000 = 2kg，重新核算仓配费' },
          { key: 'B', text: '直接下单，42% 已经过线' },
          { key: 'C', text: '尺寸不影响利润，不用管' } ],
          explain: '体积重 2kg 远超实重 0.3kg，仓配费会跳档，必须重算后才能确认毛利率。' },
        { id: '2-6-t3', kind: 'choice', question: '如果两个候选品都过线，一个毛利率 45% 但侵权风险不明，一个毛利率 33% 无风险。选哪个？', answer: 'B', options: [
          { key: 'A', text: '选 45% 的，利润更高' },
          { key: 'B', text: '选 33% 的，侵权是一票否决，不能用利润抵消' },
          { key: 'C', text: '两个都做，分散风险' } ],
          explain: '侵权属一票否决项，不能用利润率或其他分数抵消。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用三句话复盘你的首单决策：结论、依据、风险', fields: [
        { key: 'decision', label: '我最终主推的商品是', placeholder: '例：硅胶铲勺5件套，因为它五维均衡',
          keywords: [['铲勺', '5件套', '五件套', '101'], ['硅胶']], minHits: 1,
          sample: '我最终主推硅胶铲勺5件套，因为它是三个候选品里唯一五维均衡、毛利率超过 40% 的品。' },
        { key: 'evidence', label: '我依据的三个数据是', placeholder: '例：搜索量 4 万+、前10评论数不高、毛利率 41.7%',
          keywords: [['毛利率', '利润', '41', '40'], ['搜索', '容量', '月搜'], ['评论', '竞争'], ['仓配', '物流', '重量', '体积重'], ['初筛', '淘汰']], minHits: 2,
          sample: '依据是月搜索量 4 万+ 支撑容量、前 10 评论数不高说明竞争可控、核算后毛利率 41.7% 高于 30% 红线。' },
        { key: 'risk', label: '我识别出的风险是', placeholder: '例：含电池的品被淘汰，物流受限',
          keywords: [['侵权', '专利'], ['季节'], ['电池', '液体', '磁性', '物流'], ['断货', '库存'], ['体积重'], ['红海', '评论']], minHits: 1,
          sample: '我识别出的风险是：含电池与液体的品物流受限、仿牌外观属侵权红线、强季节品现金流不稳、头部千评品竞争壁垒高。' },
      ], passScore: 2 },
      { type: 'dialog', speaker: '老陈', text: '选品出师了！30 天后见分晓——预告一下：Listing 上架、广告投放、供应链……真正的战争现在才开始。' },
    ],
    rewards: { title: '选品专员', unlock: '五维雷达图工具' },
  },
];
