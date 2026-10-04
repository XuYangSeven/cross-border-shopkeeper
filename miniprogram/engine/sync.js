// 云端同步引擎：微信登录 + 学习进度跨设备同步。
//
// 设计前提（很重要）：
//   本应用原本是「纯单机」——进度全在本机存储里。接入云服务不是把它改造成
//   必须联网才能用，而是**在上面加一层**：不登录照常单机学习，登录后进度会
//   同步到云端，换设备也能接着学。所以任何云端失败都只能降级为「这次没同步」，
//   绝不能让闯关主流程报错或丢进度。
//
// 分工：
//   state.js  只管本机存档（含同步书签：上次同步摘要 / 时间 / 归属账号）
//   sync.js   只管云端（登录、拉取、上传、冲突判定）
//   两者的接缝是「同步载荷」——一份去掉同步书签的存档深拷贝。
//
// 同步书签为什么不进载荷：它描述的是「本机与云端的关系」，不是学习进度本身，
// 而且每次同步都会变。若进载荷，摘要会自我引用，永远判定为「有变化」。
const state = require('./state');
const PUBLIC_CONFIG = require('../config/cloud');
const CONSTANTS = require('../config/constants');

// 云端表名。一行一个用户，owner_id 作主键，因此写入用 upsert 而非 insert。
const TABLE = 'kuajing_progress';

// 自动同步去抖：学生答一题就会触发一次 save()，若每次都上传会把云端打爆。
// 去抖到「停手 12 秒后才推」，一次连续学习通常只会产生个位数次上传。
const PUSH_DEBOUNCE_MS = 12000;

// 开源后没有 cloud.local.js 是**正常状态**，不是错误：应用应当照常纯单机运行。
// 用一个稳定的哨兵值穿过 describeError，避免把开发者向的文案泄给学生看。
const NOT_CONFIGURED_CODE = 'CLOUD_NOT_CONFIGURED';

let client = null;
let clientError = '';
let clientFactory = createRealClient;
let autoSyncBound = false;
let pushTimer = null;
let sessionCache = { userId: null, checkedAt: null };
let lastResult = { status: 'idle', message: '', at: null };

// ===== 纯函数区（不碰 wx / 网络，可单测）=====

// 递归按 key 排序。必要性：云端是 jsonb，**jsonb 不保留键序**（按长度+字节序规范化），
// 所以同一份进度经过一次存取后键序会和本机不同。若直接对 JSON.stringify 求摘要，
// 每个来回都会把「内容没变」误判成「有新进度」，同步会永远在冲突与上传之间打转。
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach((key) => { out[key] = canonicalize(value[key]); });
    return out;
  }
  return value;
}

function hex8(n) {
  const text = (n >>> 0).toString(16);
  return text.length >= 8 ? text : '00000000'.slice(text.length) + text;
}

// 内容摘要：长度 + 两条独立 FNV-1a（不同偏移/乘数）拼成 64 位量级的指纹。
// 双通道是为了压低碰撞概率——单条 32 位在 4 万字符的载荷上碰撞并非不可能，
// 而一次碰撞意味着「两边内容不同却被判定为一致」，会静默丢进度。
function digestOf(payload) {
  const text = JSON.stringify(canonicalize(payload));
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b);
  }
  return text.length + '-' + hex8(h1) + hex8(h2);
}

// 判定一份存档是否「什么都没做」。用于区分两种看起来一样的状态：
//   · 全新安装 → 登录后应当自动取云端那份，不该弹冲突
//   · 用户刚点过「重置存档」 → 本机的内容是用户主动清掉的，不能被云端悄悄填回来
// 两者都是「本机为空 + 没有同步书签」，差别在「这台设备以前同步过没有」。
function isPayloadEmpty(payload) {
  if (!payload || typeof payload !== 'object') return true;
  const progress = payload.progress || {};
  const cursors = payload.learningCursors || {};
  return Object.keys(progress).length === 0
    && (!Array.isArray(payload.cards) || payload.cards.length === 0)
    && !payload.coins
    && !payload.learning
    && Object.keys(cursors).length === 0
    && !payload.ability
    && (!Array.isArray(payload.mistakes) || payload.mistakes.length === 0)
    && (!payload.shopState || !payload.shopState.weeks);
}

