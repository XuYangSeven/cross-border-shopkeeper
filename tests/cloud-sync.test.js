// 云端同步：决策表、内容摘要、同步书签、以及整条同步链路的回归护栏
//
// 为什么这些点必须有断言：
//   ① 内容摘要是「两端是否一致」的唯一依据 —— 一次误判等于静默丢进度；
//   ② 云端存的是 jsonb，**jsonb 不保留键序**，摘要若对键序敏感，
//      每个同步来回都会被误判成「有新进度」，同步会永远在冲突与上传之间打转；
//   ③ 同步书签的写入若被当成「进度有变化」，会立刻触发下一次上传，形成推送死循环；
//   ④ 冲突不能自动猜 —— 猜错就是平白删掉一边的进度，必须交给用户。
const assert = require('assert');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', 'miniprogram', 'engine', 'state.js');
const SYNC_PATH = path.join(__dirname, '..', 'miniprogram', 'engine', 'sync.js');
const ME_PATH = path.join(__dirname, '..', 'miniprogram', 'pages', 'me', 'me.js');
const CLOUD_PATH = path.join(__dirname, '..', 'miniprogram', 'config', 'cloud.js');

const KEY = 'kuajing_save_v1';

function makeWx(seed) {
  const store = Object.assign({}, seed || {});
  return {
    store,
    getStorageSync(key) { return store[key]; },
    setStorageSync(key, value) { store[key] = JSON.parse(JSON.stringify(value)); },
    removeStorageSync(key) { delete store[key]; },
  };
}

// state 与 sync 都持有模块级状态（存档缓存 / 登录态 / 客户端单例），必须成对重载。
// 只重载 state 会让 sync 抓住一个已被替换的旧 state，断言就会假通过。
function freshModules(wx, client) {
  global.wx = wx;
  delete require.cache[require.resolve(SYNC_PATH)];
  delete require.cache[require.resolve(STATE_PATH)];
  const state = require(STATE_PATH);
  const sync = require(SYNC_PATH);
  if (client) sync.setClientFactory(function () { return client; });
  return { state, sync };
}

// 用一份替身云配置重载 state + sync。
// 替身必须**先**塞进 require.cache，sync.js 顶层的 require('../config/cloud') 才会拿到它；
// 真实环境里这个位置是本地未提交的 cloud.local.js，测试里不能依赖它的存在与否。
// 用完必须删掉这条缓存，否则后面的用例会继续拿到未配置的替身。
function freshModulesWithConfig(configExports, wx) {
  global.wx = wx;
  require.cache[CLOUD_PATH] = {
    id: CLOUD_PATH,
    filename: CLOUD_PATH,
    loaded: true,
    exports: configExports,
  };
  delete require.cache[require.resolve(SYNC_PATH)];
  delete require.cache[require.resolve(STATE_PATH)];
  const state = require(STATE_PATH);
  const sync = require(SYNC_PATH);
  return { state, sync };
}

// 模拟 jsonb 的键序规范化：递归重建对象、键按字典序排列。
// 真实链路上这正是云端读回来的样子，摘要必须对它免疫。
function asJsonb(value) {
  if (Array.isArray(value)) return value.map(asJsonb);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(function (k) { out[k] = asJsonb(value[k]); });
    return out;
  }
  return value;
}

// 可控的云端替身：能按需注入读失败 / 写失败 / 写被 RLS 过滤，
// 并把写入的内容按 jsonb 规范化后存起来，供下一次读取回放。
function makeCloud(options) {
  const opts = options || {};
  const db = {
    rows: opts.row ? [asJsonb(opts.row)] : [],
    writes: [],
    reads: 0,
    blockWrite: !!opts.blockWrite,
    failRead: opts.failRead || null,
    failWrite: opts.failWrite || null,
  };
  const client = {
    auth: {
      async getSession() {
        if (opts.sessionError) return { data: null, error: opts.sessionError };
        return { data: opts.session || null, error: null };
      },
      async signInWithWechat(code, appid) {
        db.lastLogin = { code, appid };
        return { data: { user: { id: opts.loginUserId || 'user-new' } }, error: null };
      },
      async signOut() { return { error: null }; },
    },
    database: {
      from(table) {
        return {
          upsert(row, config) {
            return {
              async select() {
                if (db.failWrite) return { data: null, error: db.failWrite };
                db.writes.push({ table, row, config });
                if (db.blockWrite) return { data: [], error: null };
                db.rows = [{ payload: asJsonb(row.payload), payload_digest: row.payload_digest }];
                return { data: [{ payload_digest: row.payload_digest }], error: null };
              },
            };
          },
          select() {
            return {
              async limit(n) {
                db.reads += 1;
                if (db.failRead) return { data: null, error: db.failRead };
                return { data: db.rows.slice(0, n || 1), error: null };
              },
            };
          },
        };
      },
    },
  };
  return { db, client };
}

