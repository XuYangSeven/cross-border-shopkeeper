// 存档状态管理（本地持久化，对应主策划案第 8 章"V1 单机化，数据本地存"）
const KEY = 'kuajing_save_v1';

const DEFAULT = {
  createdAt: null,
  // 通关进度 { levelId: { stars, bestScore, clearedAt } }
  progress: {},
  // 已收集知识卡片 [cardId]
  cards: [],
  // 金币
  coins: 0,
  // 等级经验（星数累计）
  exp: 0,
  // 已读剧情（跳过重复对话）
  seenDialogs: [],
  shopState: null,
  shopActionLog: [],
  shopWeekStartedAt: null,
};

const SHOP_DEFAULT = {
  mode: 'save',
  product: { name: 'PawPal 宠物梳', price: 16.99 },
  listing: { titleScore: 58, imageScore: 55, bulletScore: 52 },
  ads: { dailyBudget: 10, bid: 0.65, enabled: false },
  inventory: { available: 100, inTransit: 0, dailySales: 3, reorderPoint: 29 },
  orders: { pending: 12, shipped: 86, delivered: 120, refundRate: 5 },
  service: { responseRate: 82, resolutionRate: 78, rating: 4.1 },
  finance: { cash: 20000, weeklySpend: 0 },
  metrics: { visitors: 4600, conversion: 4.9, sales: 5635, acos: 41, stockDays: 12, rating: 4.42 },
  week: { day: 0, active: false },
  snapshots: [],
  lastSettlement: null,
  weeklyTasks: [],
  practiceState: null,
  practiceTasks: null,
};

let cache = null;

function init() {
  load();
  ensureShopState();
  if (!cache.createdAt) {
    cache.createdAt = Date.now();
    save();
  }
}

function load() {
  if (cache) return cache;
  try {
    cache = wx.getStorageSync(KEY) || { ...DEFAULT };
  } catch (e) {
    cache = { ...DEFAULT };
  }
  // 字段兜底（版本升级）
  cache = Object.assign({}, DEFAULT, cache);
  return cache;
}

function save() {
  try { wx.setStorageSync(KEY, cache); } catch (e) { /* 存储失败静默 */ }
}

function ensureShopState() {
  load();
  if (!cache.shopState) cache.shopState = JSON.parse(JSON.stringify(SHOP_DEFAULT));
  if (!cache.shopState.weeklyTasks || !cache.shopState.weeklyTasks.length) cache.shopState.weeklyTasks = require('./tasks').createTasks();
  if (!cache.shopWeekStartedAt) cache.shopWeekStartedAt = Date.now();
  if (!Array.isArray(cache.shopActionLog)) cache.shopActionLog = [];
  save();
  return cache.shopState;
}

function getShopState() {
  ensureShopState();
  if (cache.shopState.mode === 'practice') {
    if (!cache.shopState.practiceState) cache.shopState.practiceState = JSON.parse(JSON.stringify({ ...cache.shopState, mode: 'practice', practiceState: null, practiceTasks: null }));
    return cache.shopState.practiceState;
  }
  return cache.shopState;
}

function getShopMode() {
  ensureShopState();
  return cache.shopState.mode;
}

function activeShopState() {
  ensureShopState();
  if (cache.shopState.mode === 'practice') {
    if (!cache.shopState.practiceState) cache.shopState.practiceState = JSON.parse(JSON.stringify({ ...cache.shopState, mode: 'practice', practiceState: null, practiceTasks: null }));
    return cache.shopState.practiceState;
  }
  return cache.shopState;
}

function setShopMode(mode) {
  if (mode !== 'save' && mode !== 'practice') return false;
  ensureShopState();
  if (mode === 'practice') {
    cache.shopState.practiceState = JSON.parse(JSON.stringify({ ...cache.shopState, mode: 'practice', practiceState: null, practiceTasks: null }));
    cache.shopState.practiceTasks = JSON.parse(JSON.stringify(cache.shopState.weeklyTasks));
  } else {
    cache.shopState.practiceState = null;
    cache.shopState.practiceTasks = null;
  }
  cache.shopState.mode = mode;
  save();
  return true;
}

function updateShopState(patch, action) {
  const current = activeShopState();
  const updated = Object.assign({}, current, patch);
  if (cache.shopState.mode === 'practice') cache.shopState.practiceState = updated;
  else cache.shopState = updated;
  cache.shopActionLog.push({ type: action || 'shop_action', at: Date.now(), patch, mode: cache.shopState.mode });
  if (cache.shopState.mode === 'save') save();
  return updated;
}