// 决策表：本机摘要 / 上次同步摘要 / 云端摘要 → 该做什么。
// 纯函数，是整个同步逻辑里最需要被测试锁住的一段。
//   baseDigest 为 null 表示「没有共同的同步记录」。此时若两端都有内容就只能交给用户定夺，
//   不能猜：猜错等于平白删掉一边的进度。
function decideSync(input) {
  const localDigest = input.localDigest;
  const baseDigest = input.baseDigest;
  const remoteDigest = input.remoteDigest;

  if (!remoteDigest) return { action: 'upload', reason: '云端还没有这份进度' };
  if (remoteDigest === localDigest) return { action: 'none', reason: '本机与云端一致' };
  if (!baseDigest) {
    if (input.localEmpty && !input.everSynced) {
      return { action: 'download', reason: '本机还没有进度，已从云端取回' };
    }
    return { action: 'conflict', reason: '本机与云端的内容不一致，且没有共同的同步记录' };
  }

  const localChanged = localDigest !== baseDigest;
  const remoteChanged = remoteDigest !== baseDigest;
  if (localChanged && !remoteChanged) return { action: 'upload', reason: '本机有新的学习进度' };
  if (!localChanged && remoteChanged) return { action: 'download', reason: '云端有新的学习进度' };
  return { action: 'conflict', reason: '本机与云端都有新进度' };
}

// 把 SDK / 网关的错误翻译成学生看得懂的一句话。分支依据是稳定的 kind / code，不是文案。
function describeError(error) {
  if (!error) return '同步失败，请稍后再试';
  const kind = typeof error.kind === 'string' ? error.kind : '';
  const code = error.code ? String(error.code) : '';
  // 未配置云服务不是故障，是「这台设备就是单机用」——文案不该像出错
  if (code === NOT_CONFIGURED_CODE || error.message === NOT_CONFIGURED_CODE) {
    return '本机为纯单机模式，学习进度已保存在手机上';
  }
  if (kind === 'unauthenticated' || kind === 'invalid_grant' || code === 'PGRST301') return '登录状态已过期，请重新登录';
  if (kind === 'network' || kind === 'backend_unavailable' || kind === 'backend-unavailable') return '网络不可用，进度仍在手机上，稍后会自动重试';
  if (code === '42P01') return '云端进度表尚未就绪，请稍后再试';
  if (code === '42501') return '没有权限访问这份云端进度';
  if (code === '23505') return '云端已有记录，请重试一次';
  const message = error.message || error.error_description;
  return message ? String(message) : '同步失败，请稍后再试';
}

// ===== 云端客户端 =====

function createRealClient() {
  // 未配置就明确拒绝，而不是拿空 publishableKey 去初始化 —— 后者会在网关侧
  // 报一个看不懂的鉴权错误，让人误以为是网络问题。
  if (!PUBLIC_CONFIG.isConfigured) throw new Error(NOT_CONFIGURED_CODE);
  // 延迟 require + 延迟取 wx：模块加载期不碰 wx.*，
  // 否则 node 下跑测试时一 require 就抛错，整个测试文件都跑不起来。
  const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram');
  const { createDiagnosticWx } = require('../utils/workbuddy-cloud-diagnostics');
  if (typeof wx === 'undefined' || !wx) throw new Error('当前环境没有小程序运行时');
  // endpoint 与 publishableKey 都必须来自 publicConfig：
  // 小程序没有 Origin，SDK 没有同源回退可用，漏传 endpoint 会在初始化时就失败。
  return createMiniProgramWorkBuddyCloud({
    endpoint: PUBLIC_CONFIG.endpoint,
    publishableKey: PUBLIC_CONFIG.publishableKey,
    wx: createDiagnosticWx(wx),
  });
}

