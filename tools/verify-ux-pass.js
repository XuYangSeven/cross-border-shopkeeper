#!/usr/bin/env node
// 体验优化三线合并后的集成验收闸门（确定性、可复现）
//
// 用途：美工（UX-A）/ 交互（UX-B）/ 音频（UX-C）三条并行线各自回传后，
//       合并前用它做一次客观核对，替代目测。
//
// 设计原则：
//   1. 硬断言（ASSERT）—— 违反即 exit 1，必须修掉才能合并：
//      · 引擎 / 关卡内容 / 数值配置零改动（相对 playtest-v1 标签；既有文件禁改禁删，
//        新增文件必须显式登记在 FROZEN_ADDITIONS_ALLOWED）
//      · engine/audio.js 的导出与冻结 API 契约完全一致（多一个少一个都算失败）
//      · app.wxss 必须 import 交互线的动效库，且该文件必须真实存在
//      · 主包总体积不得超过 2 MB 上限
//      · 音频资产总量不得超过 600 KB 预算
//   2. 只报告不断言（REPORT）—— 计数类指标，供人工判断是否达标，不预设阈值。
//
// 为什么需要它：三条线改的是不同文件，但「有没有人顺手动了不该动的东西」只有
// 版本控制能回答；而「动效到底落地了没有」只有全量计数能回答。
//
// 用法：
//   node tools/verify-ux-pass.js
// 退出码：0 = 全部硬断言通过；1 = 有硬断言失败

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MINIPROGRAM = path.join(ROOT, 'miniprogram');
const BASELINE_TAG = 'playtest-v1';

// 游戏数值与契约文件：这些文件零改动是硬要求。
// 前四项承载「推演与结算同源」契约与全部关卡内容，后两项是数值与评分权重来源。
const FROZEN_PATHS = [
  'miniprogram/config',
  'miniprogram/engine/shop.js',
  'miniprogram/engine/tasks.js',
  'miniprogram/engine/learning.js',
  'miniprogram/engine/shop-view.js',
  'miniprogram/engine/hints.js',
];

// 冻结路径下允许「新增」的例外清单。**每一项都必须写明理由，且不得含关卡内容或数值。**
//
// 为什么需要这个清单：旧版用 `git diff --stat` 判定，而 git diff **不含未跟踪文件**，
// 所以「往 config/ 或 config/levels/ 里加文件」在提交前根本不会被发现——那是假阴性。
// 现在改成按 `--name-status` 判定：既有文件被改/删 → 必失败；出现未登记的新增文件 → 也失败。
// 这比旧版更严，不是更松；例外必须显式登记，不能靠沉默通过。
const FROZEN_ADDITIONS_ALLOWED = [
  // 云服务接入轮新增的配置加载器与占位模板：不含关卡内容，也不含任何游戏数值。
  'miniprogram/config/cloud.js',
  'miniprogram/config/cloud.local.example.js',
];

// 音频模块的冻结 API 契约（与 engine/audio.js 文件头的说明一致）。
// 多导出一个 / 少导出一个都算破坏契约——pages/ 下的调用点依赖它。
const FROZEN_AUDIO_API = ['SFX_NAMES', 'init', 'sfx', 'startBgm', 'stopBgm', 'getPref', 'setPref'];
const FROZEN_SFX_NAMES = ['tap', 'correct', 'wrong', 'settle', 'coin', 'unlock'];

const MAIN_PACKAGE_LIMIT_KB = 2048;   // 微信主包上限 2 MB
const AUDIO_BUDGET_KB = 600;          // 本轮音频总量硬上限

const AUDIO_EXT = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.amr'];

const failures = [];
const reports = [];

const pass = (msg) => console.log(`  \u2713 ${msg}`);
const fail = (msg) => { failures.push(msg); console.log(`  \u2717 ${msg}`); };
const info = (msg) => console.log(`  \u00b7 ${msg}`);

