// 第 6 章：客服与售后（PawPal 宠物梳）
const good = (text, explanation, extra) => ({ id: 'good', text, explanation, outcome: { qualityScore: 100, compliant: true, responseHours: 4, resolved: true, satisfactionDelta: 25, cost: {}, ...extra } });
const acceptable = (text, explanation, extra) => ({ id: 'acceptable', text, explanation, outcome: { qualityScore: 60, compliant: true, responseHours: 20, resolved: false, satisfactionDelta: 5, cost: {}, ...extra } });
const bad = (text, explanation, extra) => ({ id: 'bad', text, explanation, outcome: { qualityScore: 40, compliant: false, responseHours: 36, resolved: false, satisfactionDelta: -25, cost: {}, ...extra } });
const scenario = (id, title, message, facts, policy, options, initialSatisfaction = 60) => ({ id, title, message, facts, policy, initialSatisfaction, options });

const basicCases = [
  scenario('basic-use', '不会使用宠物梳', '我第一次用，不知道应该怎么给宠物梳毛。', '订单已签收，暂无质量异常。', '先给出安全、清洁和使用步骤。', [
    good('说明轻梳方向、力度和清洁方法，并邀请客户反馈。', '先解决使用问题，再留下跟进路径。', { responseHours: 4 }),
    acceptable('只回复“请查看说明”，不补充重点步骤。', '有回应但缺少可执行指导。', { responseHours: 12 }),
    bad('直接让客户自行摸索，并承诺一定马上学会。', '缺少指导且做出无法保证的承诺。'),
  ]),
  scenario('basic-hair', '咨询适用毛发', '我的宠物毛比较长，这把梳子适合吗？', '商品适合日常梳理，不承诺适用于所有毛况。', '如不确定，应说明适用范围并建议先小范围尝试。', [
    good('说明适合日常梳理，建议先在小范围轻柔尝试。', '给出边界和低风险验证方式。', { responseHours: 6 }),
    acceptable('回复“适合所有宠物”，但不说明使用边界。', '结论过于绝对，缺少风险提示。', { responseHours: 8 }),
    bad('要求客户先公开晒图才能提供建议。', '把正常咨询与额外条件绑定。'),
  ]),
  scenario('basic-discomfort', '首次反馈不适', '用了之后宠物有点躲，应该继续用吗？', '客户描述可能存在不适，尚未确认是否受伤。', '先停止使用，询问情况；必要时建议就医。', [
    good('建议先停止使用并观察，询问不适情况；若持续则咨询专业人士。', '安全问题优先，避免用赔付代替必要提醒。', { responseHours: 2, satisfactionDelta: 30 }),
    acceptable('回复“这是正常适应期”，让客户继续使用。', '忽略潜在安全风险。', { responseHours: 3 }),
    bad('直接承诺退款，但不提醒停止使用。', '只处理费用，遗漏安全处置。', { responseHours: 4, cost: { refundCents: 1699 } }),
  ]),
];

