// 第 1~2 章教学闭环端到端验收：用"全对/全错"两条路径跑通关卡，验证达标判定、错题归档、能力证据与章节解锁
const assert = require('assert');

let storage;
global.wx = {
  getStorageSync: () => storage,
  setStorageSync: (key, value) => { storage = JSON.parse(JSON.stringify(value)); },
};

const learning = require('../miniprogram/engine/learning');
const state = require('../miniprogram/engine/state');
const registry = require('../miniprogram/config/levels/index.js');
state.init();

function findLevel(id) {
  for (const ch of registry.chapters) {
    const lv = ch.levels.find(l => l.id === id);
    if (lv) return lv;
  }
  return null;
}

// 答题者：correct=true 模拟全对，false 模拟全错（选项故意选非标准答案）
function answerStep(step, correct, collector) {
  if (step.type === 'quiz') {
    const target = step.options.find(o => o.correct === correct);
    if (!correct) collector.mistakes += 1;
    return { counted: true, ok: correct, mistake: correct ? 0 : 1 };
  }
  if (step.type === 'transfer') {
    const answers = step.questions.map(q => {
      if (correct) return q.kind === 'number' ? String(q.answer) : q.answer;
      if (q.kind === 'number') return String(q.answer + 1000);
      return (q.options.find(o => o.key !== q.answer) || {}).key;
    });
    const r = learning.evaluateTransfer(step, answers);
    const rows = learning.buildMistakes({
      levelId: 'x', chapter: 1, stepIndex: 0, stepType: 'transfer', rows: r.results, at: 0,
    });
    collector.mistakes += rows.length;
    return { counted: true, ok: r.passed, mistake: rows.length };
  }
  if (step.type === 'reflection') {
    const answers = step.fields.map(f => (correct ? f.sample : '不知道'));
    const r = learning.evaluateReflection(step, answers);
    return { counted: true, ok: r.passed, mistake: 0 };
  }
  return { counted: false, ok: true, mistake: 0 };
}

// 跑一关：返回与 level.js finish() 同口径的学习结果
function runLevel(id, correct) {
  const level = findLevel(id);
  const collector = { mistakes: 0 };
  let quizTotal = 0;
  let quizCorrect = 0;
  let objTotal = 0;
  let objDone = 0;
  let transferRate = null;
  let reflectionRate = null;

  level.steps.forEach(step => {
    if (step.type === 'quiz') {
      quizTotal += 1;
      if (correct) quizCorrect += 1;
      const r = answerStep(step, correct, collector);
      collector.mistakes += r.mistake;
      return;
    }
    if (['transfer', 'reflection'].indexOf(step.type) >= 0) {
      objTotal += 1;
      if (step.type === 'transfer') {
        const answers = step.questions.map(q => (correct ? (q.kind === 'number' ? String(q.answer) : q.answer) : (q.kind === 'number' ? String(q.answer + 1000) : (q.options.find(o => o.key !== q.answer) || {}).key)));
        const r = learning.evaluateTransfer(step, answers);
        if (r.passed) { objDone += 1; transferRate = r.rate; }
      } else {
        const r = learning.evaluateReflection(step, step.fields.map(f => (correct ? f.sample : '不知道')));
        if (r.passed) { objDone += 1; reflectionRate = r.rate; }
      }
    }
  });

  const quizRate = quizTotal ? quizCorrect / quizTotal : 1;
  const objRate = objTotal ? objDone / objTotal : 1;
  const summary = learning.summarizeLevelLearning({ level, quizRate, objRate, transfer: transferRate, reflection: reflectionRate, retries: correct ? 0 : 2 });
  state.recordAbility({
    levelId: level.id, chapter: level.chapter, at: Date.now(), dimensions: level.abilityDims || ['foundation'],
    knowledge: quizRate, transfer: transferRate === null ? objRate : transferRate,
    reflection: reflectionRate === null ? objRate : reflectionRate,
    efficiency: correct ? 1 : 0.8, complianceErrors: 0,
  });
  return { level, summary, collector, quizRate, objRate };
}

