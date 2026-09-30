// 音频引擎：背景音乐（BGM）与音效（SFX）
//
// 【架构约束】
// 本项目是「纯单机」小程序：无后端、无云函数、无网络请求。
// 因此音频资产必须打包在 miniprogram/ 内（不走 CDN、不走远程 URL），
// 否则会破坏 pure-offline 约束。主包体积上限 2 MB，当前占用见 tools/profile-performance.js。
//
// 【不变量】
// 1. 本文件在 require 阶段不得触碰任何 wx.* API —— tests/*.test.js 在 node 下跑，
//    top-level 访问 wx 会直接抛错。所有 wx 调用必须懒加载（放进函数体内）。
// 2. 所有播放在真实设备上都可能静默失败（自动播放限制 / 静音键 / 基础库差异），
//    因此每次播放都必须包 try/catch 并 isFail 兜底，**不得向上抛错、不得弹 toast**。
//    音频永远不能成为「把页面搞崩」的原因。
// 3. 用户偏好独立存储（storage key: kuajing_audio_pref_v1），
//    避免与 state.js 的存档结构耦合，也避免存档自愈逻辑误伤偏好设置。
//
// 【API 契约 —— 已冻结，pages/ 下的调用点依赖以下签名，不得擅自改名】
//   audio.init()              应用启动时调用一次：读偏好、创建实例（不播放）
//   audio.sfx(name)           播放音效，name ∈ SFX_NAMES
//   audio.startBgm()          开始循环播放背景音乐（须在用户首次交互之后调用）
//   audio.stopBgm()           停止背景音乐
//   audio.getPref()           返回 { bgm: boolean, sfx: boolean }
//   audio.setPref(partial)    局部更新偏好并持久化，返回更新后的偏好对象
//
// 【首次交互解锁（本项目音频唯一的硬约束）】
// 小程序禁止「无用户手势」的音频播放：在非点击回调里 play() 会静默失败（不报错、无 fail 回调）。
// 因此 BGM 不在 onLaunch / onShow 自动播放，而是由「用户手势调用栈内」的第一次播放请求启动：
//   - pages 里任何控件点击都会走 audio.sfx('tap')，sfx() 顺带启动 BGM（见 sfx 实现）；
//   - 「我的」页根节点有一次兜底点击（onPageTap → startBgm），保证至少有确定的手势入口；
//   - 用户显式打开「背景音乐」开关时（setPref）也立即启动。
// startBgm() 幂等：已在播放则直接返回，不会把音乐重置回开头。

// 允许的音效名。新增音效须同时在此登记，并在 audio/ 下放置同名资产。
const SFX_NAMES = ['tap', 'correct', 'wrong', 'settle', 'coin', 'unlock'];

// 资产路径：以「/」开头表示小程序根目录（代码包内文件），与 <image src> 同口径。
const BGM_SRC = '/audio/bgm.mp3';
const SFX_SRC = {
  tap: '/audio/tap.mp3',
  correct: '/audio/correct.mp3',
  wrong: '/audio/wrong.mp3',
  settle: '/audio/settle.mp3',
  coin: '/audio/coin.mp3',
  unlock: '/audio/unlock.mp3',
};

const PREF_KEY = 'kuajing_audio_pref_v1';
const SFX_POOL_SIZE = 3;      // 音效池：短音效可重叠，避免不同音效互相打断
const BGM_VOLUME = 0.55;      // 学习场景 BGM 压低，不抢注意力
const SFX_VOLUME = 0.9;

const DEFAULT_PREF = { bgm: true, sfx: true };

// ---- 内部状态（全部模块级，不暴露） ----
let pref = Object.assign({}, DEFAULT_PREF);
let prefLoaded = false;

let bgm = null;               // BGM 独立单例
let bgmPlaying = false;       // 由 onPlay/onPause/onStop/onEnded 回调维护
let bgmWanted = false;        // 用户意图：希望 BGM 播放（用于切回前台复播）
let sfxPool = [];             // 音效池实例
let sfxPoolSrc = [];          // 每个池槽当前已加载的 src（避免重复赋值触发重载）
let sfxCursor = 0;

let unavailable = false;      // 环境不支持音频（无 wx / 创建实例失败）→ 全面静默降级（isFail 兜底）
let inited = false;

// ============================================================
// 懒加载 wx：require 阶段绝不触碰
// ============================================================
function WX() {
  try {
    return typeof wx === 'undefined' ? null : wx;   // typeof 对未声明标识符安全
  } catch (e) {
    return null;
  }
}

function bind(ctx, ev, fn) {
  try {
    if (ctx && typeof ctx[ev] === 'function') ctx[ev](fn);
  } catch (e) { /* 静默 */ }
}

// ============================================================
// 偏好读写（独立 storage key）
// ============================================================
function readPref() {
  const w = WX();
  if (!w || typeof w.getStorageSync !== 'function') return Object.assign({}, DEFAULT_PREF);
  try {
    const raw = w.getStorageSync(PREF_KEY);
    if (!raw || typeof raw !== 'object') return Object.assign({}, DEFAULT_PREF);
    return { bgm: raw.bgm !== false, sfx: raw.sfx !== false };
  } catch (e) {
    return Object.assign({}, DEFAULT_PREF);
  }
}

function loadPref() {
  if (!prefLoaded) { pref = readPref(); prefLoaded = true; }
  return pref;
}

function savePref(p) {
  const w = WX();
  if (!w || typeof w.setStorageSync !== 'function') return;
  try {
    w.setStorageSync(PREF_KEY, { bgm: !!p.bgm, sfx: !!p.sfx });
  } catch (e) { /* 静默：偏好写不进去也不影响本次播放 */ }
}

