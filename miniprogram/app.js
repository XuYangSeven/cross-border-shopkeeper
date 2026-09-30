// 应用入口：初始化存档与全局状态
// 注意：require 不能越出 miniprogramRoot（miniprogram/），
// 所以版本号以包内 config/constants.js 为单一来源，并由 tests/version-consistency.test.js 锁住它与 package.json 一致。
const state = require('./engine/state');
const CONSTANTS = require('./config/constants');
const audio = require('./engine/audio');

App({
  onLaunch() {
    state.init();
    // 音频初始化：只读偏好 + 预创建实例，**不播放**。
    // 首次播放必须发生在用户手势调用栈内（小程序自动播放限制，否则静默失败）。
    // 因此启动即播是不成立的；BGM 由以下手势入口启动，均幂等：
    //   1) 任意控件点击走 audio.sfx('tap') 时顺带启动（见 engine/audio.js 的 sfx）；
    //   2) 「我的」页根节点兜底点击 onPageTap → startBgm；
    //   3) 用户在「我的」页显式打开「背景音乐」开关时（setPref）立即启动。
    // 切后台暂停 / 回前台复播由 engine/audio.js 内注册的 wx.onAppHide/onAppShow 处理。
    audio.init();
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
