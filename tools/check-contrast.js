#!/usr/bin/env node
// 像素风色板对比度自检（WCAG 2.1 相对亮度）
//
// 用途：独立重算「文字色 / 背景色」配对的可读性，不采信任何自报数字。
//
// 【为什么登记表要按选择器查而不是写死色值】
// 本脚本第一版的登记表里直接写了 fg 色值（如 #4CAF50）。美工线把 .text-up 改成 #1B6B2C
// 之后，脚本仍旧报 #4CAF50 的旧对比度 —— 验证器开始说谎，而说谎的验证器比没有验证器更
// 危险。现在登记表只写**选择器**，色值一律从 wxss 文件里现场读取，改色后自动跟随。
//
// 检查两类配对：
//   A. 同一规则块内同时声明了 color 与 background 的配对（高置信度：一定同时生效）
//   B. 登记的关键配对（跨规则继承，脚本无法自动推导背景，只能人工指定背景 + 选择器）
//
// 判定标准（WCAG 2.1）：
//   正文文本   ≥ 4.5:1
//   大号文本   ≥ 3.0:1（本项目 page 基线 28rpx≈14px，不算大号）
//
// 用法：node tools/check-contrast.js
// 退出码：0 = 无正文级失败；1 = 存在正文级失败或登记失效

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MINIPROGRAM = path.join(ROOT, 'miniprogram');

const TEXT_MIN = 4.5;

// B 类：登记的关键配对。fgSelector 指向 wxss 里的选择器，色值现场读取；
// bg 是人工指定的实际背景（跨规则继承，脚本无法推导）。
// 若某个 fgSelector 在项目里找不到，视为登记失效并报错 —— 类被改名或删除时必须有人来看一眼。
const CURATED_PAIRS = [
  { fgSelector: 'page', bg: '#F2E8D5', what: 'page 基线正文 / 米底' },
  // .panel 自身不声明 color（继承 page），故登记的是「page 的文字色落在面板底上」。
  { fgSelector: 'page', bg: '#FFFDF7', what: '.panel：page 文字色 / 面板底' },
  { fg: '#D4A934', bg: '#1A2B4A', what: '导航栏 / 金币高亮：品牌金 / 深蓝' },
  { fg: '#F2E8D5', bg: '#1A2B4A', what: '导航栏标题：米 / 深蓝' },
  { fgSelector: '.btn-primary', bg: '#D4A934', what: '.btn-primary：深蓝 / 金' },
  { fgSelector: '.btn-secondary', bg: '#2E4A7A', what: '.btn-secondary：米 / 中蓝' },
  { fgSelector: '.btn-danger', bg: '#A84A42', what: '.btn-danger：白 / 暗红' },
  { fgSelector: '.text-up', bg: '#F2E8D5', what: '对错轴 .text-up：绿 / 米底' },
  { fgSelector: '.text-up', bg: '#FFFDF7', what: '对错轴 .text-up：绿 / 面板底' },
  { fgSelector: '.text-down', bg: '#F2E8D5', what: '对错轴 .text-down：红 / 米底' },
  { fgSelector: '.text-down', bg: '#FFFDF7', what: '对错轴 .text-down：红 / 面板底' },
  { fgSelector: '.text-warn', bg: '#F2E8D5', what: '.text-warn：橙 / 米底' },
  { fgSelector: '.text-warn', bg: '#FFFDF7', what: '.text-warn：橙 / 面板底' },
  { fgSelector: '.text-gold', bg: '#F2E8D5', what: '.text-gold：深金 / 米底' },
  { fgSelector: '.text-gold', bg: '#FFFDF7', what: '.text-gold：深金 / 面板底' },
  { fg: '#9E9E9E', bg: '#1A2B4A', what: 'Tab 未选中文字：灰 / 深蓝导航底' },
];

// ---------- 颜色换算 ----------

function parseHex(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function srgbToLinear(channel) {
  const c = Math.max(0, Math.min(255, channel)) / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fgHex, bgHex) {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  if (!fg || !bg) return null;
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------- 规则抽取 ----------

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (full.endsWith('.wxss')) out.push(full);
  }
  return out;
}

