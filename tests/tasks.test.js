const assert = require('assert');
const tasks = require('../miniprogram/engine/tasks');

const shop = { service: { resolutionRate: 92, rating: 4.4 } };
const settlement = { acos: 32, stockoutDays: 0, orders: 12, profit: 8, endingCash: 4200 };
const result = tasks.evaluateTasks(tasks.createTasks(), settlement, shop);
assert.strictEqual(result.length, 6);
assert.strictEqual(tasks.countCompleted(result), 6);
assert.strictEqual(tasks.summarize(result, settlement).allCompleted, true);
assert.strictEqual(tasks.calculateReward(result).coins, 110);
console.log('tasks tests passed');
