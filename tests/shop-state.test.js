const assert = require('assert');
const state = require('../miniprogram/engine/state');

let storage;
global.wx = { getStorageSync: () => storage, setStorageSync: (key, value) => { storage = JSON.parse(JSON.stringify(value)); } };
state.init();
const initial = state.getShopState();
assert.strictEqual(initial.mode, 'save');
assert.strictEqual(initial.inventory.available, 100);
state.updateShopState({ metrics: { ...initial.metrics, acos: 28 } }, 'test_update');
assert.strictEqual(state.getShopState().metrics.acos, 28);
assert.strictEqual(state.getShopActionLog().length, 1);
state.setShopMode('practice');
state.updateShopState({ metrics: { ...state.getShopState().metrics, acos: 60 } }, 'practice_update');
assert.strictEqual(state.getShopState().metrics.acos, 60);
state.resetShopWeek();
assert.strictEqual(state.getShopState().metrics.acos, 41);
assert.strictEqual(state.getShopActionLog().length, 0);
console.log('shop state tests passed');
