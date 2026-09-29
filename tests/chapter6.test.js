const assert = require('assert');
const levels = require('../miniprogram/config/levels/index');
const chapter6 = levels.chapters.find(chapter => chapter.id === 6);
const customer = require('../miniprogram/engine/customer');

assert(chapter6);
assert.deepStrictEqual(chapter6.levels.map(level => level.id), ['6-1', '6-2', '6-3', '6-4', '6-5', '6-6']);
const allowed = ['customerScenario', 'serviceMetrics', 'customerBoss'];
const ids = new Set();
chapter6.levels.forEach(level => {
  assert(level.steps.length === 1);
  const step = level.steps[0];
  assert(allowed.includes(step.type));
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
const boss = chapter6.levels[5].steps[0];
const selections = {};
boss.cases.forEach(item => { selections[item.id] = 'good'; });
assert.strictEqual(customer.evaluateCustomerBoss({ cases: boss.cases, selections, responseLimitHours: boss.responseLimitHours, targets: boss.targets }).passed, true);
const overBudget = { ...selections, [boss.cases[0].id]: 'bad' };
assert.strictEqual(customer.evaluateCustomerBoss({ cases: boss.cases, selections: overBudget, responseLimitHours: boss.responseLimitHours, targets: boss.targets }).passed, false);
const sourceText = JSON.stringify(chapter6);
['Amazon', '亚马逊', '淘宝', 'eBay'].forEach(name => assert(!sourceText.includes(name)));
console.log('chapter6 config tests passed');
