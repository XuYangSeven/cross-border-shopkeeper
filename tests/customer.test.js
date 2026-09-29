const assert = require('assert');
const customer = require('../miniprogram/engine/customer');
const levels = require('../miniprogram/config/levels/chapter6');

const metrics = customer.calculateServiceMetrics({ ticketCount: 20, timelyCount: 18, resolvedCount: 16, orderCount: 100, refundedOrderCount: 5, ratingCount: 10, satisfiedCount: 8 });
assert.strictEqual(metrics.timelyResponseRate, 0.9);
assert.strictEqual(metrics.resolutionRate, 0.8);
assert.strictEqual(metrics.refundRate, 0.05);
assert.strictEqual(metrics.satisfactionRate, 0.8);
assert.strictEqual(customer.calculateServiceMetrics({ ticketCount: 0, timelyCount: 0, resolvedCount: 0, orderCount: 0, refundedOrderCount: 0, ratingCount: 0, satisfiedCount: 0 }).refundRate, null);
assert.throws(() => customer.calculateServiceMetrics({ ticketCount: 1, timelyCount: 2, resolvedCount: 0, orderCount: 1, refundedOrderCount: 0, ratingCount: 1, satisfiedCount: 0 }));

const basic = levels[0].steps[0];
const source = JSON.stringify(basic.cases);
const evaluated = customer.evaluateScenario({ scenario: basic.cases[0], optionId: 'good', responseLimitHours: 24 });
assert.strictEqual(evaluated.compliant, true);
assert.strictEqual(evaluated.timely, true);
assert.strictEqual(JSON.stringify(basic.cases), source);
assert.throws(() => customer.evaluateScenario({ scenario: basic.cases[0], optionId: 'missing', responseLimitHours: 24 }));

const boss = levels[5].steps[0];
const selections = {};
boss.cases.forEach(item => { selections[item.id] = 'good'; });
const result = customer.evaluateCustomerBoss({ cases: boss.cases, selections, responseLimitHours: boss.responseLimitHours, targets: boss.targets });
assert.strictEqual(result.passed, true);
assert.strictEqual(result.costCents, 2620);
assert.strictEqual(result.averageSatisfaction, 84);
assert.strictEqual(result.timelyResponseRate, 1);
assert.strictEqual(result.resolutionRate, 1);
assert.throws(() => customer.evaluateCustomerBoss({ cases: boss.cases, selections: {}, responseLimitHours: 24, targets: boss.targets }));
console.log('customer tests passed');
