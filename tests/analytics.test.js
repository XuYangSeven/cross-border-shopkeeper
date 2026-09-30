const assert = require('assert');
const analytics = require('../miniprogram/engine/analytics');
const chapter7 = require('../miniprogram/config/levels/chapter7');

const funnelStep = chapter7[1].steps.find(step => step.type === 'funnelCalc');
const funnel = analytics.calculateFunnel(funnelStep.data);
assert.strictEqual(funnel.ctr, 3);
assert.strictEqual(funnel.conversionRate, 5);
assert.strictEqual(funnel.averageOrderValue, 16.99);
assert.strictEqual(funnel.acos, 31.39);
assert.strictEqual(analytics.classifyMetric({ value: 5, target: 3, direction: 'higher' }).good, true);
assert.strictEqual(analytics.classifyMetric({ value: 42, target: 30, direction: 'lower' }).good, false);
assert.throws(() => analytics.calculateFunnel({ ...funnelStep.data, clicks: 100001 }));

// 关卡本体填写的参考答案必须与引擎实算一致
const analyticsAnswers = { ctr: funnel.ctr, conversionRate: funnel.conversionRate, averageOrderValue: funnel.averageOrderValue, acos: funnel.acos };
funnelStep.fields.forEach(field => {
  assert.strictEqual(field.answer, analyticsAnswers[field.key], `7-2 ${field.key} 参考答案与引擎实算不一致`);
});

const metricStep = chapter7[0].steps.find(step => step.type === 'metricIdentify');
const metricSelections = {};
metricStep.items.forEach(item => { metricSelections[item.id] = item.answer; });
const metricResults = metricStep.items.map(item => ({ ...item, options: item.options.map(option => ({ id: option, valid: option === item.answer, explanation: '' })) }));
const review = analytics.evaluateReview({ selections: metricSelections, items: metricResults, targets: { minValidCount: metricResults.length } });
assert.strictEqual(review.passed, true);

const boss = chapter7[5].steps.find(step => step.type === 'reviewBoss');
const selections = {};
boss.items.forEach(item => { selections[item.id] = item.options.find(option => option.valid).id; });
const bossResult = analytics.evaluateReview({ selections, items: boss.items, targets: boss.targets });
assert.strictEqual(bossResult.passed, true);
assert.strictEqual(bossResult.validCount, 5);
const badSelections = { ...selections, 'boss-priority': 'image', 'boss-cause': 'traffic' };
assert.strictEqual(analytics.evaluateReview({ selections: badSelections, items: boss.items, targets: boss.targets }).passed, false);
console.log('analytics tests passed');
