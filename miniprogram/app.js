// 应用入口：初始化存档与全局状态
// 注意：require 不能越出 miniprogramRoot（miniprogram/），
// 所以版本号以包内 config/constants.js 为单一来源，并由 tests/version-consistency.test.js 锁住它与 package.json 一致。
const state = require('./engine/state');
const CONSTANTS = require('./config/constants');

App({
  onLaunch() {
    state.init();
  },
  // 切到后台时留一份完好快照：主键若日后损坏，可回退到「上次离开时」的进度。
  // 只在启动与离开这两个低频时机写，不会给每次操作增加写入成本。
  onHide() {
    state.snapshotBackup();
  },
  globalData: {
    version: CONSTANTS.APP_VERSION,
  },
});