const SIGNED_IN = { user: { id: 'user-a' } };

// ===== 1. 内容摘要：确定性 / 键序无关 / 内容敏感 =====
{
  const { sync } = freshModules(makeWx({}));

  const a = { b: 2, a: 1, nested: { z: [1, { y: 2, x: 3 }] } };
  const sameDifferentOrder = { nested: { z: [1, { x: 3, y: 2 }] }, a: 1, b: 2 };
  assert.strictEqual(sync.digestOf(a), sync.digestOf(sameDifferentOrder), '键序不同不应改变摘要');
  assert.strictEqual(sync.digestOf(a), sync.digestOf(JSON.parse(JSON.stringify(a))), '摘要必须确定');
  assert.strictEqual(
    sync.digestOf(a),
    sync.digestOf(asJsonb(a)),
    '必须对 jsonb 的键序规范化免疫 —— 否则每次同步都会误判为「有变化」'
  );

  // 内容变了摘要就要变，否则会漏掉真实改动
  const changedValue = { b: 2, a: 1, nested: { z: [1, { y: 2, x: 4 }] } };
  assert.notStrictEqual(sync.digestOf(a), sync.digestOf(changedValue), '数值变化必须改变摘要');
  // 数组顺序是内容的一部分，不能被视为无序
  assert.notStrictEqual(sync.digestOf([1, 2]), sync.digestOf([2, 1]), '数组顺序必须影响摘要');
  // 长度参与摘要：纯哈希在极端情况下可能碰撞，长度是最便宜的一道额外区分
  assert.ok(sync.digestOf(a).indexOf(String(JSON.stringify(sync.canonicalize(a)).length) + '-') === 0, '摘要应以载荷长度开头');
}

// ===== 2. 「本机什么都没做」的判定 =====
{
  const { sync } = freshModules(makeWx({}));

  assert.strictEqual(sync.isPayloadEmpty(null), true);
  assert.strictEqual(sync.isPayloadEmpty(undefined), true);
  assert.strictEqual(
    sync.isPayloadEmpty({ progress: {}, cards: [], coins: 0, mistakes: [], learning: null, ability: null, learningCursors: {} }),
    true,
    '全空必须判定为空'
  );
  // 每一种「有进度」的痕迹都要能识别出来，漏一种就会把有进度的存档当新装
  assert.strictEqual(sync.isPayloadEmpty({ progress: { '1-1': { stars: 1 } } }), false, '通关记录');
  assert.strictEqual(sync.isPayloadEmpty({ progress: {}, cards: ['c1'] }), false, '已收卡片');
  assert.strictEqual(sync.isPayloadEmpty({ progress: {}, coins: 10 }), false, '金币');
  assert.strictEqual(sync.isPayloadEmpty({ progress: {}, learning: { levelId: '1-1', stepIndex: 2 } }), false, '续学点');
  assert.strictEqual(sync.isPayloadEmpty({ progress: {}, learningCursors: { '1-1': { stepIndex: 2 } } }), false, '续学游标');
  assert.strictEqual(sync.isPayloadEmpty({ progress: {}, ability: { dims: {} } }), false, '能力记录');
  assert.strictEqual(sync.isPayloadEmpty({ progress: {}, mistakes: [{ q: 1 }] }), false, '错题');
  assert.strictEqual(sync.isPayloadEmpty({ progress: {}, shopState: { weeks: 1 } }), false, '经营周');
}