// ---------- 文件遍历 ----------

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// 打包忽略规则：体积闸门必须统计「真正会上传的文件」，而不是磁盘上的全部字节。
// 微信开发者工具按 project.config.json 的 packOptions.ignore 决定哪些不进包；
// 闸门若朴素遍历全目录，新装的 node_modules（5 MB）会被算成主包体积 → 314.9% 的假超限。
// 会说谎的验证器比没有验证器更危险（本项目已为此栽过一次：check-contrast.js 硬编码色值）。
function readPackIgnore() {
  const cfgPath = path.join(ROOT, 'project.config.json');
  if (!fs.existsSync(cfgPath)) return [];
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (e) {
    return [];
  }
  const list = (cfg.packOptions && cfg.packOptions.ignore) || [];
  return list
    .filter((x) => x && typeof x.value === 'string')
    .map((x) => ({
      value: x.value.replace(/^\.\//, '').replace(/\/+$/, ''),
      folder: x.type === 'folder',
    }));
}

const PACK_IGNORE = readPackIgnore();

// ignore 里的路径相对 miniprogramRoot；项目根相对路径也一并认，避免基准歧义。
function isPackedOut(absFile) {
  const relToMp = path.relative(MINIPROGRAM, absFile).split(path.sep).join('/');
  const relToRoot = path.relative(ROOT, absFile).split(path.sep).join('/');
  return PACK_IGNORE.some(({ value, folder }) => {
    for (const relPath of [relToMp, relToRoot]) {
      if (!relPath || relPath.startsWith('..')) continue;
      if (folder) {
        if (relPath === value || relPath.startsWith(value + '/')) return true;
      } else if (relPath === value) {
        return true;
      }
    }
    return false;
  });
}

const allFilesOnDisk = walk(MINIPROGRAM);
const allFiles = allFilesOnDisk.filter((f) => !isPackedOut(f));
const packedOutCount = allFilesOnDisk.length - allFiles.length;
const rel = (f) => path.relative(ROOT, f);

// 计数前必须先剥掉注释：否则「注释里提到 @keyframes」会被当成「定义了一条 @keyframes」，
// 验证器报假阳性比不报更危险（会把未落地的动效算成已落地）。
function stripComments(text, ext) {
  if (ext === '.js') {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  }
  if (ext === '.wxss') {
    return text.replace(/\/\*[\s\S]*?\*\//g, '');
  }
  if (ext === '.wxml') {
    return text.replace(/<!--[\s\S]*?-->/g, '');
  }
  return text;
}

function readText(files, ext) {
  return files
    .filter((f) => f.endsWith(ext))
    .map((f) => ({ file: rel(f), text: stripComments(fs.readFileSync(f, 'utf8'), ext) }));
}

// 统计模式在整个集合里的出现总次数（按行匹配，一行内多处只算一次——这正好对应
// 「哪些规则用了这个属性」的语义，不会被同一行的重复写法虚高）。
function countMatches(texts, regex) {
  let total = 0;
  for (const { text } of texts) {
    for (const line of text.split('\n')) if (regex.test(line)) total++;
  }
  return total;
}

function countFilesWithMatch(texts, regex) {
  return texts.filter(({ text }) => regex.test(text)).length;
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// ---------- 1. 冻结路径零改动 ----------

console.log(`\n[1] 游戏数值与关卡契约零改动（对比 ${BASELINE_TAG}）`);
try {
  const pathArgs = FROZEN_PATHS.map((p) => `"${p}"`).join(' ');

  const raw = execSync(
    `git diff --name-status ${BASELINE_TAG} -- ${pathArgs}`,
    { cwd: ROOT, encoding: 'utf8' },
  ).trim();

  const entries = raw === '' ? [] : raw.split('\n').map((line) => {
    const parts = line.split('\t');
    const status = (parts[0] || '').charAt(0);
    // 重命名/复制行的格式是 R100\t旧名\t新名，取新名
    const file = (status === 'R' || status === 'C') ? (parts[2] || parts[1] || '') : (parts[1] || '');
    return { status, file };
  });

  // ⚠ `git diff` **不含未跟踪文件** —— 这正是本闸门此前会「静默通过」的漏洞：
  //   往 config/ 或 config/levels/ 里丢一个新文件，只要没 git add，旧版就看不见。
  //   所以这里额外扫一遍未跟踪文件（--untracked-files=all），与新增文件同等对待。
  //   注意不加 --ignored：被 gitignore 的私有文件（如 config/cloud.local.js）不该算改动。
  const untrackedRaw = execSync(
    `git status --porcelain --untracked-files=all -- ${pathArgs}`,
    { cwd: ROOT, encoding: 'utf8' },
  ).trim();
  const untracked = untrackedRaw === '' ? [] : untrackedRaw.split('\n')
    .filter((line) => line.indexOf('??') === 0)
    .map((line) => ({ status: 'A', file: line.slice(3).trim().replace(/^"(.*)"$/, '$1') }));

  const all = entries.concat(untracked.map((u) => ({ status: 'A', file: u.file, untracked: true })));
  const touched = entries.filter((e) => e.status === 'M' || e.status === 'D' || e.status === 'R' || e.status === 'C');
  const added = all.filter((e) => e.status === 'A');
  const addedAllowed = added.filter((e) => FROZEN_ADDITIONS_ALLOWED.indexOf(e.file) >= 0);
  const addedUnexpected = added.filter((e) => FROZEN_ADDITIONS_ALLOWED.indexOf(e.file) < 0);

  if (touched.length) {
    fail('冻结路径下有既有文件被修改或删除，违反「不改游戏数值与关卡内容」硬约束：\n'
      + touched.map((e) => `  ${e.status}  ${e.file}`).join('\n'));
  } else if (addedUnexpected.length) {
    fail('冻结路径下出现未登记的新增文件 —— 新增关卡数据或数值文件同样算改动内容：\n'
      + addedUnexpected.map((e) => `  A  ${e.file}${e.untracked ? '（未跟踪）' : ''}`).join('\n')
      + '\n若确为与内容无关的文件（如配置加载器），需显式加入 FROZEN_ADDITIONS_ALLOWED 并写明理由。');
  } else {
    pass(`${FROZEN_PATHS.length} 个冻结路径：既有文件零修改、零删除、无未登记新增`);
    if (addedAllowed.length) {
      console.log(`  · 已登记的新增文件（不含关卡内容与数值）：${addedAllowed.map((e) => e.file).join('、')}`);
    }
  }
} catch (e) {
  fail(`git diff 执行失败，无法验证冻结路径：${e.message.trim()}`);
}

// ---------- 2. 音频 API 契约 ----------

console.log('\n[2] engine/audio.js 冻结 API 契约');
const audioModulePath = path.join(MINIPROGRAM, 'engine', 'audio.js');
if (!fs.existsSync(audioModulePath)) {
  fail('miniprogram/engine/audio.js 不存在');
} else {
  let audio;
  try {
    audio = require(audioModulePath);
  } catch (e) {
    fail(`engine/audio.js require 失败（require 阶段不得触碰 wx.*）：${e.message}`);
  }

  if (audio) {
    const actual = Object.keys(audio).sort();
    const expected = [...FROZEN_AUDIO_API].sort();
    const missing = expected.filter((k) => !actual.includes(k));
    const extra = actual.filter((k) => !expected.includes(k));

    if (missing.length === 0 && extra.length === 0) {
      pass(`导出与契约完全一致（${expected.length} 项）`);
    } else {
      if (missing.length) fail(`缺少契约要求的导出：${missing.join(', ')}`);
      if (extra.length) fail(`多出契约未定义的导出：${extra.join(', ')}`);
    }

    const names = Array.isArray(audio.SFX_NAMES) ? [...audio.SFX_NAMES].sort() : null;
    const expectedNames = [...FROZEN_SFX_NAMES].sort();
    if (names && names.join(',') === expectedNames.join(',')) {
      pass(`SFX_NAMES 与契约一致：${expectedNames.join(' / ')}`);
    } else {
      fail(`SFX_NAMES 与契约不一致。期望 [${expectedNames.join(', ')}]，实际 [${names ? names.join(', ') : '非数组'}]`);
    }

    // getPref 是唯一被交互线与「我的」页共同依赖的读接口，必须能安全调用。
    try {
      const pref = audio.getPref();
      if (pref && typeof pref.bgm === 'boolean' && typeof pref.sfx === 'boolean') {
        pass(`getPref() 返回结构正确：{ bgm: ${pref.bgm}, sfx: ${pref.sfx} }`);
      } else {
        fail(`getPref() 返回结构错误，期望 { bgm: boolean, sfx: boolean }，实际 ${JSON.stringify(pref)}`);
      }
    } catch (e) {
      fail(`getPref() 调用抛错：${e.message}`);
    }
  }
}

// ---------- 3. 动效库接线 ----------

console.log('\n[3] 交互线动效库接线');
const motionPath = path.join(MINIPROGRAM, 'styles', 'motion.wxss');
const appWxssPath = path.join(MINIPROGRAM, 'app.wxss');
const motionExists = fs.existsSync(motionPath);
const appWxss = fs.existsSync(appWxssPath) ? fs.readFileSync(appWxssPath, 'utf8') : '';

if (!motionExists) {
  fail('miniprogram/styles/motion.wxss 不存在（交互线未产出动效库）');
} else {
  pass(`styles/motion.wxss 存在（${formatKB(fs.statSync(motionPath).size)}）`);
}

if (/@import\s+["']styles\/motion\.wxss["']\s*;/.test(appWxss)) {
  pass('app.wxss 已 import styles/motion.wxss');
} else {
  fail('app.wxss 缺少 `@import "styles/motion.wxss";` —— 动效库不会被加载');
}

// ---------- 4. 体积 ----------

console.log('\n[4] 体积');
const miniprogramBytes = allFiles.reduce((sum, f) => sum + fs.statSync(f).size, 0);
const miniprogramKB = miniprogramBytes / 1024;
const pct = ((miniprogramKB / MAIN_PACKAGE_LIMIT_KB) * 100).toFixed(1);
const sizeLine = `miniprogram/ 合计 ${formatKB(miniprogramBytes)} / 上限 ${MAIN_PACKAGE_LIMIT_KB} KB（${pct}%）`;

if (miniprogramKB <= MAIN_PACKAGE_LIMIT_KB) pass(sizeLine);
else fail(`${sizeLine} —— 超出主包上限`);

info(`已按 packOptions.ignore 排除 ${packedOutCount} 个文件（不上传），计入体积的为 ${allFiles.length} 个`);

const audioFiles = allFiles.filter((f) => AUDIO_EXT.includes(path.extname(f).toLowerCase()));
const audioBytes = audioFiles.reduce((sum, f) => sum + fs.statSync(f).size, 0);
const audioKB = audioBytes / 1024;
const audioLine = `音频资产 ${audioFiles.length} 个 / ${formatKB(audioBytes)}（预算 ${AUDIO_BUDGET_KB} KB）`;

if (audioKB <= AUDIO_BUDGET_KB) pass(audioLine);
else fail(`${audioLine} —— 超出音频预算`);

// ---------- 5. 只报告不断言 ----------

console.log('\n[5] 落地计数（仅供人工判断，不设阈值）');

const wxssTexts = readText(allFiles, '.wxss');
const wxmlTexts = readText(allFiles, '.wxml');
const jsTexts = readText(allFiles, '.js');

// 动效
const keyframes = countMatches(wxssTexts, /@keyframes/i);
const animationProp = countMatches(wxssTexts, /(^|[;\s])animation\s*:/i);
const transitionProp = countMatches(wxssTexts, /(^|[;\s])transition\s*:/i);
reports.push(`动效：@keyframes ${keyframes} 条 / animation 属性 ${animationProp} 处 / transition ${transitionProp} 处`);
reports.push(`含 @keyframes 的样式文件：${countFilesWithMatch(wxssTexts, /@keyframes/i)} 个`);

// 圆角（像素风重构的核心指标）
const radiusAll = countMatches(wxssTexts, /border-radius/i);
const radius8 = countMatches(wxssTexts, /border-radius\s*:\s*8rpx/i);
const radiusPill = countMatches(wxssTexts, /border-radius\s*:\s*999rpx/i);
const radiusOther = radiusAll - radius8 - radiusPill;
reports.push(`圆角：合计 ${radiusAll} 处 → 8rpx ${radius8} / 999rpx 胶囊 ${radiusPill} / 其他值 ${radiusOther}`);
reports.push(`含圆角的样式文件：${countFilesWithMatch(wxssTexts, /border-radius/i)} 个`);

// 音效接线
const sfxCalls = countMatches(jsTexts, /audio\.sfx\s*\(/);
const sfxFiles = countFilesWithMatch(jsTexts, /audio\.sfx\s*\(/);
reports.push(`audio.sfx() 调用点：${sfxCalls} 处，分布在 ${sfxFiles} 个文件`);
for (const name of FROZEN_SFX_NAMES) {
  const n = countMatches(jsTexts, new RegExp(`audio\\.sfx\\(\\s*['"]${name}['"]`));
  if (n) reports.push(`  - sfx('${name}')：${n} 处`);
}

// 触觉反馈
const vibrate = countMatches(jsTexts, /wx\.vibrateShort/);
reports.push(`wx.vibrateShort（触觉反馈）调用：${vibrate} 处`);

// 对错形状冗余（色盲可访问性）
const shapeOk = countMatches(wxmlTexts, /[\u2713\u2714\u2705]/);
const shapeBad = countMatches(wxmlTexts, /[\u2717\u2718\u274c\u00d7]/);
reports.push(`对错形状冗余（模板内）：\u2713 类 ${shapeOk} 处 / \u2717 类 ${shapeBad} 处`);

// 阅读型字号回归哨兵：任何 .wxss 里出现给文本类选择器写 <=24rpx 的情况都值得人眼过一遍。
const smallFontFiles = wxssTexts
  .filter(({ text }) => /font-size\s*:\s*(1[0-9]|2[0-4])rpx/i.test(text))
  .map(({ file }) => file);
reports.push(`含 <=24rpx 字号的样式文件：${smallFontFiles.length} 个（标签/徽章允许，阅读型文本不允许）`);

// 新增文件（相对基线）
try {
  const untracked = execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  reports.push(`未跟踪新增文件：${untracked.length} 个`);
  for (const f of untracked) reports.push(`  + ${f}`);
} catch (e) {
  reports.push(`未跟踪文件枚举失败：${e.message.trim()}`);
}

for (const line of reports) info(line);

// ---------- 结论 ----------

console.log('\n' + '='.repeat(60));
if (failures.length === 0) {
  console.log(`集成闸门通过：${FROZEN_PATHS.length} 个冻结路径既有文件零改动、音频契约一致、动效库已接线、体积达标`);
  console.log('注意：本脚本只证明「没越界」与「接线完成」，不证明体感达标——观感与音频必须真机验收。');
  process.exit(0);
} else {
  console.log(`集成闸门未通过：${failures.length} 项硬断言失败`);
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
}
