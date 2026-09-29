# 第6章「客服与售后」实现计划

基于 `chapter6-design.md`。实施顺序遵循：纯函数引擎 → 配置 → 渲染器 → 注册 → 测试 → 微信工具验证。除明确列出的文件外不扩展范围。

## 任务 1：实现客服纯函数引擎

文件：`miniprogram/engine/customer.js`

1. 定义数值工具：整数分成本、比例夹取、计数校验；禁止依赖 wx。
2. 实现 `evaluateScenario`：按 optionId 匹配，输出及时性、解决状态、满意度、成本和解释；未知ID抛错。
3. 实现 `calculateServiceMetrics`：验证非负整数及分子不超过分母；零分母返回 null；比例保持0～1。
4. 实现 `summarizeCustomerCases`：校验工单和选择完整，逐单调用评估，汇总质量、合规、及时、解决、平均满意度和成本。
5. 实现 `evaluateCustomerBoss`：读取targets，输出passed/failureReasons，金额全部使用整数分。
6. 添加输入不变和边界测试。

完成标准：引擎不调用 wx/随机数/存储；推荐结果与设计文档一致；错误输入有明确异常。

## 任务 2：编写第6章配置

文件：`miniprogram/config/levels/chapter6.js`

1. 创建6-1到6-6，依次使用 `customerScenario`、`serviceMetrics`、`customerBoss`。
2. 为6-1到6-4分别配置三个 PawPal 宠物梳客服案例，包含客户消息、事实、模拟规则、三种选项、解释和结果。
3. 配置6-5固定服务统计量、字段答案来源和容差。
4. 配置6-6五张Boss工单、推荐动作、响应限制和目标阈值。
5. 检查所有ID唯一、成本单位统一为整数分、文案不出现真实平台名。

完成标准：配置可被Node直接require；推荐Boss方案可由引擎计算通过；错误方案有可解释失败原因。

## 任务 3：扩展通用关卡渲染器

文件：`miniprogram/pages/level/level.js`

1. 显式 `require('../../engine/customer')`。
2. 在 `renderStep` 增加三类步骤的视图初始化：案例选择状态、指标字段输入状态、Boss工单选择状态；所有显示文本提前生成。
3. 增加案例选择和提交事件；用 `map` 复制数组后整体 `setData`，不使用 `view.cases[i]` 动态路径。
4. 增加服务指标输入和提交事件；整体更新fields，使用customer引擎计算答案。
5. 增加Boss选择和提交事件；整体更新cases，调用customer引擎汇总；展示逐单复盘、指标、满意度和成本。
6. 增加完成状态保护，避免快速点击重复增加objDone；错误提交增加一次retries，重复未修改提交不重复增加。
7. 在finish或步骤推进处增加第6章失败守卫，确保未完成步骤无法写progress或解锁下一关。
8. 不改现有章节事件逻辑，除非为第6章类型分发所需的最小兼容修改。

完成标准：三类步骤都能初始化、选择、失败重试、成功继续；没有新增动态数组setData路径；失败不会进入结算存档。

## 任务 4：扩展关卡页面模板和样式

文件：`miniprogram/pages/level/level.wxml`、`miniprogram/pages/level/level.wxss`

1. 增加客服情景区：工单标题、消息、事实、政策、选项和提交按钮。
2. 增加服务指标区：指标公式说明、输入框、单位、校验状态、暂无数据展示。
3. 增加Boss复盘区：每张工单结果、满意度、响应/解决状态、成本和失败原因。
4. 只使用已准备的数据字段和简单WXML表达式；不调用slice/indexOf/map/toFixed等复杂方法。
5. 复用既有像素风类名，新增样式控制长文本换行、选中态、成功/失败态和成本展示。

完成标准：WXML标签闭合、无复杂方法调用、模拟器不出现模板解析错误；手机宽度下长消息可读。

## 任务 5：注册章节并补充测试

文件：`miniprogram/config/levels/index.js`、`tests/customer.test.js`、`tests/chapter6.test.js`

1. 用显式 `require('./chapter6')` 注册第6章「客服与售后」。
2. customer.test覆盖：四项服务指标、零分母、非法计数、满意度边界、响应阈值、成本求和、未知ID、输入不变。
3. chapter6.test覆盖：6个关卡存在、step类型合法、ID唯一、字段完整、选项结果完整、推荐Boss通过、超预算/不合规失败、禁止真实平台名。
4. 运行既有 `node tests/profit.test.js`，确认29/29通过。
5. 运行全部Node测试和语法检查；记录输出，不修改既有利润口径。

完成标准：新增测试通过，利润测试不回归，所有chapter6配置检查通过。

## 任务 6：微信开发者工具验证

1. 备份测试存档后清缓存→清除全部缓存→编译。
2. 从地图确认第6章仅在第5章六关通关后解锁，6-1至6-6逐关解锁。
3. 分别验证普通客服关、指标关、Boss关的错误提交、修改后重提、完成后继续、返回地图和重新进入。
4. 确认正确完成后结果页星级/金币/卡片展示，失败时不产生进度。
5. 检查Console第一条红错，重点检查require入口、WXML表达式、整体setData路径和页面空白。
6. 记录无法由Node替代的真机/开发者工具结果；不把清缓存后的测试存档当作用户存档迁移方案。

## 文件变更清单

新增：
- `miniprogram/engine/customer.js`
- `miniprogram/config/levels/chapter6.js`
- `tests/customer.test.js`
- `tests/chapter6.test.js`

修改：
- `miniprogram/config/levels/index.js`
- `miniprogram/pages/level/level.js`
- `miniprogram/pages/level/level.wxml`
- `miniprogram/pages/level/level.wxss`

不修改：
- 第1～5章配置与引擎
- `miniprogram/engine/scoring.js`
- `miniprogram/engine/state.js` 数据结构
- 地图、结算、手册页面
- 现有利润测试与利润口径

## 风险控制

- WXML不做复杂表达式：所有格式化字段由level.js生成。
- 动态数组不使用路径描述符：数组统一map后整体setData。
- 客服成本不接现有利润引擎，避免影响29项利润基线。
- 不将客服满意度与商品评分混用。
- 失败不调用finish；只有通过且点击继续才进入下一步。
- 不创建新的存档版本，不清理用户已有存档。