const reviewCases = [
  scenario('review-damage', '差评中的质量问题', '梳齿收到时就断了，我要给差评。', '客户提供了破损照片，订单在售后期内。', '先核实证据，按客户选择退款或补发，不引导删除评价。', [
    good('确认照片并致歉，提供退款或补发选项，不要求修改评价。', '先解决质量问题，评价由客户自主决定。', { responseHours: 4, satisfactionDelta: 30, cost: { refundCents: 1699 } }),
    acceptable('只回复请修改评价，暂不处理破损。', '把评价处理放在客户权益之前。', { responseHours: 8 }),
    bad('承诺补偿但要求删除差评。', '以利益交换评价，违反客服合规原则。'),
  ]),
  scenario('review-delay', '差评中的物流问题', '物流太慢了，商品还没到就想给差评。', '物流状态显示运输中，尚未超过模拟商城承诺时限。', '核实物流状态，说明下一次跟进时间，不虚构到货日期。', [
    good('说明当前节点和下一次跟进时间，承诺持续查询，不保证具体到货日。', '透明沟通可控信息，避免过度承诺。', { responseHours: 6, satisfactionDelta: 20 }),
    acceptable('回复“马上就到”，但没有查询节点。', '安抚意图可以理解，但事实不足。', { responseHours: 4 }),
    bad('要求客户先删差评，才帮忙查询物流。', '将服务与评价绑定。'),
  ]),
  scenario('review-malicious', '识别不当诉求', '给我现金，我就把低星评价删掉。', '客户未提供质量问题证据，只提出交换条件。', '拒绝评价交换，仍可邀请客户描述真实问题。', [
    good('拒绝以补偿交换评价，同时邀请客户说明真实使用问题。', '不参与评价操纵，保留正常服务入口。', { responseHours: 8, satisfactionDelta: 10 }),
    acceptable('只回复无法处理，不再询问是否存在真实问题。', '避免违规，但错过问题收集机会。', { responseHours: 12 }),
    bad('同意现金换删评。', '明确不合规，不能用其他优点抵消。'),
  ]),
];

const returnCases = [
  scenario('return-damage', '破损退款', '梳齿断了，我不想换货，只要退款。', '已核实破损，客户在售后期内并明确选择退款。', '应按规则完成退款，不附加评价条件。', [
    good('确认破损后按客户选择全额退款，并说明处理节点。', '满足合理售后诉求且沟通清晰。', { responseHours: 4, satisfactionDelta: 30, cost: { refundCents: 1699 } }),
    acceptable('要求客户先寄回再考虑退款，但未说明规则。', '增加不必要摩擦，未尊重已确认事实。', { responseHours: 12, satisfactionDelta: -5 }),
    bad('以没有库存为由拒绝已确认的退款。', '不能用库存问题否定应有售后。'),
  ]),
  scenario('return-fit', '不适用退货', '用了一次觉得不顺手，想退货。', '商品功能正常，客户仍在模拟商城退货规则范围内。', '先说明退货条件和流程，不把个人偏好说成质量故障。', [
    good('说明退货条件、操作路径和可能产生的费用，再按规则处理。', '区分质量问题与不适用，同时给出明确路径。', { responseHours: 8, satisfactionDelta: 20 }),
    acceptable('直接拒绝，说使用过就不能退。', '没有核对当前模拟规则。', { responseHours: 6, satisfactionDelta: -10 }),
    bad('建议客户谎称质量问题来获得退款。', '引导虚假申报，明确不合规。'),
  ]),
  scenario('return-package', '包装轻微破损', '外包装有点皱，但梳子看起来没问题。', '商品主体完好，客户愿意保留并接受合理部分补偿。', '确认商品状态，记录问题，按授权范围提供自愿方案。', [
    good('确认商品完好，记录包装问题；客户自愿保留时提供3美元部分退款。', '补偿与事实和客户选择匹配。', { responseHours: 6, satisfactionDelta: 20, cost: { refundCents: 300 } }),
    acceptable('不核实商品状态，直接全额退款。', '解决问题但成本和处置不匹配。', { responseHours: 5, satisfactionDelta: 15, cost: { refundCents: 1699 } }),
    bad('让客户自己承担并关闭工单。', '未核实也未提供解决路径。'),
  ]),
];

