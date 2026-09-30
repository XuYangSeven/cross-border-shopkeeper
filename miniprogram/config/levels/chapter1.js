// 第 1 章关卡配置（对应《MVP详细设计_第1-2章.md》第 1 章 3 关）
// 通用步骤类型 step.type：
//   dialog    剧情对话  { speaker, text, portrait }
//   card      知识卡片弹出 { cardId }
//   quiz      选择题 { question, options[{key,text,correct,explain}] }
//   moduleTour 后台模块点亮引导 { modules: [moduleKey...] }
//   formulaPuzzle 公式拼装 { formula }
//   calc      数值计算题 { skuId 或自定义数值, blanks[] }
//   diagnose  诊断勾选 { items[{text, isProblem, prescription[]}] }
//   transfer  迁移题 { scenario, questions[{kind:'choice'|'number',...}], passRatio }
//   reflection 结构化复述 { prompt, fields[{key,label,keywords,minHits,sample}], passScore }
// 关卡元数据：
//   objectives 学习目标清单（结果页展示）
//   abilityDims 本关记录的能力维度（对应 engine/learning 的 DIMENSIONS）

module.exports = [
  {
    id: '1-1', chapter: 1, name: '第一天上班', type: 'tutorial',
    goal: '认识卖家后台 6 大模块，完成店铺体检',
    passScore: 70, duration: '约 8 分钟',
    objectives: ['说出后台 6 大模块各自的作用', '知道运营每天的第一件事是看数据', '理解断货与账户健康的风险等级'],
    abilityDims: ['foundation'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '欢迎加入星帆跨境！我是你的导师老陈。从今天起，你负责我们的宠物用品店铺「PawPal」。' },
      { type: 'dialog', speaker: '老陈', text: '上班第一件事：打开卖家后台。我带你把 6 大模块过一遍。' },
      { type: 'moduleTour', modules: ['dashboard', 'listing', 'ads', 'inventory', 'orders', 'health'] },
      { type: 'card', cardId: 'K1-01' },
      { type: 'card', cardId: 'K1-02' },
      { type: 'card', cardId: 'K1-03' },
      { type: 'card', cardId: 'K1-04' },
      { type: 'card', cardId: 'K1-05' },
      { type: 'card', cardId: 'K1-06' },
      { type: 'quiz', question: '运营每天上班第一件事？', options: [
        { key: 'A', text: '看数据看板', correct: true, explain: '数据是运营的眼睛，先看流量、转化、订单三件套。' },
        { key: 'B', text: '回复邮件', correct: false, explain: '重要但不第一，数据优先。' },
        { key: 'C', text: '刷新销量', correct: false, explain: '只盯着销量数字是新手常见误区。' } ] },
      { type: 'quiz', question: '哪个模块能看出「钱花得值不值」？', options: [
        { key: 'A', text: '广告模块', correct: true, explain: '广告模块的 ACOS 数据衡量投入产出比。' },
        { key: 'B', text: '库存模块', correct: false, explain: '库存看的是周转，不是花钱效率。' },
        { key: 'C', text: '订单中心', correct: false, explain: '订单中心看履约与异常。' } ] },
      { type: 'quiz', question: '断货的后果是什么？', options: [
        { key: 'A', text: '排名下跌', correct: true, explain: '断货一天，排名跌一周。' },
        { key: 'B', text: '没什么影响', correct: false, explain: '影响非常大。' },
        { key: 'C', text: '平台给补贴', correct: false, explain: '不但没补贴，还可能影响绩效。' } ] },
      { type: 'quiz', question: '商品页面统称什么？', options: [
        { key: 'A', text: 'Listing', correct: true, explain: 'Listing 是商品页面的行业标准叫法。' },
        { key: 'B', text: 'Logo', correct: false, explain: 'Logo 是品牌标识。' },
        { key: 'C', text: '链接', correct: false, explain: '口语化说法，不专业。' } ] },
      { type: 'quiz', question: '账户健康出问题的严重后果？', options: [
        { key: 'A', text: '封店风险', correct: true, explain: '订单缺陷率超标会触发审查甚至封店。' },
        { key: 'B', text: '扣 1 分', correct: false, explain: '远比扣分严重。' },
        { key: 'C', text: '流量加 10%', correct: false, explain: '恰恰相反。' } ] },
      { type: 'dialog', speaker: '老陈', text: '不错，模块都认全了。明天开始教你看数据。' },
    ],
    rewards: { unlock: 'shop 全模块', title: null },
  },
  {
    id: '1-2', chapter: 1, name: '读懂三个数字', type: 'metric',
    goal: '理解访客数、转化率、客单价，掌握销售额公式',
    passScore: 70, duration: '约 10 分钟',
    objectives: ['写出销售额公式的三个变量', '用公式算出任意店铺的销售额', '判断"流量大"和"转化高"哪个更值钱'],
    abilityDims: ['foundation'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '今天教你跨境电商最重要的一个公式，学会了它你就看懂了 80% 的运营动作。' },
      { type: 'card', cardId: 'K1-07' },
      { type: 'formulaPuzzle', formula: 'sales', slots: ['访客数', '转化率', '客单价'] },
      { type: 'calc', scenario: '上周数据：访客 1000，转化率 8%，客单价 $25。请算出销售额', blanks: [
        { answer: 2000, unit: '$', hint: '1000 × 8% × 25' } ] },
      { type: 'calc', scenario: '第 2 轮：访客 2000，转化率 5%，客单价 $40。销售额是多少？', blanks: [
        { answer: 4000, unit: '$', hint: '2000 × 5% × 40' } ] },
      { type: 'calc', scenario: '第 3 轮：访客 800，转化率 12%，客单价 $18。销售额是多少？', blanks: [
        { answer: 1728, unit: '$', hint: '800 × 12% × 18' } ] },
      { type: 'calc', scenario: '坑题来了：访客 5000，转化率 1%，客单价 $60。销售额是多少？', blanks: [
        { answer: 3000, unit: '$', hint: '5000 × 1% × 60' } ] },
      { type: 'card', cardId: 'K1-09' },
      { type: 'quiz', question: '哪个店铺表现更好？A 店：访客 5000、转化 1%；B 店：访客 800、转化 12%', options: [
        { key: 'A', text: 'A 店，流量大', correct: false, explain: '流量大但转化差，广告费白烧。' },
        { key: 'B', text: 'B 店，转化高', correct: true, explain: '转化率是分水岭，精准流量才值钱。' },
        { key: 'C', text: '无法比较', correct: false, explain: '可以比较：转化维度 B 明显更优。' } ] },
      { type: 'card', cardId: 'K1-08' },
      { type: 'transfer', scenario: '换一家店：访客 1500、转化率 6%、客单价 $32。公式不变，数据全变，请重新算一遍。', questions: [
        { id: '1-2-t1', kind: 'number', question: '这家店的销售额是多少？', answer: 2880, tolerance: 1, unit: '$',
          explain: '1500 × 6% × 32 = 2880。公式不变，换数字照样能算。' },
        { id: '1-2-t2', kind: 'number', question: '如果转化率从 6% 提升到 12%，销售额会变成多少？', answer: 5760, tolerance: 2, unit: '$',
          explain: '1500 × 12% × 32 = 5760。转化率翻倍 → 销售额翻倍，这就是"撬动变量"的含义。' },
        { id: '1-2-t3', kind: 'choice', question: '下面哪个动作对销售额的提升最直接？', answer: 'A', options: [
          { key: 'A', text: '把转化率从 6% 提到 12%' },
          { key: 'B', text: '把访客从 1500 加到 1600' },
          { key: 'C', text: '把客单价从 $32 提到 $33' } ],
          explain: '转化率翻倍直接让销售额翻倍；访客 +7% 或客单价 +3% 的杠杆小得多。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用两句话说明你的判断依据（第一句给结论，第二句给数据）', fields: [
        { key: 'decision', label: '我的结论是', placeholder: '例：B 店更强／本店优先提转化',
          keywords: [['转化率', '转化'], ['b店', 'B店', 'b 店']], minHits: 1,
          sample: '我的结论是转化率比流量更值钱，所以优先提转化而不是加访客。' },
        { key: 'evidence', label: '我依据的数据是', placeholder: '例：A 店访客 5000 但转化只有 1%',
          keywords: [['5000'], ['1%'], ['800'], ['12%'], ['2880'], ['5760']], minHits: 1,
          sample: '我依据的是 A 店访客 5000 转化仅 1%，而 B 店访客 800 转化 12%，精准流量带来的订单效率更高。' },
      ], passScore: 2 },
      { type: 'dialog', speaker: '老陈', text: '公式刻进脑子里。明天来点实战——给咱们的店做个体检。' },
    ],
    rewards: { unlock: '数据看板完整版' },
  },
  {
    id: '1-3', chapter: 1, name: '店铺体检', type: 'boss',
    goal: '找出病店的 5 处问题并给出诊断处方',
    passScore: 70, duration: '约 10 分钟',
    objectives: ['从 8 个现象里区分真问题和干扰项', '为每个真问题选出正确处方', '说出处理优先级及其理由'],
    abilityDims: ['foundation'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '这是接手前的老店铺数据：访客 3000、转化 2.5%、ACOS 65%、库存仅剩 5 天、还有 1 条一星差评。' },
      { type: 'dialog', speaker: '老陈', text: '它病得不轻。你从 8 个选项里勾出 5 个真问题，注意有 3 个干扰项。' },
      { type: 'diagnose', items: [
        { text: '转化率过低（2.5%）', isProblem: true, prescriptions: [
          { text: '降价 15% 冲转化', good: false },
          { text: '优化主图和标题', good: true },
          { text: '加广告预算', good: false } ] },
        { text: 'ACOS 严重超标（65%）', isProblem: true, prescriptions: [
          { text: '全关广告省成本', good: false },
          { text: '否定烧钱词+降竞价', good: true },
          { text: '提高售价', good: false } ] },
        { text: '库存告急（仅剩 5 天）', isProblem: true, prescriptions: [
          { text: '立即计算补货+空运止血', good: true },
          { text: '等卖完再说', good: false },
          { text: '涨价减速销售', good: false } ] },
        { text: '一星差评未处理', isProblem: true, prescriptions: [
          { text: '联系客户了解原因并解决', good: true },
          { text: '花钱删差评', good: false },
          { text: '忽略不理', good: false } ] },
        { text: '主图不规范（非白底）', isProblem: true, prescriptions: [
          { text: '换合规白底主图', good: true },
          { text: '保留现状有个性', good: false },
          { text: '加促销水印', good: false } ] },
        { text: '访客太少（3000/周）', isProblem: false, explain: '3000 访客不算低，问题在转化不在流量。' },
        { text: '客单价偏低', isProblem: false, explain: '客单价 $25 在宠物类目属正常水平。' },
        { text: '被平台限流', isProblem: false, explain: '数据不支持限流判断，别甩锅平台。' } ] },
      { type: 'card', cardId: 'K1-10' },
      { type: 'card', cardId: 'K1-11' },
      { type: 'transfer', scenario: '换一家病店，数据全变：访客 5000、转化率 1.2%、ACOS 80%、库存还剩 25 天、店铺评分 4.8。还是同一套诊断标准。', questions: [
        { id: '1-3-t1', kind: 'choice', question: '哪一项其实不是问题？', answer: 'A', options: [
          { key: 'A', text: '库存还剩 25 天' },
          { key: 'B', text: '转化率只有 1.2%' },
          { key: 'C', text: 'ACOS 高达 80%' } ],
          explain: '25 天库存属健康水位，不构成告急。另外两项都严重超标，这才是真问题。' },
        { id: '1-3-t2', kind: 'choice', question: 'ACOS 80% 应该怎么处理？', answer: 'B', options: [
          { key: 'A', text: '直接全关广告省成本' },
          { key: 'B', text: '否定烧钱词并下调竞价' },
          { key: 'C', text: '提高售价把比例压下来' } ],
          explain: '关掉广告等于放弃流量；提价会打击转化。正确动作是砍掉无效词并降低竞价。' },
        { id: '1-3-t3', kind: 'choice', question: '访客 5000 却有 1.2% 转化，最该先做什么？', answer: 'A', options: [
          { key: 'A', text: '优化主图与标题，先把转化修好' },
          { key: 'B', text: '继续加大广告预算买更多流量' },
          { key: 'C', text: '直接降价 30% 冲单量' } ],
          explain: '流量已经不少，问题在承接能力。转化没修好之前加预算，等于把广告费烧得更快。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用三句话复盘这次店铺体检：先给优先级，再给数据依据，最后说清不处理的风险', fields: [
        { key: 'decision', label: '我优先处理的问题是', placeholder: '例：库存告急排在第一位',
          keywords: [['库存', '断货'], ['acos', 'ACOS', '广告'], ['转化'], ['差评', '评价']], minHits: 1,
          sample: '我把库存告急排在第一位，因为它会直接导致排名下跌，损失比广告浪费更快更大。' },
        { key: 'evidence', label: '我依据的数据是', placeholder: '例：库存仅剩 5 天、ACOS 65%',
          keywords: [['5天', '仅剩', '库存'], ['65'], ['2.5'], ['一星', '差评', '白底']], minHits: 2,
          sample: '依据是库存仅剩 5 天、ACOS 高达 65%、转化率只有 2.5%、还有一条一星差评未处理。' },
        { key: 'risk', label: '不处理会有什么风险', placeholder: '例：排名下跌、资金被广告烧掉',
          keywords: [['排名', '下跌', '掉排名'], ['封店', '绩效', '账户'], ['资金', '烧钱', '亏损', '成本'], ['流失', '退单', '差评']], minHits: 1,
          sample: '不处理的风险是断货导致排名下跌、广告继续烧钱、差评扩散拉低转化，形成恶性循环。' },
      ], passScore: 2 },
      { type: 'dialog', speaker: '老陈', text: '诊断得有模有样！从明天起，你就是正式的运营助理了。接下来——公司要上新品，选品的任务交给你。' },
    ],
    rewards: { title: '正式员工', unlock: '第 2 章' },
  },
];
