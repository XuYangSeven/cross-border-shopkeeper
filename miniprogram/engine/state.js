// 存档状态管理（本地持久化，对应主策划案第 8 章"V1 单机化，数据本地存"）
const KEY = 'kuajing_save_v1';
// 启动时留下的完好快照：主键日后被写坏 / 读取异常时据此恢复，避免用户进度全失
const BACKUP_KEY = 'kuajing_save_v1.bak';
// 存档结构版本：新增顶层字段时必须递增，并在 migrate 中补齐兜底
const SAVE_VERSION = 3;

const DEFAULT = {
  version: SAVE_VERSION,
  // 云端迁移预留：本地优先，联网后由 syncCursor/outbox 增量同步
  meta: {
    schemaVersion: SAVE_VERSION,
    contentVersion: require('../config/constants').APP_VERSION,
    engineVersion: 'learning-v1',
    deviceId: null,
    userId: null,
    updatedAt: null,
    lastSyncAt: null,
    syncCursor: null,
  },
  createdAt: null,
  // 通关进度 { levelId: { stars, bestScore, clearedAt } }
  progress: {},
  // 已收集知识卡片 [cardId]
  cards: [],
  // 金币
  coins: 0,
  // 金币收支流水（上限 COIN_LEDGER_LIMIT 条，只留最近记录，不写完整快照）
  coinLedger: [],
  // 零提示连胜：连续多少关没用任何提示就通关。用一次提示或失败即清零
  studyStreak: 0,
  // 等级经验（星数累计）
  exp: 0,
  // 已读剧情（跳过重复对话）
  seenDialogs: [],
  // 学习进度（退出续学）：包含关卡上下文统计，避免中断后结算失真
  learning: null,
  // 云就绪：按关卡保存续学游标，learning 作为旧版本兼容字段
  learningCursors: {},
  // 能力证据 { dims: { dimKey: {...} }, records: [] }，由 engine/learning 聚合
  ability: null,
  evidenceRecords: [],
  // 错题与复盘记录（上限 100 条）
  mistakes: [],
  // 统一学习事件与离线待同步操作队列
  learningEvents: [],
  outbox: [],
  reportSnapshots: [],
  attempts: [],
  shopState: null,
  shopActionLog: [],
  shopWeekStartedAt: null,
};

const MISTAKE_LIMIT = 100;

// 店铺初始状态：一整套「起点不算好、但每项都有救」的经营决策
// 校准不变量：metrics 必须等于 engine/shop.deriveKpis(SHOP_DEFAULT)，由 shop-decisions.test.js 锁定。
// 初始处境：ACOS 偏高、按当前需求会断货 2 天、客服评分未达标 —— 6 项任务里恰好有 3 项未达成。
const SHOP_DEFAULT = {
  mode: 'save',
  product: { name: 'PawPal 宠物梳', price: 16.99, unitCost: 2.21 },
  listing: { titleScore: 58, imageScore: 55, bulletScore: 52 },
  ads: { dailyBudget: 110, bid: 0.65, enabled: true, structureScore: 50 },
  inventory: { available: 70, inTransit: 0, dailySales: 15, reorderPoint: 120, shipments: [] },
  orders: { pending: 12, shipped: 86, delivered: 120, refundRate: 5 },
  service: { responseRate: 82, resolutionRate: 78, rating: 4.1 },
  finance: { cash: 20000, weeklySpend: 0 },
  // 本周经营推演快照（初始 = 默认决策的推演结果，结算后被真实结果覆盖）
  metrics: { visitors: 2604, conversion: 3.5, sales: 1546.09, acos: 49.7, stockDays: 4.7, rating: 4.1 },
  // 每周行动点：所有决策共享同一预算，逼出取舍
  actionPoints: { total: 12, used: 0 },
  // 各操作本周已用次数
  decisions: {},
  // 已经营周数（用于能力证据编号）
  weeks: 0,
  week: { day: 0, active: false },
  snapshots: [],
  lastSettlement: null,
  weeklyTasks: [],
  taskSettlement: null,
  settlementHistory: [],
  rewardClaimed: false,
  practiceState: null,
  practiceTasks: null,
  settlementPreview: null,
};

let cache = null;

