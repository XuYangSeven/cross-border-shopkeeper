// 静态结构审计：页面文件齐备 / 事件绑定有对应方法 / 模板标签闭合 / 无本地调试埋点 / app.json 注册一致
// 目的：把"点击无反应"这类只能靠真机发现的缺陷，提前到 Node 阶段确定性拦截
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');
const app = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));

// ===== 1. app.json 注册的页面文件必须齐备 =====
app.pages.forEach(p => {
  ['js', 'wxml', 'json'].forEach(ext => {
    const file = path.join(MP, `${p}.${ext}`);
    assert.ok(fs.existsSync(file), `缺少文件：${p}.${ext}`);
  });
});

// ===== 2. tabBar 页面必须在 pages 中注册 =====
(app.tabBar && app.tabBar.list ? app.tabBar.list : []).forEach(tab => {
  assert.ok(app.pages.indexOf(tab.pagePath) >= 0, `tabBar 页面未注册：${tab.pagePath}`);
});

// ===== 3. 每个路由字符串指向的页面必须存在 =====
const routeRe = /url:\s*[`'"]\/pages\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)/g;
function collectFiles(dir, ext, out) {
  fs.readdirSync(dir).forEach(name => {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) collectFiles(full, ext, out);
    else if (full.endsWith(ext)) out.push(full);
  });
  return out;
}
const jsFiles = collectFiles(MP, '.js', []);
jsFiles.forEach(file => {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = routeRe.exec(src))) {
    const route = `pages/${m[1]}/${m[2]}`;
    assert.ok(app.pages.indexOf(route) >= 0, `${path.relative(ROOT, file)} 跳转到未注册页面：${route}`);
  }
});

// ===== 4. WXML 事件绑定必须有对应的方法 =====
const BIND_RE = /\b(?:bind|catch)(?:tap|input|change|submit|confirm|blur|focus|longpress|longtap)\s*=\s*"([^"]+)"/g;
// 方法名匹配：支持换行缩进与单行 `}, onBack() {` 两种写法
// 参数列表用 [^()]*，避免贪婪跨过 `data: {...}` 里嵌套的 `()` 把后续方法名一起吞掉
const METHOD_RE = /(?:[{,]\s*|\n\s*)([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/g;
const wxmlFiles = collectFiles(MP, '.wxml', []);
wxmlFiles.forEach(wxml => {
  const js = wxml.replace(/\.wxml$/, '.js');
  if (!fs.existsSync(js)) return;
  const jsSrc = fs.readFileSync(js, 'utf8');
  const methods = new Set();
  let mm;
  while ((mm = METHOD_RE.exec(jsSrc))) methods.add(mm[1]);

  const src = fs.readFileSync(wxml, 'utf8');
  const seen = new Set();
  let h;
  while ((h = BIND_RE.exec(src))) {
    const name = h[1].trim();
    if (seen.has(name)) continue;
    seen.add(name);
    assert.ok(methods.has(name),
      `${path.relative(ROOT, wxml)} 绑定了 ${name}，但 ${path.basename(js)} 中不存在该方法`);
  }
});

// ===== 5. 模板标签闭合（忽略自闭合与注释）=====
const VOID_TAGS = ['input', 'image', 'import', 'include', 'wxs', 'icon', 'progress', 'slot'];
wxmlFiles.forEach(wxml => {
  const src = fs.readFileSync(wxml, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  const tagRe = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|[^>"])*?)(\/?)>/g;
  let t;
  while ((t = tagRe.exec(src))) {
    const closing = t[1] === '/';
    const name = t[2];
    const selfClose = t[4] === '/';
    if (VOID_TAGS.indexOf(name) >= 0 || selfClose) continue;
    if (!closing) stack.push(name);
    else {
      const last = stack.pop();
      assert.strictEqual(last, name, `${path.relative(ROOT, wxml)} 标签不匹配：期望 </${last}>，实际 </${name}>`);
    }
  }
  assert.strictEqual(stack.length, 0, `${path.relative(ROOT, wxml)} 存在未闭合标签：${stack.join(', ')}`);
});

// ===== 6. 不得残留本地调试埋点 =====
jsFiles.concat(wxmlFiles).forEach(file => {
  const src = fs.readFileSync(file, 'utf8');
  assert.strictEqual(/127\.0\.0\.1:\d+/.test(src), false, `${path.relative(ROOT, file)} 残留本地调试请求`);
  assert.strictEqual(/#region\s+debug-point/.test(src), false, `${path.relative(ROOT, file)} 残留调试代码块`);
});

// ===== 7. 关卡注册表引用的章节文件必须存在 =====
const registry = require(path.join(MP, 'config/levels/index.js'));
assert.ok(registry.chapters.length >= 8, '章节注册表应覆盖 8 章');
registry.chapters.forEach(ch => {
  assert.ok(Array.isArray(ch.levels) && ch.levels.length, `第 ${ch.id} 章没有关卡`);
  ch.levels.forEach(level => {
    assert.strictEqual(level.chapter, ch.id, `${level.id} 的 chapter 字段与注册表不一致`);
  });
});

// ===== 8. 所有关卡步骤类型必须被渲染器或模板覆盖 =====
const levelSrc = fs.readFileSync(path.join(MP, 'pages/level/level.js'), 'utf8');
const wxmlSrc = fs.readFileSync(path.join(MP, 'pages/level/level.wxml'), 'utf8');
const learning = require(path.join(MP, 'engine/learning.js'));
const allSteps = [];
registry.chapters.forEach(ch => ch.levels.forEach(lv => lv.steps.forEach(s => allSteps.push({ levelId: lv.id, type: s.type }))));
allSteps.forEach(step => {
  assert.ok(learning.STAGE_LABEL[step.type], `步骤类型 ${step.type}（${step.levelId}）未定义阶段标签`);
  assert.ok(levelSrc.indexOf(`case '${step.type}'`) >= 0, `渲染器缺少步骤类型分支：${step.type}（${step.levelId}）`);
  assert.ok(wxmlSrc.indexOf(`view.type === '${step.type}'`) >= 0, `模板缺少步骤类型分支：${step.type}（${step.levelId}）`);
});

// ===== 9. 关卡 ID 全局唯一 =====
const ids = [];
registry.chapters.forEach(ch => ch.levels.forEach(lv => ids.push(lv.id)));
assert.strictEqual(new Set(ids).size, ids.length, '关卡 ID 存在重复');

// ===== 10. tabBar 四个 Tab 必须配齐两态图标，且图标文件真实存在 =====
// 微信 tabBar 无图标时退化为纯文字，视觉上像未完成品；漏配不会报错，只能靠断言兜住
const tabs = (app.tabBar && app.tabBar.list) || [];
assert.strictEqual(tabs.length, 4, `tabBar 应有 4 个 Tab，实际 ${tabs.length}`);
tabs.forEach(tab => {
  ['iconPath', 'selectedIconPath'].forEach(key => {
    const value = tab[key];
    assert.ok(value, `Tab「${tab.text}」缺少 ${key}`);
    const file = path.join(MP, value);
    assert.ok(fs.existsSync(file), `Tab「${tab.text}」的 ${key} 指向不存在的文件：${value}`);
    const size = fs.statSync(file).size;
    assert.ok(size > 0, `Tab「${tab.text}」的 ${key} 是空文件：${value}`);
  });
});

console.log(`structure audit passed：${app.pages.length} 个页面 / ${wxmlFiles.length} 个模板 / ${ids.length} 个关卡 / ${tabs.length} 个 Tab 图标`);
