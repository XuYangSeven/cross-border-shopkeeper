// 版本号单一来源：包内常量与 npm 侧 package.json 必须一致
//
// 背景：修复前版本号散落三处且互相矛盾 —— package.json 是 0.5.0-shop，
// app.js 的 globalData.version 停在 0.3.0-mvp，存档 meta.contentVersion 停在 0.4.0-teaching。
// 现在包内以 config/constants.js 的 APP_VERSION 为单一来源，本文件锁住它不外漂。
const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const constants = require(path.join(ROOT, 'miniprogram', 'config', 'constants.js'));

assert.strictEqual(
  typeof constants.APP_VERSION, 'string',
  'config/constants.js 必须导出字符串 APP_VERSION'
);
assert.ok(constants.APP_VERSION.length > 0, 'APP_VERSION 不能为空');
assert.strictEqual(
  constants.APP_VERSION, pkg.version,
  `版本号不一致：constants.APP_VERSION=${constants.APP_VERSION}，package.json=${pkg.version}`
);

// 存档 meta 的 contentVersion 也取自同一来源，不能各自硬编码
const stateSrc = require('fs').readFileSync(path.join(ROOT, 'miniprogram', 'engine', 'state.js'), 'utf8');
assert.ok(
  /contentVersion:\s*require\('\.\.\/config\/constants'\)\.APP_VERSION/.test(stateSrc),
  'state.js 的 meta.contentVersion 必须取自 config/constants，不得硬编码'
);

// app.js 同样不得硬编码版本串
const appSrc = require('fs').readFileSync(path.join(ROOT, 'miniprogram', 'app.js'), 'utf8');
assert.ok(
  /version:\s*CONSTANTS\.APP_VERSION/.test(appSrc),
  'app.js 的 globalData.version 必须取自 config/constants，不得硬编码'
);

console.log(`version consistency passed：APP_VERSION=${constants.APP_VERSION} 与 package.json 一致`);