// 存档健康状态：写入失败必须能被上层读到并提示用户，
// 不允许像以前那样静默 return false，让用户在丢失进度之后才发现。
let saveStatus = {
  ok: true,                  // 最近一次写入是否成功
  loadFailed: false,         // 本次启动读取主键是否抛异常（原数据可能仍在，禁止自动覆盖）
  recoveredFromBackup: false,// 本次是否从快照恢复
  failCount: 0,              // 连续写入失败次数
  lastError: '',
  lastSavedAt: null,
};

function writeKey(key, value) {
  try {
    wx.setStorageSync(key, value);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function readKey(key) {
  try {
    const value = wx.getStorageSync(key);
    return { ok: true, value: value || null, error: null };
  } catch (e) {
    return { ok: false, value: null, error: e };
  }
}

// 只有「非空且是普通对象」才敢当成存档用；字符串/数组/数字一律视为损坏
function usableSave(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function init() {
  load();
  // 读取异常时禁止自动落盘：此刻写下去会用空白存档覆盖可能仍可恢复的进度
  ensureShopState({ persist: !saveStatus.loadFailed });
  if (!cache.createdAt) {
    cache.createdAt = Date.now();
    if (!saveStatus.loadFailed) save();
  }
  if (!saveStatus.loadFailed) snapshotBackup();
}

function load() {
  if (cache) return cache;

  const primary = readKey(KEY);
  if (usableSave(primary.value)) {
    cache = migrate(primary.value);
    saveStatus.loadFailed = false;
    return cache;
  }

  // 主键不可用（读取异常 / 值被写坏 / 首次进入）：先尝试上次启动留下的快照
  const backup = readKey(BACKUP_KEY);
  if (usableSave(backup.value)) {
    cache = migrate(backup.value);
    saveStatus.recoveredFromBackup = true;
    saveStatus.loadFailed = false;
    writeKey(KEY, cache); // 立刻回写主键，完成自愈
    return cache;
  }

  // 主键与快照都拿不到。关键区分：若主键是「读取抛异常」而非「真的没有」，
  // 原数据可能仍躺在存储里只是这次没读到 —— 此时置 loadFailed 以堵住自动覆盖。
  saveStatus.loadFailed = !primary.ok;
  // 用 mergeDefaults 做深拷贝落空档；旧写法 { ...DEFAULT } 是浅拷贝，
  // 会把 DEFAULT 的嵌套对象直接共享出去，一旦改动就会污染进程内的默认模板。
  cache = mergeDefaults({}, DEFAULT);
  return cache;
}

// 存档迁移：只补齐结构与类型，不删除用户既有进度
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDefaults(value, defaults) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return clone(defaults);
  const result = { ...clone(defaults), ...value };
  Object.keys(defaults).forEach(key => {
    if (defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
      result[key] = mergeDefaults(value[key], defaults[key]);
    }
  });
  return result;
}

function migrate(raw) {
  // 深拷贝默认值，避免旧存档缺字段时与 DEFAULT 共享嵌套引用
  const next = mergeDefaults(raw || {}, DEFAULT);
  next.version = SAVE_VERSION;
  next.meta = mergeDefaults(next.meta, DEFAULT.meta);
  next.meta.schemaVersion = SAVE_VERSION;
  if (!next.progress || typeof next.progress !== 'object' || Array.isArray(next.progress)) next.progress = {};
  if (!Array.isArray(next.cards)) next.cards = [];
  if (!Array.isArray(next.seenDialogs)) next.seenDialogs = [];
  if (!Array.isArray(next.mistakes)) next.mistakes = [];
  if (!Array.isArray(next.evidenceRecords)) next.evidenceRecords = next.ability && Array.isArray(next.ability.records) ? clone(next.ability.records) : [];
  if (!Array.isArray(next.learningEvents)) next.learningEvents = [];
  if (!Array.isArray(next.outbox)) next.outbox = [];
  if (!Array.isArray(next.reportSnapshots)) next.reportSnapshots = [];
  if (!Array.isArray(next.attempts)) next.attempts = [];
  if (!next.learningCursors || typeof next.learningCursors !== 'object' || Array.isArray(next.learningCursors)) next.learningCursors = {};
  if (typeof next.coins !== 'number' || Number.isNaN(next.coins)) next.coins = 0;
  if (!Array.isArray(next.coinLedger)) next.coinLedger = [];
  if (typeof next.studyStreak !== 'number' || Number.isNaN(next.studyStreak) || next.studyStreak < 0) next.studyStreak = 0;
  if (typeof next.exp !== 'number' || Number.isNaN(next.exp)) next.exp = 0;
  if (next.shopState) next.shopState = mergeDefaults(next.shopState, SHOP_DEFAULT);
  if (next.learning) {
    const l = next.learning;
    if (!l.levelId || typeof l.stepIndex !== 'number' || l.stepIndex < 0) next.learning = null;
    else next.learning = { ...l, stepIndex: Math.floor(l.stepIndex), stepTotal: Math.max(0, Math.floor(Number(l.stepTotal) || 0)) };
  }
  if (next.ability && (!next.ability.dims || typeof next.ability.dims !== 'object')) next.ability = null;
  if (next.ability && !Array.isArray(next.ability.records)) next.ability.records = [];
  next.version = SAVE_VERSION;
  return next;
}

function save() {
  if (!cache) return false;
  cache.meta = mergeDefaults(cache.meta, DEFAULT.meta);
  cache.meta.updatedAt = Date.now();
  const result = writeKey(KEY, cache);
  if (result.ok) {
    saveStatus.ok = true;
    saveStatus.failCount = 0;
    saveStatus.lastError = '';
    saveStatus.lastSavedAt = cache.meta.updatedAt;
    return true;
  }
  saveStatus.ok = false;
  saveStatus.failCount += 1;
  saveStatus.lastError = (result.error && result.error.message) ? result.error.message : String(result.error || '未知写入错误');
  return false;
}

// 留一份完好快照，供主键损坏时回退。
// 时机：启动时 + 每次切到后台（app.onHide）各拍一次，于是快照 ≈「上次离开时的进度」。
// 比每写一次就镜像一份便宜得多（每次操作只写 1 次而非 2 次），
// 又比只拍启动快照保护力强得多。重置存档后必须重新拍，
// 否则之后若主键损坏，会从快照里把重置前的旧进度「复活」。
function snapshotBackup() {
  if (!cache) return false;
  return writeKey(BACKUP_KEY, cache).ok;
}

// 供页面读取的存档健康状态（纯读，不产生副作用）
function getSaveStatus() {
  return {
    ok: saveStatus.ok,
    loadFailed: saveStatus.loadFailed,
    recoveredFromBackup: saveStatus.recoveredFromBackup,
    failCount: saveStatus.failCount,
    lastError: saveStatus.lastError,
    lastSavedAt: saveStatus.lastSavedAt,
  };
}

function ensureShopState(options) {
  const persist = !options || options.persist !== false;
  load();
  if (!cache.shopState) cache.shopState = JSON.parse(JSON.stringify(SHOP_DEFAULT));
  // 旧存档补齐：行动点 / 操作计数 / 补货单 / 周数，避免页面读到 undefined
  if (!cache.shopState.actionPoints || typeof cache.shopState.actionPoints !== 'object') {
    cache.shopState.actionPoints = { total: SHOP_DEFAULT.actionPoints.total, used: 0 };
  }
  if (typeof cache.shopState.actionPoints.total !== 'number') cache.shopState.actionPoints.total = SHOP_DEFAULT.actionPoints.total;
  if (typeof cache.shopState.actionPoints.used !== 'number') cache.shopState.actionPoints.used = 0;
  if (!cache.shopState.decisions || typeof cache.shopState.decisions !== 'object' || Array.isArray(cache.shopState.decisions)) cache.shopState.decisions = {};
  if (!cache.shopState.inventory || typeof cache.shopState.inventory !== 'object') cache.shopState.inventory = JSON.parse(JSON.stringify(SHOP_DEFAULT.inventory));
  if (!Array.isArray(cache.shopState.inventory.shipments)) cache.shopState.inventory.shipments = [];
  if (typeof cache.shopState.weeks !== 'number' || Number.isNaN(cache.shopState.weeks)) cache.shopState.weeks = 0;
  if (!cache.shopState.weeklyTasks || !cache.shopState.weeklyTasks.length) cache.shopState.weeklyTasks = require('./tasks').createTasks();
  if (!cache.shopWeekStartedAt) cache.shopWeekStartedAt = Date.now();
  if (!Array.isArray(cache.shopActionLog)) cache.shopActionLog = [];
  if (persist) save();
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

// ===== 店铺经营决策（带约束的操作入口）=====
// 所有子模块的「操作」都走这里：由 engine/shop 校验行动点/现金/次数/前置条件，
// 通过后整体写回店铺状态，并记一条可回溯的操作日志。
function applyShopAction(actionId) {
  ensureShopState();
  const shopEngine = require('./shop');
  const current = activeShopState();
  const result = shopEngine.applyAction(current, actionId);
  if (!result.ok) return { ok: false, reason: result.reason, action: result.action, kpis: shopEngine.deriveKpis(current) };

  if (cache.shopState.mode === 'practice') cache.shopState.practiceState = result.next;
  else cache.shopState = result.next;

  cache.shopActionLog.push({
    type: result.action.id,
    at: Date.now(),
    mode: cache.shopState.mode,
    costCNY: result.costCNY || 0,
    points: result.action.points,
  });
  if (cache.shopActionLog.length > 200) cache.shopActionLog = cache.shopActionLog.slice(-200);
  if (cache.shopState.mode === 'save') save();
  return {
    ok: true,
    reason: '',
    action: result.action,
    costCNY: result.costCNY || 0,
    shipmentNote: result.shipmentNote || '',
    shop: result.next,
    kpis: result.kpis,
  };
}

// 只读：某项操作当前能否执行（供页面渲染按钮态，不产生副作用）
function planShopAction(actionId) {
  ensureShopState();
  const shopEngine = require('./shop');
  return shopEngine.planAction(activeShopState(), actionId);
}

// 本周剩余行动点
function getShopActionPoints() {
  ensureShopState();
  const state = activeShopState();
  const total = Number(state.actionPoints && state.actionPoints.total) || 0;
  const used = Number(state.actionPoints && state.actionPoints.used) || 0;
  return { total, used, remaining: Math.max(0, total - used) };
}


function startShopWeek(patch) {
  ensureShopState();
  const current = activeShopState();
  const updated = Object.assign({}, current, patch, { week: { day: 0, active: true }, snapshots: [], lastSettlement: null, weekSimulation: null });
  if (cache.shopState.mode === 'practice') cache.shopState.practiceState = updated;
  else cache.shopState = updated;
  cache.shopActionLog.push({ type: 'start_simulation', at: Date.now(), mode: cache.shopState.mode });
  if (cache.shopState.mode === 'save') save();
  return updated;
}

function saveShopSettlement(settlement) {
  ensureShopState();
  const shopEngine = require('./shop');
  const tasksEngine = require('./tasks');
  const current = activeShopState();
  const results = tasksEngine.evaluateTasks(current.weeklyTasks, settlement, current);
  const summary = tasksEngine.summarize(results, settlement);

  // 经营快照：金额类以真实结算为准，访客与评分沿用决策推演口径，避免两套数字打架
  const kpis = shopEngine.deriveKpis(current);
  const visitors = Number(kpis.visitors) || 0;
  const orders = Number(settlement.orders) || 0;
  const dailySales = Number((current.inventory || {}).dailySales) || 0;
  const metrics = {
    visitors,
    conversion: visitors ? Math.round(orders / visitors * 1000) / 10 : 0,
    sales: settlement.sales,
    acos: settlement.acos,
    stockDays: dailySales ? Math.round(settlement.endingInventory / dailySales * 10) / 10 : 0,
    rating: Number((current.service || {}).rating) || 0,
  };

  // 周复盘历史：只留结论行，不带 7 天快照，避免存档膨胀
  const historyRow = {
    at: Date.now(),
    week: (Number(current.weeks) || 0) + 1,
    rating: settlement.rating,
    orders: settlement.orders,
    sales: settlement.sales,
    acos: settlement.acos,
    stockoutDays: settlement.stockoutDays,
    profit: settlement.profit,
    decisionScore: settlement.decision ? settlement.decision.score : null,
    decisionLevel: settlement.decision ? settlement.decision.level : '',
    completed: summary.completed,
  };

  const base = Object.assign({}, current, {
    weeks: (Number(current.weeks) || 0) + 1,
    week: { day: settlement.days, active: false },
    snapshots: settlement.snapshots,
    lastSettlement: settlement,
    taskSettlement: { results, summary, lockedAt: Date.now() },
    metrics,
    inventory: Object.assign({}, current.inventory, { available: settlement.endingInventory, inTransit: 0, shipments: [] }),
  });

  if (cache.shopState.mode === 'practice') {
    base.settlementPreview = { results, summary, reward: summary.reward, practiceOnly: true, decision: settlement.decision || null };
    cache.shopState.practiceState = base;
  } else {
    const alreadyClaimed = cache.shopState.rewardClaimed;
    cache.shopState = base;
    if (!alreadyClaimed) {
      cache.coins += summary.reward.coins;
      cache.exp += summary.reward.exp;
      cache.shopState.rewardClaimed = true;
      if (summary.reward.coins > 0) {
        pushCoinEntry({ type: 'shop', amount: summary.reward.coins, label: '经营周任务奖励' });
      }
    }
    cache.shopState.settlementHistory = (cache.shopState.settlementHistory || []).concat([historyRow]).slice(-12);
  }
  cache.shopActionLog.push({ type: 'settle_week', at: Date.now(), patch: { orders: settlement.orders, sales: settlement.sales }, mode: cache.shopState.mode });
  if (cache.shopState.mode === 'save') save();

  // 结算 → 能力证据 + 学习事件（只在正式存档写入，练习模式只给预览）
  const evidence = shopEngine.buildSettlementEvidence(current, settlement);
  if (cache.shopState.mode === 'save') {
    recordAbility(evidence);
    cache.learningEvents.push({
      type: 'shop_week_settled',
      at: Date.now(),
      payload: {
        week: evidence.levelId,
        decisionScore: evidence.decisionScore,
        decisionLevel: evidence.decisionLevel,
        weak: evidence.weak,
        redlines: evidence.redlines,
        tasksCompleted: summary.completed,
        rating: settlement.rating,
      },
    });
    if (cache.learningEvents.length > 300) cache.learningEvents = cache.learningEvents.slice(-300);
    save();
  }
  return cache.shopState;
}

function resetShopWeek() {
  ensureShopState();
  const mode = cache.shopState.mode;
  const weeks = Number(cache.shopState.weeks) || 0;
  const history = (cache.shopState.settlementHistory || []).slice(-12);
  cache.shopState = JSON.parse(JSON.stringify(SHOP_DEFAULT));
  cache.shopState.mode = mode;
  cache.shopState.weeks = weeks;
  cache.shopState.settlementHistory = history;
  cache.shopState.weeklyTasks = require('./tasks').createTasks();
  cache.shopState.taskSettlement = null;
  cache.shopState.rewardClaimed = false;
  cache.shopState.settlementPreview = null;
  cache.shopState.practiceState = mode === 'practice' ? JSON.parse(JSON.stringify({ ...cache.shopState, practiceState: null, practiceTasks: null })) : null;
  cache.shopState.practiceTasks = mode === 'practice' ? JSON.parse(JSON.stringify(cache.shopState.weeklyTasks)) : null;
  cache.shopActionLog = [];
  cache.shopWeekStartedAt = Date.now();
  save();
  return getShopState();
}

function get() { return load(); }

// 关卡通关记录
// 奖励规则：首次通关发全额金币；重复通关仅在星数提升时补发差额（避免刷金币）
function clearLevel(levelId, stars, totalScore) {
  const prev = cache.progress[levelId];
  const prevStars = prev ? prev.stars : 0;
  cache.progress[levelId] = {
    stars: Math.max(prevStars, stars),
    bestScore: Math.max(prev ? prev.bestScore : 0, totalScore),
    clearedAt: Date.now(),
  };
  let coin = 0;
  if (!prev) {
    cache.exp += stars * 10;
    coin = require('../config/constants').COIN_REWARD[stars] || 0;
  } else if (stars > prevStars) {
    cache.exp += (stars - prevStars) * 10;
    coin = (require('../config/constants').COIN_REWARD[stars] || 0) - (require('../config/constants').COIN_REWARD[prevStars] || 0);
  }
  cache.coins += coin;
  if (coin > 0) pushCoinEntry({ type: 'level', amount: coin, label: `${levelId} 通关奖励` });
  save();
  return coin;
}

// ===== 金币账本 =====
// 只保留最近若干条，用于「我的」页解释金币从哪来、花到哪去。
// 存的是结论行（时间/类型/金额/来源），不存整份快照，避免存档随使用时长膨胀。
const COIN_LEDGER_LIMIT = 20;

function pushCoinEntry(entry) {
  if (!cache) return;
  if (!Array.isArray(cache.coinLedger)) cache.coinLedger = [];
  cache.coinLedger.push({
    at: entry.at || Date.now(),
    type: entry.type || 'other',
    amount: Number(entry.amount) || 0,
    label: String(entry.label || '').slice(0, 40),
  });
  if (cache.coinLedger.length > COIN_LEDGER_LIMIT) {
    cache.coinLedger = cache.coinLedger.slice(-COIN_LEDGER_LIMIT);
  }
}

// 最近的金币收支（新的在前）
function getCoinLedger(limit) {
  load();
  const list = Array.isArray(cache.coinLedger) ? cache.coinLedger.slice() : [];
  const n = Math.max(1, Math.floor(Number(limit) || COIN_LEDGER_LIMIT));
  return list.slice(-n).reverse();
}

function getStudyStreak() {
  load();
  return Math.max(0, Number(cache.studyStreak) || 0);
}

// 关卡结算：通关金币 + 零提示加成 + 连胜加成。
//
// 为什么不直接改 clearLevel：它的「首次通关发全奖 / 升星只补差额」契约已被
// 既有测试锁定，动语义会连带影响其他调用方。这里在其之上叠加加成。
//
// 为什么重刷不给加成：加成只在该关真的产生 base>0（首次通关或升星）时才发，
// 否则可以靠反复重刷简单关卡无限刷金币。
function settleLevelReward(levelId, stars, totalScore, options) {
  load();
  const C = require('../config/constants');
  const opts = options || {};
  const base = clearLevel(levelId, stars, totalScore);
  const result = {
    base, noHintBonus: 0, streakBonus: 0, total: base,
    streak: getStudyStreak(), usedHint: !!opts.usedHint, brokeStreak: false,
  };

  if (base <= 0) return result; // 未通关 / 重刷未升星：不动连胜，也不发加成

  if (opts.usedHint) {
    // 用了任何一级提示（含免费的 L1）：本关失去零提示奖励，并中断连胜
    result.brokeStreak = getStudyStreak() > 0;
    cache.studyStreak = 0;
    result.streak = 0;
    save();
    return result;
  }

  const streak = getStudyStreak() + 1;
  cache.studyStreak = streak;
  const noHintBonus = Math.round(base * (C.NO_HINT_MULTIPLIER - 1));
  const streakBonus = C.STREAK_BONUS_STEP * Math.min(streak, C.STREAK_BONUS_CAP);
  const extra = noHintBonus + streakBonus;
  if (extra > 0) {
    cache.coins += extra;
    pushCoinEntry({ type: 'bonus', amount: extra, label: `零提示通关（连胜 ${streak}）` });
  }
  save();
  result.noHintBonus = noHintBonus;
  result.streakBonus = streakBonus;
  result.total = base + extra;
  result.streak = streak;
  return result;
}

// 判断是否已通关（用于关卡结算守卫）
function isLevelCleared(levelId) {
  return !!cache.progress[levelId];
}

// ===== 学习进度（退出续学）=====
function saveLearningProgress(payload) {
  load();
  if (!payload || !payload.levelId) return null;
  cache.learning = {
    levelId: payload.levelId,
    levelName: payload.levelName || '',
    stepIndex: Math.max(0, Math.floor(Number(payload.stepIndex) || 0)),
    stepTotal: Math.max(0, Math.floor(Number(payload.stepTotal) || 0)),
    quizTotal: Math.max(0, Number(payload.quizTotal) || 0),
    quizCorrect: Math.max(0, Number(payload.quizCorrect) || 0),
    objTotal: Math.max(0, Number(payload.objTotal) || 0),
    objDone: Math.max(0, Number(payload.objDone) || 0),
    retries: Math.max(0, Number(payload.retries) || 0),
    // 求助记录随续学一起保存：否则退出重进就能洗掉「用过提示」，白拿零提示奖励
    hintsUsed: Math.max(0, Number(payload.hintsUsed) || 0),
    hintsSpent: Math.max(0, Number(payload.hintsSpent) || 0),
    collectedCards: Array.isArray(payload.collectedCards) ? payload.collectedCards.slice() : [],
    transferRate: payload.transferRate === undefined ? null : payload.transferRate,
    reflectionRate: payload.reflectionRate === undefined ? null : payload.reflectionRate,
    updatedAt: Date.now(),
  };
  cache.learningCursors[payload.levelId] = {
    attemptId: payload.attemptId || null,
    levelId: payload.levelId,
    stepIndex: cache.learning.stepIndex,
    stepTotal: cache.learning.stepTotal,
    stage: payload.stage || null,
    updatedAt: cache.learning.updatedAt,
  };
  save();
  return cache.learning;
}

function getLearningProgress() {
  load();
  return cache.learning;
}

function clearLearningProgress(levelId) {
  load();
  if (!cache.learning) return;
  if (!levelId || cache.learning.levelId === levelId) {
    cache.learning = null;
    save();
  }
}

// ===== 能力证据 =====
function recordAbility(payload) {
  load();
  const learning = require('./learning');
  const next = learning.recordEvidence(cache.ability, payload);
  cache.ability = next;
  save();
  return next;
}

function getAbility() {
  load();
  return cache.ability;
}

// ===== 错题与复盘 =====
function addMistakes(rows) {
  load();
  if (!Array.isArray(rows) || !rows.length) return cache.mistakes;
  const existing = new Set(cache.mistakes.map(item => [item.levelId, item.stepIndex, item.stepType, item.question, item.userAnswer].join('|')));
  const fresh = rows.filter(item => {
    const key = [item.levelId, item.stepIndex, item.stepType, item.question, item.userAnswer].join('|');
    if (existing.has(key)) return false;
    existing.add(key);
    return true;
  });
  cache.mistakes = cache.mistakes.concat(fresh).slice(-MISTAKE_LIMIT);
  save();
  return cache.mistakes;
}

function getMistakes(levelId) {
  load();
  if (!levelId) return cache.mistakes.slice();
  return cache.mistakes.filter(item => item.levelId === levelId);
}

function clearMistakes(levelId) {
  load();
  cache.mistakes = levelId ? cache.mistakes.filter(item => item.levelId !== levelId) : [];
  save();
  return cache.mistakes;
}

// 收集知识卡片
function collectCard(cardId) {
  load();
  if (!cache.cards.includes(cardId)) {
    cache.cards.push(cardId);
    save();
    return true; // 新收集
  }
  return false;
}

// 花金币。返回 boolean 以保持既有契约。
// meta 可选：{ type, label }，用于金币账本里说明这笔花在哪。
// 修复：原实现没有先 load()，若在 init 之前调用会因 cache 为 null 抛异常，
// 与同文件其他函数的写法不一致（collectCard / saveLearningProgress 都有）。
function spendCoins(n, meta) {
  load();
  const amount = Math.max(0, Math.floor(Number(n) || 0));
  if (amount === 0) return true; // 免费档不扣费，但仍由调用方计为「用过提示」
  if (cache.coins < amount) return false;
  cache.coins -= amount;
  pushCoinEntry({
    type: (meta && meta.type) || 'spend',
    amount: -amount,
    label: (meta && meta.label) || '消费',
  });
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
  cache = clone(DEFAULT);
  cache.createdAt = Date.now();
  cache.meta.updatedAt = cache.createdAt;
  ensureShopState();
  save();
  // 快照必须跟着刷新：否则之后若主键损坏，会从快照里把重置前的旧进度「复活」
  snapshotBackup();
  saveStatus.loadFailed = false;
  saveStatus.recoveredFromBackup = false;
  return cache;
}

module.exports = { init, get, clearLevel, settleLevelReward, getCoinLedger, getStudyStreak, isLevelCleared, collectCard, spendCoins, isLevelUnlocked, reset, ensureShopState, getShopState, getShopMode, setShopMode, updateShopState, getShopActionLog, applyShopAction, planShopAction, getShopActionPoints, startShopWeek, saveShopSettlement, resetShopWeek, saveLearningProgress, getLearningProgress, clearLearningProgress, recordAbility, getAbility, addMistakes, getMistakes, clearMistakes, getSaveStatus, snapshotBackup, SAVE_VERSION, SHOP_DEFAULT };
