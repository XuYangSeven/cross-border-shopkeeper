// 应用入口：初始化存档与全局状态
const state = require('./engine/state');

App({
  onLaunch() {
    state.init();
  },
  globalData: {
    version: '0.3.0-mvp',
  },
});