// ===== 3. 同步决策表 =====
{
  const { sync } = freshModules(makeWx({}));
  const D = sync.decideSync;

  // 云端什么都没有 → 只能上传
  assert.strictEqual(D({ localDigest: 'L', baseDigest: null, remoteDigest: null }).action, 'upload');
  // 两端一致 → 什么都不做（这条最容易被漏掉，漏了就会每 12 秒白传一次）
  assert.strictEqual(D({ localDigest: 'L', baseDigest: 'L', remoteDigest: 'L' }).action, 'none');
  // 有共同基线：只本机变 → 传；只云端变 → 取
  assert.strictEqual(D({ localDigest: 'L2', baseDigest: 'L1', remoteDigest: 'L1' }).action, 'upload');
  assert.strictEqual(D({ localDigest: 'L1', baseDigest: 'L1', remoteDigest: 'R2' }).action, 'download');
  // 两边都变 → 冲突，绝不自动选一边
  assert.strictEqual(D({ localDigest: 'L2', baseDigest: 'L1', remoteDigest: 'R2' }).action, 'conflict');

  // 没有共同基线 + 本机为空 + 从未同步过 → 重装后的首次登录，应当自动取回云端
  const fresh = D({ localDigest: 'L1', baseDigest: null, remoteDigest: 'R1', localEmpty: true, everSynced: false });
  assert.strictEqual(fresh.action, 'download', '重装后登录应自动取回云端，而不是弹冲突');
  // 没有共同基线 + 本机是空的 + **同步过** → 这是「刚重置存档」，不能被云端悄悄填回来
  const afterReset = D({ localDigest: 'L1', baseDigest: null, remoteDigest: 'R1', localEmpty: true, everSynced: true });
  assert.strictEqual(afterReset.action, 'conflict', '重置存档后必须让用户选，不能自动恢复');
  // 没有共同基线 + 本机有内容 → 换账号或首次登录，同样必须问
  const noBase = D({ localDigest: 'L1', baseDigest: null, remoteDigest: 'R1', localEmpty: false, everSynced: false });
  assert.strictEqual(noBase.action, 'conflict');
  // 决策必须带可展示的原因
  assert.ok(D({ localDigest: 'L', baseDigest: null, remoteDigest: null }).reason.length > 0, '决策要带原因');
}

// ===== 4. 错误翻译：分支依据是 kind / code，不是文案 =====
{
  const { sync } = freshModules(makeWx({}));
  assert.ok(sync.describeError({ kind: 'unauthenticated' }).indexOf('重新登录') >= 0, '登录失效要说清要重新登录');
  assert.ok(sync.describeError({ kind: 'network' }).indexOf('网络') >= 0, '网络问题不能说成账号问题');
  assert.ok(sync.describeError({ kind: 'backend-unavailable' }).indexOf('网络') >= 0);
  assert.ok(sync.describeError({ code: '42P01' }).indexOf('表') >= 0);
  assert.ok(sync.describeError({ code: '42501' }).indexOf('权限') >= 0);
  assert.strictEqual(sync.describeError({ message: 'boom' }), 'boom', '未识别的错误要透出原始信息');
  assert.ok(sync.describeError(null).length > 0, '空错误也要给一句兜底文案');
}

// ===== 5. 同步书签：写书签绝不能改动「进度载荷」 =====
// 这是防推送死循环的关键：书签若进了载荷，markSynced 就会改变摘要，
// 于是刚同步完立刻又被判定为「有新进度」，无限上传。
{
  const wx = makeWx({});
  const { state, sync } = freshModules(wx);
  state.init();

  const book0 = state.getSyncBookkeeping();
  assert.deepStrictEqual(
    { d: book0.syncedDigest, t: book0.lastSyncAt, u: book0.userId },
    { d: null, t: null, u: null },
    '全新存档没有同步书签'
  );

  state.clearLevel('1-1', 3, 95);
  const payload = state.getSyncPayload();
  assert.strictEqual(payload.meta.syncedDigest, undefined, '载荷不得包含 syncedDigest');
  assert.strictEqual(payload.meta.lastSyncAt, undefined, '载荷不得包含 lastSyncAt');
  assert.strictEqual(payload.meta.userId, undefined, '载荷不得包含 userId');
  assert.ok(payload.progress['1-1'], '载荷要带上真实进度');

  const before = sync.digestOf(payload);
  state.markSynced('digest-1', 'user-a');
  const book1 = state.getSyncBookkeeping();
  assert.strictEqual(book1.syncedDigest, 'digest-1');
  assert.strictEqual(book1.userId, 'user-a');
  assert.ok(book1.lastSyncAt > 0, '书签要记下同步时间');

  const after = sync.digestOf(state.getSyncPayload());
  assert.strictEqual(after, before, '写书签不得改变载荷摘要（否则会无限推送）');
}

// ===== 6. 监听器：save() 通知，书签落盘不通知 =====
{
  const wx = makeWx({});
  const { state } = freshModules(wx);
  state.init();

  let calls = 0;
  state.onSave(function () { calls += 1; });
  state.onSave(function () { throw new Error('listener boom'); });

  state.clearLevel('1-2', 3, 90);
  assert.ok(calls > 0, 'save() 应通知监听器');

  // 监听器抛错不得影响存档主流程
  assert.strictEqual(state.getSaveStatus().ok, true, '监听器抛错不应影响写入结果');
  assert.ok(wx.store[KEY].progress['1-2'], '监听器抛错时进度仍要落盘');

  // 书签落盘走 persist 而不是 save，不触发监听器 —— 否则推送会自己触发自己
  const beforeMark = calls;
  state.markSynced('d1', 'user-a');
  assert.strictEqual(calls, beforeMark, 'markSynced 不应通知监听器');
}

