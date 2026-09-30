// 关卡结果页：游戏结果（星级）+ 学习结果（能力反馈）+ 下一步行动
const cards = require('../../config/cards');
const levels = require('../../config/levels/index');
const state = require('../../engine/state');

// 结算明细通过临时存档传递，避免长 JSON 挤在 URL 里被截断
const PAYLOAD_KEY = 'kuajing_result_payload';
const PAYLOAD_TTL = 60 * 1000;

function readPayload(levelId) {
  try {
    const payload = wx.getStorageSync(PAYLOAD_KEY);
    if (!payload || payload.levelId !== levelId) return null;
    if (Date.now() - (payload.at || 0) > PAYLOAD_TTL) return null;
    // 一次性读取：避免二次进入结果页时读到上一轮的旧明细
    if (typeof wx.removeStorageSync === 'function') wx.removeStorageSync(PAYLOAD_KEY);
    return payload;
  } catch (e) {
    return null;
  }
}

// URL 参数可能被截断或手工改写，解码失败时降级而不是抛异常白屏
function safeDecode(text, fallback) {
  const fallbackValue = fallback === undefined ? '' : fallback;
  if (text === undefined || text === null || text === '') return fallbackValue;
  try { return decodeURIComponent(String(text)); } catch (e) { return String(text); }
}

function clampStars(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(3, Math.floor(n)));
}

function levelExists(id) {
  for (const ch of levels.chapters) {
    if (ch.levels.some(l => l.id === id)) return true;
  }
  return false;
}

Page({
  data: {
    level: '',
    levelValid: false,
    stars: 0,
    total: 0,
    coin: 0,
    passed: false,
    starsText: '☆☆☆',
    title: '',
    cards: [],
    rows: [],
    abilityScore: 0,
    abilityLevel: '',
    weakText: '',
    nextStep: '',
    overall: 0,
    overallLevel: '',
    nextLevelId: '',
    nextLevelName: '',
    // 金币结算明细（走 payload，不塞 URL）
    reward: null,
    hintsUsed: 0,
    hintsSpent: 0,
  },
  onLoad(q) {
    const levelId = typeof q.level === 'string' ? q.level.trim() : '';
    const levelValid = levelExists(levelId);
    const stars = clampStars(q.stars);
    const passed = q.passed === '1' && levelValid;
    const payload = readPayload(levelId);
    const rawRows = payload && Array.isArray(payload.rows) ? payload.rows : [];
    this.setData({
      level: levelId,
      levelValid,
      stars,
      total: Number(q.total) || 0,
      coin: Number(q.coin) || 0,
      passed,
      starsText: stars >= 1 ? '★★★'.slice(0, stars) + '☆☆☆'.slice(stars) : '☆☆☆',
      title: stars >= 1 ? '本关完成' : '未达标，再来一次',
      cards: (q.cards || '').split(',').filter(Boolean).map(id => cards[id]).filter(Boolean),
      rows: rawRows.filter(r => r && typeof r === 'object')
        .map(row => ({ ...row, percent: Math.round((row.rate || 0) * 100) })),
      abilityScore: payload ? Number(payload.abilityScore) || 0 : 0,
      abilityLevel: payload ? safeDecode(payload.abilityLevel) : '',
      weakText: payload ? safeDecode(payload.weakText) : '',
      nextStep: payload ? safeDecode(payload.nextStep) : '',
      overall: payload ? Number(payload.overall) || 0 : 0,
      overallLevel: payload ? safeDecode(payload.overallLevel) : '',
      nextLevelId: passed ? (this.findNextLevelId(levelId) || '') : '',
      nextLevelName: passed ? (this.findNextLevelName(levelId) || '') : '',
      // 逐字段取值而不是整个透传：payload 结构不合法时也不会把脏数据带进模板
      reward: this.readReward(payload),
      hintsUsed: payload ? Number(payload.hintsUsed) || 0 : 0,
      hintsSpent: payload ? Number(payload.hintsSpent) || 0 : 0,
    });
  },
  // payload 可能因 TTL 失效或读到旧结构，逐字段兜底而不是直接信任
  readReward(payload) {
    const r = payload && payload.reward;
    if (!r || typeof r !== 'object') return null;
    return {
      base: Number(r.base) || 0,
      noHintBonus: Number(r.noHintBonus) || 0,
      streakBonus: Number(r.streakBonus) || 0,
      streak: Number(r.streak) || 0,
      usedHint: !!r.usedHint,
      brokeStreak: !!r.brokeStreak,
    };
  },
  findNextLevelId(levelId) {
    const next = this.findNextLevel(levelId);
    if (!next) return '';
    return state.isLevelUnlocked(next.id, levels) ? next.id : '';
  },
  findNextLevelName(levelId) {
    const next = this.findNextLevel(levelId);
    return next ? next.name : '';
  },
  findNextLevel(levelId) {
    if (!levelId) return null;
    for (const ch of levels.chapters) {
      const idx = ch.levels.findIndex(l => l.id === levelId);
      if (idx < 0) continue;
      return ch.levels[idx + 1] || null;
    }
    return null;
  },
  onNextLevel() {
    const id = this.data.nextLevelId;
    if (!id) return;
    wx.redirectTo({ url: `/pages/level/level?id=${id}` });
  },
  onBackMap() {
    wx.switchTab({ url: '/pages/map/map' });
  },
  onRetry() {
    if (!this.data.levelValid) return;
    wx.redirectTo({ url: `/pages/level/level?id=${this.data.level}` });
  },
  onOpenReview() {
    const query = this.data.levelValid ? `?level=${this.data.level}` : '';
    wx.navigateTo({ url: `/pages/review/review${query}` });
  },
  onOpenShop() {
    wx.switchTab({ url: '/pages/shop/shop' });
  },
  onOpenManual() {
    wx.switchTab({ url: '/pages/manual/manual' });
  },
});
