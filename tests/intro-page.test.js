// 新手引导页测试
// 覆盖：① 页面导出与首屏数据齐备；② 点开始跳转关卡地图（tabBar 页必须用 switchTab）；
//      ③ 有进度时文案切换为「继续学习」并显示进度；④ 展示数字与真实配置一致（防止写死过期）。
const assert = require('assert');
const path = require('path');

let storage = null;
const navs = [];
global.wx = {
  getStorageSync: () => storage,
  setStorageSync: (key, value) => { storage = JSON.parse(JSON.stringify(value)); },
  switchTab: opt => navs.push(opt && opt.url),
  navigateTo: opt => navs.push(opt && opt.url),
};

const state = require('../miniprogram/engine/state');
state.init();

const PAGE = path.join(__dirname, '..', 'miniprogram/pages/intro/intro.js');

function loadPage() {
  let captured = null;
  global.Page = obj => { captured = obj; };
  delete require.cache[require.resolve(PAGE)];
  require(PAGE);
  return captured;
}

function makeInstance(def) {
  const instance = Object.assign({}, def);
  instance.data = JSON.parse(JSON.stringify(def.data || {}));
  instance.setData = function setData(patch, cb) {
    Object.keys(patch || {}).forEach(key => { instance.data[key] = patch[key]; });
    if (typeof cb === 'function') cb();
  };
  return instance;
}

// ===== 1. 首次进入：无任何进度 =====
const def = loadPage();
assert.ok(def, '引导页应导出 Page 配置');
['onLoad', 'onShow', 'onStart'].forEach(fn => {
  assert.strictEqual(typeof def[fn], 'function', `引导页应实现 ${fn}`);
});
const first = makeInstance(def);
first.onLoad.call(first);
assert.strictEqual(first.data.features.length, 4, '应展示 4 项功能');
assert.strictEqual(first.data.flow.length, 5, '学习闭环应为 5 步');
assert.strictEqual(first.data.hasProgress, false, '无进度时不应显示进度行');
assert.strictEqual(first.data.ctaText, '开始体验');
assert.strictEqual(first.data.stars, 0);

// ===== 2. 点「开始」→ switchTab 进入关卡地图 =====
navs.length = 0;
first.onStart.call(first);
assert.deepStrictEqual(navs, ['/pages/map/map'], '点开始应进入关卡地图，且 tabBar 页必须用 switchTab');

// ===== 3. 展示数字必须与真实配置一致 =====
const levelsCfg = require('../miniprogram/config/levels/index');
const cards = require('../miniprogram/config/cards');
const learning = require('../miniprogram/engine/learning');
const levelTotal = levelsCfg.chapters.reduce((sum, ch) => sum + ch.levels.length, 0);
assert.strictEqual(first.data.totalLevels, levelTotal, '关卡总数应与注册表一致');
assert.ok(first.data.features[0].stat.indexOf(String(levelTotal)) >= 0, '关卡功能卡的数字应与注册表一致');
assert.ok(first.data.features[2].stat.indexOf(String(Object.keys(cards).length)) >= 0, '知识手册卡数应与卡片库一致');
assert.ok(first.data.features[3].stat.indexOf(String(learning.DIMENSIONS.length)) >= 0, '能力评估维度数应与引擎一致');

// ===== 4. 已有进度：文案切换为「继续学习」并显示进度 =====
state.clearLevel('1-1', 3, 100);
state.clearLevel('1-2', 2, 80);
const second = makeInstance(loadPage());
second.onShow.call(second);
assert.strictEqual(second.data.cleared, 2, '应统计已通关关卡数');
assert.strictEqual(second.data.stars, 5, '应累计星数');
assert.strictEqual(second.data.hasProgress, true);
assert.strictEqual(second.data.ctaText, '继续学习');

console.log('intro page tests passed');
