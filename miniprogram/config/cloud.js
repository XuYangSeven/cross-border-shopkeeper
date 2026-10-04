// 云服务公开配置（publicConfig）加载器。
//
// 【开源说明】本文件只含占位逻辑，可以安全提交。
// 真实的 applicationId / publishableKey 请写到同级的 cloud.local.js —— 它已在 .gitignore
// 中被忽略。没有 cloud.local.js 时 isConfigured 为 false，应用自动保持「纯单机」：
// 学习、闯关、金币、星级全部照常，只是没有跨设备同步。
//
//   cp miniprogram/config/cloud.local.example.js miniprogram/config/cloud.local.js
//
// 只有这三个字段允许出现在前端代码里。底层的环境 ID 与各类服务端密钥永远不下发，
// 也不得写进这两个文件。
//
// ⚠ 关于 endpoint：小程序没有 Origin，微信的 request 合法域名白名单不支持通配符且有数量上限，
//   所以**所有小程序共用同一个固定网关**（mp-api 开头），它不是本应用的专属域名。
//   不要把它「纠正」成某个应用域名，也不要改成预览/测试域名 —— 那是把小程序的请求打到
//   一个白名单外的地址上。真机报「url not in domain list」时应去登记这个固定网关，
//   而不是改这里的值。
const FIXED_ENDPOINT = 'https://mp-api.app.workbuddy.host';

// 拼路径而不是写 require('./cloud.local') 是刻意为之：微信开发者工具只对**字面量** require
// 做静态依赖分析，写死路径会在文件不存在时报「找不到模块」并中断构建。而云配置本来就是
// 「有则启用、无则单机」的可选件，不该因为别人没配它就让整个小程序编译不过。
function loadLocalConfig() {
  try {
    const modulePath = ['./cloud', 'local'].join('.');
    return require(modulePath);
  } catch (e) {
    return null;
  }
}

// 纯函数：把「可能残缺的本地配置」规范化成一份确定的配置对象。
// 单独抽出来是为了可单测 —— 否则只能靠真的增删 cloud.local.js 来验证分支。
function resolveConfig(local) {
  const raw = local && typeof local === 'object' ? local : {};
  const applicationId = typeof raw.applicationId === 'string' ? raw.applicationId.trim() : '';
  const publishableKey = typeof raw.publishableKey === 'string' ? raw.publishableKey.trim() : '';
  const endpoint = typeof raw.endpoint === 'string' && raw.endpoint.trim()
    ? raw.endpoint.trim()
    : FIXED_ENDPOINT;
  // 判定「配置好了没有」只看两个凭据：endpoint 有固定默认值，缺它不影响判断。
  return {
    applicationId,
    publishableKey,
    endpoint,
    isConfigured: !!(applicationId && publishableKey),
  };
}

const resolved = resolveConfig(loadLocalConfig());

module.exports = {
  applicationId: resolved.applicationId,
  endpoint: resolved.endpoint,
  publishableKey: resolved.publishableKey,
  isConfigured: resolved.isConfigured,
  FIXED_ENDPOINT,
  resolveConfig,
};
