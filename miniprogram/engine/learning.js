// 教学闭环引擎（第 1~2 章教学样板）
// 职责：迁移题评分、结构化复述评分、能力证据聚合、错题记录、掌握度判定。
// 约束：纯函数，不依赖 wx，不读写存储，不修改入参，不使用随机数。

// ===== 能力维度定义（与策划案"能力雷达图"对齐，按章节逐步补齐证据）=====
const DIMENSIONS = [
  { key: 'foundation', label: '经营基础' },
  { key: 'sourcing', label: '选品' },
  { key: 'listing', label: 'Listing' },
  { key: 'ads', label: '广告' },
  { key: 'supply', label: '供应链与库存' },
  { key: 'service', label: '客服与经营' },
  { key: 'analytics', label: '数据分析' },
  { key: 'finance', label: '资金决策' },
];

const DIMENSION_MAP = DIMENSIONS.reduce((acc, d) => { acc[d.key] = d.label; return acc; }, {});

// ===== 步骤阶段标签（学习容器顶部进度用）=====
const STAGE_LABEL = {
  dialog: '情境', card: '知识',
  quiz: '练习', calc: '练习', formulaPuzzle: '练习', moduleTour: '练习',
  diagnose: '练习', skuFilter: '练习', profitDemo: '示范', profitCalc: '练习',
  radarScore: '练习', titlePuzzle: '练习', keywordPlacement: '练习', imageABTest: '练习',
  negotiate: '练习', adMetricCalc: '练习', searchTermSort: '练习', adPlacement: '练习',
  launchStrategy: '练习', keywordCampaign: '练习', bidBudgetSim: '练习', negativeKeyword: '练习',
  transportChoice: '练习', freightCalc: '练习', reorderCalc: '练习', logisticsIncident: '练习',
  customerScenario: '练习', serviceMetrics: '练习', metricIdentify: '练习', funnelCalc: '练习',
  diagnoseChoice: '练习', cashFlowCalc: '练习', financeCalc: '练习', pricingChoice: '练习',
  purchaseChoice: '练习', riskChoice: '练习',
  listingBoss: 'Boss', adBoss: 'Boss', inventoryBoss: 'Boss', customerBoss: 'Boss',
  reviewBoss: 'Boss', financeBoss: 'Boss',
  transfer: '迁移', reflection: '复盘',
};

// ===== 通用工具 =====
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function round(value, digits) {
  const p = Math.pow(10, digits === undefined ? 2 : digits);
  return Math.round(value * p) / p;
}