// ===== 7. 云端覆盖本机：内容替换 + 书签就位 + 时间戳沿用云端 =====
{
  const wx = makeWx({});
  const { state, sync } = freshModules(wx);
  state.init();
  state.clearLevel('1-1', 1, 60);

  const remotePayload = {
    version: 3,
    meta: { schemaVersion: 3, contentVersion: 'x', updatedAt: 1700000000000 },
    createdAt: 1600000000000,
    progress: { '5-5': { stars: 3, bestScore: 99, clearedAt: 1700000000000 } },
    cards: ['c9'],
    coins: 500,
    exp: 300,
    mistakes: [],
  };
  const ok = state.applySyncPayload(remotePayload, { syncedDigest: 'digest-remote', userId: 'user-a' });
  assert.strictEqual(ok, true);

  const after = state.get();
  assert.deepStrictEqual(Object.keys(after.progress), ['5-5'], '本机进度应被云端那份整体替换');
  assert.strictEqual(after.coins, 500, '金币应来自云端');
  assert.strictEqual(after.progress['1-1'], undefined, '旧的本机进度不应残留');
  assert.strictEqual(after.meta.updatedAt, 1700000000000, 'updatedAt 必须沿用云端那份，不能被记成本机改动');
  assert.strictEqual(state.getSyncBookkeeping().syncedDigest, 'digest-remote');
  assert.strictEqual(state.getSyncBookkeeping().userId, 'user-a');

  // 覆盖后的载荷会被 migrate 补齐成完整存档结构，因此与「云端那份原始载荷」
  // 不会逐字相同。要锁的是两条真正重要的性质：
  //   ① 摘要稳定 —— 否则每次同步都会把「没变」误判成「有变化」；
  //   ② 重复落同一份载荷是幂等的 —— 否则同步会在「上传 / 下载」之间来回震荡。
  const d1 = sync.digestOf(state.getSyncPayload());
  const d2 = sync.digestOf(state.getSyncPayload());
  assert.strictEqual(d1, d2, '覆盖后的载荷摘要必须稳定');

  const stable = state.getSyncPayload();
  state.applySyncPayload(stable, { syncedDigest: d1, userId: 'user-a' });
  assert.strictEqual(sync.digestOf(state.getSyncPayload()), d1, '重复落同一份载荷必须得到相同摘要（幂等）');

  // 实质内容确实来自云端
  assert.deepStrictEqual(Object.keys(state.get().progress), ['5-5']);
  assert.strictEqual(state.get().coins, 500);
  assert.strictEqual(state.get().cards[0], 'c9');
}

