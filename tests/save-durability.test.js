// 存档持久化与自愈：两个「静默丢失」路径的回归护栏
//
// 背景：修复前 save() 返回 boolean 但全站 19 处调用点无一检查 —— 写失败用户无感；
// load() 读取抛异常时静默退回空白存档，紧接着 init() 因 createdAt 为空而落盘，
// 把可能仍可恢复的旧数据直接覆盖。本文件锁定修复后的行为。
const assert = require('assert');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', 'miniprogram', 'engine', 'state.js');
const KEY = 'kuajing_save_v1';
const BACKUP_KEY = 'kuajing_save_v1.bak';

// 每次拿到全新的 state 模块（模块内有 cache / saveStatus 状态，必须重载）
function freshState(wx) {
  global.wx = wx;
  delete require.cache[require.resolve(STATE_PATH)];
  return require(STATE_PATH);
}

// 可控存储：能分别注入「读异常」和「写异常」，并按真实行为做序列化
function makeWx(seed) {
  const store = Object.assign({}, seed || {});
  let failReads = false;
  let failWrites = false;
  return {
    store,
    failReads(v) { failReads = v; },
    failWrites(v) { failWrites = v; },
    getStorageSync(key) {
      if (failReads) throw new Error('read boom');
      return store[key];
    },
    setStorageSync(key, value) {
      if (failWrites) throw new Error('write boom');
      store[key] = JSON.parse(JSON.stringify(value));
    },
    removeStorageSync(key) { delete store[key]; },
  };
}

function goodSave(progress) {
  return {
    version: 3,
    meta: { schemaVersion: 3 },
    createdAt: 1700000000000,
    progress: progress || { '1-1': { stars: 3, bestScore: 92, clearedAt: 1700000000000 } },
    cards: [],
    coins: 120,
    exp: 60,
    seenDialogs: [],
  };
}

// ===== 1. 首次进入：正常落盘，并留下一份完好快照 =====
{
  const wx = makeWx({});
  const state = freshState(wx);
  state.init();

  const status = state.getSaveStatus();
  assert.strictEqual(status.loadFailed, false, '空存储不是读取失败');
  assert.strictEqual(status.ok, true, '首次进入应写入成功');
  assert.ok(wx.store[KEY], '主键应已写入');
  assert.ok(wx.store[BACKUP_KEY], '启动时应留下快照');
  assert.strictEqual(wx.store[BACKUP_KEY].createdAt, wx.store[KEY].createdAt, '快照内容应与主键一致');
}

// ===== 2. 主键读取抛异常：禁止自动落盘，绝不能覆盖原数据 =====
{
  const wx = makeWx({ [KEY]: goodSave() });
  const original = wx.store[KEY];
  wx.failReads(true);

  const state = freshState(wx);
  state.init();

  assert.strictEqual(state.getSaveStatus().loadFailed, true, '读取抛异常必须被记录');
  assert.strictEqual(wx.store[KEY], original, '原存档对象必须原封不动（不得被空白档覆盖）');
  assert.strictEqual(wx.store[KEY].progress['1-1'].stars, 3, '原进度仍在存储里，等待用户重试');
  assert.strictEqual(wx.store[KEY].createdAt, 1700000000000, '不得被 init 写入新的 createdAt');
}

// ===== 3. 主键被写坏但快照完好：从快照恢复并自愈回写主键 =====
{
  const wx = makeWx({ [KEY]: 'corrupted-string', [BACKUP_KEY]: goodSave() });

  const state = freshState(wx);
  state.init();

  const status = state.getSaveStatus();
  assert.strictEqual(status.recoveredFromBackup, true, '应标记为从快照恢复');
  assert.strictEqual(status.loadFailed, false, '读取本身没抛异常，不算读取失败');
  assert.strictEqual(state.get().progress['1-1'].stars, 3, '进度应从快照恢复');
  assert.strictEqual(typeof wx.store[KEY], 'object', '主键应被自愈回写为对象');
  assert.strictEqual(wx.store[KEY].progress['1-1'].stars, 3, '回写内容应为恢复后的存档');
}

// ===== 4. 坏类型且无快照：不崩、不误判为读取失败 =====
{
  const wx = makeWx({ [KEY]: ['not', 'an', 'object'] });
  const state = freshState(wx);
  state.init();

  const status = state.getSaveStatus();
  assert.strictEqual(status.loadFailed, false, '读到了值（只是不可用），不算读取失败');
  assert.strictEqual(status.recoveredFromBackup, false, '没有快照可用');
  assert.deepStrictEqual(state.get().progress, {}, '应落空档');
  assert.ok(state.get().createdAt, '空档应补上 createdAt');
}

