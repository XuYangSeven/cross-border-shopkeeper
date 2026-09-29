// 通用关卡流程渲染器：按 level.steps 顺序驱动
const levels = require('../../config/levels/index');
const skus = require('../../config/skus');
const cards = require('../../config/cards');
const profitEngine = require('../../engine/profit');
const scoring = require('../../engine/scoring');
const state = require('../../engine/state');
const CONSTANTS = require('../../config/constants');
const adsEngine = require('../../engine/ads');
const inventoryEngine = require('../../engine/inventory');
const customerEngine = require('../../engine/customer');
const analyticsEngine = require('../../engine/analytics');
const financeEngine = require('../../engine/finance');
const FBA_TIERS = require('../../config/fbaTiers');

function findLevel(id) {
  for (const ch of levels.chapters) {
    const lv = ch.levels.find(l => l.id === id);
    if (lv) return lv;
  }
  return null;
}

Page({
  data: {
    level: null,
    stepIndex: 0,
    // 当前步骤渲染数据
    view: null,
    // 答题统计
    quizTotal: 0, quizCorrect: 0,
    // 目标完成度累计（各交互步骤成功比例）
    objTotal: 0, objDone: 0,
    // 修改次数（效率分折算）
    retries: 0,
    collectedCards: [],
    scoreRows: [1, 2, 3, 4, 5],
    scoreColumns: [1, 2, 3, 4, 5],
  },

  onLoad(query) {
    const level = findLevel(query.id);
    if (!level) {
      wx.showToast({ title: '关卡不存在', icon: 'none' });
      setTimeout(() => wx.switchTab({ url: '/pages/map/map' }), 500);
      return;
    }
    wx.setNavigationBarTitle({ title: `${query.id} ${level.name}` });
    this.setData({ level }, () => this.renderStep());
  },

  // ===== 步骤渲染分发 =====
  renderStep() {
    const { level, stepIndex } = this.data;
    if (stepIndex >= level.steps.length) return this.finish();
    const step = level.steps[stepIndex];
    let view = { type: step.type };
    switch (step.type) {
      case 'dialog':
        view = { ...view, speaker: step.speaker, text: step.text };
        break;
      case 'card': {
        const card = cards[step.cardId];
        view = { ...view, card };
        state.collectCard(step.cardId);
        this.setData({ collectedCards: [...this.data.collectedCards, step.cardId] });
        break;
      }
      case 'quiz':
        view = { ...view, question: step.question, options: step.options, picked: null };
        this.setData({ quizTotal: this.data.quizTotal + 1 });
        break;
      case 'moduleTour':
        view = { ...view, modules: step.modules.map((key, i) => ({ key, name: ['数据看板', 'Listing', '广告', '库存', '订单', '绩效'][i] })), tapped: [], litMap: {} };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'formulaPuzzle':
        view = { ...view, slots: step.slots, placed: [], placedMap: {}, correctOrder: ['访客数', '转化率', '客单价'] };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'calc':
        view = { ...view, scenario: step.scenario, blanks: step.blanks.map(b => ({ ...b, input: '', ok: null })), done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'diagnose':
        view = { ...view, items: step.items.map((it, i) => ({ ...it, i, checked: false, rx: null })), phase: 'pick', currentRxItem: null, currentRxOptions: [] };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'skuFilter': {
        const list = step.skuIds.map(id => {
          const sku = skus.find(s => s.id === id);
          const screen = profitEngine.screenSKU(sku);
          return { id, nameZh: sku.nameZh, priceUSD: sku.priceUSD,
            monthlySearch: sku.monthlySearch, top10AvgReviews: sku.top10AvgReviews,
            weightKg: sku.weightKg, dimCm: sku.dimCm, dimText: sku.dimCm.join('×'), tags: sku.tags,
            hazmat: sku.hazmat, patentRisk: sku.patentRisk,
            seasonality: !!sku.seasonality, intro: sku.intro || '',
            verdict: null, reason: null,
            isCandidate: screen.pass };
        });
        view = { ...view, list, reasons: step.reasons, done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      }
      case 'profitDemo':
      case 'profitCalc': {
        const sku = skus.find(s => s.id === step.skuId);
        const r = profitEngine.calcProfit(sku);
        const fbaGuide = FBA_TIERS.map(t => `${t.name}：≤${t.maxWeightKg}kg / $${t.feeUSD}`).join('；');
        view = { ...view, sku, result: r, fbaGuide, trap: !!step.trap, trapExplain: step.trapExplain || '',
          // 6 项填空：采购/头程/仓配/佣金/退货+汇损/毛利率%
          blanks: [
            { label: '采购成本($)', answer: r.supplyUSD },
            { label: '头程运费($)', answer: r.freightUSD },
            { label: '仓配费用($)', answer: r.fbaFeeUSD },
            { label: '平台佣金($)', answer: r.commissionUSD },
            { label: '退货+汇损($)', answer: r.returnLossUSD + r.fxLossUSD },
            { label: '毛利率(%)', answer: Math.round(r.margin * 100) },
          ].map(b => ({ ...b, input: step.type === 'profitDemo' ? String(b.answer) : '', ok: null })) };
        if (step.type === 'profitCalc') this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      }
      case 'radarScore': {
        const list = step.skuIds.map(id => {
          const sku = skus.find(s => s.id === id);
          return { id, nameZh: sku.nameZh, expert: sku.expertScores,
            dims: { market: 3, competition: 3, profit: 3, logistics: 3, risk: 3 }, active: false };
        });
        const radarRows = [
          { label: '容量', key: 'market', cells: [1, 2, 3, 4, 5] },
          { label: '竞争', key: 'competition', cells: [1, 2, 3, 4, 5] },
          { label: '利润', key: 'profit', cells: [1, 2, 3, 4, 5] },
          { label: '物流', key: 'logistics', cells: [1, 2, 3, 4, 5] },
          { label: '风险', key: 'risk', cells: [1, 2, 3, 4, 5] },
        ];
        view = { ...view, list, rows: radarRows, weights: step.weights, activeIdx: -1, submited: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      }
      case 'titlePuzzle':
        view = { ...view, title: step.title, blocks: step.blocks.map(b => ({ ...b, used: false })), answer: step.answer, placed: [], placedText: '', done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'keywordPlacement':
        view = { ...view, keywords: step.keywords.map(k => ({ ...k, placed: null })), slots: step.slots.map(s => ({ ...s, items: [] })), answer: step.answer, done: false, score: 0, keywordSelected: null };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'imageABTest':
        view = { ...view, question: step.question, variants: step.variants, selected: null, answer: step.answer, done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'listingBoss':
        view = { ...view, titleOptions: step.titleOptions, keywordOptions: step.keywordOptions,
          imageOptions: step.imageOptions, complianceOptions: step.complianceOptions,
          picks: { title: null, keyword: null, image: null, compliance: null },
          passScore: step.passScore, score: 0, done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'negotiate':
        view = { ...view, factories: step.factories, chips: step.chips, usedChips: [], usedChipMap: {},
          chosen: null, sample: null, qty: null, done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'adMetricCalc':
        view = { ...view, scenario: step.scenario, blanks: step.blanks.map(b => ({ ...b, input: '', ok: null })), done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'searchTermSort':
        view = { ...view, mode: 'terms', list: step.terms.map(t => ({ ...t, picked: null })), done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'adPlacement':
      case 'launchStrategy':
        view = { ...view, options: (step.placements || step.options).map(o => ({ ...o, label: o.name || o.text })), selected: null, done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'keywordCampaign':
        view = { ...view, groups: step.groups.map(x => ({ ...x, selected: false })), matches: step.matches.map(x => ({ ...x, selected: false })), done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'bidBudgetSim':
        view = { ...view, ...step, budgetInput: String(step.budget), bidInput: String(step.bid), result: null, done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'negativeKeyword':
        view = { ...view, mode: 'negative', list: step.items.map(x => ({ ...x, picked: null })), done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'adBoss':
        view = { ...view, day: 1, total: { impressions: 0, clicks: 0, spend: 0, orders: 0, sales: 0 }, daily: [], dayBudget: '14', bidInput: '0.5', ctrInput: '0.06', cvrInput: '0.1', qualityInput: '1', done: false, passed: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'transportChoice':
        view = { ...view, options: step.options, selected: null, scenario: step.scenario, done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'freightCalc':
        view = { ...view, scenario: step.scenario, blanks: step.blanks.map(b => ({ ...b, input: '', ok: null })), done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'reorderCalc':
        view = { ...view, scenario: step.scenario, fields: step.fields.map(f => ({ ...f, input: '', ok: null })), done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'logisticsIncident':
        view = { ...view, incidents: step.incidents.map(i => ({ ...i, selected: null, result: null })), done: false };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'inventoryBoss':
        view = { ...view, options: step.options, selected: null, bossFields: [{ key: 'initialStock', label: '初始库存' }, { key: 'dailySales', label: '日销量' }, { key: 'shipmentUnits', label: '补货数量' }, { key: 'leadTimeDays', label: '交期天数' }, { key: 'safetyDays', label: '安全库存' }, { key: 'reorderPoint', label: '补货点' }], inputs: { initialStock: String(step.initialStock), dailySales: String(step.dailySales), shipmentUnits: String(step.shipmentUnits), leadTimeDays: String(step.leadTimeDays), safetyDays: String(step.safetyDays), reorderPoint: String(step.reorderPoint) }, budgetCNY: step.budgetCNY, days: step.days, done: false, passed: false, result: null };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'customerScenario':
      case 'customerBoss': {
        view = { ...view, scenario: step.scenario, responseLimitHours: step.responseLimitHours, cases: step.cases.map(item => ({ ...item, selected: null, result: null, options: item.options.map(option => ({ ...option, picked: false })) })), targets: step.targets || null, reviewPrompt: step.reviewPrompt, done: false, result: null };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      }
      case 'serviceMetrics': {
        const stats = step.stats;
        const statsText = `本周报表：需回复工单 ${stats.ticketCount}，及时回复 ${stats.timelyCount}；总工单 ${stats.ticketCount}，已解决 ${stats.resolvedCount}；统计订单 ${stats.orderCount}，退款订单 ${stats.refundedOrderCount}；有效评价 ${stats.ratingCount}，满意评价 ${stats.satisfiedCount}。请根据分子 ÷ 分母 × 100% 计算。`;
        view = { ...view, scenario: step.scenario, stats, statsText, fields: step.fields.map(field => ({ ...field, input: '', ok: null })), tolerance: step.tolerancePercentagePoints, reviewPrompt: step.reviewPrompt, done: false, result: null };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      }
      case 'metricIdentify':
      case 'diagnoseChoice':
      case 'reviewBoss':
        view = { ...view, scenario: step.scenario, items: step.items.map(item => ({ ...item, selected: null, result: null })), targets: step.targets || null, reviewPrompt: step.reviewPrompt, done: false, result: null };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'funnelCalc':
        view = { ...view, scenario: step.scenario, data: step.data, fields: step.fields.map(field => ({ ...field, input: '', ok: null })), reviewPrompt: step.reviewPrompt, done: false, result: null };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'cashFlowCalc':
      case 'financeCalc':
      case 'financeBoss':
        view = { ...view, scenario: step.scenario, data: step.data, targets: step.targets || null, fields: step.fields.map(field => ({ ...field, input: '', ok: null })), reviewPrompt: step.reviewPrompt, done: false, result: null };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'pricingChoice':
      case 'purchaseChoice':
        view = { ...view, scenario: step.scenario, data: step.data || null, options: step.options.map(option => ({ ...option, selected: false })), targetMargin: step.targetMargin, reviewPrompt: step.reviewPrompt, done: false, result: null };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
      case 'riskChoice':
        view = { ...view, scenario: step.scenario, items: step.items.map(item => ({ ...item, selected: null, result: null })), reviewPrompt: step.reviewPrompt, done: false, result: null };
        this.setData({ objTotal: this.data.objTotal + 1 });
        break;
    }
    this.setData({ view });
  },

  next() {
    this.setData({ stepIndex: this.data.stepIndex + 1 }, () => this.renderStep());
  },

  // ===== quiz =====
  onPickOption(e) {
    const { view } = this.data;
    if (view.picked) return;
    const idx = Number(e.currentTarget.dataset.idx);
    const opt = view.options[idx];
    const correct = opt.correct ? this.data.quizCorrect + 1 : this.data.quizCorrect;
    this.setData({ 'view.picked': idx, 'view.explain': opt.explain, quizCorrect: correct });
    setTimeout(() => this.next(), 1400);
  },

  // ===== moduleTour =====
  onTapModule(e) {
    const { view } = this.data;
    if (view.tapped.includes(e.currentTarget.dataset.key)) return;
    const key = e.currentTarget.dataset.key;
    const tapped = [...view.tapped, key];
    const modules = view.modules.map(m => m.key === key ? { ...m, lit: true } : m);
    if (tapped.length === view.modules.length) {
      this.setData({ 'view.tapped': tapped, 'view.modules': modules, objDone: this.data.objDone + 1 });
      setTimeout(() => this.next(), 800);
    } else {
      this.setData({ 'view.tapped': tapped, 'view.modules': modules });
    }
  },

  // ===== formulaPuzzle =====
  onTapFormulaSlot(e) {
    const { view } = this.data;
    const name = e.currentTarget.dataset.name;
    if (view.placed.includes(name)) return;
    const placed = [...view.placed, name];
    const placedMap = { ...view.placedMap, [name]: true };
    const correct = view.correctOrder.every((n, i) => placed[i] === n);
    this.setData({ 'view.placed': placed, 'view.placedMap': placedMap });
    if (placed.length === 3) {
      if (correct) {
        this.setData({ objDone: this.data.objDone + 1 });
        setTimeout(() => this.next(), 1200);
      } else {
        wx.showToast({ title: '顺序不对，再想想：销售额=访客×转化×客单', icon: 'none' });
        setTimeout(() => this.setData({ 'view.placed': [], 'view.placedMap': {}, retries: this.data.retries + 1 }), 800);
      }
    }
  },

  // ===== calc 填空 =====
  onCalcInput(e) {
    const { idx } = e.currentTarget.dataset;
    this.setData({ [`view.blanks[${idx}].input`]: e.detail.value });
  },
  onCalcSubmit() {
    const { view } = this.data;
    let allOk = true;
    view.blanks.forEach((b, i) => {
      const ok = Math.abs(Number(b.input) - b.answer) <= Math.abs(b.answer) * 0.02;
      if (!ok) allOk = false;
      this.setData({ [`view.blanks[${i}].ok`]: ok });
    });
    if (allOk) {
      this.setData({ 'view.done': true, objDone: this.data.objDone + 1 });
    } else {
      this.setData({ retries: this.data.retries + 1 });
      wx.showToast({ title: '有偏差，检查一下（允许±2%）', icon: 'none' });
    }
  },

  // ===== diagnose =====
  onToggleCheck(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    this.setData({ [`view.items[${idx}].checked`]: !this.data.view.items[idx].checked });
  },
  onDiagnoseSubmit() {
    const { view } = this.data;
    const checked = view.items.filter(i => i.checked);
    if (checked.length !== 5) {
      wx.showToast({ title: `选了 ${checked.length} 项，需要勾满 5 项`, icon: 'none' });
      return;
    }
    let hit = 0;
    checked.forEach(i => { if (i.isProblem) hit++; });
    // 进入处方阶段
    const items = view.items.map(i => i.checked && i.isProblem ? i : i);
    const rxQueue = checked.filter(i => i.isProblem).map(i => i.i);
    const firstRx = view.items[rxQueue[0]];
    this.setData({ 'view.phase': 'rx', 'view.rxQueue': rxQueue, 'view.rxIdx': 0,
      'view.currentRxItem': firstRx, 'view.currentRxOptions': firstRx ? firstRx.prescriptions : [], diagHit: hit });
  },
  onPickRx(e) {
    const { view } = this.data;
    const { idx } = e.currentTarget.dataset;
    const qi = view.rxQueue[view.rxIdx];
    // #region debug-point A:rx-state
    wx.request({ url: 'http://127.0.0.1:7778/event', method: 'POST', data: { sessionId: 'diagnose-rx-click', runId: 'pre', hypothesisId: 'A', location: 'pages/level/level.js:onPickRx:before-rx', msg: '[DEBUG] 处方点击状态', data: { idx, rxIdx: view.rxIdx, queueLength: view.rxQueue && view.rxQueue.length, qi, itemCount: view.items && view.items.length } }, fail: () => {} });
    // #endregion
    const rx = view.items[qi].prescriptions[idx];
    const goodCount = (this.data.rxGood || 0) + (rx.good ? 1 : 0);
    // #region debug-point B:set-data-path
    wx.request({ url: 'http://127.0.0.1:7778/event', method: 'POST', data: { sessionId: 'diagnose-rx-click', runId: 'pre', hypothesisId: 'B', location: 'pages/level/level.js:onPickRx:before-setData', msg: '[DEBUG] 准备更新处方索引', data: { qi, idx, rxGood: goodCount, itemExists: !!view.items[qi], prescriptionCount: view.items[qi] && view.items[qi].prescriptions ? view.items[qi].prescriptions.length : null } }, fail: () => {} });
    // #endregion
    const updatedItems = view.items.map((item, itemIndex) => {
      if (itemIndex !== qi) return item;
      return { ...item, rx: idx };
    });
    this.setData({ rxGood: goodCount, 'view.items': updatedItems });
    if (view.rxIdx + 1 < view.rxQueue.length) {
      const nextItem = view.items[view.rxQueue[view.rxIdx + 1]];
      this.setData({ 'view.rxIdx': view.rxIdx + 1, 'view.currentRxItem': nextItem,
        'view.currentRxOptions': nextItem.prescriptions });
    } else {
      const score = (this.data.diagHit * 10 + goodCount * 10); // 50+50 满分100
      const objRate = Math.min(1, score / 70); // ≥70 通关线
      this.setData({ 'view.phase': 'done', 'view.finalScore': score, objDone: this.data.objDone + (score >= 70 ? 1 : 0) });
    }
  },

  // ===== skuFilter =====
  onVerdict(e) {
    const { idx, verdict } = e.currentTarget.dataset;
    const { view } = this.data;
    const item = view.list[idx];
    if (item.verdict) return;
    let reason = null;
    if (verdict === 'in' && item.isCandidate) reason = 'candidate';
    if (verdict === 'out') {
      // 取第一个陷阱标签作为正确理由
      reason = item.tags.find(t => view.reasons[t]) || null;
    }
    const list = view.list.map((candidate, i) => i === Number(idx)
      ? { ...candidate, verdict, reason, reasonText: reason ? view.reasons[reason] : '' }
      : candidate);
    this.setData({ 'view.list': list });
  },
  onSkuFilterSubmit() {
    const { view } = this.data;
    const undone = view.list.some(i => !i.verdict);
    if (undone) { wx.showToast({ title: '还有商品未判定', icon: 'none' }); return; }
    let ok = 0;
    view.list.forEach(i => {
      const correct = i.isCandidate ? i.verdict === 'in' : i.verdict === 'out';
      if (correct) ok++;
    });
    const rate = ok / view.list.length;
    if (rate >= 0.8) {
      this.setData({ 'view.done': true, objDone: this.data.objDone + 1 });
    } else {
      wx.showToast({ title: `正确率 ${Math.round(rate * 100)}%，需 ≥80%，回顾卡片再来`, icon: 'none' });
      setTimeout(() => this.next(), 1600); // 不过关也放行进入卡片回顾（软失败）
    }
  },

  // ===== profit 填空 =====
  onProfitInput(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const blanks = this.data.view.blanks.map((blank, i) => i === idx ? { ...blank, input: e.detail.value } : blank);
    this.setData({ 'view.blanks': blanks });
  },
  onProfitSubmit() {
    const { view } = this.data;
    let allOk = true;
    const blanks = view.blanks.map((b, i) => {
      // 毛利率行（最后一行）允许 ±3 个百分点，其余金额项允许 ±3%（且至少 0.06）
      const isLast = i === view.blanks.length - 1;
      const ok = isLast
        ? Math.abs(Number(b.input) - b.answer) <= 3
        : Math.abs(Number(b.input) - b.answer) <= Math.max(0.06, b.answer * 0.03);
      if (!ok) allOk = false;
      return { ...b, ok };
    });
    if (allOk) {
      this.setData({ 'view.blanks': blanks, 'view.done': true, objDone: this.data.objDone + 1 });
      if (view.trap) {
        wx.showModal({ title: '体积重陷阱！', content: view.trapExplain, showCancel: false });
      }
    } else {
      this.setData({ 'view.blanks': blanks, retries: this.data.retries + 1 });
      wx.showToast({ title: '数字有偏差，可用页面顶部参考公式再核一遍', icon: 'none' });
    }
  },

  // ===== radarScore =====
  onRadarPick(e) {
    this.setData({ 'view.activeIdx': Number(e.currentTarget.dataset.idx) });
  },
  onRadarDim(e) {
    const { dim } = e.currentTarget.dataset;
    const idx = this.data.view.activeIdx;
    if (idx < 0) return;
    const val = Number(e.currentTarget.dataset.val);
    this.setData({ [`view.list[${idx}].dims.${dim}`]: val });
  },
  onRadarSubmit() {
    const { view } = this.data;
    // 与专家分对比：偏差≤1 为合格
    let total = 0, within = 0, count = 0;
    view.list.forEach(s => {
      Object.keys(s.dims).forEach(d => {
        count++;
        if (Math.abs(s.dims[d] - s.expert[d]) <= 1) within++;
      });
      total += profitEngine.weightedScore(s.dims, view.weights);
    });
    const rate = within / count;
    this.setData({ 'view.submited': true, 'view.totalScores': view.list.map((s, i) =>
      ({ nameZh: s.nameZh, mine: profitEngine.weightedScore(s.dims, view.weights), expert: profitEngine.weightedScore(s.expert, view.weights) })) });
    if (rate >= 0.6) this.setData({ objDone: this.data.objDone + 1 });
    setTimeout(() => this.next(), 2600);
  },

  // ===== 第3章：Listing玩法 =====
  onTitleBlock(e) {
    const id = e.currentTarget.dataset.id;
    const view = this.data.view;
    const block = view.blocks.find(b => b.id === id);
    if (!block || block.used) return;
    const placed = [...view.placed, block];
    const blocks = view.blocks.map(b => b.id === id ? { ...b, used: true } : b);
    const placedText = placed.map(b => b.text).join(' ');
    if (placed.length === view.answer.length) {
      const correct = placed.every((b, i) => b.id === view.answer[i]);
      if (correct) {
        this.setData({ 'view.blocks': blocks, 'view.placed': placed, 'view.placedText': placedText, 'view.done': true, objDone: this.data.objDone + 1 });
      } else {
        wx.showToast({ title: '顺序或词块不对，请重试', icon: 'none' });
        setTimeout(() => this.setData({ 'view.blocks': view.blocks.map(b => ({ ...b, used: false })), 'view.placed': [], 'view.placedText': '', retries: this.data.retries + 1 }), 600);
      }
    } else {
      this.setData({ 'view.blocks': blocks, 'view.placed': placed, 'view.placedText': placedText });
    }
  },
  onKeywordPick(e) {
    this.setData({ 'keywordSelected': e.currentTarget.dataset.key });
  },
  onKeywordPlace(e) {
    const key = this.data.keywordSelected;
    if (!key) return;
    const slotKey = e.currentTarget.dataset.slot;
    const view = this.data.view;
    const keyword = view.keywords.find(k => k.key === key);
    const slot = view.slots.find(s => s.key === slotKey);
    if (!keyword || keyword.placed || !slot || slot.items.length >= slot.limit) return;
    const keywords = view.keywords.map(k => k.key === key ? { ...k, placed: slotKey } : k);
    const slots = view.slots.map(s => s.key === slotKey ? { ...s, items: [...s.items, keyword] } : s);
    this.setData({ 'view.keywords': keywords, 'view.slots': slots, keywordSelected: null });
  },
  onKeywordRemove(e) {
    const key = e.currentTarget.dataset.key;
    const view = this.data.view;
    const keyword = view.keywords.find(k => k.key === key);
    if (!keyword || !keyword.placed) return;
    const keywords = view.keywords.map(k => k.key === key ? { ...k, placed: null } : k);
    const slots = view.slots.map(s => ({ ...s, items: s.items.filter(item => item.key !== key) }));
    this.setData({ 'view.keywords': keywords, 'view.slots': slots, keywordSelected: key });
  },
  onKeywordSubmit() {
    const view = this.data.view;
    let score = 0;
    view.slots.forEach(s => s.items.forEach(item => {
      if (view.answer[s.key] && view.answer[s.key].includes(item.key)) score += item.points;
    }));
    const valid = view.keywords.filter(k => k.placed && view.answer[k.placed] && view.answer[k.placed].includes(k.key));
    const required = Object.values(view.answer).reduce((n, a) => n + a.length, 0);
    if (valid.length === required && score >= 80) {
      this.setData({ 'view.score': score, 'view.done': true, objDone: this.data.objDone + 1 });
    } else {
      this.setData({ 'view.score': score, retries: this.data.retries + 1 });
      wx.showToast({ title: `覆盖 ${valid.length}/${required}，请调整位置`, icon: 'none' });
    }
  },
  onImagePick(e) {
    this.setData({ 'view.selected': e.currentTarget.dataset.id });
  },
  onImageSubmit() {
    const view = this.data.view;
    if (!view.selected) { wx.showToast({ title: '请选择一个方案', icon: 'none' }); return; }
    const selected = view.variants.find(v => v.id === view.selected);
    const good = selected.id === view.answer && selected.ctr > view.variants[0].ctr;
    this.setData({ 'view.done': true, 'view.good': good, objDone: this.data.objDone + (good ? 1 : 0) });
  },
  onBossPick(e) {
    const kind = e.currentTarget.dataset.kind;
    const id = e.currentTarget.dataset.id;
    this.setData({ [`view.picks.${kind}`]: id });
  },
  onBossSubmit() {
    const view = this.data.view;
    const picks = view.picks;
    if (!picks.title || !picks.keyword || !picks.image || !picks.compliance) {
      wx.showToast({ title: '四项都要完成选择', icon: 'none' }); return;
    }
    const groups = [view.titleOptions, view.keywordOptions, view.imageOptions, view.complianceOptions];
    const keys = ['title', 'keyword', 'image', 'compliance'];
    const score = groups.reduce((total, list, i) => total + (list.find(o => o.id === picks[keys[i]])?.score || 0), 0);
    const valid = keys.every(k => {
      const list = view[`${k}Options`];
      return list.find(o => o.id === picks[k]).valid;
    });
    const passed = valid && score >= view.passScore;
    if (passed) {
      this.setData({ 'view.score': score, 'view.done': true, objDone: this.data.objDone + 1 });
    } else {
      this.setData({ 'view.score': score, retries: this.data.retries + 1 });
      wx.showToast({ title: `当前 ${score} 分，需达到 ${view.passScore} 分且合规`, icon: 'none' });
    }
  },

  // ===== negotiate =====
  onPickFactory(e) {
    this.setData({ 'view.chosen': Number(e.currentTarget.dataset.idx) });
  },
  onUseChip(e) {
    const { view } = this.data;
    const idx = Number(e.currentTarget.dataset.idx);
    if (view.usedChips.includes(idx) || view.chosen === null) return;
    this.setData({ 'view.usedChips': [...view.usedChips, idx], [`view.usedChipMap[${idx}]`]: true });
  },
  onNegotiateOpt(e) {
    const { k, v } = e.currentTarget.dataset;
    this.setData({ [`view.${k}`]: v });
  },
  onNegotiateSubmit() {
    const { view } = this.data;
    if (view.chosen === null || view.sample === null || view.qty === null) {
      wx.showToast({ title: '先完成三项决策', icon: 'none' }); return;
    }
    const f = view.factories[view.chosen];
    const discount = view.usedChips.reduce((s, i) => s + [0.04, 0.03, 0.05][i], 0);
    const finalPrice = Math.round(f.basePriceCNY * (1 - discount) * 10) / 10;
    // 最优组合：中型工厂(2)+打样+300件；或达任意2项指标
    const costOk = finalPrice <= 16, qualityOk = f.quality >= 85, leadOk = f.leadDays <= 25;
    const hits = [costOk, qualityOk, leadOk, view.sample === 1, view.qty === 300].filter(Boolean).length;
    const good = hits >= 4;
    this.setData({ 'view.done': true, 'view.finalPrice': finalPrice, 'view.good': good,
      objDone: this.data.objDone + (good ? 1 : 0) });
  },

  onAdInput(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    if (key.indexOf('blanks[') === 0) {
      const match = key.match(/^blanks\[(\d+)\]\.input$/);
      if (!match) return;
      const idx = Number(match[1]);
      const blanks = this.data.view.blanks.map((blank, i) => i === idx ? { ...blank, input: value, ok: null } : blank);
      this.setData({ 'view.blanks': blanks });
      return;
    }
    this.setData({ [`view.${key}`]: value });
  },
  onAdMetricSubmit() {
    const blanks = this.data.view.blanks.map(b => ({
      ...b,
      ok: Math.abs(Number(b.input) - b.answer) <= Math.max(0.01, Math.abs(b.answer) * 0.03),
    }));
    const ok = blanks.every(b => b.ok);
    this.setData({ 'view.blanks': blanks, 'view.done': ok });
    if (ok) this.setData({ objDone: this.data.objDone + 1 });
    else wx.showToast({ title: '请检查指标计算', icon: 'none' });
  },
  onAdTermPick(e) {
    const i = Number(e.currentTarget.dataset.idx);
    const list = this.data.view.list.map((item, index) => index === i ? { ...item, picked: e.currentTarget.dataset.kind } : item);
    this.setData({ 'view.list': list });
  },
  onAdTermSubmit() {
    const ok = this.data.view.list.every(x => x.picked === x.kind);
    this.setData({ 'view.done': ok });
    if (ok) this.setData({ objDone: this.data.objDone + 1 });
    else wx.showToast({ title: '分类仍有错误', icon: 'none' });
  },
  onAdCategoryPick(e) {
    const i = Number(e.currentTarget.dataset.idx);
    const list = this.data.view.list.map((item, index) => index === i ? { ...item, picked: e.currentTarget.dataset.kind } : item);
    this.setData({ 'view.list': list });
  },
  onAdCategorySubmit() {
    const ok = this.data.view.list.every(x => x.picked === x.kind);
    this.setData({ 'view.done': ok });
    if (ok) this.setData({ objDone: this.data.objDone + 1 });
    else wx.showToast({ title: '分类仍有错误', icon: 'none' });
  },
  onAdOptionPick(e) { this.setData({ 'view.selected': e.currentTarget.dataset.id }); },
  onAdOptionSubmit() { const v = this.data.view; const o = v.options.find(x => x.id === v.selected); if (o && o.valid) this.setData({ 'view.done': true, objDone: this.data.objDone + 1 }); else wx.showToast({ title: '再比较一下投放目标', icon: 'none' }); },
  onAdGroupPick(e) { const kind = e.currentTarget.dataset.kind; const idx = Number(e.currentTarget.dataset.idx); this.setData({ [`view.${kind}[${idx}].selected`]: !this.data.view[kind][idx].selected }); },
  onAdGroupSubmit() { const v = this.data.view; const goodGroup = v.groups.some(x => x.selected && x.valid) && v.matches.some(x => x.selected && x.valid); if (goodGroup) this.setData({ 'view.done': true, objDone: this.data.objDone + 1 }); else wx.showToast({ title: '至少选择有效词组和匹配方式', icon: 'none' }); },
  onBidSubmit() { const v = this.data.view; const result = adsEngine.simulateDay({ budget: Number(v.budgetInput), bid: Number(v.bidInput), ctr: v.ctr, cvr: v.cvr, placementMultiplier: v.placementMultiplier, quality: v.quality, priceUSD: v.priceUSD }); const good = Number(v.budgetInput) <= 100 && result.orders >= 1; this.setData({ 'view.result': result, 'view.done': good }); if (good) this.setData({ objDone: this.data.objDone + 1 }); },
  onNegativePick(e) { const i = Number(e.currentTarget.dataset.idx); this.setData({ [`view.items[${i}].picked`]: e.currentTarget.dataset.kind }); },
  onNegativeSubmit() { const ok = this.data.view.items.every(x => x.picked === x.kind); this.setData({ 'view.done': ok }); if (ok) this.setData({ objDone: this.data.objDone + 1 }); else wx.showToast({ title: '检查否定词与核心词分类', icon: 'none' }); },
  onTransportPick(e) { this.setData({ 'view.selected': e.currentTarget.dataset.id }); },
  onTransportSubmit() {
    const v = this.data.view; const o = v.options.find(x => x.id === v.selected);
    if (o && o.valid) this.setData({ 'view.done': true, objDone: this.data.objDone + 1 }); else wx.showToast({ title: o ? o.reason : '请选择运输方式', icon: 'none' });
  },
  onFreightInput(e) { const idx = Number(e.currentTarget.dataset.idx); const blanks = this.data.view.blanks.map((b, i) => i === idx ? { ...b, input: e.detail.value } : b); this.setData({ 'view.blanks': blanks }); },
  onFreightSubmit() {
    const blanks = this.data.view.blanks; const updated = blanks.map(b => ({ ...b, ok: Math.abs(Number(b.input) - b.answer) <= Math.max(1, b.answer * 0.02) }));
    const ok = updated.every(b => b.ok); this.setData({ 'view.blanks': updated, 'view.done': ok }); if (ok) this.setData({ objDone: this.data.objDone + 1 }); else wx.showToast({ title: '成本计算有误，请检查重量×单价', icon: 'none' });
  },
  onReorderInput(e) { const idx = Number(e.currentTarget.dataset.idx); const fields = this.data.view.fields.map((f, i) => i === idx ? { ...f, input: e.detail.value } : f); this.setData({ 'view.fields': fields }); },
  onReorderSubmit() {
    const fields = this.data.view.fields; const values = {}; fields.forEach(f => { values[f.key] = Number(f.input); });
    const updated = fields.map(f => ({ ...f, ok: Math.abs(Number(f.input) - f.answer) <= 0.01 })); const ok = updated.every(f => f.ok) && values.reorderPoint === inventoryEngine.calculateReorderPoint(values);
    this.setData({ 'view.fields': updated, 'view.done': ok }); if (ok) this.setData({ objDone: this.data.objDone + 1 }); else wx.showToast({ title: '补货点应为日销量×（交期+安全天数）', icon: 'none' });
  },
  onIncidentPick(e) { const ii = Number(e.currentTarget.dataset.incident); const oi = Number(e.currentTarget.dataset.option); const incidents = this.data.view.incidents.map((item, i) => i === ii ? { ...item, selected: oi } : item); this.setData({ 'view.incidents': incidents }); },
  onIncidentSubmit() {
    const incidents = this.data.view.incidents; if (incidents.some(i => i.selected === null)) { wx.showToast({ title: '请处理全部物流异常', icon: 'none' }); return; }
    const updated = incidents.map(i => ({ ...i, result: !!i.options[i.selected].valid })); const ok = updated.every(i => i.result); this.setData({ 'view.incidents': updated, 'view.done': ok }); if (ok) this.setData({ objDone: this.data.objDone + 1 }); else wx.showToast({ title: '有异常应对不合理，请复盘后重试', icon: 'none' });
  },
  onBossInput(e) { const key = e.currentTarget.dataset.key; const inputs = { ...this.data.view.inputs, [key]: e.detail.value }; this.setData({ 'view.inputs': inputs }); },
  onInventoryBossSubmit() {
    const v = this.data.view; const option = v.options.find(x => x.id === v.selected); if (!option) { wx.showToast({ title: '请选择运输方式', icon: 'none' }); return; }
    const i = v.inputs; const reorderPoint = Number(i.reorderPoint); const result = inventoryEngine.simulateInventory({ days: v.days, initialStock: Number(i.initialStock), dailySales: Number(i.dailySales), shipmentUnits: Number(i.shipmentUnits), leadTimeDays: Number(i.leadTimeDays), reorderPoint });
    const shipment = inventoryEngine.calculateShipment({ units: Number(i.shipmentUnits), weightKg: 0.5, freightKey: option.freightKey }); result.logisticsCost = shipment.costCNY; result.totalCost = Math.round((result.holdingCost + result.stockoutCost + result.logisticsCost) * 100) / 100;
    const budgetOk = result.logisticsCost <= v.budgetCNY; const passed = option.valid && result.stockoutDays === 0 && result.endingStock >= Number(i.safetyDays) && budgetOk;
    this.setData({ 'view.result': result, 'view.passed': passed, 'view.done': passed }); if (passed) this.setData({ objDone: this.data.objDone + 1 }); else wx.showToast({ title: `未通过：${result.stockoutDays ? '有断货' : result.endingStock < Number(i.safetyDays) ? '期末库存低于安全库存' : !budgetOk ? '物流成本超预算' : '运输方式不合理'}`, icon: 'none' });
  },
  onAdBossSubmitDay() {
    const v = this.data.view; const result = adsEngine.simulateDay({ budget: Number(v.dayBudget), bid: Number(v.bidInput), ctr: Number(v.ctrInput), cvr: Number(v.cvrInput), quality: Number(v.qualityInput), priceUSD: 30 });
    const total = { impressions: v.total.impressions + result.impressions, clicks: v.total.clicks + result.clicks, spend: v.total.spend + result.spend, orders: v.total.orders + result.orders, sales: v.total.sales + result.sales };
    const daily = [...v.daily, result];
    if (v.day < 7) this.setData({ 'view.day': v.day + 1, 'view.total': total, 'view.daily': daily });
    else { const m = adsEngine.calcMetrics({ ...total, priceUSD: 30 }); const passed = total.spend <= 100 && m.acos <= 0.3 && total.orders / Math.max(1, total.orders + 3) >= 0.4 && total.orders > 0; this.setData({ 'view.total': total, 'view.daily': daily, 'view.metrics': m, 'view.passed': passed, 'view.done': passed }); if (passed) this.setData({ objDone: this.data.objDone + 1 }); }
  },

  // ===== 第6章：客服与售后 =====
  onCustomerPick(e) {
    const caseIndex = Number(e.currentTarget.dataset.case);
    const optionIndex = Number(e.currentTarget.dataset.option);
    const view = this.data.view;
    if (view.done || !view.cases[caseIndex]) return;
    const cases = view.cases.map((item, index) => {
      if (index !== caseIndex) return item;
      const options = item.options.map((option, index2) => ({ ...option, picked: index2 === optionIndex }));
      return { ...item, selected: item.options[optionIndex].id, options, result: null };
    });
    this.setData({ 'view.cases': cases, 'view.result': null });
  },
  onCustomerSubmit() {
    const view = this.data.view;
    if (view.done) return;
    if (view.cases.some(item => !item.selected)) {
      wx.showToast({ title: '请先处理全部工单', icon: 'none' });
      return;
    }
    const selections = {};
    view.cases.forEach(item => { selections[item.id] = item.selected; });
    let result;
    try {
      result = view.type === 'customerBoss'
        ? customerEngine.evaluateCustomerBoss({ cases: view.cases, selections, responseLimitHours: view.responseLimitHours, targets: view.targets })
        : customerEngine.summarizeCustomerCases({ cases: view.cases, selections, responseLimitHours: view.responseLimitHours });
    } catch (error) {
      wx.showToast({ title: error.message || '方案无法计算', icon: 'none' });
      return;
    }
    const cases = view.cases.map(item => ({ ...item, result: result.results.find(row => row.caseId === item.id) || null }));
    const passed = view.type === 'customerBoss'
      ? result.passed
      : result.compliant && result.qualityScore >= 70;
    if (passed) {
      this.setData({ 'view.cases': cases, 'view.result': result, 'view.done': true, objDone: this.data.objDone + 1 });
    } else {
      this.setData({ 'view.cases': cases, 'view.result': result, retries: this.data.retries + 1 });
      wx.showToast({ title: '方案未达标，请根据复盘调整', icon: 'none' });
    }
  },
  onMetricInput(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const fields = this.data.view.fields.map((field, index) => index === idx ? { ...field, input: e.detail.value, ok: null } : field);
    this.setData({ 'view.fields': fields, 'view.result': null });
  },
  onMetricSubmit() {
    const view = this.data.view;
    if (view.done) return;
    if (view.fields.some(field => field.input === '')) {
      wx.showToast({ title: '请完成全部指标', icon: 'none' });
      return;
    }
    const values = {};
    view.fields.forEach(field => { values[field.key] = Number(field.input); });
    const metrics = customerEngine.calculateServiceMetrics(view.stats);
    const updated = view.fields.map(field => {
      const actual = metrics[field.key] === null ? null : metrics[field.key] * 100;
      return { ...field, ok: actual !== null && Math.abs(actual - values[field.key]) <= view.tolerance };
    });
    const ok = updated.every(field => field.ok);
    if (ok) {
      this.setData({ 'view.fields': updated, 'view.result': metrics, 'view.done': true, objDone: this.data.objDone + 1 });
    } else {
      this.setData({ 'view.fields': updated, 'view.result': metrics, retries: this.data.retries + 1 });
      wx.showToast({ title: '指标有误，请检查分子和分母', icon: 'none' });
    }
  },

  // ===== 第7章：数据分析与运营复盘 =====
  onAnalyticsPick(e) {
    const itemIndex = Number(e.currentTarget.dataset.item);
    const optionId = e.currentTarget.dataset.option;
    const view = this.data.view;
    if (view.done || !view.items[itemIndex]) return;
    const items = view.items.map((item, index) => index === itemIndex ? { ...item, selected: optionId, result: null } : item);
    this.setData({ 'view.items': items, 'view.result': null });
  },
  onAnalyticsInput(e) {
    const index = Number(e.currentTarget.dataset.idx);
    const fields = this.data.view.fields.map((field, i) => i === index ? { ...field, input: e.detail.value, ok: null } : field);
    this.setData({ 'view.fields': fields, 'view.result': null });
  },
  onFunnelSubmit() {
    const view = this.data.view;
    if (view.done) return;
    if (view.fields.some(field => field.input === '')) { wx.showToast({ title: '请完成全部指标', icon: 'none' }); return; }
    const result = analyticsEngine.calculateFunnel(view.data);
    const updated = view.fields.map(field => ({ ...field, ok: Math.abs(Number(field.input) - result[field.key]) <= (field.key === 'averageOrderValue' ? 0.05 : 0.1) }));
    const ok = updated.every(field => field.ok);
    if (ok) this.setData({ 'view.fields': updated, 'view.result': result, 'view.done': true, objDone: this.data.objDone + 1 });
    else { this.setData({ 'view.fields': updated, 'view.result': result, retries: this.data.retries + 1 }); wx.showToast({ title: '指标计算有误，请检查分子和分母', icon: 'none' }); }
  },
  onAnalyticsSubmit() {
    const view = this.data.view;
    if (view.done) return;
    if (view.type === 'metricIdentify') {
      const valid = view.items.filter(item => item.selected === item.answer).length;
      const passed = valid === view.items.length;
      const items = view.items.map(item => ({ ...item, result: item.selected === item.answer }));
      if (passed) this.setData({ 'view.items': items, 'view.result': { validCount: valid, total: view.items.length }, 'view.done': true, objDone: this.data.objDone + 1 });
      else { this.setData({ 'view.items': items, 'view.result': { validCount: valid, total: view.items.length }, retries: this.data.retries + 1 }); wx.showToast({ title: `正确 ${valid}/${view.items.length}，请重新归类`, icon: 'none' }); }
      return;
    }
    const selections = {};
    view.items.forEach(item => { selections[item.id] = item.selected; });
    let result;
    try {
      result = analyticsEngine.evaluateReview({ selections, items: view.items, targets: view.targets || { minValidCount: view.items.length } });
    } catch (error) { wx.showToast({ title: error.message || '请完成全部选择', icon: 'none' }); return; }
    const items = view.items.map(item => ({ ...item, result: result.results.find(row => row.itemId === item.id) || null }));
    if (result.passed) this.setData({ 'view.items': items, 'view.result': result, 'view.done': true, objDone: this.data.objDone + 1 });
    else { this.setData({ 'view.items': items, 'view.result': result, retries: this.data.retries + 1 }); wx.showToast({ title: `当前 ${result.validCount}/${result.total}，请复盘后调整`, icon: 'none' }); }
  },

  // ===== 第8章：资金与经营决策 =====
  onFinanceInput(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const fields = this.data.view.fields.map((field, i) => i === idx ? { ...field, input: e.detail.value, ok: null } : field);
    this.setData({ 'view.fields': fields, 'view.result': null });
  },
  onFinanceOptionPick(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const options = this.data.view.options.map((option, i) => ({ ...option, selected: i === idx }));
    this.setData({ 'view.options': options, 'view.result': null });
  },
  onRiskPick(e) {
    const itemIndex = Number(e.currentTarget.dataset.item);
    const optionId = e.currentTarget.dataset.option;
    const items = this.data.view.items.map((item, i) => i === itemIndex ? { ...item, selected: optionId, result: null } : item);
    this.setData({ 'view.items': items, 'view.result': null });
  },
  onCashFlowSubmit() {
    const view = this.data.view;
    if (view.fields.some(field => field.input === '')) { wx.showToast({ title: '请完成全部金额', icon: 'none' }); return; }
    const result = financeEngine.calculateCashFlow(view.data);
    const updated = view.fields.map(field => ({ ...field, ok: Math.abs(Number(field.input) - result[field.key]) <= view.tolerance }));
    this.setData({ 'view.fields': updated, 'view.result': result, 'view.done': updated.every(field => field.ok) });
    if (updated.every(field => field.ok)) this.setData({ objDone: this.data.objDone + 1 }); else { this.setData({ retries: this.data.retries + 1 }); wx.showToast({ title: '资金数据有误，请检查口径', icon: 'none' }); }
  },
  onFinanceCalcSubmit() {
    const view = this.data.view;
    if (view.fields.some(field => field.input === '')) { wx.showToast({ title: '请完成计算', icon: 'none' }); return; }
    const result = financeEngine.calculateBreakEvenPrice(view.data);
    const updated = view.fields.map(field => ({ ...field, ok: Math.abs(Number(field.input) - result[field.key]) <= view.tolerance }));
    this.setData({ 'view.fields': updated, 'view.result': result, 'view.done': updated.every(field => field.ok) });
    if (updated.every(field => field.ok)) this.setData({ objDone: this.data.objDone + 1 }); else { this.setData({ retries: this.data.retries + 1 }); wx.showToast({ title: '利润计算有误，请检查费用比例', icon: 'none' }); }
  },
  onPricingSubmit() {
    const view = this.data.view;
    const selected = view.options.find(option => option.selected);
    if (!selected) { wx.showToast({ title: '请选择价格方案', icon: 'none' }); return; }
    const result = financeEngine.evaluatePricingPlan({ ...selected, targetMargin: view.targetMargin });
    const passed = selected.valid && result.meetsTarget;
    this.setData({ 'view.result': result, 'view.done': passed });
    if (passed) this.setData({ objDone: this.data.objDone + 1 }); else { this.setData({ retries: this.data.retries + 1 }); wx.showToast({ title: '该方案未达到利润安全线', icon: 'none' }); }
  },
  onPurchaseSubmit() {
    const view = this.data.view;
    const selected = view.options.find(option => option.selected);
    if (!selected) { wx.showToast({ title: '请选择采购方案', icon: 'none' }); return; }
    const result = financeEngine.evaluatePurchasePlan({ ...selected, ...view.data });
    this.setData({ 'view.result': result, 'view.done': result.valid });
    if (result.valid) this.setData({ objDone: this.data.objDone + 1 }); else { this.setData({ retries: this.data.retries + 1 }); wx.showToast({ title: '采购方案会造成现金或库存风险', icon: 'none' }); }
  },
  onRiskSubmit() {
    const view = this.data.view;
    if (view.items.some(item => !item.selected)) { wx.showToast({ title: '请处理全部经营风险', icon: 'none' }); return; }
    const items = view.items.map(item => ({ ...item, result: item.options.find(option => option.id === item.selected) }));
    const passed = items.every(item => item.result.valid);
    this.setData({ 'view.items': items, 'view.result': { validCount: items.filter(item => item.result.valid).length, total: items.length }, 'view.done': passed });
    if (passed) this.setData({ objDone: this.data.objDone + 1 }); else { this.setData({ retries: this.data.retries + 1 }); wx.showToast({ title: '风险优先级需要调整', icon: 'none' }); }
  },
  onFinanceBossSubmit() {
    const view = this.data.view;
    if (view.fields.some(field => field.input === '')) { wx.showToast({ title: '请完成经营方案', icon: 'none' }); return; }
    const values = {};
    view.fields.forEach(field => { values[field.key] = Number(field.input); });
    const result = financeEngine.evaluateFinanceBoss({ ...view.data, ...values, margin: values.margin / 100, targets: view.targets });
    const updated = view.fields.map(field => ({ ...field, ok: true }));
    this.setData({ 'view.fields': updated, 'view.result': result, 'view.done': result.passed });
    if (result.passed) this.setData({ objDone: this.data.objDone + 1 }); else { this.setData({ retries: this.data.retries + 1 }); wx.showToast({ title: result.failures.join('、'), icon: 'none' }); }
  },

  // ===== 结算 =====
  finish() {
    const { level } = this.data;
    const quizRate = this.data.quizTotal ? this.data.quizCorrect / this.data.quizTotal : 1;
    const objRate = this.data.objTotal ? this.data.objDone / this.data.objTotal : 1;
    const efficiency = Math.max(0, 1 - this.data.retries * 0.1);
    const passLine = (level.passScore || 70) / 100;
    const objective = objRate >= passLine ? Math.min(1, objRate + 0.05) : objRate;
    const r = scoring.score(objective, efficiency, quizRate);
    state.clearLevel(level.id, r.stars, r.total);
    wx.redirectTo({
      url: `/pages/result/result?level=${level.id}&stars=${r.stars}&total=${r.total}&coin=${r.coin}&cards=${this.data.collectedCards.join(',')}`,
    });
  },
});