const orderCases = [
  scenario('order-delay', '延迟未签收', '订单还没到，能告诉我今天一定收到吗？', '物流显示运输中，预计时间仍可能变化。', '说明当前状态和跟进时间，不保证不可控的具体到货日。', [
    good('说明运输节点，承诺在24小时内再次查询并反馈，不保证具体到货日。', '承诺可控的跟进动作。', { responseHours: 4, satisfactionDelta: 25 }),
    acceptable('回复今天一定到，但没有查物流。', '过度承诺且缺少事实核实。', { responseHours: 2, satisfactionDelta: -10 }),
    bad('让客户自行联系承运商，店铺不再跟进。', '把应处理的异常完全推给客户。'),
  ]),
  scenario('order-missing', '漏发一件', '包裹里少了一把梳子，我已经拍照了。', '照片和发货记录显示漏发，客户确认收货地址不变。', '核实后补发或退款，并给出下一次跟进节点。', [
    good('确认照片和记录，按客户选择补发或退款，并告知下一次跟进时间。', '事实核实、解决方式和时间承诺完整。', { responseHours: 6, satisfactionDelta: 25, cost: { replacementCents: 221, shippingCents: 400 } }),
    acceptable('只说已登记，等待仓库有空再处理。', '缺少明确解决路径和时间。', { responseHours: 8, satisfactionDelta: -5 }),
    bad('要求客户再次购买后才补发。', '让客户为已确认的漏发再次付款。'),
  ]),
  scenario('order-address', '地址错误', '我刚发现地址填错了，能帮我改吗？', '订单尚未出库，地址仍可在模拟商城内修改。', '核对订单状态和新地址，修改后复述确认。', [
    good('核对订单和新地址，修改后复述确认，并说明已更新。', '先核实再操作，降低二次错误。', { responseHours: 3, satisfactionDelta: 25 }),
    acceptable('直接按客户消息中的地址修改，不再复述确认。', '动作可能正确，但缺少二次核对。', { responseHours: 2 }),
    bad('公开回复完整收货地址，要求客户自行处理。', '泄露订单信息且未完成服务。'),
  ]),
];

const metricsStats = { ticketCount: 20, timelyCount: 18, resolvedCount: 16, orderCount: 100, refundedOrderCount: 5, ratingCount: 10, satisfiedCount: 8 };
const bossCases = [
  scenario('boss-delay', '物流延迟工单', '客户已签收但抱怨等待太久。', '物流记录显示已签收。', '确认收货并完成跟进。', [good('确认收货并完成跟进。', '闭环处理。', { responseHours: 4, satisfactionDelta: 25 })]),
  scenario('boss-damage', '梳齿破损工单', '已核实破损，客户只要退款。', '破损已核实，客户选择退款。', '按客户选择全额退款。', [good('按客户选择全额退款。', '满足明确售后诉求。', { responseHours: 2, satisfactionDelta: 30, cost: { refundCents: 1699 } })]),
  scenario('boss-missing', '漏发工单', '已核实漏发，客户同意补发。', '地址已确认，客户同意补发。', '补发一件并跟进。', [good('补发一件并跟进。', '完成解决闭环。', { responseHours: 6, satisfactionDelta: 25, cost: { replacementCents: 221, shippingCents: 400 } })]),
  scenario('boss-guide', '使用咨询工单', '客户询问清洁和使用方法。', '商品无质量问题。', '提供适用和清洁指导。', [good('提供适用和清洁指导。', '给出可执行帮助。', { responseHours: 8, satisfactionDelta: 20 })]),
  scenario('boss-package', '包装问题工单', '商品完好，客户愿意接受部分退款。', '包装轻微破损，商品主体完好。', '提供3美元部分退款并记录问题。', [good('提供3美元部分退款并记录问题。', '补偿与事实匹配。', { responseHours: 3, satisfactionDelta: 20, cost: { refundCents: 300 } })]),
];

function addBossAlternatives(item) {
  const best = item.options[0];
  item.options = [best, acceptable('仅回复已登记，暂不提供明确解决节点。', '响应但未形成完整闭环。', { responseHours: 20, satisfactionDelta: -5 }), bad('以额外补偿交换客户修改评价。', '评价与售后不应绑定。', { responseHours: 36, satisfactionDelta: -30, cost: { compensationCents: 1000 } })];
  return item;
}
bossCases.forEach(addBossAlternatives);