// ===== 8. 整条同步链路（用替身云端跑真实编排） =====
async function flowTests() {
  // (a) 未登录：不联网、不动本机，返回 signed-out
  {
    const cloud = makeCloud({ session: null });
    const wx = makeWx({});
    const { state, sync } = freshModules(wx, cloud.client);
    state.init();
    state.clearLevel('1-1', 3, 95);
    await sync.refreshSession();

    const r = await sync.syncNow();
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 'signed-out', '未登录应明确返回未登录而不是报错');
    assert.strictEqual(cloud.db.reads, 0, '未登录不得发起任何云端读取');
    assert.strictEqual(cloud.db.writes.length, 0, '未登录不得写入云端');
    assert.ok(wx.store[KEY].progress['1-1'], '本机进度不受影响');
  }

  // (b) 已登录 + 云端为空 → 上传
  {
    const cloud = makeCloud({ session: SIGNED_IN });
    const wx = makeWx({});
    const { state, sync } = freshModules(wx, cloud.client);
    state.init();
    state.clearLevel('1-1', 3, 95);
    await sync.refreshSession();

    const r = await sync.syncNow();
    assert.strictEqual(r.status, 'uploaded', '云端为空时应上传本机进度');
    assert.strictEqual(cloud.db.writes.length, 1);
    const written = cloud.db.writes[0].row;
    assert.ok(written.payload.progress['1-1'], '上传内容必须含真实进度');
    assert.strictEqual(written.payload.owner_id, undefined, 'owner_id 必须由数据库默认值填充，不能由前端传');
    assert.ok(typeof written.app_version === 'string' && written.app_version.length > 0, '必须记录写入时的应用版本，便于排查');
    assert.ok(written.payload_digest, '必须带上内容摘要');
    assert.strictEqual(state.getSyncBookkeeping().userId, 'user-a', '上传成功后要记下书签归属');

    // 再来一次：云端已有一致内容 → 不再重复上传
    const again = await sync.syncNow();
    assert.strictEqual(again.status, 'in-sync', '内容一致时不应重复上传');
    assert.strictEqual(cloud.db.writes.length, 1, '第二次同步不应产生新的写入');
  }

  // (c) 重装后首次登录：本机为空 + 从未同步过 → 自动取回云端
  {
    const cloud = makeCloud({
      session: SIGNED_IN,
      row: {
        payload: { version: 3, meta: { schemaVersion: 3, updatedAt: 1700000000000 }, createdAt: 1, progress: { '3-3': { stars: 3 } }, coins: 400 },
        payload_digest: 'whatever',
      },
    });
    const wx = makeWx({});
    const { state, sync } = freshModules(wx, cloud.client);
    state.init();
    await sync.refreshSession();

    const r = await sync.syncNow();
    assert.strictEqual(r.status, 'downloaded', '本机为空且从未同步过时应自动取回云端');
    assert.ok(state.get().progress['3-3'], '云端进度应落到本机');
    assert.strictEqual(state.get().coins, 400);
  }

  // (d) 基线之后本机有新进度 → 上传
  {
    const wx = makeWx({});
    const cloud = makeCloud({ session: SIGNED_IN });
    const { state, sync } = freshModules(wx, cloud.client);
    state.init();
    state.clearLevel('1-1', 3, 95);
    await sync.refreshSession();
    await sync.syncNow();                       // 建立基线
    assert.strictEqual(cloud.db.writes.length, 1);

    state.clearLevel('1-2', 2, 80);             // 本机新进度
    const r = await sync.syncNow();
    assert.strictEqual(r.status, 'uploaded', '本机有新进度时应上传');
    assert.strictEqual(cloud.db.writes.length, 2);
    assert.ok(cloud.db.writes[1].row.payload.progress['1-2'], '新进度必须真的传上去');
  }

  // (e) 基线之后云端有新进度 → 取回
  {
    const wx = makeWx({});
    const cloud = makeCloud({ session: SIGNED_IN });
    const { state, sync } = freshModules(wx, cloud.client);
    state.init();
    state.clearLevel('1-1', 3, 95);
    await sync.refreshSession();
    await sync.syncNow();

    // 模拟另一台设备更新了云端
    const remotePayload = JSON.parse(JSON.stringify(cloud.db.rows[0].payload));
    remotePayload.progress['7-7'] = { stars: 3, bestScore: 100 };
    remotePayload.coins = 999;
    cloud.db.rows = [{ payload: asJsonb(remotePayload), payload_digest: 'other-device' }];

    const r = await sync.syncNow();
    assert.strictEqual(r.status, 'downloaded', '云端有新进度时应取回本机');
    assert.ok(state.get().progress['7-7'], '云端那条新进度应落到本机');
    assert.strictEqual(state.get().coins, 999);
  }

  // (f) 两端都有新进度 → 冲突，且不得写入任何一边
  {
    const wx = makeWx({});
    const cloud = makeCloud({ session: SIGNED_IN });
    const { state, sync } = freshModules(wx, cloud.client);
    state.init();
    state.clearLevel('1-1', 3, 95);
    await sync.refreshSession();
    await sync.syncNow();
    const writesBefore = cloud.db.writes.length;

    state.clearLevel('1-9', 3, 95);                     // 本机变了
    const remotePayload = JSON.parse(JSON.stringify(cloud.db.rows[0].payload));
    remotePayload.progress['9-9'] = { stars: 3 };       // 云端也变了
    cloud.db.rows = [{ payload: asJsonb(remotePayload), payload_digest: 'other-device' }];

    const r = await sync.syncNow();
    assert.strictEqual(r.status, 'conflict', '两端都变必须判冲突，不能自动选一边');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(cloud.db.writes.length, writesBefore, '冲突时不得写入云端');
    assert.ok(state.get().progress['1-9'], '冲突时本机进度必须原样保留');
    assert.strictEqual(state.get().progress['9-9'], undefined, '冲突时不得擅自把云端进度盖到本机');

    // 用户选「保留本机」→ 强制上传
    const up = await sync.syncNow({ force: 'upload' });
    assert.strictEqual(up.status, 'uploaded', '冲突后应能明确选择保留本机');
    assert.strictEqual(cloud.db.writes.length, writesBefore + 1);
    assert.ok(cloud.db.writes[writesBefore].row.payload.progress['1-9'], '上传的是本机那一份');
    assert.strictEqual(cloud.db.writes[writesBefore].row.payload.progress['9-9'], undefined, '本机那份不含云端的 9-9');

    // 用户选「保留云端」→ 强制下载
    const down = await sync.syncNow({ force: 'download' });
    assert.strictEqual(down.status, 'downloaded');
    assert.ok(state.get().progress['1-9'], '下载的正是刚上传的那一份');
  }

  // (g) 写入被 RLS 过滤（返回空数组）→ 必须报失败，不能当成功
  {
    const cloud = makeCloud({ session: SIGNED_IN, blockWrite: true });
    const wx = makeWx({});
    const { state, sync } = freshModules(wx, cloud.client);
    state.init();
    state.clearLevel('1-1', 3, 95);
    await sync.refreshSession();

    const r = await sync.syncNow();
    assert.strictEqual(r.ok, false, 'RLS 过滤掉写入不是成功');
    assert.strictEqual(r.status, 'error');
    assert.ok(r.message.length > 0, '必须给出可读原因');
    assert.strictEqual(state.getSyncBookkeeping().syncedDigest, null, '失败时不得记书签（否则会误以为已同步）');
  }

  // (h) 读取失败 → 报错、不动本机、不合书签
  {
    const cloud = makeCloud({ session: SIGNED_IN, failRead: { kind: 'network', message: 'offline' } });
    const wx = makeWx({});
    const { state, sync } = freshModules(wx, cloud.client);
    state.init();
    state.clearLevel('1-1', 3, 95);
    await sync.refreshSession();

    const r = await sync.syncNow();
    assert.strictEqual(r.ok, false);
    assert.ok(r.message.indexOf('网络') >= 0, '网络类错误要如实说明是网络问题');
    assert.ok(wx.store[KEY].progress['1-1'], '读失败不得影响本机存档');
    assert.strictEqual(cloud.db.writes.length, 0, '读都没成功就不该尝试写入');
  }

  // (i) 登录：微信 code + 运行时 appid 一起交给 SDK
  {
    const cloud = makeCloud({ session: null, loginUserId: 'user-wechat' });
    const wx = makeWx({});
    wx.login = function (opts) { opts.success({ code: 'CODE-1' }); };
    wx.getAccountInfoSync = function () { return { miniProgram: { appId: 'wx-runtime' } }; };
    const { sync } = freshModules(wx, cloud.client);

    const r = await sync.signIn();
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.userId, 'user-wechat');
    assert.deepStrictEqual(cloud.db.lastLogin, { code: 'CODE-1', appid: 'wx-runtime' }, '必须传运行时 appid，不能用 applicationId 顶替');
    assert.strictEqual(sync.getStatus().signedIn, true, '登录后状态应变更为已登录');
  }

  // (j) 登录失败：不产生会话，界面要能拿到原因
  {
    const cloud = makeCloud({ session: null });
    const wx = makeWx({});
    wx.login = function (opts) { opts.fail({ errMsg: 'wx.login:fail mock' }); };
    wx.getAccountInfoSync = function () { return { miniProgram: { appId: 'wx-runtime' } } };
    const { sync } = freshModules(wx, cloud.client);

    const r = await sync.signIn();
    assert.strictEqual(r.ok, false);
    assert.ok(r.message.indexOf('wx.login') >= 0, '要把微信侧的原因带出来');
    assert.strictEqual(sync.getStatus().signedIn, false, '失败不得留下会话');
  }

  // (k) 未登录时 flush 不发请求
  {
    const cloud = makeCloud({ session: null });
    const wx = makeWx({});
    const { sync } = freshModules(wx, cloud.client);
    await sync.refreshSession();
    const r = await sync.flush();
    assert.strictEqual(r.status, 'signed-out');
    assert.strictEqual(cloud.db.reads, 0, '未登录的 flush 不得发请求');
  }
}

