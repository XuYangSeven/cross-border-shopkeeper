const assert = require('assert');
const analytics = require('../miniprogram/engine/analytics');
const chapter7 = require('../miniprogram/config/levels/chapter7');

const funnel = analytics.calculateFunnel(chapter7[1].steps[0].data);
assert.strictEqual(funnel.ctr, 3);
assert.strictEqual(funnel.conversionRate, 5);
assert.strictEqual(funnel.averageOrderValue, 16.99);
assert.strictEqual(funnel.acos, 31.39);
assert.strictEqual(analytics.classifyMetric({ value: 5, target: 3, direction: 'higher' }).good, true);
assert.strictEqual(analytics.classifyMetric({ value: 42, target: 30, direction: 'lower' }).good, false);
assert.throws(() => analytics.calculateFunnel({ ...chapter7[1].steps[0].data, clicks: 100001 }));

const metricStep = chapter7[0].steps[0];
const metricSelections = {};
metricStep.items.forEach(item => { metricSelections[item.id] = item.answer; });
const metricResults = metricStep.items.map(item => ({ ...item, options: item.options.map(option => ({ id: option, valid: option === item.answer, explanation: '' })) }));
const review = analytics.evaluateReview({ selections: metricSelections, items: metricResults, targets: { minValidCount: metricResults.length } });
assert.strictEqual(review.passed, true);

const boss = chapter7[5].steps[0];
const selections = {};
boss.items.forEach(item => { selections[item.id] = item.options.find(option => option.valid).id; });
const bossResult = analytics.evaluateReview({ selections, items: boss.items, targets: boss.targets });
assert.strictEqual(bossResult.passed, true);
assert.strictEqual(bossResult.validCount, 5);
const badSelections = { ...selections, 'boss-priority': 'image', 'boss-cause': 'traffic' };
assert.strictEqual(analytics.evaluateReview({ selections: badSelections, items: boss.items, targets: boss.targets }).passed, false);
console.log('analytics tests passed');
