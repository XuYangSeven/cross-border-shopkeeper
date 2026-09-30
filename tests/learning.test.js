// 教学闭环引擎测试：迁移题 / 结构化复述 / 能力证据 / 掌握度
const assert = require('assert');
const learning = require('../miniprogram/engine/learning');

// ===== 1. 迁移题：选项题判定 =====
const choiceStep = {
  passRatio: 0.7,
  questions: [
    { id: 'q1', kind: 'choice', question: '哪个更值钱？', answer: 'B',
      options: [{ key: 'A', text: '流量' }, { key: 'B', text: '转化率' }], explain: '转化是分水岭。' },
  ],
};
let r = learning.evaluateTransfer(choiceStep, ['B']);
assert.strictEqual(r.results[0].correct, true, '选项正确应判定为正确');
assert.strictEqual(r.passed, true);
assert.strictEqual(r.score, 100);

r = learning.evaluateTransfer(choiceStep, ['A']);
assert.strictEqual(r.results[0].correct, false);
assert.strictEqual(r.passed, false, '答错不应通过');
assert.strictEqual(r.results[0].correctAnswer, 'B. 转化率', '应回填正确答案文本');
assert.strictEqual(r.results[0].userAnswer, 'A. 流量');

// 未作答
r = learning.evaluateTransfer(choiceStep, ['']);
assert.strictEqual(r.results[0].correct, false);
assert.strictEqual(r.results[0].userAnswer, '未作答');

// ===== 2. 迁移题：数值题容差 =====
const numberStep = {
  passRatio: 0.5,
  questions: [
    { id: 'n1', kind: 'number', question: '销售额？', answer: 288, tolerance: 1, unit: '$' },
    { id: 'n2', kind: 'number', question: '毛利率？', answer: 20.9, tolerance: 1, unit: '%' },
  ],
};
r = learning.evaluateTransfer(numberStep, ['288', '20.9']);
assert.strictEqual(r.correctCount, 2);
r = learning.evaluateTransfer(numberStep, ['289', '20']);
assert.strictEqual(r.correctCount, 2, '容差内应判定正确');
r = learning.evaluateTransfer(numberStep, ['300', '30']);
assert.strictEqual(r.correctCount, 0);
assert.strictEqual(r.passed, false);
r = learning.evaluateTransfer(numberStep, ['abc', '20.9']);
assert.strictEqual(r.correctCount, 1, '非数字应按错误处理，不得抛错');

// 通过比例：3 题制用 0.66，答对 2 题即达标（与关卡配置一致）
const threeStep = { passRatio: 0.66, questions: [
  { id: 'a', kind: 'choice', question: 'a', answer: 'A', options: [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }] },
  { id: 'b', kind: 'choice', question: 'b', answer: 'A', options: [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }] },
  { id: 'c', kind: 'choice', question: 'c', answer: 'A', options: [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }] },
] };
assert.strictEqual(learning.evaluateTransfer(threeStep, ['A', 'A', 'B']).passed, true, '2/3 应达到 0.66 线');
assert.strictEqual(learning.evaluateTransfer(threeStep, ['A', 'B', 'B']).passed, false, '1/3 不应通过');
// 0.7 线在 3 题制下要求全对，这是刻意保留的行为，配置里不得回退到 0.7
assert.strictEqual(learning.evaluateTransfer({ ...threeStep, passRatio: 0.7 }, ['A', 'A', 'B']).passed, false);

// 空配置必须报错，不能静默通过
assert.throws(() => learning.evaluateTransfer({ questions: [] }, []), /迁移题配置为空/);

// ===== 3. 结构化复述：关键词覆盖 =====
const reflectStep = {
  passScore: 2,
  fields: [
    { key: 'decision', label: '我的结论是', keywords: [['转化率', '转化'], ['b店', 'B店']], minHits: 1 },
    { key: 'evidence', label: '我依据的数据是', keywords: [['5000'], ['12%'], ['288']], minHits: 2 },
    { key: 'risk', label: '风险是', keywords: [['排名', '下跌']], minHits: 1 },
  ],
};
let rr = learning.evaluateReflection(reflectStep, [
  '我的结论是转化率比流量更值钱，B 店更强。',
  '依据是 A 店访客 5000 但转化只有 1%，B 店转化 12%。',
  '风险是断货会导致排名下跌。',
]);
assert.strictEqual(rr.matchedCount, 3, '三段都覆盖要点应达标');
assert.strictEqual(rr.passed, true);

// 依据段只命中 1 个要点（要求 2）→ 该段不达标，整体 2/3 仍达标
rr = learning.evaluateReflection(reflectStep, [
  '转化率更重要。',
  'A 店访客 5000。',
  '可能排名下跌。',
]);
assert.strictEqual(rr.results[1].matched, false, '命中数不足时应判定该段未达标');
assert.strictEqual(rr.matchedCount, 2);
assert.strictEqual(rr.passed, true);

// 空洞回答不达标，且给出参考表述
rr = learning.evaluateReflection(reflectStep, ['还行', '不知道', '没想过']);
assert.strictEqual(rr.matchedCount, 0);
assert.strictEqual(rr.passed, false);
assert.strictEqual(rr.results[0].sample, '', '未配置 sample 时为空字符串，不得报错');

// 标点与大小写归一
rr = learning.evaluateReflection({ passScore: 1, fields: [
  { key: 'k', label: 'L', keywords: [['acos']], minHits: 1 },
] }, ['ACOS 太高了，需要否定烧钱词。']);
assert.strictEqual(rr.results[0].matched, true, '应忽略大小写与标点');