function getClient() {
  if (client) return client;
  if (clientError) throw new Error(clientError);
  try {
    client = clientFactory();
    return client;
  } catch (e) {
    clientError = describeError(e) || '云端客户端初始化失败';
    throw new Error(clientError);
  }
}

function failure(status, message) {
  lastResult = { status, message, at: Date.now() };
  return { ok: false, status, message, at: lastResult.at };
}

// 纯单机模式下的统一回答。它不是失败：应用本来就能只靠本机存档跑完全部关卡。
// 用独立 status（local-only）而不是 error，页面才不至于把正常状态渲染成红色告警。
function localOnly() {
  return failure('local-only', '本机为纯单机模式，学习进度已保存在手机上');
}

function success(status, message, extra) {
  const result = { ok: true, status, message, at: Date.now() };
  if (extra) Object.keys(extra).forEach((k) => { result[k] = extra[k]; });
  lastResult = { status, message, at: result.at };
  return result;
}

// ===== 登录 =====

async function readSession() {
  const cloud = getClient();
  const { data, error } = await cloud.auth.getSession();
  if (error || !data) return null;
  return data;
}

// 静默刷新登录态（启动时调用），失败不打扰用户——未登录也是一种正常状态
async function refreshSession() {
  try {
    const session = await readSession();
    sessionCache = { userId: session && session.user ? session.user.id : null, checkedAt: Date.now() };
  } catch (e) {
    sessionCache = { userId: null, checkedAt: Date.now() };
  }
  return sessionCache;
}

// 微信一键登录：wx.login 拿 code → 交给 SDK 换 WorkBuddy 会话。
// appid 必须取运行时值（试用版与正式版是两个小程序），不能用 applicationId 顶替。
function signIn() {
  if (!PUBLIC_CONFIG.isConfigured) return Promise.resolve(localOnly());
  return new Promise((resolve) => {
    let cloud;
    try {
      cloud = getClient();
    } catch (e) {
      resolve(failure('error', describeError(e)));
      return;
    }
    if (typeof wx === 'undefined' || typeof wx.login !== 'function') {
      resolve(failure('error', '当前环境不支持微信登录'));
      return;
    }
    wx.login({
      success(res) {
        const code = res && res.code;
        if (!code) {
          resolve(failure('error', '微信登录没有返回凭证，请重试'));
          return;
        }
        let appid = '';
        try {
          appid = wx.getAccountInfoSync().miniProgram.appId;
        } catch (e) {
          appid = '';
        }
        if (!appid) {
          resolve(failure('error', '读不到小程序 appid，请重启小程序后重试'));
          return;
        }
        Promise.resolve(cloud.auth.signInWithWechat(code, appid)).then(({ data, error }) => {
          if (error) {
            resolve(failure('error', describeError(error)));
            return;
          }
          const user = data && data.user;
          sessionCache = { userId: user ? user.id : null, checkedAt: Date.now() };
          if (!sessionCache.userId) {
            resolve(failure('error', '登录没有返回账号信息，请重试'));
            return;
          }
          resolve(success('signed-in', '已登录', { userId: sessionCache.userId }));
        }).catch((err) => {
          console.error('[WorkBuddy Cloud] login failed', JSON.stringify({
            stage: 'wechat-login-handler',
            message: err instanceof Error ? err.message : '微信登录失败，请重试',
          }));
          resolve(failure('error', '微信登录失败，请重试'));
        });
      },
      fail(error) {
        console.error('[WorkBuddy Cloud] login failed', JSON.stringify({
          stage: 'wx.login',
          message: error && error.errMsg,
        }));
        resolve(failure('error', (error && error.errMsg) || '微信登录失败，请重试'));
      },
    });
  });
}

