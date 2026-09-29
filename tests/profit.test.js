// 利润引擎验证脚本（Node 环境，验证 miniprogram/engine/profit.js 与策划案答案一致）
// 策划案参照：MVP详细设计_第1-2章.md 关卡 2-3 答案设计表 + 商品库与数值配置.md

const profit = require('../miniprogram/engine/profit');
const skus = require('../miniprogram/config/skus');

let pass = 0, fail = 0;
function check(name, actual, expected, tol) {
  const ok = Math.abs(actual - expected) <= (tol || 0.02);
  ok ? pass++ : fail++;
  console.log(`${ok ? '✅' : '❌'} ${name}: 实际 ${actual} / 期望 ${expected}${ok ? '' : '  ←← 不一致'}`);
}

function getSku(id) { return skus.find(s => s.id === id); }

console.log('===== 测试 1：体积重与计费重 =====');
const s1 = getSku('SKU-001'); // 20x8x2cm
check('SKU-001 体积重(kg)', profit.volumeWeight(s1.dimCm), 20 * 8 * 2 / 6000, 0.001);
check('SKU-001 计费重(kg)', profit.chargeableWeight(s1), 0.24, 0.001); // 体积重0.053 < 实重0.24

const s10 = getSku('SKU-010'); // 90x40x2cm 防抓沙发贴
check('SKU-010 体积重(kg)', profit.volumeWeight(s10.dimCm), 90 * 40 * 2 / 6000, 0.001); // 1.2
check('SKU-010 计费重取体积重(kg)', profit.chargeableWeight(s10), 1.2, 0.001);

console.log('\n===== 测试 2：仓配档位判定 =====');
check('SKU-001 档位=small_standard', profit.fbaTier(s1).key === 'small_standard' ? 1 : 0, 1);
const s7 = getSku('SKU-007'); // 猫抓板 50x30x4cm
check('SKU-007 档位=oversize_1(计费重1.1kg)', profit.fbaTier(s7).key === 'oversize_1' ? 1 : 0, 1);
check('SKU-010 档位=oversize_1(体积重1.2kg)', profit.fbaTier(s10).key === 'oversize_1' ? 1 : 0, 1);

console.log('\n===== 测试 3：利润核算（对照策划案关卡 2-3 答案表）=====');
// 硅胶宠物梳：售价16.99 采购15元 仓配3.22(small) → 毛利率≈45%
const r1 = profit.calcProfit(s1);
check('宠物梳 采购成本$', r1.supplyUSD, 15 / 6.8, 0.01);
check('宠物梳 仓配费$', r1.fbaFeeUSD, 3.22, 0.001);
check('宠物梳 佣金$', r1.commissionUSD, 16.99 * 0.15, 0.01);
check('宠物梳 毛利率', r1.margin * 100, 45.2, 1.5);

// 慢食碗：13.99 → ≈40%
const r4 = profit.calcProfit(getSku('SKU-004'));
check('慢食碗 毛利率', r4.margin * 100, 40.2, 1.5);

// 猫抓板：21.99 → ≈35%（oversize_1 仓配 5.08）
const r7 = profit.calcProfit(s7);
check('猫抓板 仓配费$=5.08', r7.fbaFeeUSD, 5.08, 0.001);
check('猫抓板 毛利率', r7.margin * 100, 34.6, 2);

// 防抓沙发贴：体积重 1.2kg → 仓配跳档 oversize_1，毛利率崩塌（教学陷阱）
const r10 = profit.calcProfit(s10);
console.log(`   防抓贴 实际毛利率 ${ (r10.margin * 100).toFixed(1) }% (策划案设定"远低于表面"，验证显著低)`);
check('防抓贴 毛利率显著低于25%', r10.margin < 0.25 ? 1 : 0, 1);

console.log('\n===== 测试 4：五维加权总分（对照关卡 2-4 专家答案）=====');
const W = { market: 0.25, competition: 0.25, profit: 0.25, logistics: 0.15, risk: 0.10 };
check('宠物梳 加权总分=4.5', profit.weightedScore(getSku('SKU-001').expertScores, W), 4.5, 0.01);
check('慢食碗 加权总分=3.6', profit.weightedScore(getSku('SKU-004').expertScores, W), 3.6, 0.01);
check('猫抓板 加权总分=3.8', profit.weightedScore(getSku('SKU-007').expertScores, W), 3.8, 0.01);

console.log('\n===== 测试 5：初筛规则引擎 =====');
// 第 2 章 10 品：通过 4 个（001/004/007/010），淘汰 6 个
// 注：SKU-010 防抓贴按教学设计通过初筛（显性维度全部合格），体积重陷阱在核算关暴露
const chapter2Ids = ['SKU-001','SKU-002','SKU-003','SKU-004','SKU-005','SKU-006','SKU-007','SKU-008','SKU-009','SKU-010'];
const results = chapter2Ids.map(id => ({ id, s: profit.screenSKU(getSku(id)) }));
const passed = results.filter(r => r.s.pass).map(r => r.id);
console.log('   通过初筛:', passed.join(', '));
check('通过数=4', passed.length, 4, 0);
check('宠物梳通过', passed.includes('SKU-001') ? 1 : 0, 1);
check('防抓贴通过初筛(陷阱留到核算关)', passed.includes('SKU-010') ? 1 : 0, 1);
check('仿大牌背包被侵权否决', results.find(r => r.id === 'SKU-005').s.traps.includes('trap_patent') ? 1 : 0, 1);
check('电动猫玩具被电池否决', results.find(r => r.id === 'SKU-002').s.traps.includes('trap_battery') ? 1 : 0, 1);
check('圣诞服饰被季节否决', results.find(r => r.id === 'SKU-008').s.traps.includes('trap_season') ? 1 : 0, 1);
check('智能饮水机被竞争否决', results.find(r => r.id === 'SKU-009').s.traps.includes('trap_competition') ? 1 : 0, 1);
check('宠物香水被液体否决', results.find(r => r.id === 'SKU-003').s.traps.includes('trap_liquid') ? 1 : 0, 1);

console.log('\n===== 测试 6：评分引擎 =====');
const scoring = require('../miniprogram/engine/scoring');
const sc1 = scoring.score(0.9, 1, 1); // 60*0.9+25+15=94
check('高分场景=3星', sc1.stars, 3, 0);
check('高分场景总分=94', sc1.total, 94, 0);
console.log(`   实际: total=${sc1.total} stars=${sc1.stars} coin=${sc1.coin}`);
const sc2 = scoring.score(0.6, 0.8, 0.6);
console.log(`   中分场景: total=${sc2.total} stars=${sc2.stars} coin=${sc2.coin}`);
check('中分场景≥1星', sc2.stars >= 1 ? 1 : 0, 1);

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
