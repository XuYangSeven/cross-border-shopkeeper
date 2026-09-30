// 提示引擎：把「求助」做成有代价、有教学价值的动作。
//
// 约束：纯函数，不依赖 wx，不读写存储，不修改入参，不使用随机数。
//
// ── 为什么提示必须自动生成 ─────────────────────────────
// 项目有 230 个步骤、43 种步骤类型。手写提示既写不完，也会在关卡内容改动后
// 悄悄过期。而「可判定」的步骤本身就自带答案与解析字段：
//   quiz.options[].explain / calc.blanks[].hint / transfer.questions[].explain
//   *.reviewPrompt / skuFilter.reasons / *.fields[].answer ...
// 提示从这些字段派生，就永远不会与题目脱节——改了题干，提示跟着变。
//
// ── 三级提示的分工 ────────────────────────────────────
//   L1 思路（免费）：这题问什么、第一步做什么。只有框架，不含答案。
//   L2 线索（收费）：题目自带的公式提示 / 复盘提示；没有时给「考点定位 + 复习指引」。
//   L3 解析（收费）：正确答案与完整过程，直接给答案。
//
// 「取不到答案时不编造」是本引擎的硬约束：任何一级拿不到真实内容，
// 就如实降级并标记 exact=false，绝不用通用话术伪装成答案。

const CONSTANTS = require('../config/constants');

const TIERS = CONSTANTS.HINT_TIERS;
const TIER_MAP = TIERS.reduce((acc, t) => { acc[t.tier] = t; return acc; }, {});

// ===== 各步骤类型的考察点（本文件唯一需要人工维护的部分）=====
// 只写「这题在考什么」，一律不含答案，所以改关卡内容时这里不需要跟着改。
// 未列入此表的类型（dialog / card / moduleTour / profitDemo）没有对错，
// 因此不提供求助——给阅读型步骤「提示」只会让人以为读错了。
const FRAMEWORK = {
  // 第 1 章 经营基础
  quiz: '先看清题目问的是哪个变量，再排除「相关但不优先」的动作。',
  formulaPuzzle: '先想清楚这个指标由哪几个量相乘得来，再决定词块的先后。',
  calc: '把题干里的数字逐个对应到公式的每个位置，再代入计算。',
  moduleTour: '按数据看板 → 商品 → 流量 → 库存 → 订单 → 绩效的顺序理解后台。',
  diagnose: '先判断这一项是不是「真问题」，再挑动作——好动作治根因，坏动作只缓解症状。',
  // 第 2 章 选品
  skuFilter: '按利润空间、物流风险、侵权与季节四条线逐项过筛，任一不合格就淘汰。',
  profitCalc: '按「售价 → 减佣金 → 减退货与汇损 → 减采购与头程 → 减仓配」逐层扣减。',
  radarScore: '评分是为了找短板而不是找优点，先给每维一个分，再看哪一维拖后腿。',
  // 第 3 章 Listing
  titlePuzzle: '标题骨架是「核心词 + 属性词 + 场景词」，先摆骨架再调顺序。',
  keywordPlacement: '把词分核心、长尾、泛词三档，分别放进搜索、描述与后台字段。',
  imageABTest: '判断主图看的是「三秒内能不能看懂卖点」，不是好看不好看。',
  listingBoss: '四项（标题、卖点、主图、合规）任一项失分都压低整体，先补最弱那项。',
  negotiate: '谈判先分清哪些条件可以让、哪些必须拿，用可以让的换必须拿的。',
  // 第 4 章 广告
  adMetricCalc: '广告指标互相推导：ACOS = 花费 ÷ 销售额，点击 = 曝光 × 点击率。',
  searchTermSort: '按「是否带来订单」而不是「是否有曝光」给搜索词分类。',
  adPlacement: '不同展示位的流量意图不同，先想清要的是曝光还是转化。',
  keywordCampaign: '广告组按匹配方式拆开：宽泛匹配探词，精准匹配收割。',
  bidBudgetSim: '预算决定买多少点击，竞价决定单次成本，两者要一起看 ACOS。',
  launchStrategy: '新品期先要数据和评价，中期才谈利润——阶段不同目标不同。',
  negativeKeyword: '否定标准是「这个词花了钱但没转化」，而不是「这个词看不懂」。',
  adBoss: '每天先看花费与订单的比值：超标就收，健康就稳住，别一天一个方向。',
  // 第 5 章 物流与库存
  transportChoice: '比较运输方式要同时看时效、单价与资金占用，只看单价一定选错。',
  freightCalc: '运费先判断计费重是实重还是体积重，再乘单价。',
  reorderCalc: '补货点 = 补货周期内会卖掉多少 + 安全库存，两部分都不能漏。',
  logisticsIncident: '异常先分责任方与紧急度，再决定是等、是催、还是改派。',
  inventoryBoss: '库存盯两条线：不断货、不压货。先算日销与到仓时间，再选运输方式。',
  // 第 6 章 客服与售后
  customerScenario: '客服先给情绪回应再给方案，顺序反了方案再好也听不进去。',
  serviceMetrics: '客服指标要成对看：解决率配满意度，响应率配平均时长。',
  customerBoss: '目标是「时限内解决 + 不把成本转嫁给客户」，冲突时优先解决。',
  // 第 7 章 数据分析
  metricIdentify: '先判断每个指标是结果指标还是过程指标，再排它们的先后关系。',
  funnelCalc: '漏斗逐层相乘，每层转化率单独算，乘起来才是最终转化。',
  diagnoseChoice: '先看指标离目标差多少：差得少是微调，差得多要换策略。',
  reviewBoss: '复盘顺序：先看结论指标，再拆到过程指标，最后才落到动作。',
  // 第 8 章 资金与经营
  cashFlowCalc: '现金口径 ≠ 利润口径：回款有周期，账面赚钱不等于手上有钱。',
  financeCalc: '盈亏平衡价要把「不随售价变」的固定成本与「随售价变」的比例费用分开。',
  pricingChoice: '定价先算清底线（不亏）和目标毛利，再看市场能不能接受。',
  purchaseChoice: '采购要同时满足现金约束与库存周转，缺一个都是风险。',
  riskChoice: '按「影响金额 × 发生概率」排序，先处理大额高概率的风险。',
  financeBoss: '方案要同时站得住三面：现金撑不撑得住、利润够不够、库存会不会压死。',
  // 教学闭环
  transfer: '情境换了、数字换了，但公式和判断标准不变——先找回同一套标准。',
  reflection: '三段式复述：先给结论，再给支撑数据，最后说清风险或前提。',
};

