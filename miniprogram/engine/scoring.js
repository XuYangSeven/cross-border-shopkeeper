// 评分引擎（对应《商品库与数值配置.md》4.3 节）
const CONSTANTS = require('../config/constants');

// 计算关卡得分与星数
// @param objective  目标完成度 0~1
// @param efficiency 效率分 0~1（如提示使用次数、修改次数折算）
// @param quizRate   知识问答正确率 0~1
function score(objective, efficiency, quizRate) {
  const w = CONSTANTS.SCORE_WEIGHTS;
  const total = Math.round((objective * w.objective + efficiency * w.efficiency + quizRate * w.quiz) * 100);
  const stars = total >= CONSTANTS.STAR_THRESHOLDS[0] ? 3
    : total >= CONSTANTS.STAR_THRESHOLDS[1] ? 2
    : total >= CONSTANTS.STAR_THRESHOLDS[2] ? 1 : 0;
  const passed = stars >= 1;
  return { total, stars, passed, coin: passed ? CONSTANTS.COIN_REWARD[stars] || 0 : 0 };
}

// 检查目标是否越过健康线（结算报告用）
function healthCheck(metrics) {
  const t = CONSTANTS.HEALTH_TARGETS;
  return {
    grossMargin: metrics.grossMargin >= t.grossMargin,
    acos: metrics.acos <= t.acos,
    conversion: metrics.conversion >= t.conversion,
    turnoverDays: metrics.turnoverDays <= t.turnoverDays,
    shopRating: metrics.shopRating >= t.shopRating,
  };
}

module.exports = { score, healthCheck };
