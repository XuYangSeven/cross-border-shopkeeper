// 第 3 章关卡配置：上架优化（PawPal 宠物梳案例）
// 教学样板要素（与第 1~2 章同构）：
//   objectives  学习目标清单（结果页展示）
//   abilityDims 本关记录的能力维度（对应 engine/learning 的 DIMENSIONS）
//   transfer    迁移题 { scenario, questions[{kind:'choice'|'number',...}], passRatio }
//   reflection  结构化复述 { prompt, fields[{key,label,keywords,minHits,sample}], passScore }
// 教学锚点：3-2（标题结构）与 3-5（Boss）必须同时具备迁移题与结构化复述。
const CORE = [
  { key: 'pet grooming brush', text: 'pet grooming brush', slot: 'title', points: 20 },
  { key: 'self cleaning slicker brush', text: 'self cleaning slicker brush', slot: 'title', points: 20 },
  { key: 'removes loose fur', text: 'removes loose fur', slot: 'bullet', points: 15 },
  { key: 'for dogs and cats', text: 'for dogs and cats', slot: 'bullet', points: 15 },
  { key: 'easy to clean', text: 'easy to clean', slot: 'search', points: 10 },
];

module.exports = [
  {
    id: '3-1', chapter: 3, name: 'Listing 基础认知', type: 'tutorial',
    goal: '认识标题、五点、主图和 A+ 内容的作用', passScore: 70, duration: '约 8 分钟',
    objectives: ['说出标题、五点、主图、A+ 各自承担什么任务', '记住标题「品牌+核心词+属性+场景」的结构', '知道主图决定点击、页面决定转化'],
    abilityDims: ['listing'],
    steps: [
      { type: 'dialog', speaker: 'Lisa 总', text: '选品通过后，下一步是把产品准确地展示给买家。Listing 就是你的线上销售员。' },
      { type: 'card', cardId: 'K3-01' },
      { type: 'card', cardId: 'K1-02' },
      { type: 'quiz', question: 'Listing 标题最重要的作用是什么？', options: [
        { key: 'A', text: '让买家快速知道卖什么', correct: true, explain: '标题要先说清核心品类，再补充关键属性和使用场景。' },
        { key: 'B', text: '尽可能塞满所有关键词', correct: false, explain: '堆词会降低可读性，甚至带来合规风险。' },
        { key: 'C', text: '只写品牌名', correct: false, explain: '买家需要知道具体商品和用途。' },
      ] },
      { type: 'quiz', question: '主图优化首先要关注什么？', options: [
        { key: 'A', text: '白底、主体清晰、能看懂产品', correct: true, explain: '主图承担第一眼点击任务，必须清晰、真实、易识别。' },
        { key: 'B', text: '放大促销文字', correct: false, explain: '主图应突出产品本身，避免干扰信息。' },
        { key: 'C', text: '使用竞品图片', correct: false, explain: '盗用图片存在侵权和下架风险。' },
      ] },
      { type: 'card', cardId: 'K1-08' },
      { type: 'dialog', speaker: '老陈', text: '记住：先让买家看懂，再让算法识别，最后用数据验证。接下来开始改标题。' },
    ], rewards: {},
  },
  {
    id: '3-2', chapter: 3, name: '标题拼装', type: 'practice',
    goal: '按品牌+核心词+属性+场景组成清晰标题', passScore: 70, duration: '约 10 分钟',
    objectives: ['按「品牌+核心词+属性+场景」拼出可读标题', '识别夸大词与堆词', '把标题结构规则迁移到新类目'],
    abilityDims: ['listing'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '标题结构先记住：品牌 + 核心词 + 关键属性 + 使用场景。不要为了塞词牺牲可读性。' },
      { type: 'card', cardId: 'K3-02' },
      { type: 'titlePuzzle', title: 'PawPal Self Cleaning Slicker Brush for Dogs and Cats', blocks: [
        { id: 'brand', text: 'PawPal', order: 0 },
        { id: 'core', text: 'Self Cleaning Slicker Brush', order: 1 },
        { id: 'attribute', text: 'with Retractable Pins', order: 2 },
        { id: 'scene', text: 'for Dogs and Cats', order: 3 },
        { id: 'noise', text: 'Best Cheap Brush', order: 9 },
      ], answer: ['brand', 'core', 'attribute', 'scene'] },
      { type: 'card', cardId: 'K1-02' },
      { type: 'quiz', question: '以下哪个标题问题最大？', options: [
        { key: 'A', text: 'PawPal Self Cleaning Slicker Brush for Dogs and Cats', correct: true, explain: '结构清晰，核心词和适用对象都明确。' },
        { key: 'B', text: 'Best Cheap Brush Amazing No.1 Buy Now', correct: false, explain: '夸大、低相关、缺少清晰品类描述。' },
        { key: 'C', text: 'PawPal Brush', correct: false, explain: '信息太少，无法覆盖核心搜索意图。' },
      ] },
      { type: 'transfer', scenario: '换一个类目：宠物自动饮水机（品牌 PawPal）。标题结构规则一个字都没变，数据全换，请重新判断。', questions: [
        { id: '3-2-t1', kind: 'choice', question: '下面哪个标题最符合「品牌+核心词+属性+场景」的结构？', answer: 'A', options: [
          { key: 'A', text: 'PawPal Automatic Pet Water Fountain with Replaceable Filter for Cats and Small Dogs' },
          { key: 'B', text: 'Best Cheap Water Fountain Amazing No.1 Buy Now' },
          { key: 'C', text: 'PawPal Fountain' } ],
          explain: 'A 四段齐全：品牌 PawPal、核心词 Automatic Pet Water Fountain、属性 with Replaceable Filter、场景 for Cats and Small Dogs。B 夸大堆词且无清晰品类，C 信息不足、覆盖不到搜索意图。' },
        { id: '3-2-t2', kind: 'choice', question: '标题里的「with Replaceable Filter」这一段承担什么作用？', answer: 'B', options: [
          { key: 'A', text: '核心词，说明卖的是什么品类' },
          { key: 'B', text: '属性修饰，补充产品的关键差异点' },
          { key: 'C', text: '场景说明，交代适用对象' } ],
          explain: '核心词是 Automatic Pet Water Fountain；with Replaceable Filter 补的是属性和差异点；for Cats and Small Dogs 才是场景。' },
        { id: '3-2-t3', kind: 'choice', question: '下面哪个词一旦放进标题就是合规风险？', answer: 'A', options: [
          { key: 'A', text: 'No.1 Best Seller' },
          { key: 'B', text: 'with Replaceable Filter' },
          { key: 'C', text: 'for Cats and Small Dogs' } ],
          explain: '「No.1 / Best Seller」属夸大与排名暗示，是明确的合规风险；另外两项都是可验证的属性与场景描述。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用两句话说明你拼标题的判断标准（第一句给结构结论，第二句给具体依据）', fields: [
        { key: 'decision', label: '我拼标题的结构是', placeholder: '例：品牌 + 核心词 + 属性 + 场景，四段各司其职',
          keywords: [['品牌', 'pawpal'], ['核心词', '品类', '核心'], ['属性'], ['场景', '适用']], minHits: 2,
          sample: '我拼标题的结构是品牌 + 核心词 + 关键属性 + 使用场景，四段各司其职，缺一段就会丢掉一类搜索意图。' },
        { key: 'evidence', label: '我依据的规则是', placeholder: '例：不要堆词、不要夸大词，先保证可读',
          keywords: [['可读', '通顺', '读得懂'], ['夸大', 'no1', 'best', '排名'], ['堆词', '堆砌', '塞满'], ['顺序', '结构', '四段', '三段']], minHits: 1,
          sample: '我依据的规则是标题要顺序清晰、可读性强，不能堆词，也不能出现 No.1、Best 这类夸大违规词。' },
      ], passScore: 2 },
    ], rewards: {},
  },
  {
    id: '3-3', chapter: 3, name: '关键词埋词', type: 'practice',
    goal: '将高相关关键词放进正确位置，避免堆词和违规词', passScore: 70, duration: '约 12 分钟',
    objectives: ['把高相关词分别放进标题、五点与 Search Terms', '识别并淘汰夸大词与平台官方标记词', '说出每个词放在该位置的理由'],
    abilityDims: ['listing'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '关键词不是越多越好。把买家会搜索、且和产品真实能力匹配的词放到合适位置。' },
      { type: 'card', cardId: 'K3-03' },
      { type: 'keywordPlacement', keywords: [
        ...CORE,
        { key: 'best cheap brush', text: 'best cheap brush', slot: 'reject', points: 0 },
        { key: 'platform badge', text: '平台官方标记词', slot: 'reject', points: 0 },
        { key: 'dog brush', text: 'dog brush', slot: 'search', points: 10 },
      ], slots: [
        { key: 'title', name: '标题', limit: 2 },
        { key: 'bullet', name: '五点描述', limit: 2 },
        { key: 'search', name: 'Search Terms', limit: 2 },
        { key: 'reject', name: '淘汰词', limit: 2 },
      ], answer: { title: ['pet grooming brush', 'self cleaning slicker brush'], bullet: ['removes loose fur', 'for dogs and cats'], search: ['easy to clean', 'dog brush'], reject: ['best cheap brush', 'platform badge'] } },
      { type: 'card', cardId: 'K2-05' },
      { type: 'dialog', speaker: 'Lisa 总', text: '相关性、覆盖度、合规性三者要一起看。最后用主图测试验证点击率。' },
    ], rewards: {},
  },
  {
    id: '3-4', chapter: 3, name: '主图 A/B 测试', type: 'practice',
    goal: '根据 7 天数据选出点击率更高的主图方案', passScore: 70, duration: '约 10 分钟',
    objectives: ['用 CTR、加购率与转化率综合判断主图优劣', '说出为什么 A/B 测试不能只看订单数'],
    abilityDims: ['listing'],
    steps: [
      { type: 'dialog', speaker: '老陈', text: '主图已经定稿，现在做 7 天 A/B 测试：两张主图各投 10000 次曝光，用数据决定留哪张。' },
      { type: 'card', cardId: 'K3-04' },
      { type: 'imageABTest', question: '哪张主图更适合继续投放？', variants: [
        { id: 'A', name: '白底正面图', description: '产品轮廓清晰，细节完整', exposure: 10000, clicks: 520, ctr: 5.2, addCart: 104, conversion: 8.1 },
        { id: 'B', name: '宠物使用场景图', description: '产品与猫咪同框，场景感更强', exposure: 10000, clicks: 690, ctr: 6.9, addCart: 138, conversion: 10.4 },
      ], answer: 'B', benchmark: 5.8 },
      { type: 'quiz', question: 'A/B 测试时为什么不能只看订单数？', options: [
        { key: 'A', text: '要结合曝光、CTR、加购和转化率', correct: true, explain: '漏斗数据能帮助定位是点击问题还是页面转化问题。' },
        { key: 'B', text: '订单数永远没用', correct: false, explain: '订单仍是最终结果，只是不能脱离样本量单独判断。' },
        { key: 'C', text: '只看主观审美', correct: false, explain: '测试的目的就是用数据减少主观判断。' },
      ] },
    ], rewards: {},
  },
  {
    id: '3-5', chapter: 3, name: '上架优化 Boss', type: 'boss',
    goal: '综合完成标题、关键词和主图选择，Listing 质量分达到 80', passScore: 80, duration: '约 15 分钟',
    objectives: ['综合完成标题、关键词、主图与合规四项决策', '把 Listing 质量分做到 80 以上', '说清每一项选择的依据与合规风险'],
    abilityDims: ['listing'],
    steps: [
      { type: 'listingBoss', titleOptions: [
        { id: 'good', text: 'PawPal Self Cleaning Slicker Brush with Retractable Pins for Dogs and Cats', score: 25, valid: true },
        { id: 'weak', text: 'Best Cheap Brush Amazing No.1', score: 8, valid: false },
        { id: 'short', text: 'PawPal Pet Brush', score: 14, valid: true },
      ], keywordOptions: [
        { id: 'core', text: 'pet grooming brush + self cleaning slicker brush', score: 25, valid: true },
        { id: 'stuff', text: 'best cheap brush + 平台官方标记词', score: 4, valid: false },
        { id: 'partial', text: 'dog brush + easy to clean', score: 18, valid: true },
      ], imageOptions: [
        { id: 'B', text: '宠物使用场景图', score: 20, valid: true },
        { id: 'A', text: '白底正面图', score: 15, valid: true },
        { id: 'C', text: '带大段促销文字的图片', score: 5, valid: false },
      ], complianceOptions: [
        { id: 'safe', text: '无夸大、无品牌蹭词', score: 10, valid: true },
        { id: 'risk', text: '含 Best、No.1 等夸大词', score: 0, valid: false },
      ], passScore: 80 },
      { type: 'card', cardId: 'K2-06' },
      { type: 'transfer', scenario: '换一个类目做上架验收：宠物指甲剪（品牌 PawPal）。规则不变，只给数据，结论自己下。', questions: [
        { id: '3-5-t1', kind: 'choice', question: '主图 A/B 测试 7 天：A 曝光 8000、点击 320（CTR 4.0%）；B 曝光 8000、点击 480（CTR 6.0%）。应该保留哪张？', answer: 'B', options: [
          { key: 'A', text: 'A，曝光一样时点击少说明图片更简洁' },
          { key: 'B', text: 'B，同一批曝光下 CTR 从 4.0% 提到 6.0%，点击效率更高' },
          { key: 'C', text: '无法判断，必须等到订单数出来' } ],
          explain: '曝光量相同的前提下，CTR 更高就代表点击承接力更强，这一步已经分出高下；订单数可以继续观察，但不影响点击效率的结论。' },
        { id: '3-5-t2', kind: 'number', question: '若换成 500 次点击、转化率 12%、客单价 $12.99，这批点击大约带来多少销售额（美元，四舍五入到整数）？', answer: 779, tolerance: 3, unit: '$',
          explain: '500 × 12% = 60 单；60 × $12.99 = $779.4，约 $779。先算订单再乘客单价，顺序不能反。' },
        { id: '3-5-t3', kind: 'choice', question: '关键词候选里，「best cheap nail clipper」和「No.1 Best Seller」应该怎么处理？', answer: 'B', options: [
          { key: 'A', text: '放进标题核心词，能拉搜索量' },
          { key: 'B', text: '直接淘汰：夸大词与排名暗示词都有合规风险' },
          { key: 'C', text: '放进 Search Terms 藏起来就行' } ],
          explain: '「best cheap」是夸大营销词，「No.1 Best Seller」是排名暗示词，放在标题、五点还是 Search Terms 都违规，必须淘汰。' },
      ], passRatio: 0.66 },
      { type: 'reflection', prompt: '用三句话复盘这次上架验收：先给质量分结论，再给数据依据，最后说清合规风险', fields: [
        { key: 'decision', label: '我这次上架的整体结论是', placeholder: '例：四项都要达标，质量分才能过 80',
          keywords: [['标题'], ['关键词', '埋词', '词'], ['主图'], ['合规', '夸大'], ['质量分', '80']], minHits: 2,
          sample: '我的结论是标题、关键词、主图和合规四项都要达标，Listing 质量分才能过 80。' },
        { key: 'evidence', label: '我依据的数据是', placeholder: '例：B 方案 CTR 6.0% 高于 A 的 4.0%',
          keywords: [['ctr', '点击率', '点击'], ['40', '60', '4%', '6%'], ['12', '转化'], ['质量分', '80'], ['曝光', '8000']], minHits: 1,
          sample: '我依据的是主图 B 方案 CTR 6.0% 高于 A 的 4.0%、转化率 12%，以及四个维度合计质量分达到 80 以上。' },
        { key: 'risk', label: '我识别出的合规风险是', placeholder: '例：堆词、夸大词、盗图与促销水印',
          keywords: [['夸大', 'no1', 'best', '排名', '合规', '违规'], ['堆词', '堆砌', '关键词', '塞满'], ['侵权', '盗图', '竞品', '版权'], ['促销', '水印', '标签']], minHits: 1,
          sample: '我识别出的合规风险是：标题堆词与 No.1、Best 这类夸大词会被降权，主图上加大段促销水印或盗用竞品图也有侵权风险。' },
      ], passScore: 2 },
      { type: 'dialog', speaker: 'Lisa 总', text: '恭喜你完成上架优化。下一章会给 Listing 装上油门：广告投放。' },
    ], rewards: {},
  },
];