// 有对错、值得求助的步骤类型（= FRAMEWORK 覆盖的类型）
const ASKABLE_TYPES = Object.keys(FRAMEWORK).reduce((acc, k) => { acc[k] = true; return acc; }, {});

// ===== 通用提取工具 =====

function textOf(node) {
  if (!node || typeof node !== 'object') return '';
  const value = node.text || node.label || node.name || node.title || '';
  return typeof value === 'string' ? value.trim() : '';
}

function withKey(node) {
  const text = textOf(node);
  if (!text) return '';
  const key = typeof node.key === 'string' && node.key ? node.key + '. ' : '';
  return key + text;
}

// 递归收集「被标记为正确」的条目。
// 不写死嵌套路径（items[].options[].valid / items[].prescriptions[].good /
// options[].correct ...），避免新增题型时漏掉，也避免猜错字段名。
const TRUTHY_FLAGS = ['correct', 'valid', 'good'];
function collectCorrect(node, out, depth) {
  const level = depth || 0;
  if (!node || typeof node !== 'object' || level > 6 || out.length > 40) return;
  if (Array.isArray(node)) {
    node.forEach(item => collectCorrect(item, out, level + 1));
    return;
  }
  if (TRUTHY_FLAGS.some(flag => node[flag] === true)) {
    const text = withKey(node);
    if (text && out.indexOf(text) < 0) out.push(text);
  }
  Object.keys(node).forEach(key => collectCorrect(node[key], out, level + 1));
}

// 收集数值型答案（blanks / fields / questions）
function collectNumbers(step) {
  const lines = [];
  (step.blanks || []).forEach(b => {
    if (b && b.answer !== undefined && b.answer !== null && b.answer !== '') {
      lines.push(`${b.label ? b.label + '：' : ''}${b.answer}${b.unit || ''}`);
    }
  });
  (step.fields || []).forEach(f => {
    if (f && f.answer !== undefined && f.answer !== null && f.answer !== '') {
      lines.push(`${f.label ? f.label + '：' : ''}${f.answer}${f.unit || ''}`);
    }
  });
  (step.questions || []).forEach(q => {
    if (q && q.answer !== undefined && q.answer !== null && q.answer !== '') {
      lines.push(`${q.question ? q.question + ' → ' : ''}${q.answer}${q.unit || ''}`);
    }
  });
  return lines;
}

// ===== 三级内容生成 =====

// 题干摘要：让每一级的提示都带当前题目的上下文，
// 否则同一关连着几道同类题时，提示会一模一样，读起来像没看题。
function stemOf(step) {
  const raw = step.question || step.scenario || step.prompt || '';
  return typeof raw === 'string' ? raw.trim() : '';
}

function brief(text, max) {
  const limit = max || 24;
  if (!text) return '';
  return text.length > limit ? text.slice(0, limit) + '…' : text;
}

// L1 思路：只给框架，不含答案
function buildIdea(step) {
  const frame = FRAMEWORK[step.type];
  if (!frame) return '';
  const stem = brief(stemOf(step));
  return stem ? `这题问「${stem}」——${frame}` : frame;
}

