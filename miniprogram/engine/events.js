// 事件引擎（对应《商品库与数值配置.md》4.1/4.2 节）
const EVENTS = require('../config/events');

// 每日事件判定
// @param chapter   当前章节（难度系数）
// @param day       游戏日
// @param lastFired 事件ID->上次触发日 映射（冷却判定）
// @param nearBoss  是否处于 Boss 结算前后 3 日窗口
// @param unlockedChapters 已解锁章节
function rollDaily(chapter, day, lastFired, nearBoss, unlockedChapters) {
  if (nearBoss) return null;
  if (Math.random() > EVENTS.RULES.baseChance * EVENTS.RULES.chapterScale(chapter)) return null;
  const pool = EVENTS.filter(e =>
    unlockedChapters >= e.unlockChapter &&
    (!lastFired[e.id] || day - lastFired[e.id] >= EVENTS.RULES.cooldownDays)
  );
  if (!pool.length) return null;
  // 加权随机
  const totalW = pool.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * totalW;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return pool[pool.length - 1];
}

module.exports = { rollDaily };
