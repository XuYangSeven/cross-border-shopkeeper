# 第6章「客服与售后」设计

状态：已确认六关、情景选择为主、三类步骤和独立纯函数引擎；以下细化数值为本次设计提案，待文档审核后实施。本轮仅产出文档，不修改代码，不提交 Git。

## 1. 目标与范围

面向零基础用户，在 PawPal 宠物梳案例中训练「核实事实—选择方案—沟通承诺—跟进复盘」。全部为本地教学模拟；平台称「模拟商城」，不接真实订单、支付或消息服务。不引入 Taro、uni-app、后端或 AI 自由文本评分。

保留原生小程序、像素风、配置驱动、现有本地存档键、章节顺序及 60%/25%/15% 评分权重、85/70/60 星级线。不改第1～5章的玩法和数值。客服成本是教学统计，不扣店铺资金或金币，不叠加到现有利润模型。

本章只有三种新增步骤：customerScenario、serviceMetrics、customerBoss。复用 dialog 做导入；每关提交后的复盘直接呈现在当前页面，不自动跳过。首版不新增知识卡及手册交互，避免牵涉现有手册动态数组路径；面试复述提示放在关卡复盘中。

## 2. 六关设计

普通关 passScore=70，Boss passScore=80。6-1～6-4 每关三个案例，每个案例三个情景选项，全部选择后统一提交；每个选项都有具体解释，不依赖选项序号判定。

| 关卡 | 步骤 | 案例与学习结果 |
| --- | --- | --- |
| 6-1 客服回复基础 | customerScenario | 不会使用宠物梳、咨询适用毛发、首次反馈不适；确认问题、表达理解、给明确操作和后续联系路径，涉及不适先停止使用 |
| 6-2 差评识别与处理 | customerScenario | 梳齿破损、物流延迟、要求补偿换删评；区分问题归因，留存证据、合规处理，不以低星推断恶意，不承诺删评 |
| 6-3 退货退款决策 | customerScenario | 已核实破损且客户选择退款、功能正常但不适用且符合退货规则、包装轻微破损且客户自愿接受部分退款；先给明示规则再决策，不以省钱牺牲应得权益 |
| 6-4 订单异常沟通 | customerScenario | 延迟未签收、漏发、地址错误；先核实状态，按订单规则补发或升级处理，只承诺下一次跟进时间，不保证不可控到货日 |
| 6-5 服务指标 | serviceMetrics | 计算及时响应率、解决率、退款订单率、满意度；展示各自分母，区分退款与退货、满意评价与商品星级 |
| 6-6 客服综合 Boss | customerBoss | 固定一班五张工单，选择完整处理方案，平衡合规、响应、解决、满意度和售后支出；提交后逐单复盘 |

案例明确订单状态、买家诉求、核实证据、可选权益及教学授权额度。每个选项显示回复话术和实际动作，不能只有抽象的「正确/错误」。退款不能与好评、删评或站外沟通绑定；地址和订单信息通过平台内私信核实，不在公开评价回复中披露。

所有普通案例的最佳选项 qualityScore=100，其他选项使用 40 或 60，并解释缺失环节；涉及违规的选项 compliant=false。以方案质量均分达到70且全部合规为练习通过条件，允许低于最佳的可接受组合。满意度是可解释的模拟结果，不宣称预测真实买家行为。

## 3. 规则和数据口径

### 3.1 通用情景结果

每个选项配置 outcome：qualityScore（0～100）、compliant（布尔）、responseHours（非负小时）、resolved（布尔）、satisfactionDelta（-100～100）、cost（见下）。每个案例带 initialSatisfaction（0～100）。

- 单工单满意度 = clamp(initialSatisfaction + satisfactionDelta, 0, 100)。
- 及时响应 = responseHours <= responseLimitHours；本章教学响应时限24小时，不代表任何真实平台政策。
- 金额以美元分存储和累加，展示时转美元并保留两位小数。
- 售后支出 = refundCents + replacementCents + shippingCents + compensationCents。
- refundCents 为退回买家的钱；replacementCents 是补发商品成本；shippingCents 是新增运费；compensationCents 是额外授权补偿。部分退款只记 refundCents，避免重复计为补偿。
- 原始采购、原始运费、佣金、税、残值不计入该售后支出口径；不把它称为净亏损。
- 配置中价格、成本和教学政策自包含；默认宠物梳实付1699分，与现有商品样例一致。规则先展示再答题。

### 3.2 服务指标练习