// L2 线索：给台阶但不给答案。
//
// 这里刻意**不做**「排除法」（即把错误选项的 explain 拼成"常见误区"），
// 有两个原因，都是实测踩出来的：
//   ① 三选项题排除两个等于白送答案，而 L2 只卖 20 金币、L3 才卖 50；
//   ② 脱离选项上下文后，错项 explain 会被误读成在肯定错误选项——
//      例如「影响非常大。不但没补贴，还可能影响绩效。」读起来像是在夸它。
// 所以没有显式提示时，改为给「考点定位 + 复习指引」：
// 告诉学生这题考什么、去哪一章复习，这对真实工作更贴切——
// 遇到不会的事，正确的动作是去查资料，而不是等人报答案。
function buildClue(step, context) {
  if (typeof step.reviewPrompt === 'string' && step.reviewPrompt.trim()) {
    return step.reviewPrompt.trim();
  }
  const hints = (step.blanks || []).map(b => (b && typeof b.hint === 'string' ? b.hint.trim() : '')).filter(Boolean);
  if (hints.length) return '代入公式：' + hints.join('；');
  if (typeof step.trapExplain === 'string' && step.trapExplain.trim()) return step.trapExplain.trim();
  if (typeof step.explanation === 'string' && step.explanation.trim()) return step.explanation.trim();

  const ctx = context || {};
  const parts = [];
  if (Array.isArray(ctx.abilityLabels) && ctx.abilityLabels.length) {
    parts.push(`本关考的是「${ctx.abilityLabels.join('、')}」`);
  }
  if (ctx.chapterName) {
    parts.push(`对应第 ${ctx.chapterId} 章「${ctx.chapterName}」`);
  }
  if (!parts.length) return '';
  return `${parts.join('，')}。先回看这一章的知识卡片，再回到题目。`;
}

// L3 解析：给答案。取不到真实答案时如实降级，绝不编造。
function buildAnswer(step) {
  const lines = [];

  const correct = [];
  collectCorrect(step, correct, 0);
  if (correct.length) lines.push(correct.slice(0, 8).join('；'));

  collectNumbers(step).forEach(line => {
    if (lines.indexOf(line) < 0) lines.push(line);
  });

  // 迁移题：每题自带的解析最有教学价值
  const explains = [];
  if (Array.isArray(step.questions)) {
    step.questions.forEach(q => {
      if (q && typeof q.explain === 'string' && q.explain.trim()) explains.push(q.explain.trim());
    });
  }
  if (Array.isArray(step.options)) {
    step.options.forEach(o => {
      if (o && o.correct === true && typeof o.explain === 'string' && o.explain.trim()) {
        explains.push(o.explain.trim());
      }
    });
  }
  if (explains.length) lines.push(explains.slice(0, 3).join(' '));

  // 主观复述题：给参考表述而不是「答案」，它本来就是范例而非唯一解。
  // 不拼字段名做前缀——sample 本身已是完整句子（「我的结论是…」「我依据的是…」），
  // 拼上去会读成「我依据的数据是：我依据的是…」。
  if (step.type === 'reflection' && Array.isArray(step.fields)) {
    const samples = step.fields
      .map(f => (f && typeof f.sample === 'string' && f.sample.trim() ? f.sample.trim() : ''))
      .filter(Boolean);
    if (samples.length) {
      return { text: samples.join('\n'), exact: false, kind: 'reference' };
    }
  }

  if (lines.length) return { text: lines.join('\n'), exact: true, kind: 'answer' };

  // 拿不到权威答案：如实说明，并给出可执行的下一步，不用通用话术伪装成答案
  return {
    text: '这一关没有唯一标准答案，需要你自己推演。建议回看本关的知识卡片，再把判断依据写出来。',
    exact: false,
    kind: 'none',
  };
}

// ===== 对外接口 =====

// 该步骤是否值得提供求助
function isAskable(step) {
  return !!(step && ASKABLE_TYPES[step.type]);
}

// 生成三级提示。
// context（可选）：{ chapterId, chapterName, abilityLabels } —— 由调用方传入，
// 避免本引擎反向依赖关卡注册表。
// 返回 { available, tiers: [{ tier, key, label, price, desc, text, exact, ready }] }
// price 一律取自 constants.HINT_TIERS，避免出现第二份定价。
function buildHints(step, context) {
  if (!isAskable(step)) return { available: false, tiers: [] };

  const idea = buildIdea(step);
  const clue = buildClue(step, context);
  const answer = buildAnswer(step);

  const bodies = {
    1: { text: idea, exact: false },
    2: { text: clue, exact: false },
    3: answer,
  };

  const tiers = TIERS.map(t => {
    const body = bodies[t.tier] || { text: '', exact: false };
    return {
      tier: t.tier,
      key: t.key,
      label: t.label,
      price: t.price,
      desc: t.desc,
      text: body.text || '',
      exact: !!body.exact,
      // ready=false 表示这一级没有可用内容（如 L2 提取不到），前端应隐藏而不是给空壳
      ready: !!body.text,
    };
  });

  return { available: true, tiers };
}

function tierOf(tier) {
  return TIER_MAP[tier] || null;
}

function priceOf(tier) {
  const t = TIER_MAP[tier];
  return t ? t.price : 0;
}

// 一次买齐某一级及之前所有级别的总价（前端做「升到这一级要再付多少」用）
function priceUpTo(tier) {
  return TIERS.filter(t => t.tier <= tier).reduce((sum, t) => sum + t.price, 0);
}

module.exports = {
  TIERS, FRAMEWORK, ASKABLE_TYPES,
  isAskable, buildHints, tierOf, priceOf, priceUpTo,
};
