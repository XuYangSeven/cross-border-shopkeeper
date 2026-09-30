// 存档层新增字段测试：学习进度 / 能力证据 / 错题 / 版本迁移 / 通关奖励不重复发放
const assert = require('assert');

let storage;
global.wx = {
  getStorageSync: () => storage,
  setStorageSync: (key, value) => { storage = JSON.parse(JSON.stringify(value)); },
};

const state = require('../miniprogram/engine/state');
state.init();

// ===== 1. 存档版本与默认结构 =====
const raw = state.get();
assert.strictEqual(raw.version, state.SAVE_VERSION, '存档应带版本号');
assert.deepStrictEqual(raw.mistakes, [], '错题默认应为空数组');
assert.strictEqual(raw.learning, null);
assert.strictEqual(raw.ability, null);

// ===== 2. 学习进度：保存 / 读取 / 清除 =====
state.saveLearningProgress({ levelId: '1-2', levelName: '读懂三个数字', stepIndex: 5, stepTotal: 12 });
let progress = state.getLearningProgress();
assert.strictEqual(progress.levelId, '1-2');
assert.strictEqual(progress.stepIndex, 5);
assert.strictEqual(progress.stepTotal, 12);
assert.ok(progress.updatedAt > 0);

// 清除指定关卡
state.clearLearningProgress('1-1');
assert.strictEqual(state.getLearningProgress().levelId, '1-2', '清除其他关卡不应影响本关进度');
state.clearLearningProgress('1-2');
assert.strictEqual(state.getLearningProgress(), null, '清除本关进度后应为空');

// 非法入参不写入
state.saveLearningProgress(null);
assert.strictEqual(state.getLearningProgress(), null);

// ===== 3. 能力证据：连续记录并聚合 =====
state.recordAbility({
  levelId: '1-1', chapter: 1, at: 1, dimensions: ['foundation'],
  knowledge: 1, transfer: 0.5, reflection: 0.5, efficiency: 1, complianceErrors: 0,
});
const ability1 = state.getAbility();
assert.strictEqual(ability1.dims.foundation.attempts, 1);
assert.strictEqual(ability1.records.length, 1);

state.recordAbility({
  levelId: '1-2', chapter: 1, at: 2, dimensions: ['foundation'],
  knowledge: 1, transfer: 1, reflection: 1, efficiency: 1, complianceErrors: 0,
});
const ability2 = state.getAbility();
assert.strictEqual(ability2.dims.foundation.attempts, 2, '同一维度应累加次数');
assert.ok(ability2.dims.foundation.levels.indexOf('1-1') >= 0);
assert.ok(ability2.dims.foundation.levels.indexOf('1-2') >= 0);

// ===== 4. 错题：追加 / 过滤 / 上限 / 清除 =====
state.addMistakes([
  { levelId: '1-2', chapter: 1, question: 'q1', userAnswer: 'A', correctAnswer: 'B', explain: 'e', at: 1 },
  { levelId: '1-3', chapter: 1, question: 'q2', userAnswer: 'C', correctAnswer: 'A', explain: 'e', at: 2 },
]);
assert.strictEqual(state.getMistakes().length, 2);
assert.strictEqual(state.getMistakes('1-2').length, 1, '按关卡过滤应生效');
state.clearMistakes('1-2');
assert.strictEqual(state.getMistakes().length, 1, '应只清除指定关卡错题');
assert.strictEqual(state.getMistakes()[0].levelId, '1-3');

// 上限保护：不得无限增长
const bulk = [];
for (let i = 0; i < 150; i += 1) {
  bulk.push({ levelId: '2-6', chapter: 2, question: `q${i}`, userAnswer: '', correctAnswer: '', explain: '', at: i });
}
state.addMistakes(bulk);
assert.strictEqual(state.getMistakes().length, 100, '错题应保留最近 100 条');
state.clearMistakes();
assert.strictEqual(state.getMistakes().length, 0);

// ===== 5. 通关奖励：首次全额、重复通关不刷金币、星数提升只补差额 =====
const before = state.get().coins;
const first = state.clearLevel('9-9', 3, 95);
assert.strictEqual(first, 30, '首次三星应发 30 金币');
assert.strictEqual(state.get().coins, before + 30);
const repeat = state.clearLevel('9-9', 3, 95);
assert.strictEqual(repeat, 0, '重复通关同星数不得再发金币');
assert.strictEqual(state.get().coins, before + 30);
state.clearLevel('9-9', 1, 60);
assert.strictEqual(state.get().progress['9-9'].stars, 3, '低星重刷不得降低已得星数');
assert.strictEqual(state.isLevelCleared('9-9'), true);
state.clearLevel('9-8', 1, 62);
assert.strictEqual(state.isLevelCleared('9-8'), true);
state.clearLevel('9-8', 2, 75);
assert.strictEqual(state.get().progress['9-8'].stars, 2);

// ===== 6. 存档迁移：模拟旧存档（缺新字段）不得报错且补齐结构 =====
storage = {
  createdAt: 123,
  progress: { '1-1': { stars: 2, bestScore: 80, clearedAt: 1 } },
  cards: ['K1-01'],
  coins: 10,
  exp: 20,
  shopState: { mode: 'save' },
};
const reloaded = require('../miniprogram/engine/state');
delete require.cache[require.resolve('../miniprogram/engine/state')];
const state2 = require('../miniprogram/engine/state');
state2.init();
const migrated = state2.get();
assert.strictEqual(migrated.version, state2.SAVE_VERSION, '旧存档应被升级到当前版本');
assert.deepStrictEqual(migrated.mistakes, [], '迁移应补齐 mistakes');
assert.strictEqual(migrated.learning, null, '迁移应补齐 learning');
assert.strictEqual(migrated.progress['1-1'].stars, 2, '迁移不得丢失既有进度');
assert.strictEqual(migrated.coins, 10);
assert.strictEqual(state2.getLearningProgress(), null, '迁移后学习进度读取不应抛错');
assert.strictEqual(state2.getMistakes().length, 0);
state2.saveLearningProgress({ levelId: '2-1', stepIndex: 3, stepTotal: 10 });
assert.strictEqual(state2.getLearningProgress().levelId, '2-1', '迁移后新功能应可正常写入');

console.log('learning-state tests passed');