async function signOut() {
  if (!PUBLIC_CONFIG.isConfigured) return localOnly();
  try {
    const cloud = getClient();
    const { error } = await cloud.auth.signOut();
    sessionCache = { userId: null, checkedAt: Date.now() };
    if (error) return failure('error', describeError(error));
    return success('signed-out', '已退出登录');
  } catch (e) {
    return failure('error', describeError(e));
  }
}

// ===== 数据面 =====

async function uploadPayload(payload, digest) {
  const cloud = getClient();
  const updatedAt = payload && payload.meta && payload.meta.updatedAt;
  // owner_id 不传：由 owner_id DEFAULT auth.uid() 填，并由 RLS 拒绝伪造的归属。
  const row = {
    payload,
    payload_digest: digest,
    app_version: CONSTANTS.APP_VERSION,
    client_updated_at: updatedAt ? new Date(updatedAt).toISOString() : new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
  const { data, error } = await cloud.database
    .from(TABLE)
    .upsert(row, { onConflict: 'owner_id' })
    .select('payload_digest');

  if (error) return { ok: false, message: describeError(error) };
  // RLS 会静默过滤掉不属于当前用户的行：写入返回空数组不是成功，必须当成失败报出来。
  const affected = Array.isArray(data) ? data : [];
  if (!affected.length) return { ok: false, message: '云端没有接受这次写入，请重新登录后再试' };
  return { ok: true };
}

async function downloadPayload() {
  const cloud = getClient();
  const { data, error } = await cloud.database
    .from(TABLE)
    .select('payload, payload_digest, client_updated_at')
    .limit(1);

  if (error) return { ok: false, message: describeError(error) };
  const rows = Array.isArray(data) ? data : [];
  const row = rows[0];
  if (!row || !row.payload) return { ok: true, remote: null };
  // 摘要以「收到的载荷重新算一遍」为准，不直接信任列值：
  // 列值用于核对规范化是否稳定，不一致说明 jsonb 往返改动了内容，需要留痕。
  const digest = digestOf(row.payload);
  return {
    ok: true,
    remote: {
      payload: row.payload,
      digest,
      storedDigest: row.payload_digest || null,
      digestMatched: !row.payload_digest || row.payload_digest === digest,
      updatedAt: row.client_updated_at || null,
    },
  };
}

// ===== 编排 =====

function bookkeepingFor(currentUserId) {
  const book = state.getSyncBookkeeping();
  const sameUser = !!book.userId && !!currentUserId && book.userId === currentUserId;
  return {
    baseDigest: sameUser ? (book.syncedDigest || null) : null,
    // 这台设备此前是否同步成功过：重装后为 false，重置存档后仍为 true
    everSynced: !!book.lastSyncAt,
  };
}

/**
 * 完整同步一次。
 * force 传 'upload' / 'download' 时跳过冲突判定（供「本机覆盖云端」「云端覆盖本机」两个按钮用）。
 * 永远 resolve，不 reject —— 调用方（页面）不需要 try/catch。
 */
async function syncNow(options) {
  const force = options && options.force ? options.force : null;

  // 未配置时提前返回：否则会掉进「未登录」分支，把「你没登录」当成原因，
  // 而真实原因是这台设备压根没启用云同步 —— 用户会去反复点登录。
  if (!PUBLIC_CONFIG.isConfigured) return localOnly();

  if (!sessionCache.userId) {
    const session = await refreshSession();
    if (!session.userId) return failure('signed-out', '尚未登录，进度保存在本机');
  }
  const userId = sessionCache.userId;

  const localPayload = state.getSyncPayload();
  const localDigest = digestOf(localPayload);

  const pulled = await downloadPayload();
  if (!pulled.ok) return failure('error', pulled.message);
  const remote = pulled.remote;

  if (force === 'upload') {
    const pushed = await uploadPayload(localPayload, localDigest);
    if (!pushed.ok) return failure('error', pushed.message);
    state.markSynced(localDigest, userId);
    return success('uploaded', '已把本机进度上传到云端');
  }
  if (force === 'download') {
    if (!remote) return failure('error', '云端还没有进度可以恢复');
    const applied = state.applySyncPayload(remote.payload, { syncedDigest: remote.digest, userId });
    if (!applied) return failure('error', '云端进度写入本机失败');
    return success('downloaded', '已用云端进度覆盖本机');
  }

  const book = bookkeepingFor(userId);
  const decision = decideSync({
    localDigest,
    baseDigest: book.baseDigest,
    everSynced: book.everSynced,
    localEmpty: isPayloadEmpty(localPayload),
    remoteDigest: remote ? remote.digest : null,
  });

  if (decision.action === 'none') {
    state.markSynced(localDigest, userId);
    return success('in-sync', decision.reason);
  }
  if (decision.action === 'upload') {
    const pushed = await uploadPayload(localPayload, localDigest);
    if (!pushed.ok) return failure('error', pushed.message);
    state.markSynced(localDigest, userId);
    return success('uploaded', decision.reason);
  }
  if (decision.action === 'download') {
    const applied = state.applySyncPayload(remote.payload, { syncedDigest: remote.digest, userId });
    if (!applied) return failure('error', '云端进度写入本机失败');
    return success('downloaded', decision.reason);
  }
  return {
    ok: false,
    status: 'conflict',
    message: decision.reason + '，请选择保留哪一份',
    at: Date.now(),
  };
}

function schedulePush() {
  if (!sessionCache.userId) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    syncNow().catch(() => {});
  }, PUSH_DEBOUNCE_MS);
}