固定数据：需回复工单20、24小时内回复18、已解决16、统计订单100、发生退款的订单5、有效满意评价8、有效评价10。

| 指标 | 公式 | 标准答案 |
| --- | --- | --- |
| 及时响应率 | 及时回复工单 / 需回复工单 ×100% | 90% |
| 解决率 | 已解决工单 / 总工单 ×100% | 80% |
| 退款订单率 | 发生退款订单 / 统计订单 ×100% | 5% |
| 满意度 | 满意评价 / 有效评价 ×100% | 80% |

一个退款订单只计一次；部分退款也算发生退款；退款率不是退货率。输入数字百分比，例如90而非0.9；容差0.1个百分点，四项全对才完成。空白、非数字、负数、大于100均拒绝，不把空白当0。分母为0时引擎返回null，页面显示「暂无数据」而非0%或100%。配置计数必须为非负整数，分子不得超分母。

### 3.3 Boss 确定性规则

不做真实倒计时、不允许修改初始订单量或响应时限。每张工单三个选项，各自绑定响应时长、质量、合规、是否解决、满意度变化与成本；选择不同动作会产生不同结果，不用随机数。

五张工单初始满意度均为60，推荐组合如下。质量均100、全部合规、全部解决。

| 工单 | 推荐动作与前提 | 响应小时 | 满意度变化 | 退款/补发/运费/额外补偿（分） |
| --- | --- | --- | --- | --- |
| 物流延迟 | 查验后已签收，确认收货并完成跟进 | 4 | +25 | 0/0/0/0 |
| 梳齿破损 | 已核实且买家选择退款，授权全退无需退回 | 2 | +30 | 1699/0/0/0 |
| 漏发一件 | 已核实，买家同意补发且确认收货 | 6 | +25 | 0/221/400/0 |
| 使用咨询 | 提供适用和清洁指导，买家确认解决 | 8 | +20 | 0/0/0/0 |
| 包装轻微破损 | 商品完好，买家自愿接受3美元部分退款并确认解决 | 3 | +20 | 300/0/0/0 |

这里的选择代表完整工单处理过程及其模拟结果，不是「发出一次回复就自动解决」。破损风险或不适案例禁止以赔付代替必要的安全提示。

推荐组合结果：及时响应率100%、解决率100%、平均模拟满意度84/100、售后支出2620分（$26.20）、方案质量均分100。

通过需同时满足：全部工单已选、全部合规、及时响应率>=80%、解决率>=80%、平均模拟满意度>=80、支出<=3500分、质量均分>=80。阈值均放在章节配置中。平均模拟满意度不是6-5的问卷满意度，界面使用不同名称；Boss不输出无统计分母的退款订单率。

不合格组合必须有可解释失败原因，例如虚假到货承诺、补偿换删评、拖延超过24小时、未实际解决、授权外过度补偿。每个配置选项必须填写完整结果和解释，测试验证推荐解确实可达、至少一个超预算组合失败、任一违规组合不能靠其他高分抵消。

## 4. 纯函数引擎契约

新增 miniprogram/engine/customer.js，CommonJS 导出；不调用 wx、时间、随机数、存储或页面，不修改入参。

- evaluateScenario({ scenario, optionId, responseLimitHours })：按ID查选项，返回 qualityScore、compliant、timely、resolved、satisfaction、costCents、explanation。未知ID抛出明确错误，不默认为正确答案。
- calculateServiceMetrics({ ticketCount, timelyCount, resolvedCount, orderCount, refundedOrderCount, ratingCount, satisfiedCount })：返回 timelyResponseRate、resolutionRate、refundRate、satisfactionRate，比例为0～1或null；违反计数约束抛错。
- summarizeCustomerCases({ cases, selections, responseLimitHours })：selections为工单ID到选项ID的映射，返回逐单结果、qualityScore均分、compliant、timelyResponseRate、resolutionRate、averageSatisfaction、costCents；缺选或无效ID拒绝计算。
- evaluateCustomerBoss({ cases, selections, responseLimitHours, targets })：调用汇总，增加 passed 和 failureReasons。金额比较使用整数分，指标比较使用未格式化数值。

普通练习复用汇总，用质量均分和合规判定；退款支出、满意度等展示帮助理解，但不增加未声明的通关条件。serviceMetrics标准答案由引擎从配置统计量计算，不在渲染器再写一套公式。

## 5. 配置和渲染契约