function normalizeText(text) {
  return String(text === undefined || text === null ? '' : text)
    .toLowerCase()
    .replace(/[\s，,。.；;：:、！!？?"'（）()【】\[\]]/g, '');
}

// 关键词组匹配：group 为字符串（任一命中）或字符串数组（任一命中即算该组命中）
function matchKeywordGroups(text, groups) {
  const normalized = normalizeText(text);
  if (!normalized) return { hits: 0, matched: [], total: 0 };
  const list = Array.isArray(groups) ? groups : [];
  const matched = [];
  list.forEach(group => {
    const alternatives = Array.isArray(group) ? group : [group];
    const hit = alternatives.some(word => normalized.indexOf(normalizeText(word)) >= 0);
    if (hit) matched.push(alternatives[0]);
  });
  return { hits: matched.length, matched, total: list.length };
}

// ===== 迁移题评分 =====
// step.transfer.questions: [{ id, kind: 'choice'|'number', question, options?, answer, tolerance?, unit?, explain }]
// userAnswers: 与 questions 等长的数组，元素为字符串（choice 存 option.key，number 存数字文本）
function evaluateTransfer(step, userAnswers) {
  const questions = step && Array.isArray(step.questions) ? step.questions : [];
  if (!questions.length) throw new Error('迁移题配置为空');
  const answers = Array.isArray(userAnswers) ? userAnswers : [];
  const passRatio = step.passRatio === undefined ? 0.7 : step.passRatio;

  const results = questions.map((q, index) => {
    const raw = answers[index];
    const hasAnswer = raw !== undefined && raw !== null && String(raw).trim() !== '';
    let ok = false;
    let correctText = '';
    let userText = hasAnswer ? String(raw) : '未作答';

    if (q.kind === 'number') {
      const value = Number(raw);
      const tolerance = q.tolerance === undefined ? Math.max(0.01, Math.abs(q.answer) * 0.02) : q.tolerance;
      ok = hasAnswer && Number.isFinite(value) && Math.abs(value - q.answer) <= tolerance;
      correctText = `${q.answer}${q.unit || ''}`;
      userText = hasAnswer ? `${raw}${q.unit || ''}` : '未作答';
    } else {
      const option = (q.options || []).find(o => o.key === raw);
      ok = hasAnswer && raw === q.answer;
      correctText = (q.options || []).filter(o => o.key === q.answer).map(o => `${o.key}. ${o.text}`).join('') || q.answer;
      userText = option ? `${option.key}. ${option.text}` : '未作答';
    }
    return {
      id: q.id || `q${index}`,
      index,
      kind: q.kind || 'choice',
      question: q.question,
      userAnswer: userText,
      correctAnswer: correctText,
      correct: ok,
      explain: q.explain || '',
    };
  });

  const correctCount = results.filter(r => r.correct).length;
  const total = results.length;
  const rate = total ? correctCount / total : 0;
  return {
    results,
    correctCount,
    total,
    rate: round(rate, 4),
    score: Math.round(rate * 100),
    passed: rate >= passRatio,
    passText: `${correctCount}/${total} 正确`,
  };
}

// ===== 结构化复述评分 =====
// step.reflection.fields: [{ key, label, placeholder, sample, keywords: [[...],[...]], minHits }]
// 判定：命中组数 ≥ minHits（默认 1）即该字段达标
function evaluateReflection(step, userAnswers) {
  const fields = step && Array.isArray(step.fields) ? step.fields : [];
  if (!fields.length) throw new Error('复述题配置为空');
  const answers = Array.isArray(userAnswers) ? userAnswers : [];
  const passScore = step.passScore === undefined ? Math.max(1, Math.ceil(fields.length * 2 / 3)) : step.passScore;

  const results = fields.map((field, index) => {
    const input = answers[index] === undefined || answers[index] === null ? '' : String(answers[index]);
    const minHits = field.minHits === undefined ? 1 : field.minHits;
    const matched = matchKeywordGroups(input, field.keywords);
    const filled = input.trim().length > 0;
    return {
      key: field.key,
      label: field.label,
      input,
      filled,
      hits: matched.hits,
      required: minHits,
      matchedWords: matched.matched.join('、'),
      matched: filled && matched.hits >= minHits,
      sample: field.sample || '',
    };
  });

  const matchedCount = results.filter(r => r.matched).length;
  const total = results.length;
  const rate = total ? matchedCount / total : 0;
  return {
    results,
    matchedCount,
    total,
    rate: round(rate, 4),
    score: Math.round(rate * 100),
    passed: matchedCount >= passScore,
    passScore,
    passText: `要点覆盖 ${matchedCount}/${total}`,
  };
}

// ===== 错题记录 =====
function buildMistakes(payload) {
  const levelId = payload.levelId;
  const chapter = payload.chapter;
  const at = payload.at;
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return rows.filter(r => r && !r.correct).map(r => ({
    levelId,
    chapter,
    stepIndex: payload.stepIndex,
    stepType: payload.stepType,
    question: r.question || '',
    userAnswer: r.userAnswer || '',
    correctAnswer: r.correctAnswer || '',
    explain: r.explain || '',
    cardId: payload.cardId || '',
    at: at || null,
  }));
}

// ===== 能力证据聚合 =====
// payload: { levelId, chapter, at, dimensions[], knowledge, transfer, reflection, efficiency, complianceErrors }
// knowledge/transfer/reflection/efficiency 均为 0~1
function recordEvidence(prev, payload) {
  const evidence = prev && prev.dims ? clone(prev) : { dims: {}, records: [] };
  if (!Array.isArray(evidence.records)) evidence.records = [];
  const dims = Array.isArray(payload.dimensions) && payload.dimensions.length ? payload.dimensions : ['foundation'];
  const knowledge = clamp01(payload.knowledge);
  const transfer = clamp01(payload.transfer);
  const reflection = clamp01(payload.reflection);
  const efficiency = clamp01(payload.efficiency);
  const complianceErrors = Number(payload.complianceErrors || 0);

  dims.forEach(key => {
    const cur = evidence.dims[key] || {
      attempts: 0, knowledgeSum: 0, transferSum: 0, reflectionSum: 0,
      efficiencySum: 0, complianceErrors: 0, levels: [],
    };
    cur.attempts += 1;
    cur.knowledgeSum = round(cur.knowledgeSum + knowledge, 4);
    cur.transferSum = round(cur.transferSum + transfer, 4);
    cur.reflectionSum = round(cur.reflectionSum + reflection, 4);
    cur.efficiencySum = round(cur.efficiencySum + efficiency, 4);
    cur.complianceErrors += complianceErrors;
    if (cur.levels.indexOf(payload.levelId) < 0) cur.levels.push(payload.levelId);
    evidence.dims[key] = cur;
  });

  evidence.records.push({
    levelId: payload.levelId,
    chapter: payload.chapter,
    at: payload.at || null,
    dimensions: dims.slice(),
    knowledge, transfer, reflection, efficiency, complianceErrors,
  });
  if (evidence.records.length > 60) evidence.records = evidence.records.slice(-60);
  return evidence;
}

// 单项维度得分：知识 25% + 迁移 35% + 复盘 25% + 效率 15%
// 合规硬门槛：出现合规错误则该维度得分封顶 60，不能被其他分数抵消
const WEIGHTS = { knowledge: 0.25, transfer: 0.35, reflection: 0.25, efficiency: 0.15 };
const COMPLIANCE_CAP = 60;

function scoreDimension(entry) {
  if (!entry || !entry.attempts) return null;
  const n = entry.attempts;
  const avg = key => entry[`${key}Sum`] / n;
  let score = (avg('knowledge') * WEIGHTS.knowledge
    + avg('transfer') * WEIGHTS.transfer
    + avg('reflection') * WEIGHTS.reflection
    + avg('efficiency') * WEIGHTS.efficiency) * 100;
  const capped = entry.complianceErrors > 0 && score > COMPLIANCE_CAP;
  if (capped) score = COMPLIANCE_CAP;
  return {
    score: Math.round(score),
    capped,
    attempts: n,
    levels: (entry.levels || []).slice(),
    knowledge: Math.round(avg('knowledge') * 100),
    transfer: Math.round(avg('transfer') * 100),
    reflection: Math.round(avg('reflection') * 100),
    efficiency: Math.round(avg('efficiency') * 100),
    complianceErrors: entry.complianceErrors || 0,
  };
}

function summarizeAbility(evidence) {
  const dims = evidence && evidence.dims ? evidence.dims : {};
  const list = DIMENSIONS.filter(d => dims[d.key] && dims[d.key].attempts)
    .map(d => {
      const detail = scoreDimension(dims[d.key]);
      return { key: d.key, label: d.label, ...detail, level: masteryOf(detail.score), cappedText: detail.capped ? '合规封顶' : '' };
    });
  const scored = list.filter(d => d.score !== null);
  const overall = scored.length ? Math.round(scored.reduce((a, d) => a + d.score, 0) / scored.length) : 0;
  return { list, overall, level: masteryOf(overall), hasData: scored.length > 0 };
}

function masteryOf(score) {
  if (score >= 85) return '熟练';
  if (score >= 70) return '掌握';
  if (score >= 60) return '基本达标';
  return '待加强';
}

// ===== 关卡层学习结论（结果页用）=====
// payload: { level, quizRate, objRate, transfer, reflection, retries }
function summarizeLevelLearning(payload) {
  const quizRate = clamp01(payload.quizRate);
  const objRate = clamp01(payload.objRate);
  const transferRate = payload.transfer === null || payload.transfer === undefined ? null : clamp01(payload.transfer);
  const reflectionRate = payload.reflection === null || payload.reflection === undefined ? null : clamp01(payload.reflection);
  const efficiency = Math.max(0, 1 - Number(payload.retries || 0) * 0.1);

  const rows = [
    { key: 'knowledge', label: '知识掌握', rate: quizRate, text: `${Math.round(quizRate * 100)}%` },
    { key: 'objective', label: '决策质量', rate: objRate, text: `${Math.round(objRate * 100)}%` },
    { key: 'efficiency', label: '操作效率', rate: efficiency, text: `${Math.round(efficiency * 100)}%` },
  ];
  if (transferRate !== null) rows.push({ key: 'transfer', label: '迁移应用', rate: transferRate, text: `${Math.round(transferRate * 100)}%` });
  if (reflectionRate !== null) rows.push({ key: 'reflection', label: '复盘表达', rate: reflectionRate, text: `${Math.round(reflectionRate * 100)}%` });

  const abilityScore = Math.round((
    quizRate * WEIGHTS.knowledge
    + (transferRate === null ? objRate : transferRate) * WEIGHTS.transfer
    + (reflectionRate === null ? objRate : reflectionRate) * WEIGHTS.reflection
    + efficiency * WEIGHTS.efficiency
  ) * 100);

  const weakRows = rows.filter(r => r.rate < 0.7);
  const nextStep = weakRows.length
    ? `优先补强「${weakRows[0].label}」，再进入下一关。`
    : '各项达标，可以进入下一关并到店铺应用。';

  return {
    rows,
    abilityScore,
    abilityLevel: masteryOf(abilityScore),
    hasTransfer: transferRate !== null,
    hasReflection: reflectionRate !== null,
    weakRows,
    weakText: weakRows.map(r => r.label).join('、'),
    nextStep,
  };
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return round(n, 4);
}

module.exports = {
  DIMENSIONS, DIMENSION_MAP, STAGE_LABEL, WEIGHTS, COMPLIANCE_CAP,
  evaluateTransfer, evaluateReflection, buildMistakes,
  recordEvidence, summarizeAbility, summarizeLevelLearning, masteryOf,
  normalizeText, matchKeywordGroups,
};
