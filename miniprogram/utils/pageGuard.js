// 页面错误边界（最小加固）
//
// 背景：16 个页面里只有 intro / result / level 在业务代码里做了 try/catch。
// 其余页面一旦 state.get() 或配置读取抛错，onLoad / onShow 会中途中断，
// 页面停在「已创建但没渲染出内容」的状态 —— 用户看到的就是一片白屏
// （不是微信错误页、也不是崩溃弹窗，是最难排查的那种）。
//
// 对策：在 onLoad / onShow 这两个「进入页面必跑」的渲染入口外包一层 try/catch，
// 抛错时给出可执行的出路（提示 + 返回首页），而不是把用户丢在白屏上。
//
// 为什么只包 onLoad / onShow：
//   白屏的根因是「首次渲染前就抛错」。事件回调里抛错时页面已经渲染过，
//   不会白屏，所以不在本轮加固范围（逐个包住所有回调，风险与收益不成比例）。
//
// 为什么放在 utils/ 而不是每个页面各写一遍：
//   防御姿势必须一致，否则「有的页面降级、有的页面白屏」更难定位；
//   集中一处以后新增页面套用同一个入口即可。
//
// 用法：把页面末尾的 `Page({ ... })` 换成 `definePage('页面名', { ... })`。
//   definePage 负责包钩子并完成注册，页面其它结构保持不变。
//   result.js 那种「逐字段兜底 + payload TTL + safeDecode」的精细防御继续保留，
//   本守卫是它外面的一层安全网：细活照做，兜不住时还有最后一跳。

// 降级时的落点：引导页是全站入口（非 tabBar 页，用 reLaunch 可清栈重开）
const HOME_URL = '/pages/intro/intro';
const HOME_PAGE = 'intro';

// 需要包裹的生命周期：这两个是「进入页面必跑」的渲染入口。
// onReady / onUnload 不在其列：前者失败时 onLoad 已跑过（不是白屏），
// 后者在离开页面时执行、抛错不影响本页渲染。
const GUARDED_HOOKS = ['onLoad', 'onShow'];

function describeError(error) {
  if (!error) return '未知错误';
  return (error && error.message) || String(error);
}

// 同一页面实例、同一钩子只降级一次：
// tabBar 页面每次切换都会重跑 onShow，若每次都弹窗会变成噪音，
// 反而干扰玩测观察。
function alreadyNotified(ctx, hook) {
  if (!ctx || typeof ctx !== 'object') return false;
  const seen = ctx.__guardNotified || (ctx.__guardNotified = {});
  if (seen[hook]) return true;
  seen[hook] = true;
  return false;
}

function hasWxMethod(name) {
  return typeof wx !== 'undefined' && wx && typeof wx[name] === 'function';
}

// 降级：给出可执行的出路。优先弹窗（可一键回首页），弹窗不可用时退化为 toast。
function degrade(pageName, hook, error, ctx) {
  // 先留痕：即便没有任何 UI 可弹，控制台也能看到是谁在哪个钩子抛的错
  try {
    console.error('[pageGuard] ' + pageName + '.' + hook + ' 失败：' + describeError(error), error);
  } catch (e) { /* 忽略：console 不可用不影响降级 */ }

  if (alreadyNotified(ctx, hook)) return;

  // 首页自身失败时不再跳首页，避免「返回首页 → 又失败 → 又返回」的死循环
  const isHome = pageName === HOME_PAGE;
  if (hasWxMethod('showModal')) {
    try {
      wx.showModal({
        title: '页面加载失败',
        content: isHome
          ? '首页没能正常加载。可以退出小程序重进一次；若反复出现，请反馈给我们。'
          : '「' + pageName + '」页面没能正常显示，可能是本机存档读取异常。请返回首页重试。',
        showCancel: !isHome,
        cancelText: '留在本页',
        confirmText: isHome ? '知道了' : '返回首页',
        success: function (res) {
          if (!isHome && res && res.confirm) {
            try { wx.reLaunch({ url: HOME_URL }); } catch (e) { /* 忽略 */ }
          }
        },
      });
      return;
    } catch (e) { /* 落到 toast */ }
  }
  if (hasWxMethod('showToast')) {
    try {
      wx.showToast({ title: '页面加载失败', icon: 'none' });
    } catch (e) { /* 无 UI 可用：至少控制台已有记录 */ }
  }
}

// 把单个钩子包成「失败不中断渲染链」的安全版本：
// 返回 undefined 而不是继续往外抛，让页面至少停在可交互的降级态。
function wrapLifecycle(pageName, hook, handler) {
  return function guardedLifecycle() {
    try {
      return handler.apply(this, arguments);
    } catch (error) {
      degrade(pageName, hook, error, this);
      return undefined;
    }
  };
}

// 注册一个带错误边界的页面。
// 保持与原生 Page() 一致：仍然把配置交给全局 Page()，只是先给
// onLoad / onShow 套上守卫。测试通过全局 Page 桩捕获配置，因此这条路不能断。
function definePage(pageName, config) {
  const source = config || {};
  const guarded = Object.assign({}, source);
  GUARDED_HOOKS.forEach(function (hook) {
    if (typeof source[hook] !== 'function') return;
    guarded[hook] = wrapLifecycle(pageName, hook, source[hook]);
  });
  guarded.__pageName = pageName; // 供降级文案与调试定位
  Page(guarded);
  return guarded;
}

module.exports = { definePage, wrapLifecycle, GUARDED_HOOKS, HOME_URL, HOME_PAGE };