assert.throws(() => learning.evaluateReflection({ fields: [] }, []), /复述题配置为空/);

// ===== 4. 错题记录 =====
const mistakes = learning.buildMistakes({
  levelId: '1-2', chapter: 1, stepIndex: 4, stepType: 'transfer', at: 1000,
  rows: [
    { question: '销售额？', userAnswer: '300$', correctAnswer: '288$', correct: false, explain: '公式' },
    { question: '转化？', userAnswer: 'B', correctAnswer: 'B', correct: true, explain: '' },
  ],
});
assert.strictEqual(mistakes.length, 1, '只记录错题');
assert.strictEqual(mistakes[0].levelId, '1-2');
assert.strictEqual(mistakes[0].correctAnswer, '288$');

// ===== 5. 能力证据：滚动平均 + 合规封顶 =====
let evidence = learning.recordEvidence(null, {
  levelId: '1-2', chapter: 1, at: 1, dimensions: ['foundation'],
  knowledge: 1, transfer: 1, reflection: 1, efficiency: 1, complianceErrors: 0,
});
let ability = learning.summarizeAbility(evidence);
assert.strictEqual(ability.list.length, 1);
assert.strictEqual(ability.list[0].score, 100, '全对满分应为 100');
assert.strictEqual(ability.list[0].level, '熟练');

evidence = learning.recordEvidence(evidence, {
  levelId: '1-3', chapter: 1, at: 2, dimensions: ['foundation'],
  knowledge: 0.5, transfer: 0.5, reflection: 0.5, efficiency: 0.5, complianceErrors: 0,
});
ability = learning.summarizeAbility(evidence);
assert.strictEqual(ability.list[0].attempts, 2);
assert.strictEqual(ability.list[0].score, 75, '两次平均应为 75');
assert.strictEqual(ability.list[0].level, '掌握');

// 合规错误 → 封顶 60
evidence = learning.recordEvidence(evidence, {
  levelId: '1-3', chapter: 1, at: 3, dimensions: ['foundation'],
  knowledge: 1, transfer: 1, reflection: 1, efficiency: 1, complianceErrors: 1,
});
ability = learning.summarizeAbility(evidence);
assert.strictEqual(ability.list[0].score, 60, '合规错误应把维度得分封顶 60');
assert.strictEqual(ability.list[0].capped, true);
assert.strictEqual(ability.list[0].cappedText, '合规封顶');

// 多维度互不污染
let multi = learning.recordEvidence(null, {
  levelId: '2-6', chapter: 2, at: 4, dimensions: ['sourcing'],
  knowledge: 1, transfer: 1, reflection: 1, efficiency: 1, complianceErrors: 0,
});
multi = learning.recordEvidence(multi, {
  levelId: '1-1', chapter: 1, at: 5, dimensions: ['foundation'],
  knowledge: 0.4, transfer: 0.4, reflection: 0.4, efficiency: 0.4, complianceErrors: 0,
});
const multiAbility = learning.summarizeAbility(multi);
const sourcing = multiAbility.list.find(d => d.key === 'sourcing');
const foundation = multiAbility.list.find(d => d.key === 'foundation');
assert.strictEqual(sourcing.score, 100);
assert.strictEqual(foundation.score, 40);
assert.strictEqual(multiAbility.overall, 70, '总能力分应为各维度平均');

// 无数据时不应伪造分数
const emptyAbility = learning.summarizeAbility(null);
assert.strictEqual(emptyAbility.hasData, false);
assert.strictEqual(emptyAbility.overall, 0);

// 入参不被修改
const before = JSON.stringify(evidence);
learning.summarizeAbility(evidence);
assert.strictEqual(JSON.stringify(evidence), before, '聚合函数不得修改入参');

// ===== 6. 关卡学习结论 =====
let summary = learning.summarizeLevelLearning({
  level: { id: '1-2' }, quizRate: 1, objRate: 1, transfer: 1, reflection: 1, retries: 0,
});
assert.strictEqual(summary.abilityScore, 100);
assert.strictEqual(summary.hasTransfer, true);
assert.strictEqual(summary.hasReflection, true);
assert.strictEqual(summary.weakRows.length, 0);
assert.strictEqual(summary.nextStep.indexOf('进入下一关') >= 0, true);

summary = learning.summarizeLevelLearning({
  level: { id: '1-2' }, quizRate: 1, objRate: 1, transfer: 0.3, reflection: 1, retries: 0,
});
assert.strictEqual(summary.weakRows.length, 1);
assert.strictEqual(summary.weakRows[0].key, 'transfer');
assert.strictEqual(summary.nextStep.indexOf('迁移应用') >= 0, true, '应指出最该补强的项');

// 未配置迁移/复盘时回落到决策质量，不得出现 NaN
summary = learning.summarizeLevelLearning({
  level: { id: '2-1' }, quizRate: 0.8, objRate: 0.9, transfer: null, reflection: null, retries: 2,
});
assert.strictEqual(summary.hasTransfer, false);
assert.strictEqual(summary.rows.length, 3);
assert.ok(summary.abilityScore > 0 && summary.abilityScore <= 100, '分值必须在 0~100 之间');

// 掌握度分档
assert.strictEqual(learning.masteryOf(90), '熟练');
assert.strictEqual(learning.masteryOf(75), '掌握');
assert.strictEqual(learning.masteryOf(62), '基本达标');
assert.strictEqual(learning.masteryOf(30), '待加强');

console.log('learning tests passed');