// 切后台时把待推的进度立刻推出去（尽力而为：小程序转后台后请求可能被挂起，
// 推不出去也不影响本机存档，下次打开会再推一次）。
function flush() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (!PUBLIC_CONFIG.isConfigured) return Promise.resolve(localOnly());
  if (!sessionCache.userId) return Promise.resolve(failure('signed-out', '尚未登录'));
  return syncNow().catch(() => failure('error', '同步未能完成'));
}

function init() {
  if (!autoSyncBound) {
    autoSyncBound = true;
    try {
      state.onSave(schedulePush);
    } catch (e) { /* 注册失败只影响自动同步，不影响单机使用 */ }
  }
  // 未配置云服务时不去读会话：那条路只会产出一个必然失败的网络请求
  if (PUBLIC_CONFIG.isConfigured) refreshSession().catch(() => {});
  return { bound: autoSyncBound, configured: !!PUBLIC_CONFIG.isConfigured };
}

// 供页面判断「该显示同步面板还是单机说明」。真实值来自 config/cloud.js。
function isConfigured() {
  return !!PUBLIC_CONFIG.isConfigured;
}

function getStatus() {
  const book = state.getSyncBookkeeping();
  return {
    configured: !!PUBLIC_CONFIG.isConfigured,
    signedIn: !!sessionCache.userId,
    userId: sessionCache.userId || null,
    lastSyncAt: book.lastSyncAt || null,
    syncedDigest: book.syncedDigest || null,
    bookmarkUserId: book.userId || null,
    pending: !!pushTimer,
    last: lastResult,
    clientError: clientError || '',
  };
}

// 仅供测试注入替身客户端；生产代码不得调用。
function setClientFactory(factory) {
  clientFactory = factory || createRealClient;
  client = null;
  clientError = '';
}

module.exports = {
  TABLE,
  PUSH_DEBOUNCE_MS,
  NOT_CONFIGURED_CODE,
  canonicalize,
  digestOf,
  isPayloadEmpty,
  decideSync,
  describeError,
  isConfigured,
  getStatus,
  init,
  flush,
  refreshSession,
  signIn,
  signOut,
  syncNow,
  setClientFactory,
};