// ===== 9. 开源默认状态：未配置云服务必须优雅降级 =====
// 公开仓库里没有 cloud.local.js 是**默认状态**，不是异常。三条底线：
//   ① 不得初始化云端客户端、不得发起任何请求、不得弹登录；
//   ② 登录 / 同步 / 推送接口仍然 resolve（页面不需要 try/catch），只是明确说明本机模式；
//   ③ 这个状态是「本地保存」而不是「同步失败」——文案与状态码都不能吓人。
function resolveConfigTests() {
  const cloud = require(CLOUD_PATH);
  assert.strictEqual(typeof cloud.resolveConfig, 'function', 'cloud.js 要导出可单测的 resolveConfig');

  const off = cloud.resolveConfig(null);
  assert.strictEqual(off.isConfigured, false, '没有本地配置时不得算作已配置');
  assert.strictEqual(off.endpoint, cloud.FIXED_ENDPOINT, 'endpoint 必须有固定默认值：所有小程序共用同一网关');
  assert.strictEqual(off.applicationId, '', '不得回落到任何内置的 applicationId');
  assert.strictEqual(off.publishableKey, '', '不得回落到任何内置的 publishableKey');

  assert.strictEqual(
    cloud.resolveConfig({ applicationId: 'wbapp_x', publishableKey: 'wbpk_y' }).isConfigured,
    true,
    '两个凭据齐全才算配置好'
  );
  // 半配置比不配置更危险：会拿空 key 去初始化客户端，在网关侧报一个看不懂的鉴权错
  assert.strictEqual(cloud.resolveConfig({ applicationId: 'wbapp_x' }).isConfigured, false, '只有 applicationId 不算配置好');
  assert.strictEqual(cloud.resolveConfig({ publishableKey: 'wbpk_y' }).isConfigured, false, '只有 publishableKey 不算配置好');
  assert.strictEqual(cloud.resolveConfig({ applicationId: '   ', publishableKey: 'wbpk_y' }).isConfigured, false, '纯空白不算填了');
  assert.strictEqual(cloud.resolveConfig({ applicationId: 123, publishableKey: {} }).isConfigured, false, '非字符串不算填了');

  // endpoint 只认显式给出的合法值，其余一律退回固定网关（防止有人「纠正」成应用域名）
  assert.strictEqual(cloud.resolveConfig({ applicationId: 'a', publishableKey: 'b' }).endpoint, cloud.FIXED_ENDPOINT);
  assert.strictEqual(
    cloud.resolveConfig({ applicationId: 'a', publishableKey: 'b', endpoint: 'https://own.example.com' }).endpoint,
    'https://own.example.com',
    '显式配置的 endpoint 应生效（自建网关场景）'
  );
  assert.strictEqual(cloud.resolveConfig({ applicationId: 'a', publishableKey: 'b', endpoint: '  ' }).endpoint, cloud.FIXED_ENDPOINT);
}

