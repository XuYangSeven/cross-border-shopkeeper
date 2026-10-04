// 云服务本地配置模板 —— 复制本文件为 cloud.local.js 并填入自己的值。
//
//   cp miniprogram/config/cloud.local.example.js miniprogram/config/cloud.local.js
//
// cloud.local.js 已被 .gitignore 忽略。不创建它也能正常运行：
// 此时 config/cloud.js 的 isConfigured 为 false，应用保持「纯单机」模式，
// 所有学习功能照常，只是没有跨设备同步。
//
// 字段说明：
//   applicationId   云服务应用 ID，形如 wbapp_xxxxxxxx
//   endpoint        固定网关。**所有小程序共用这一个地址**，不是应用自己的域名，
//                   不要「纠正」成你自己的域名（原因见 config/cloud.js 顶部注释）。
//   publishableKey  客户端公开密钥，形如 wbpk_xxxxxxxx_yyyy
//
// ⚠ 底层环境 ID 与服务端密钥永远不下发到前端，不要往这里写。
module.exports = {
  applicationId: 'wbapp_xxxxxxxxxxxxxxxxxxxxxxxx',
  endpoint: 'https://mp-api.app.workbuddy.host',
  publishableKey: 'wbpk_xxxxxxxxxxxxxxxxxxxxxxxx_yyyyyyyyyyyyyyyyyyyyyyyy',
};
