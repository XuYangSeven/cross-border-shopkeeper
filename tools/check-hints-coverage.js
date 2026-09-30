// 求助提示的覆盖率与内容质量自检。
//
// 用途：每次改动关卡数据后跑一遍，确认提示系统没有出现「空壳」或覆盖率塌陷。
// 为什么需要它：提示是从题目字段自动派生的，题目改了提示就会跟着变——
// 如果某道题把答案字段改没了，提示会静默降级成「没有唯一标准答案」，
// 单靠一次功能测试不一定发现，这个脚本会直接报出是哪一关。
//
// 运行：node tools/check-hints-coverage.js
// 退出码非 0 表示有问题（可直接接进 CI）。

const path = require('path');

const MP = path.join(__dirname, '..', 'miniprogram');
const registry = require(path.join(MP, 'config/levels/index'));
const hints = require(path.join(MP, 'engine/hints'));
const learning = require(path.join(MP, 'engine/learning'));
const CONSTANTS = require(path.join(MP, 'config/constants'));

let exitCode = 0;

function eachStep(fn) {
  registry.chapters.forEach(ch => {
    ch.levels.forEach(lv => {
      lv.steps.forEach((s, i) => fn(s, lv, ch, i));
    });
  });
}

function contextOf(lv, ch) {
  return {
    chapterId: ch.id,
    chapterName: ch.name,
    abilityLabels: (lv.abilityDims || []).map(k => learning.DIMENSION_MAP[k]).filter(Boolean),
  };
}

console.log('提示定价（唯一来源 constants.HINT_TIERS）：');
CONSTANTS.HINT_TIERS.forEach(t => {
  console.log(`  L${t.tier} ${t.label.padEnd(4)} ${String(t.price).padStart(3)} 金币  ${t.desc}`);
});
console.log('');

const stat = {};
let total = 0;
let askable = 0;
let withExact = 0;
const notReady = [];

eachStep((step, lv, ch) => {
  total++;
  stat[step.type] = stat[step.type] || { n: 0, askable: 0, l1: 0, l2: 0, l3: 0, exact: 0 };
  const row = stat[step.type];
  row.n++;
  if (!hints.isAskable(step)) return;

  askable++;
  row.askable++;
  const built = hints.buildHints(step, contextOf(lv, ch));
  if (built.tiers[0].ready) row.l1++;
  if (built.tiers[1].ready) row.l2++;
  if (built.tiers[2].ready) row.l3++;
  if (built.tiers[2].exact) { row.exact++; withExact++; }
  built.tiers.forEach(t => {
    if (!t.ready || !t.text) notReady.push(`${lv.id} / ${step.type} / L${t.tier}`);
  });
});

console.log(`步骤总数 ${total}，其中可求助 ${askable}，不可求助 ${total - askable}`);
console.log('');
console.log('类型'.padEnd(20) + '数量'.padStart(4) + 'L1'.padStart(5) + 'L2'.padStart(5) + 'L3'.padStart(5) + 'L3精确'.padStart(7));
Object.keys(stat).sort((a, b) => stat[b].n - stat[a].n).forEach(type => {
  const row = stat[type];
  const mark = row.askable === 0 ? '  (不提供求助：无对错)'
    : row.l1 === row.askable && row.l2 === row.askable && row.l3 === row.askable ? ''
      : '  ← 有缺内容';
  console.log(
    type.padEnd(20)
    + String(row.n).padStart(4)
    + String(row.l1).padStart(5)
    + String(row.l2).padStart(5)
    + String(row.l3).padStart(5)
    + String(row.exact).padStart(7)
    + mark
  );
});
console.log('');

if (notReady.length) {
  console.error(`✗ 有 ${notReady.length} 处提示取不到内容：`);
  notReady.slice(0, 20).forEach(x => console.error('  ' + x));
  exitCode = 1;
}
if (askable < 100) {
  console.error(`✗ 可求助步骤数异常偏少：${askable}`);
  exitCode = 1;
}

console.log(`L3 含权威答案：${withExact} / ${askable}（其余为复述题或多轮 Boss，如实降级不编造）`);

// 抽样展示，便于人工核对语气与质量
console.log('\n=== 抽样 ===');
const wanted = ['quiz', 'calc', 'financeCalc', 'reflection', 'skuFilter'];
const seen = {};
eachStep((step, lv, ch) => {
  if (wanted.indexOf(step.type) < 0 || seen[step.type]) return;
  seen[step.type] = 1;
  const built = hints.buildHints(step, contextOf(lv, ch));
  console.log(`--- ${step.type} @${lv.id} ---`);
  built.tiers.forEach(t => {
    console.log(`  L${t.tier} ${t.label}（${t.price} 金币，exact=${t.exact}）`);
    console.log('    ' + (t.text || '(空)').split('\n').join('\n    '));
  });
});

if (exitCode === 0) console.log('\n✓ 提示覆盖率自检通过');
process.exit(exitCode);
