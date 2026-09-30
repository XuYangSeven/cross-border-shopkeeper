// 金币经济平衡模拟。
//
// 用途：改动 HINT_TIERS / NO_HINT_MULTIPLIER / STREAK_BONUS_* 之后，
// 用真实引擎跑一遍不同玩法，确认平衡没有被改坏。
//
// 标定基准（见 docs/求助与学习经济_设计说明.md 第 6 节）：
//   「每关都买线索提示」的支出应恰好等于全部关卡的基础收益（base 总和），
//   即一路靠线索通关的人刚好花光、攒不下钱；想有余钱就得少用提示。
//   同时「每关都买解析」应当明显买不起，让解析成为需要选择性使用的奢侈品。
//
// 运行：node tools/simulate-coin-economy.js
// 退出码非 0 表示平衡被改坏。

const path = require('path');

const MP = path.join(__dirname, '..', 'miniprogram');
const registry = require(path.join(MP, 'config/levels/index'));
const C = require(path.join(MP, 'config/constants'));
const statePath = path.join(MP, 'engine/state.js');

function makeWx() {
  const store = {};
  return {
    store,
    getStorageSync: k => store[k],
    setStorageSync: (k, v) => { store[k] = v; },
    removeStorageSync: k => { delete store[k]; },
  };
}
function freshState() {
  global.wx = makeWx();
  delete require.cache[require.resolve(statePath)];
  return require(statePath);
}

const ids = [];
registry.chapters.forEach(ch => ch.levels.forEach(lv => ids.push(lv.id)));

const baseAll = ids.length * C.COIN_REWARD[3];
console.log(`关卡总数 ${ids.length}；提示定价 L1=${C.HINT_TIERS[0].price} L2=${C.HINT_TIERS[1].price} L3=${C.HINT_TIERS[2].price}`);
console.log(`全三星 base 总收入 ${baseAll}（每关 ${C.COIN_REWARD[3]}）`);
console.log(`其他参数：零提示 ×${C.NO_HINT_MULTIPLIER}，连胜 ${C.STREAK_BONUS_STEP}×min(N,${C.STREAK_BONUS_CAP})`);
console.log('');

function play(label, plan) {
  const state = freshState();
  state.init();
  state.get().coins = 0;
  let bought = 0;
  let blocked = 0;
  let spent = 0;
  plan.forEach((uses, i) => {
    uses.forEach(tier => {
      const price = C.HINT_TIERS[tier - 1].price;
      if (state.spendCoins(price, { type: 'hint', label: 'sim' })) { bought++; spent += price; }
      else blocked++;
    });
    state.settleLevelReward(ids[i], 3, 95, { usedHint: uses.length > 0 });
  });
  const coins = state.get().coins;
  console.log(
    label.padEnd(26)
    + '余额' + String(coins).padStart(6)
    + ' | 连胜' + String(state.getStudyStreak()).padStart(3)
    + ' | 买到' + String(bought).padStart(4)
    + ' | 买不起' + String(blocked).padStart(4)
    + ' | 花掉' + String(spent).padStart(5)
  );
  return { coins, bought, blocked, spent, streak: state.getStudyStreak() };
}

console.log('=== 五种玩法的经济结果（全三星通关）===');
const none = ids.map(() => []);
const moderate = ids.map((id, i) => (i % 3 === 0 ? [2] : []));
const heavy = ids.map(() => [2]);
const answerHeavy = ids.map(() => [3]);
const mixed = ids.map((id, i) => (i % 4 === 0 ? [1, 2] : i % 7 === 0 ? [1, 2, 3] : []));

const rNone = play('① 全程零提示', none);
const rModerate = play('② 每 3 关买 1 次线索', moderate);
const rHeavy = play('③ 每关都买线索', heavy);
const rAnswer = play('④ 每关都买解析', answerHeavy);
const rMixed = play('⑤ 混合（约 1/4 关卡求助）', mixed);

console.log('');

let failed = 0;
function check(ok, message) {
  if (ok) { console.log('✓ ' + message); return; }
  console.error('✗ ' + message);
  failed++;
}

// ① 零提示必须显著富余，否则「省着用」没有回报
check(rNone.coins > baseAll * 1.5, `全程零提示应显著富余（余额 ${rNone.coins} > ${Math.round(baseAll * 1.5)}）`);
check(rNone.streak === ids.length, '全程零提示的连胜应等于关卡总数');

// ② 适度求助后仍有结余，不能让学生因为「怕花光」而不敢求助
check(rModerate.coins > 1000, `适度求助仍应留有余钱（余额 ${rModerate.coins} > 1000）`);

// ③ 核心标定：每关都用线索 ≈ 花光基础收益
const heavyGap = Math.abs(rHeavy.spent - baseAll);
check(heavyGap <= C.HINT_TIERS[1].price * 2,
  `「每关都用线索」的支出应贴近 base 总和（支出 ${rHeavy.spent} vs base ${baseAll}，差 ${heavyGap}）`);

// ④ 解析必须是奢侈品：大量购买被拦下
check(rAnswer.blocked > 0, `「每关都用解析」应出现买不起的情况（被拦下 ${rAnswer.blocked} 次）`);

// ⑤ 混合玩法应处于两者之间
check(rMixed.coins < rNone.coins && rMixed.coins > rHeavy.coins,
  `混合玩法的结余应介于零提示与全程求助之间（${rHeavy.coins} < ${rMixed.coins} < ${rNone.coins}）`);

if (failed) {
  console.error(`\n✗ 经济平衡检查未通过：${failed} 项`);
  process.exit(1);
}
console.log('\n✓ 经济平衡检查通过');