// ===== 5. 写入失败必须可被上层看见，恢复后自动清除告警 =====
{
  const wx = makeWx({});
  const state = freshState(wx);
  state.init();

  wx.failWrites(true);
  state.clearLevel('1-1', 3, 90);
  let status = state.getSaveStatus();
  assert.strictEqual(status.ok, false, '写失败必须让状态变为不健康');
  assert.strictEqual(status.failCount, 1, '连续失败次数应累计');
  assert.ok(/write boom/.test(status.lastError), `失败原因应被记录，实际：${status.lastError}`);

  state.clearLevel('1-2', 3, 90);
  assert.strictEqual(state.getSaveStatus().failCount, 2, '再次失败应继续累计');

  wx.failWrites(false);
  state.clearLevel('1-3', 3, 90);
  status = state.getSaveStatus();
  assert.strictEqual(status.ok, true, '写入恢复后状态应回到健康');
  assert.strictEqual(status.failCount, 0, '成功后失败计数应清零');
  assert.strictEqual(status.lastError, '', '成功后应清空错误信息');
}

// ===== 6. reset 必须刷新快照：不能让旧进度从快照「复活」 =====
// 快照的语义是「上次离开时的进度」（启动时 + app.onHide 各拍一次），
// 所以要先把快照拍成「含进度」，才能验证 reset 之后它确实被刷新掉了。
{
  const wx = makeWx({});
  const state = freshState(wx);
  state.init();
  state.clearLevel('1-1', 3, 95);
  state.snapshotBackup(); // 模拟切后台

  assert.ok(state.get().progress['1-1'], '前置：进度非空');
  assert.strictEqual(wx.store[BACKUP_KEY].progress['1-1'].stars, 3, '前置：快照里已含这份进度');

  state.reset();

  assert.deepStrictEqual(wx.store[BACKUP_KEY].progress, {}, '重置后快照必须同步清空');

  // 模拟重置之后主键损坏：从快照恢复出来必须是空档，而不是重置前的进度
  const wx2 = makeWx({ [KEY]: 'corrupted-string', [BACKUP_KEY]: wx.store[BACKUP_KEY] });
  const state2 = freshState(wx2);
  state2.init();
  assert.deepStrictEqual(state2.get().progress, {}, '恢复出的必须是重置后的空档');
}

// ===== 7. 落空档必须是深拷贝：不能与 DEFAULT 共享嵌套引用 =====
// 修复前是 { ...DEFAULT } 浅拷贝，改动空档会污染进程内的默认模板，
// 使得同一进程后续 reset 出来的存档带着脏数据。
{
  const wx = makeWx({});
  const state = freshState(wx);
  state.init();

  // 直接改内存里的空档（模拟任何一次未被拦截的写入）
  state.get().progress['9-9'] = { stars: 3, bestScore: 99 };
  state.get().cards.push('leaked-card');

  state.reset();

  assert.deepStrictEqual(state.get().progress, {}, '默认模板未被污染：reset 后应为空');
  assert.deepStrictEqual(state.get().cards, [], '默认模板未被污染：卡片应为空');
}

// ===== 8. 快照语义：启动 + 切后台各拍一次，能回退到「上次离开时」 =====
{
  const wx = makeWx({});
  const state = freshState(wx);
  state.init();

  // 本次会话推进了两关
  state.clearLevel('1-1', 3, 95);
  state.clearLevel('1-2', 2, 78);
  // 离开前拍快照
  state.snapshotBackup();

  // 下次启动时主键已损坏 —— 应恢复到离开时的两关进度，而不是全丢
  const wx2 = makeWx({ [KEY]: 'corrupted-string', [BACKUP_KEY]: wx.store[BACKUP_KEY] });
  const state2 = freshState(wx2);
  state2.init();

  const progress = state2.get().progress;
  assert.ok(progress['1-1'], '应恢复出 1-1');
  assert.strictEqual(progress['1-2'].stars, 2, '应恢复出 1-2 且星数正确');

  // 且自愈：主键已被回写成可用存档
  assert.strictEqual(JSON.stringify(wx2.store[KEY].progress), JSON.stringify(progress), '主键应被自愈回写');
}

console.log('save durability passed：8 组断言（覆盖 / 自愈 / 写失败可见 / 快照刷新 / 深拷贝 / 快照语义）');
