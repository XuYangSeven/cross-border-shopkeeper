#!/usr/bin/env node
/**
 * 构建 miniprogram_npm —— 等价于微信开发者工具的「工具 → 构建 npm」。
 *
 * 为什么需要这个脚本：
 *   云服务接入路径不安装微信开发者工具，但小程序运行时只能从 `miniprogram_npm/`
 *   解析 `require('@tencent-ai/workbuddy-cloud-sdk/miniprogram')`。
 *   本脚本把这唯一一步自动化，产物与开发者工具一致（见 SDK README：
 *   目标文件为 `miniprogram_npm/@tencent-ai/workbuddy-cloud-sdk/miniprogram.js`）。
 *
 * 用法（在 kuajing-miniapp/miniprogram 下执行过 `npm install` 之后）：
 *   node tools/build-miniprogram-npm.js
 *
 * 升级 SDK 后必须重跑；只跑 npm install 不会更新小程序端的产物。
 * 如果你更希望用开发者工具构建，直接点「构建 npm」也可以，产物路径相同。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MINIPROGRAM_ROOT = path.join(__dirname, '..', 'miniprogram');
const PKG_NAME = '@tencent-ai/workbuddy-cloud-sdk';
const PKG_DIR = path.join(MINIPROGRAM_ROOT, 'node_modules', ...PKG_NAME.split('/'));
const OUT_DIR = path.join(MINIPROGRAM_ROOT, 'miniprogram_npm', ...PKG_NAME.split('/'));
const ENTRY_FILE = 'miniprogram.js';

function fail(message) {
  console.error(`构建 miniprogram_npm 失败：${message}`);
  process.exit(1);
}

// `package.json#miniprogram` 指向小程序专用产物目录；缺失说明装到的不是小程序版本
const pkgJsonPath = path.join(PKG_DIR, 'package.json');
if (!fs.existsSync(pkgJsonPath)) {
  fail(`未找到 ${PKG_DIR}。请先在 miniprogram/ 目录执行 npm install。`);
}
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
const distDir = path.join(PKG_DIR, pkgJson.miniprogram || '');
const distEntry = path.join(distDir, ENTRY_FILE);
if (!pkgJson.miniprogram || !fs.existsSync(distEntry)) {
  fail(`${pkgJson.name} 未提供 miniprogram 产物（package.json#miniprogram=${pkgJson.miniprogram}）。`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.copyFileSync(distEntry, path.join(OUT_DIR, ENTRY_FILE));

// 同时提供包根入口，使 `require('@tencent-ai/workbuddy-cloud-sdk')` 也能解析
fs.writeFileSync(
  path.join(OUT_DIR, 'index.js'),
  "// 由 tools/build-miniprogram-npm.js 生成：包根入口转发到小程序产物。\nmodule.exports = require('./" + ENTRY_FILE + "');\n",
  'utf8'
);

// 自检：产物必须能被 CommonJS 正常加载并暴露工厂函数。
// 这里在一份不带 "type": "module" 的临时 package.json 下加载，模拟小程序运行时的解析方式。
const probeDir = path.join(require('os').tmpdir(), `sdk-probe-${process.pid}`);
fs.mkdirSync(probeDir, { recursive: true });
try {
  const probeFile = path.join(probeDir, ENTRY_FILE);
  fs.copyFileSync(path.join(OUT_DIR, ENTRY_FILE), probeFile);
  fs.writeFileSync(path.join(probeDir, 'package.json'), '{"type":"commonjs"}', 'utf8');
  const loaded = execFileSync(process.execPath, [
    '-e',
    `const m=require(process.argv[1]);if(typeof m.createMiniProgramWorkBuddyCloud!=="function"){process.exit(3)};`
      + `console.log(JSON.stringify(Object.keys(m)))`,
    probeFile,
  ], { encoding: 'utf8' }).trim();
  console.log(`  自检通过，导出：${loaded}`);
} catch (e) {
  fail(`产物无法加载或不含 createMiniProgramWorkBuddyCloud —— ${e.message}`);
} finally {
  fs.rmSync(probeDir, { recursive: true, force: true });
}

const bytes = fs.statSync(path.join(OUT_DIR, ENTRY_FILE)).size;
console.log(`miniprogram_npm 构建完成`);
console.log(`  来源：${path.relative(MINIPROGRAM_ROOT, distEntry)}`);
console.log(`  产物：${path.relative(MINIPROGRAM_ROOT, OUT_DIR)}/ (${(bytes / 1024).toFixed(1)} KB)`);