function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function collectRules() {
  const rules = [];
  for (const file of walk(MINIPROGRAM)) {
    // 先把 @import 语句整行剔除：否则 `@import "x";\npage { ... }` 会被块正则
    // 捕获成选择器 `@import "x"; page`，导致按选择器登记失效。
    const text = stripCssComments(fs.readFileSync(file, 'utf8')).replace(/@import[^;]*;/g, '');
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      rules.push({
        file: path.relative(ROOT, file),
        selector: m[1].trim().replace(/\s+/g, ' '),
        body: m[2],
      });
    }
  }
  return rules;
}

const RULES = collectRules();

function lookupColorHex(selector) {
  const hits = [];
  for (const r of RULES) {
    const parts = r.selector.split(',').map((s) => s.trim());
    if (!parts.includes(selector)) continue;
    const c = r.body.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3,6})/);
    if (c) hits.push({ file: r.file, hex: c[1] });
  }
  return hits;
}

// ---------- A 类：同规则块内 color + background ----------

function sameRulePairs() {
  const out = [];
  for (const r of RULES) {
    const fg = r.body.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3,6})/);
    const bg = r.body.match(/(?:^|;)\s*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/);
    if (fg && bg) out.push({ fg: fg[1], bg: bg[1], what: `${r.file} → ${r.selector}` });
  }
  return out;
}

function fmt(n) {
  return n === null || n === undefined ? 'n/a' : n.toFixed(2);
}

const failures = [];

console.log('\n[A] 同规则块内 color / background 配对（自动提取）');
const aPairs = sameRulePairs();
if (aPairs.length === 0) console.log('  （无）');
for (const p of aPairs) {
  const ratio = contrast(p.fg, p.bg);
  const ok = ratio !== null && ratio >= TEXT_MIN;
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${fmt(ratio)}:1  ${p.fg} on ${p.bg}  ${p.what}`);
  if (!ok) failures.push({ ...p, ratio, kind: 'same-rule' });
}

console.log('\n[B] 登记的关键配对（色值现场读取，防止登记随改色过期）');
for (const p of CURATED_PAIRS) {
  let fgHex = p.fg;
  let source = '登记字面值';

  if (!fgHex) {
    const hits = lookupColorHex(p.fgSelector);
    if (hits.length === 0) {
      console.log(`  \u2717 登记失效：选择器 ${p.fgSelector} 在项目中找不到 color 声明（类被改名或删除？）`);
      failures.push({ fg: '(未找到)', bg: p.bg, what: p.what, ratio: null, kind: 'stale-registry' });
      continue;
    }
    const uniq = Array.from(new Set(hits.map((h) => h.hex)));
    fgHex = hits[0].hex;
    source = `${p.fgSelector} @ ${hits[0].file}`;
    if (uniq.length > 1) {
      console.log(`  \u2717 ${p.fgSelector} 有多份互相冲突的定义：${hits.map((h) => `${h.hex}@${h.file}`).join(' vs ')}`);
      failures.push({ fg: uniq.join(' / '), bg: p.bg, what: `${p.what}（重复定义）`, ratio: null, kind: 'duplicate-definition' });
      continue;
    }
  }

  const ratio = contrast(fgHex, p.bg);
  const ok = ratio !== null && ratio >= TEXT_MIN;
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${fmt(ratio)}:1  ${fgHex} on ${p.bg}  ${p.what}  [${source}]`);
  if (!ok) failures.push({ fg: fgHex, bg: p.bg, what: p.what, ratio, kind: 'curated' });
}

console.log('\n' + '='.repeat(64));
const total = aPairs.length + CURATED_PAIRS.length;
console.log(`配对总数：同规则 ${aPairs.length} + 登记 ${CURATED_PAIRS.length} = ${total}`);
console.log(`正文级（<${TEXT_MIN}:1）失败：${failures.length} 项`);

if (failures.length === 0) {
  console.log('结论：全部配对达到 WCAG 正文标准。');
  process.exit(0);
}

console.log('需要人工处置的配对（逐个确认是正文还是装饰性元素）：');
failures.forEach((p, i) => {
  const tag = p.kind === 'same-rule' ? '' : `〔${p.kind}〕`;
  console.log(`  ${i + 1}. ${fmt(p.ratio)}:1  ${p.fg} on ${p.bg}  —— ${p.what} ${tag}`);
});
process.exit(1);