// 教学样板要素：objectives / abilityDims / transfer / reflection（见 chapter3.js 顶部说明）
// 教学锚点：6-2（差评合规）与 6-6（Boss）必须同时具备迁移题与结构化复述。
module.exports = [
  { id: '6-1', chapter: 6, name: '客服回复基础', type: 'practice',
    goal: '掌握核实问题、表达理解与给出解决路径', passScore: 70,
    objectives: ['先核实事实，再给出客户能执行的下一步', '区分「表达理解」与「过度承诺」', '遇到安全类反馈时把风险处置放在赔付之前'],
    abilityDims: ['service'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '客服不是"会说话"就行，它有一套可复用的结构。先看三步法，再逐张工单练。' },
      { type: 'card', cardId: 'K6-01' },
      { type: 'customerScenario', scenario: 'PawPal 客服基础：逐项选择专业回复。', responseLimitHours: 24, cases: basicCases, passScore: 70, reviewPrompt: '客服回复的第一原则：先确认事实，再给出客户可以执行的下一步。' },
    ] },
  { id: '6-2', chapter: 6, name: '差评识别与处理', type: 'practice',
    goal: '区分质量、物流与不当评价诉求', passScore: 70,
    objectives: ['把差评按质量问题、物流问题、不当诉求三类归因', '说出为什么补偿不能与删评绑定', '把「先核实、再对等解决」的规则迁移到新工单'],
    abilityDims: ['service'],
    steps: [
      { type: 'dialog', speaker: 'Lisa 总', text: '差评来了别慌。先按事实归因，再谈怎么解决——但有一条线绝对不能碰。' },
      { type: 'card', cardId: 'K6-02' },
      { type: 'customerScenario', scenario: 'PawPal 差评处理：解决问题，不交换评价。', responseLimitHours: 24, cases: reviewCases, passScore: 70, reviewPrompt: '差评不是敌人，先按事实归因；任何退款或补偿都不能绑定删评。' },
      { type: 'transfer', scenario: '换三张新工单，规则一个字都没变：先核实事实，再给客户能执行的动作；补偿与评价不能绑定。', questions: [
        { id: '6-2-t1', kind: 'choice', question: '客户留言：「外包装压扁了，梳子本身没事，但我想全额退款。」商品主体完好、包装仅轻微变形，客户并未提出退货。最专业的处理是？', answer: 'A', options: [
          { key: 'A', text: '确认商品主体完好并记录包装问题，按授权范围提出合理部分补偿，说明依据' },
          { key: 'B', text: '直接全额退款，避免差评' },
          { key: 'C', text: '让客户自己承担，因为商品没坏' } ],
          explain: '事实与补偿必须对等：主体完好、只影响包装，应记录问题并给出匹配的部分补偿。全额退款成本和事实不匹配；完全不理则忽略了客户体验。' },
        { id: '6-2-t2', kind: 'choice', question: '客户说：「给我 100 元补偿，我就把一星评价删掉。」且没有提供任何质量问题证据。正确处理是？', answer: 'B', options: [
          { key: 'A', text: '同意补偿，先把差评解决掉' },
          { key: 'B', text: '拒绝以补偿交换评价，同时邀请客户说明真实使用问题' },
          { key: 'C', text: '不回复，等系统自动过期' } ],
          explain: '评价与补偿不能绑定，这是明确的合规红线；但拒绝之后仍要保留正常服务入口，请客户描述真实问题。' },
        { id: '6-2-t3', kind: 'choice', question: '物流显示运输中、未超承诺时限，客户催问「今天一定到吗」。专业回复是？', answer: 'B', options: [
          { key: 'A', text: '承诺今天一定到，先安抚客户' },
          { key: 'B', text: '说明当前物流节点，承诺 24 小时内再次查询并主动反馈' },
          { key: 'C', text: '让客户自己联系承运商' } ],
          explain: '专业客服承诺的是可控的跟进动作，而不是不可控的具体到货时间。过度承诺一旦兑现不了，会二次伤害信任。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用两句话说明你的客服处理原则（第一句给原则结论，第二句给事实依据）', fields: [
        { key: 'decision', label: '我处理差评的原则是', placeholder: '例：先核实事实，再给对等方案，绝不拿补偿换评价',
          keywords: [['核实', '确认', '事实'], ['补偿', '退款', '赔偿'], ['评价', '差评', '删评'], ['合规', '违规', '红线']], minHits: 1,
          sample: '我处理差评的原则是先核实事实，再按事实给出对等的解决方案，绝不把补偿与删评绑定。' },
        { key: 'evidence', label: '我依据的是', placeholder: '例：主体完好只影响包装、客户没给证据、物流仍在运输中',
          keywords: [['主体完好', '包装', '完好'], ['没有证据', '无证据', '未提供'], ['运输中', '物流', '节点'], ['合规', '红线', '违规']], minHits: 1,
          sample: '我依据的是工单事实：主体完好只影响包装、客户未提供质量证据、物流仍在运输中未超时限，所以补偿与承诺都必须与事实匹配。' },
      ], passScore: 2 },
    ] },
  { id: '6-3', chapter: 6, name: '退货退款决策', type: 'practice',
    goal: '按事实和规则做出合规售后决策', passScore: 70,
    objectives: ['区分质量问题与「不适用」退货', '按规则而不是按情绪决定退与不退', '说出虚假申报为什么不能碰'],
    abilityDims: ['service'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '「有问题要退」和「用着不顺手想退」是两码事，处理方式也完全不同。' },
      { type: 'card', cardId: 'K6-05' },
      { type: 'customerScenario', scenario: 'PawPal 售后决策：权益、成本与合规要同时考虑。', responseLimitHours: 24, cases: returnCases, passScore: 70, reviewPrompt: '退款率是结果指标，不能为了压低退款而拒绝合理权益。' },
    ] },
  { id: '6-4', chapter: 6, name: '订单异常沟通', type: 'practice',
    goal: '处理延迟、漏发与地址异常', passScore: 70,
    objectives: ['处理延迟、漏发与地址错误三类异常', '承诺可控动作而不是不可控结果', '改动类操作先核实、再复述确认'],
    abilityDims: ['service'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '客户催物流的时候，你越是拍胸脯保证，后面越容易翻车。记住一条原则再开始。' },
      { type: 'card', cardId: 'K6-03' },
      { type: 'customerScenario', scenario: 'PawPal 订单异常：承诺可控动作，不承诺不可控结果。', responseLimitHours: 24, cases: orderCases, passScore: 70, reviewPrompt: '专业客服承诺下一次跟进时间，而不是虚构一个到货时间。' },
    ] },
  { id: '6-5', chapter: 6, name: '服务指标', type: 'practice',
    goal: '计算客服响应、解决、退款与满意度指标', passScore: 70,
    objectives: ['算出及时响应率、解决率、退款订单率与满意度', '说出分母选错会怎样误导结论'],
    abilityDims: ['service'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '指标算错往往不是算错，而是分母选错。先记住四个分母，再动手。' },
      { type: 'card', cardId: 'K6-04' },
      { type: 'serviceMetrics', scenario: '根据本周客服报表计算四项服务指标。输入数字百分比，例如90。', stats: metricsStats, fields: [
    { key: 'timelyResponseRate', label: '及时响应率', formula: '及时回复工单 ÷ 需回复工单 × 100%', answer: 90, unit: '%' },
    { key: 'resolutionRate', label: '解决率', formula: '已解决工单 ÷ 总工单 × 100%', answer: 80, unit: '%' },
    { key: 'refundRate', label: '退款订单率', formula: '发生退款订单 ÷ 统计订单 × 100%', answer: 5, unit: '%' },
    { key: 'satisfactionRate', label: '满意度', formula: '满意评价 ÷ 有效评价 × 100%', answer: 80, unit: '%' },
  ], tolerancePercentagePoints: 0.1, reviewPrompt: '先看分母，再看分子；退款订单率不等于退货率。' },
    ] },
  { id: '6-6', chapter: 6, name: '客服综合 Boss', type: 'boss',
    goal: '在合规、满意度、效率和售后支出之间取得平衡', passScore: 80,
    objectives: ['在合规、满意度、效率与售后成本之间取得平衡', '说清每张工单的处理依据', '识别并避开不合规动作'],
    abilityDims: ['service'],
    steps: [
      { type: 'dialog', speaker: 'Lisa 总', text: '最后一关：一个班次的五张工单，全部由你独立处理。合规、满意度、效率、成本，四条线要同时守住。' },
      { type: 'card', cardId: 'K6-01' },
      { type: 'customerBoss', scenario: '客服综合 Boss：处理一班五张工单。', responseLimitHours: 24, cases: bossCases, targets: { minTimelyResponseRate: 0.8, minResolutionRate: 0.8, minAverageSatisfaction: 80, minQualityScore: 80, maxCostCents: 3500 }, reviewPrompt: '综合处理要做到：事实清楚、动作合规、问题解决、承诺可控。' },
      { type: 'transfer', scenario: '换一组客服报表：需回复工单 25 张、及时回复 20 张、已解决 19 张；统计订单 200 单、退款 8 单；有效评价 20 条、满意 16 条。公式不变，重新算。', questions: [
        { id: '6-6-t1', kind: 'number', question: '及时响应率是多少（百分比，填数字）？', answer: 80, tolerance: 0.5, unit: '%',
          explain: '及时响应率 = 及时回复工单 ÷ 需回复工单 = 20 ÷ 25 = 80%。分母是「需要回复的工单」，不是全部订单。' },
        { id: '6-6-t2', kind: 'number', question: '退款订单率是多少（百分比，填数字）？', answer: 4, tolerance: 0.2, unit: '%',
          explain: '退款订单率 = 发生退款订单 ÷ 统计订单 = 8 ÷ 200 = 4%。分母是订单数，不是工单数——这是最容易用错的一个分母。' },
        { id: '6-6-t3', kind: 'number', question: '满意度是多少（百分比，填数字）？', answer: 80, tolerance: 0.5, unit: '%',
          explain: '满意度 = 满意评价 ÷ 有效评价 = 16 ÷ 20 = 80%。只统计有效评价，不计未评价的订单。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用三句话复盘这次客服验收：结论、依据、合规风险', fields: [
        { key: 'decision', label: '这次客服验收的结论是', placeholder: '例：四项指标与合规同时达标才算通过',
          keywords: [['及时响应', '响应率', '解决率', '满意度'], ['达标', '未达标', '80', '通过'], ['合规']], minHits: 1,
          sample: '这次客服验收的结论是：及时响应率、解决率、满意度和合规四项都达标，才算真正通过。' },
        { key: 'evidence', label: '我依据的数据是', placeholder: '例：及时 20/25、解决 19/25、满意 16/20、退款 8/200',
          keywords: [['80', '及时响应', '响应率'], ['20', '25'], ['19', '解决率'], ['16', '20', '满意度'], ['8', '200', '退款']], minHits: 2,
          sample: '我依据的数据是需回复 25 张、及时 20 张、解决 19 张，满意 16/20 条，退款 8/200 单，四项指标都落在目标线以上。' },
        { key: 'risk', label: '我识别出的合规风险是', placeholder: '例：补偿换删评、虚假申报、不可控承诺、泄露订单信息',
          keywords: [['删评', '修改评价', '评价', '换评价'], ['补偿', '补偿金', '现金', '利益交换'], ['虚假', '谎称', '不实', '申报'], ['过度承诺', '承诺', '保证'], ['泄露', '隐私', '地址']], minHits: 1,
          sample: '我识别出的合规风险是：用补偿交换删评、引导客户虚假申报、对客户做出无法兑现的承诺，以及公开泄露订单地址信息。' },
      ], passScore: 2 },
    ] },
];