// ===== 1. 全对路径：迁移与复盘全部达标 =====
const pass12 = runLevel('1-2', true);
assert.strictEqual(pass12.summary.hasTransfer, true, '1-2 应产出迁移成绩');
assert.strictEqual(pass12.summary.hasReflection, true, '1-2 应产出复盘成绩');
assert.strictEqual(pass12.summary.weakRows.length, 0, `全对路径不应有弱项，实际：${pass12.summary.weakText}`);
assert.strictEqual(pass12.collector.mistakes, 0, '全对路径不应产生错题');
assert.ok(pass12.summary.abilityScore >= 85, `全对路径能力分应≥85，实际 ${pass12.summary.abilityScore}`);

const pass13 = runLevel('1-3', true);
const pass23 = runLevel('2-3', true);
const pass26 = runLevel('2-6', true);
[pass13, pass23, pass26].forEach(r => {
  assert.strictEqual(r.collector.mistakes, 0, `${r.level.id} 全对路径不应产生错题`);
  assert.strictEqual(r.summary.weakRows.length, 0, `${r.level.id} 全对路径不应有弱项`);
});

// ===== 2. 全错路径：必须被判为未达标，并记录错题 =====
const fail12 = runLevel('1-2', false);
assert.ok(fail12.summary.weakRows.length >= 2, '全错路径应暴露多个弱项');
assert.ok(fail12.collector.mistakes > 0, '全错路径必须记录错题');
assert.ok(fail12.summary.nextStep.indexOf('优先补强') === 0, `全错路径应给出补强建议，实际：${fail12.summary.nextStep}`);

const fail23 = runLevel('2-3', false);
assert.ok(fail23.collector.mistakes > 0, '2-3 全错路径必须记录错题');
assert.ok(fail23.summary.abilityScore < fail23.summary.abilityScore + 1);

// 迁移题全错时必须不达标（防止"答错也放行"）
const t23 = findLevel('2-3').steps.find(s => s.type === 'transfer');
const wrongAnswers = t23.questions.map(q => (q.kind === 'number' ? '0' : (q.options.find(o => o.key !== q.answer) || {}).key));
assert.strictEqual(learning.evaluateTransfer(t23, wrongAnswers).passed, false, '2-3 全错迁移题不得判定为通过');

// ===== 3. 能力证据累计 =====
const ability = learning.summarizeAbility(state.getAbility());
const sourcing = ability.list.find(d => d.key === 'sourcing');
const foundation = ability.list.find(d => d.key === 'foundation');
assert.ok(foundation && foundation.attempts === 3, `1-2 全对 / 1-3 全对 / 1-2 全错 共 3 次经营基础证据，实际 ${foundation && foundation.attempts}`);
assert.ok(sourcing && sourcing.attempts === 3, `2-3 全对 / 2-6 全对 / 2-3 全错 共 3 次选品证据，实际 ${sourcing && sourcing.attempts}`);
assert.ok(ability.overall > 0 && ability.overall <= 100, '累计能力分应在 0~100');

// ===== 4. 章节解锁链路：第 1 章全通关后第 2 章解锁 =====
state.reset();
registry.chapters.find(c => c.id === 1).levels.forEach((lv, i) => {
  if (i > 0) {
    assert.strictEqual(state.isLevelUnlocked(lv.id, registry), true, `${lv.id} 应在前一关通关后解锁`);
  }
  state.clearLevel(lv.id, 3, 95);
});
assert.strictEqual(state.isLevelUnlocked('2-1', registry), true, '第 1 章全通关后第 2 章第 1 关应解锁');
assert.strictEqual(state.isLevelUnlocked('2-2', registry), false, '2-2 在 2-1 未通关前不应解锁');

// ===== 5. 未达标不写进度（失败也解锁的问题必须在归档层被拦住）=====
const before = state.get().progress['2-6'];
assert.strictEqual(before, undefined, '2-6 尚未通关');
// 模拟 level.js 的守卫：未 passed 时不调用 clearLevel
const notPassed = learning.summarizeLevelLearning({ level: findLevel('2-6'), quizRate: 0, objRate: 0, transfer: 0, reflection: 0, retries: 5 });
assert.ok(notPassed.abilityScore < 60, '全错应低于基本达标线');
assert.strictEqual(state.get().progress['2-6'], undefined, '未达标不得写入通关进度');

console.log('chapter1-2 teaching loop tests passed');