// ============================================================
// 实例创建
// ============================================================
function ensureBgm() {
  if (bgm || unavailable) return bgm;
  const w = WX();
  if (!w || typeof w.createInnerAudioContext !== 'function') { unavailable = true; return null; }
  try {
    const ctx = w.createInnerAudioContext();
    ctx.src = BGM_SRC;
    ctx.loop = true;
    ctx.autoplay = false;
    try { ctx.volume = BGM_VOLUME; } catch (e) { /* 个别基础库无 volume */ }
    // 用回调跟踪真实播放状态：静默失败时 bgmPlaying 保持 false，下一次手势会重试
    bind(ctx, 'onPlay', () => { bgmPlaying = true; });
    bind(ctx, 'onPause', () => { bgmPlaying = false; });
    bind(ctx, 'onStop', () => { bgmPlaying = false; });
    bind(ctx, 'onEnded', () => { bgmPlaying = false; });
    bind(ctx, 'onError', () => { bgmPlaying = false; });
    bgm = ctx;
  } catch (e) {
    bgm = null;
    unavailable = true;
  }
  return bgm;
}

function ensurePool() {
  if (sfxPool.length || unavailable) return sfxPool;
  const w = WX();
  if (!w || typeof w.createInnerAudioContext !== 'function') { unavailable = true; return sfxPool; }
  for (let i = 0; i < SFX_POOL_SIZE; i++) {
    try {
      const ctx = w.createInnerAudioContext();
      ctx.autoplay = false;
      ctx.loop = false;
      try { ctx.volume = SFX_VOLUME; } catch (e) { /* 忽略 */ }
      bind(ctx, 'onError', () => {});
      sfxPool.push(ctx);
      sfxPoolSrc.push('');
    } catch (e) {
      // 单个实例失败不影响其余；全部失败则 pool 为空，playSfx 静默返回
    }
  }
  if (!sfxPool.length) unavailable = true;
  return sfxPool;
}

// ============================================================
// 播放
// ============================================================
function playBgm() {
  if (unavailable) return;
  const ctx = ensureBgm();
  if (!ctx) return;
  if (bgmPlaying) return;              // 已在播放：不重复 play()，避免被重置
  try {
    ctx.play();
  } catch (e) {
    bgmPlaying = false;
  }
}

function playSfx(name) {
  if (unavailable) return;
  const src = SFX_SRC[name];
  if (!src) return;
  const pool = ensurePool();
  if (!pool.length) return;
  const slot = sfxCursor % pool.length;
  sfxCursor = (sfxCursor + 1) % pool.length;
  const ctx = pool[slot];
  try {
    if (sfxPoolSrc[slot] !== src) {
      ctx.src = src;
      sfxPoolSrc[slot] = src;
    }
    ctx.stop();    // 回到起点，避免上一轮尾巴残留
    ctx.play();
  } catch (e) { /* 静默：音效永远不能把页面搞崩 */ }
}

// ============================================================
// 公开 API（冻结）
// ============================================================
module.exports = {
  SFX_NAMES,

  init() {
    if (inited) return;                // 幂等：App.onLaunch 可能被重复调用
    inited = true;
    loadPref();
    // 预创建实例（不播放）：本地文件下让首次播放更快
    if (pref.bgm) ensureBgm();
    ensurePool();

    const w = WX();
    if (!w) return;
    // 切后台暂停 BGM；回到前台时若用户仍期望播放则复播。
    // 复播发生在 App 生命周期回调里、不是手势调用栈内 —— iOS 可能拦截，
    // 故用 try/catch 兜底；若被拦，下一次手势（sfx/开关）会再次尝试。
    try {
      if (typeof w.onAppHide === 'function') w.onAppHide(() => { try { if (bgm) bgm.pause(); } catch (e) { bgmPlaying = false; } });
    } catch (e) { /* 静默 */ }
    try {
      if (typeof w.onAppShow === 'function') w.onAppShow(() => { if (bgmWanted && loadPref().bgm) playBgm(); });
    } catch (e) { /* 静默 */ }
  },

  sfx(name) {
    if (SFX_NAMES.indexOf(name) < 0) return;   // 未登记的名字静默忽略（不抛错）
    // 首次交互解锁：sfx() 的调用点都在 tap 回调内，这里顺带启动 BGM。
    // 放在手势栈内是刻意的 —— 否则自动播放会被静默拦截。
    if (loadPref().bgm) { bgmWanted = true; playBgm(); }
    if (!loadPref().sfx) return;
    playSfx(name);
  },

  startBgm() {
    if (!loadPref().bgm) { bgmWanted = false; return; }
    bgmWanted = true;
    playBgm();
  },

  stopBgm() {
    bgmWanted = false;
    bgmPlaying = false;
    if (!bgm) return;
    try { bgm.stop(); } catch (e) { /* 静默 */ }
  },

  getPref() {
    const p = loadPref();
    return { bgm: !!p.bgm, sfx: !!p.sfx };
  },

  setPref(partial) {
    const cur = loadPref();
    const next = {
      bgm: partial && typeof partial.bgm === 'boolean' ? partial.bgm : cur.bgm,
      sfx: partial && typeof partial.sfx === 'boolean' ? partial.sfx : cur.sfx,
    };
    pref = next;
    prefLoaded = true;
    savePref(next);
    // 打开开关的点按本身就是手势：立即启动，用户能立刻听到反馈
    if (next.bgm) { bgmWanted = true; playBgm(); } else { this.stopBgm(); }
    return { bgm: next.bgm, sfx: next.sfx };
  },
};
