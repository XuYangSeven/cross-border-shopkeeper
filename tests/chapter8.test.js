const assert = require('assert');
const levels = require('../miniprogram/config/levels/index');
const chapter8 = levels.chapters.find(chapter => chapter.id === 8);
assert(chapter8);
assert.deepStrictEqual(chapter8.levels.map(level => level.id), ['8-1', '8-2', '8-3', '8-4', '8-5', '8-6']);
const types = ['cashFlowCalc', 'financeCalc', 'pricingChoice', 'purchaseChoice', 'riskChoice', 'financeBoss'];
chapter8.levels.forEach((level, index) => {
  // 每关有且仅有 1 个核心交互步骤（其余为情境对话 / 知识卡片 / 迁移题 / 结构化复述）
  const core = level.steps.filter(step => types.includes(step.type));
  assert.strictEqual(core.length, 1, `${level.id} 应有且仅有 1 个核心交互步骤，实际 ${core.length}`);
  assert.strictEqual(core[0].type, types[index], `${level.id} 核心交互步骤类型不符`);
  // 每个 Boss 关必须有迁移与复述
  if (level.type === 'boss') {
    assert.ok(level.steps.some(step => step.type === 'transfer'), `${level.id} 缺少迁移题`);
    assert.ok(level.steps.some(step => step.type === 'reflection'), `${level.id} 缺少结构化复述`);
  }
});
const text = JSON.stringify(chapter8);
['Amazon', '亚马逊', '淘宝', 'eBay'].forEach(name => assert(!text.includes(name)));
console.log('chapter8 config tests passed');
