// 第 3 章关卡配置：上架优化（PawPal 宠物梳案例）
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
    steps: [
      { type: 'dialog', speaker: 'Lisa 总', text: '选品通过后，下一步是把产品准确地展示给买家。Listing 就是你的线上销售员。' },
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
    steps: [
      { type: 'dialog', speaker: '老陈', text: '标题结构先记住：品牌 + 核心词 + 关键属性 + 使用场景。不要为了塞词牺牲可读性。' },
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
    ], rewards: {},
  },
  {
    id: '3-3', chapter: 3, name: '关键词埋词', type: 'practice',
    goal: '将高相关关键词放进正确位置，避免堆词和违规词', passScore: 70, duration: '约 12 分钟',
    steps: [
      { type: 'dialog', speaker: '老陈', text: '关键词不是越多越好。把买家会搜索、且和产品真实能力匹配的词放到合适位置。' },
      { type: 'keywordPlacement', keywords: [
        ...CORE,
        { key: 'best cheap brush', text: 'best cheap brush', slot: 'reject', points: 0 },
        { key: 'Amazon Choice', text: 'Amazon Choice', slot: 'reject', points: 0 },
        { key: 'dog brush', text: 'dog brush', slot: 'search', points: 10 },
      ], slots: [
        { key: 'title', name: '标题', limit: 2 },
        { key: 'bullet', name: '五点描述', limit: 2 },
        { key: 'search', name: 'Search Terms', limit: 2 },
        { key: 'reject', name: '淘汰词', limit: 2 },
      ], answer: { title: ['pet grooming brush', 'self cleaning slicker brush'], bullet: ['removes loose fur', 'for dogs and cats'], search: ['easy to clean', 'dog brush'], reject: ['best cheap brush', 'Amazon Choice'] } },
      { type: 'card', cardId: 'K2-05' },
      { type: 'dialog', speaker: 'Lisa 总', text: '相关性、覆盖度、合规性三者要一起看。最后用主图测试验证点击率。' },
    ], rewards: {},
  },
  {
    id: '3-4', chapter: 3, name: '主图 A/B 测试', type: 'practice',
    goal: '根据 7 天数据选出点击率更高的主图方案', passScore: 70, duration: '约 10 分钟',
    steps: [
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
    steps: [
      { type: 'listingBoss', titleOptions: [
        { id: 'good', text: 'PawPal Self Cleaning Slicker Brush with Retractable Pins for Dogs and Cats', score: 25, valid: true },
        { id: 'weak', text: 'Best Cheap Brush Amazing No.1', score: 8, valid: false },
        { id: 'short', text: 'PawPal Pet Brush', score: 14, valid: true },
      ], keywordOptions: [
        { id: 'core', text: 'pet grooming brush + self cleaning slicker brush', score: 25, valid: true },
        { id: 'stuff', text: 'best cheap brush + Amazon Choice', score: 4, valid: false },
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
      { type: 'dialog', speaker: 'Lisa 总', text: '恭喜你完成上架优化。下一章会给 Listing 装上油门：广告投放。' },
    ], rewards: {},
  },
];