chapter6.js 导出六关数组，基础字段沿用 id/chapter/name/type/goal/passScore/steps。前三类步骤字段：

- customerScenario：scenario说明、responseLimitHours、cases、passScore、reviewPrompt。
- serviceMetrics：stats、fields（key/label/formula）、tolerancePercentagePoints、reviewPrompt。
- customerBoss：cases、responseLimitHours、targets、reviewPrompt。
- 案例：id、title、message、facts、policy、initialSatisfaction、options。
- 选项：id、text、explanation、outcome（含四项cost整数分）。

level.js 渲染时生成视图模型：案例的picked/selected样式、可读金额、指标百分比、错误解释等提前计算。初始done=false、result=null。WXML只循环、条件展示和读取字段，不调用slice/indexOf/map/toFixed等方法。

选择后用map复制cases数组，再整体setData({'view.cases': updated})；指标输入同理整体更新fields。不能拼接动态数组下标路径。提交前检测未填项；成功后锁定选项和提交、显示继续按钮；失败留在本步骤，保留选择与逐项解释，可以修改后再提交。修改后清除旧结果，避免新选择显示旧评价。

页面事件需校验当前类型与done状态，防止快速连点重复objDone或重试次数。输入遗漏仅提示、不扣效率；完整但错误的一次提交增加一次retries；同一失败结果未修改再次提交不重复扣分。

## 6. 评分、存档与解锁

新增三种步骤初始化时各计一次objTotal，首次成功时各加一次objDone。失败不能next，不能触发finish或写progress；第6章的next/finish增加仅对chapter===6生效的完成状态保护。完成后调用现有评分与结果页面，不另设第二套金币或星级。

本章不新增quiz步骤，quizTotal=0，沿用quizRate默认1；这15%在本章是默认分，不把它伪装成独立答题测评。效率仍按max(0,1-retries*0.1)计算。普通关质量70/Boss质量80是玩法通过门槛，不是最终星数分数线。

复用finish中现有目标完成度逻辑：成功完成本章时目标为1，最终分数至少75（60+0+15），因此本章当前机制只会出现两星或三星；这是保留评分约束的明确结果，本次不为制造一星修改全局算法。

在index.js注册第6章，地图按注册表自动显示。前章六关均有progress后6-1解锁，之后逐关解锁；只复用现有存档事实，不重算历史通关。无需修改存档结构，保留原键和历史数据。新增第6章仅在合法成功结束时写入进度。

注意：现有finish无条件调用clearLevel，现有解锁按progress是否存在而非星数判断；本次通过第6章局部完成守卫防止新玩法失败解锁，不顺带修复其他章节。

## 7. 文件范围

新增业务文件仅customer.js、chapter6.js；测试新增customer.test.js和chapter6.test.js。修改level.js、level.wxml、level.wxss（仅必要样式）及config/levels/index.js。地图、结果页、手册、全局评分和存档结构预计不改。

像素风沿用panel/option/blank-row/btn-primary等现有样式，只补事实区域、复盘区、指标区必要样式。不生成图片或新页面。

## 8. 验收

1. Node语法检查覆盖所有小程序及测试JS；既有profit.test.js必须保持29/29通过。
2. 引擎测试覆盖推荐Boss、阈值等号、超预算、不合规、响应超时、未解决、满意度夹取、零分母、非法计数、未知ID及入参不变。
3. 配置检查覆盖六关ID、三种step类型、案例/选项ID唯一、所有字段与解释齐全、推荐解可达、新增文案不使用真实平台名。
4. 模拟Page/wx/setData验证初始化、数组整体更新、缺选、错误重试、成功锁定、连续点击不重复计分、失败不存档与顺序解锁；不把Node测试称作真机/WXML编译验证。
5. 微信开发者工具：使用独立测试存档，先备份重要本地进度，再清缓存→清除全部缓存→编译；验证六关全流程、复盘、地图、返回重进、存档恢复和第1～5章关键路径。遇到空白先查Console第一条红错。
6. 清全部缓存可能删除存档；只在测试数据上执行，不自动清用户存档。未运行的工具端验证明确记录为待验收。

## 9. 自检结论

教学响应时限和授权政策均标为模拟；满意度的两种定义分开；金额统一整数分；服务指标明确分母；合规硬约束不能被分数抵消；推荐Boss预算有确定可行解；失败不得写进度；不改旧章玩法。库存引擎中的安全库存口径、旧动态setData路径等已知旧问题不在本次修复范围。