function getShopActionLog() {
  ensureShopState();
  return cache.shopActionLog.slice();
}

function startShopWeek(patch) {
  ensureShopState();
  const current = activeShopState();
  const updated = Object.assign({}, current, patch, { week: { day: 0, active: true }, snapshots: [], lastSettlement: null });
  if (cache.shopState.mode === 'practice') cache.shopState.practiceState = updated;
  else cache.shopState = updated;
  cache.shopActionLog.push({ type: 'start_simulation', at: Date.now(), mode: cache.shopState.mode });
  if (cache.shopState.mode === 'save') save();
  return updated;
}

function saveShopSettlement(settlement) {
  ensureShopState();
  const current = activeShopState();
  const updated = Object.assign({}, current, { week: { day: settlement.days, active: false }, snapshots: settlement.snapshots, lastSettlement: settlement, metrics: { ...current.metrics, sales: settlement.sales, acos: settlement.acos, stockDays: settlement.endingInventory, rating: settlement.rating === '优秀' ? 4.6 : settlement.rating === '合格' ? 4.3 : 4.0 } });
  if (cache.shopState.mode === 'practice') cache.shopState.practiceState = updated;
  else cache.shopState = updated;
  cache.shopActionLog.push({ type: 'settle_week', at: Date.now(), patch: { settlement }, mode: cache.shopState.mode });
  if (cache.shopState.mode === 'save') save();
  return updated;
}

function resetShopWeek() {
  ensureShopState();
  const mode = cache.shopState.mode;
  cache.shopState = JSON.parse(JSON.stringify(SHOP_DEFAULT));
  cache.shopState.mode = mode;
  cache.shopState.weeklyTasks = require('./tasks').createTasks();
  cache.shopState.practiceState = mode === 'practice' ? JSON.parse(JSON.stringify({ ...cache.shopState, practiceState: null, practiceTasks: null })) : null;
  cache.shopState.practiceTasks = mode === 'practice' ? JSON.parse(JSON.stringify(cache.shopState.weeklyTasks)) : null;
  cache.shopActionLog = [];
  cache.shopWeekStartedAt = Date.now();
  save();
  return getShopState();
}

function get() { return load(); }

// 关卡通关记录
function clearLevel(levelId, stars, totalScore) {
  const prev = cache.progress[levelId];
  cache.progress[levelId] = {
    stars: Math.max(prev ? prev.stars : 0, stars),
    bestScore: Math.max(prev ? prev.bestScore : 0, totalScore),
    clearedAt: Date.now(),
  };
  if (!prev) cache.exp += stars * 10;
  const coin = require('../config/constants').COIN_REWARD[stars] || 0;
  cache.coins += coin;
  save();
  return coin;
}

// 收集知识卡片
function collectCard(cardId) {
  if (!cache.cards.includes(cardId)) {
    cache.cards.push(cardId);
    save();
    return true; // 新收集
  }
  return false;
}

// 花金币
function spendCoins(n) {
  if (cache.coins < n) return false;
  cache.coins -= n;
  save();
  return true;
}

// 关卡是否解锁（按章节顺序：前一章通关数>=3 或 本章前一关已通）
function isLevelUnlocked(levelId, registry) {
  const [ch, no] = levelId.split('-').map(Number);
  if (ch === 1 && no === 1) return true;
  // 找前一关
  const chapter = registry.chapters.find(c => c.id === ch);
  if (!chapter) return false;
  const idx = chapter.levels.findIndex(l => l.id === levelId);
  if (idx < 0) return false;
  if (idx > 0) return !!cache.progress[chapter.levels[idx - 1].id];
  // 本章第一关：需上一章全部通关
  const prevChapter = registry.chapters.find(c => c.id === ch - 1);
  if (!prevChapter) return true;
  return prevChapter.levels.every(l => cache.progress[l.id]);
}

// 重置存档（设置页）
function reset() {
  cache = { ...DEFAULT, createdAt: Date.now() };
  save();
}

module.exports = { init, get, clearLevel, collectCard, spendCoins, isLevelUnlocked, reset, ensureShopState, getShopState, getShopMode, setShopMode, updateShopState, getShopActionLog, startShopWeek, saveShopSettlement, resetShopWeek };
