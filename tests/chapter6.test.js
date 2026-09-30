const assert = require('assert');
const levels = require('../miniprogram/config/levels/index');
const chapter6 = levels.chapters.find(chapter => chapter.id === 6);
const customer = require('../miniprogram/engine/customer');

assert(chapter6);
assert.deepStrictEqual(chapter6.levels.map(level => level.id), ['6-1', '6-2', '6-3', '6-4', '6-5', '6-6']);
const allowed = ['customerScenario', 'serviceMetrics', 'customerBoss'];
const lead = ['dialog', 'card'];
const tail = ['transfer', 'reflection'];
const ids = new Set();
chapter6.levels.forEach(level => {
  // 每关有且仅有 1 个客服核心交互步骤；其余步骤只允许是情境对话 / 知识卡片 / 迁移题 / 结构化复述
  const core = level.steps.filter(step => allowed.includes(step.type));
  assert.strictEqual(core.length, 1, `${level.id} 应有且仅有 1 个客服核心交互步骤，实际 ${core.length}`);
  level.steps.forEach(step => {
    assert(lead.concat(allowed, tail).includes(step.type), `${level.id} 出现未预期的步骤类型 ${step.type}`);
  });
  // 结构顺序：引入（dialog/card）→ 核心交互 → 迁移 → 复述
  const coreIndex = level.steps.indexOf(core[0]);
  const tailIndex = level.steps.findIndex(step => tail.includes(step.type));
  level.steps.slice(0, coreIndex).forEach(step => {
    assert(lead.includes(step.type), `${level.id} 核心交互步骤之前只能有情境对话或知识卡片，出现 ${step.type}`);
  });
  if (tailIndex >= 0) {
    assert(coreIndex < tailIndex, `${level.id} 客服核心交互步骤应排在迁移/复述之前`);
    level.steps.slice(tailIndex).forEach(step => {
      assert(tail.includes(step.type), `${level.id} 迁移/复述之后不应再有 ${step.type} 步骤`);
    });
  }
  const step = core[0];
  if (step.cases) {
    step.cases.forEach(item => {
      assert(!ids.has(item.id));
      ids.add(item.id);
      assert(item.options.length >= 3);
      item.options.forEach(option => {
        assert(option.explanation);
        assert(option.outcome);
      });
    });
  }
});
const boss = chapter6.levels[5].steps.find(step => step.type === 'customerBoss');
assert(chapter6.levels[5].steps.some(step => step.type === 'transfer'), '6-6 Boss 应包含迁移题');
assert(chapter6.levels[5].steps.some(step => step.type === 'reflection'), '6-6 Boss 应包含结构化复述');
const selections = {};
boss.cases.forEach(item => { selections[item.id] = 'good'; });
assert.strictEqual(customer.evaluateCustomerBoss({ cases: boss.cases, selections, responseLimitHours: boss.responseLimitHours, targets: boss.targets }).passed, true);
const overBudget = { ...selections, [boss.cases[0].id]: 'bad' };
assert.strictEqual(customer.evaluateCustomerBoss({ cases: boss.cases, selections: overBudget, responseLimitHours: boss.responseLimitHours, targets: boss.targets }).passed, false);
const sourceText = JSON.stringify(chapter6);
['Amazon', '亚马逊', '淘宝', 'eBay'].forEach(name => assert(!sourceText.includes(name)));
console.log('chapter6 config tests passed');