function unconfiguredTests() {
  const OFF = {
    applicationId: '',
    endpoint: 'https://mp-api.app.workbuddy.host',
    publishableKey: '',
    isConfigured: false,
  };
  const wx = makeWx({});
  let loginCalls = 0;
  wx.login = function () { loginCalls += 1; };

  const mods = freshModulesWithConfig(OFF, wx);
  mods.state.init();

  function cleanup() { delete require.cache[CLOUD_PATH]; }

  try {
    assert.strictEqual(mods.sync.isConfigured(), false, 'isConfigured 应直接反映配置');
    assert.strictEqual(mods.sync.getStatus().configured, false, '状态里要带出「未配置」，页面据此换形态');
    assert.strictEqual(mods.sync.init().configured, false, '未配置时 init 也要报告 configured=false');

    const text = mods.sync.describeError(new Error(mods.sync.NOT_CONFIGURED_CODE));
    assert.ok(text.indexOf('单机') >= 0, '未配置的文案要说成「单机」：' + text);
    assert.ok(text.indexOf('失败') < 0, '纯单机不是故障，文案里不该出现「失败」');
    assert.ok(text.indexOf('wbapp') < 0 && text.indexOf('wbpk') < 0, '不得把配置值泄进用户可见文案');
  } catch (e) {
    cleanup();
    throw e;
  }

  return Promise.all([
    mods.sync.signIn(),
    mods.sync.syncNow(),
    mods.sync.flush(),
  ]).then(function (results) {
    results.forEach(function (r) {
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.status, 'local-only', '未配置要用独立状态，不能被当成 error：' + JSON.stringify(r));
      assert.ok(r.message.indexOf('单机') >= 0, '要讲清是单机模式：' + r.message);
    });
    assert.strictEqual(loginCalls, 0, '未配置云服务时绝不能去调 wx.login');

    // 面板也必须真的切成单机形态 —— 只在状态里带个字段而视图不消费，等于没做
    let capturedPage = null;
    global.Page = function (config) { capturedPage = config; };
    delete require.cache[require.resolve(ME_PATH)];
    require(ME_PATH);
    const page = Object.assign({}, capturedPage);
    page.data = JSON.parse(JSON.stringify(capturedPage.data));
    page.setData = function (patch) {
      Object.keys(patch || {}).forEach(function (k) {
        if (k.indexOf('.') >= 0) {
          const parts = k.split('.');
          let node = page.data;
          for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]];
          node[parts[parts.length - 1]] = patch[k];
        } else {
          page.data[k] = patch[k];
        }
      });
    };
    page.onShow.call(page);
    assert.strictEqual(page.data.sync.configured, false, '「我的」页要带出未配置状态');
    assert.strictEqual(page.data.sync.signedIn, false, '未配置时不得渲染成已登录');
    assert.strictEqual(page.data.sync.conflict, false, '未配置时不该出现冲突二选一');

    cleanup();
    console.log('cloud sync：未配置云服务的降级断言通过');
  }).catch(function (e) {
    cleanup();
    throw e;
  });
}

// ===== 10. 「我的」页：同步面板要能真正渲染出来 =====
// 注意 pageGuard 会吞掉 onShow 的异常，所以这里只能靠「渲染结果」断言，
// 不能用「没抛错」当通过条件。
function meTests() {
  const wx = makeWx({});
  const cloud = makeCloud({ session: null });
  freshModules(wx, cloud.client);

  let captured = null;
  global.Page = function (config) { captured = config; };
  delete require.cache[require.resolve(ME_PATH)];
  require(ME_PATH);
  assert.ok(captured, 'me 页应完成注册');

  function makeInstance() {
    const inst = Object.assign({}, captured);
    inst.data = JSON.parse(JSON.stringify(captured.data));
    inst.setData = function (patch, cb) {
      Object.keys(patch || {}).forEach(function (k) {
        if (k.indexOf('.') >= 0) {
          const parts = k.split('.');
          let node = inst.data;
          for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]];
          node[parts[parts.length - 1]] = patch[k];
        } else {
          inst.data[k] = patch[k];
        }
      });
      if (typeof cb === 'function') cb();
    };
    return inst;
  }

  const page = makeInstance();
  page.onShow.call(page);
  assert.ok(page.data.sync, 'onShow 后应有同步面板数据');
  assert.strictEqual(page.data.sync.signedIn, false, '未登录时应显示未登录');
  assert.strictEqual(page.data.sync.stateText, '未登录');
  assert.strictEqual(page.data.sync.stateClass, 'sync-state-idle', '未登录不该用成功/失败色');

  // 已登录 → 面板要切成登录后的形态
  captured = null;
  const wx2 = makeWx({});
  const cloud2 = makeCloud({ session: SIGNED_IN });
  const mods = freshModules(wx2, cloud2.client);
  global.Page = function (config) { captured = config; };
  delete require.cache[require.resolve(ME_PATH)];
  require(ME_PATH);
  mods.sync.refreshSession().then(function () {
    const page2 = makeInstance();
    page2.onShow.call(page2);
    assert.strictEqual(page2.data.sync.signedIn, true, '已登录时面板应显示已登录');
    assert.strictEqual(page2.data.sync.stateText, '已登录，还没同步过');
    assert.strictEqual(page2.data.sync.buttonText, '把进度备份到云端');

    // 冲突结果 → 面板必须切成「二选一」，不能只给一个按钮
    page2.applySyncResult({ ok: false, status: 'conflict', message: '本机与云端都有新进度' });
    assert.strictEqual(page2.data.sync.conflict, true, '冲突时面板要进入二选一状态');
    assert.strictEqual(page2.data.sync.busy, false, '结果落地后必须解除忙碌态，否则按钮永远点不动');

    // 成功结果 → 显示成功文案并解除忙碌态
    page2.applySyncResult({ ok: true, status: 'uploaded', message: '云端还没有这份进度' });
    assert.strictEqual(page2.data.sync.conflict, false);
    assert.strictEqual(page2.data.sync.message, '已把本机进度备份到云端', '成功文案应统一来自映射表');

    // 所有按钮的处理函数都要存在（结构审计只查 wxml 里的事件名，这里补调用链）
    ['onCloudSignIn', 'onCloudSyncNow', 'onCloudUpload', 'onCloudDownload', 'onCloudSignOut'].forEach(function (name) {
      assert.strictEqual(typeof page2[name], 'function', name + ' 必须存在');
    });
    console.log('cloud sync tests passed：10 组断言（摘要 / 空档判定 / 决策表 / 错误翻译 / 书签 / 监听器 / 覆盖 / 链路 / 未配置降级 / 页面）');
  }).catch(function (e) {
    console.error(e);
    process.exit(1);
  });
}

flowTests().then(function () {
  resolveConfigTests();
}).then(function () {
  return unconfiguredTests();
}).then(function () {
  meTests();
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});
