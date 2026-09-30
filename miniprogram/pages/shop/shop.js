// 店铺总览：经营推演 + 本周任务 + 模块入口 + 结算趋势
// 设计要点：KPI 不再是静态种子，而是由 engine/shop.deriveKpis 依据「当前决策」实时推导，
// 并与上一周快照对比；所有子模块的操作共享同一份「行动点」预算，逼出取舍。

const levels = require('../../config/levels/index');
const state = require('../../engine/state');
const tasksEngine = require('../../engine/tasks');
const shopEngine = require('../../engine/shop');

// 指标定义：better 说明「变大」是好事还是坏事，用于着色
const KPI_DEFS = [
  { key: 'visitors', label: '周访客', unit: '', better: 'high' },
  { key: 'conversion', label: '转化率', unit: '%', better: 'high' },
  { key: 'sales', label: '周销售额', unit: '$', better: 'high' },
  { key: 'acos', label: 'ACOS', unit: '%', better: 'low' },
  { key: 'stockDays', label: '库存水位', unit: '天', better: 'high' },
  { key: 'rating', label: '店铺评分', unit: '', better: 'high' },
];

const MODULES = [
  { key: 'dashboard', name: '数据看板', chapter: 1, desc: '指标推演与决策评分' },
  { key: 'listing', name: 'Listing', chapter: 3, desc: '标题 / 主图 / 五点' },
  { key: 'ads', name: '广告', chapter: 4, desc: '预算 / 竞价 / 广告结构' },
  { key: 'inventory', name: '库存', chapter: 5, desc: '补货时点与运输方式' },
  { key: 'orders', name: '订单与客服', chapter: 6, desc: '工单 / 售后 / 评分' },
  { key: 'health', name: '店铺绩效', chapter: 6, desc: '服务与风控指标' },
];

function formatValue(def, value) {
  if (value === undefined || value === null) return '—';
  return `${def.unit === '$' ? '$' : ''}${value}${def.unit === '$' ? '' : def.unit}`;
}

function buildKpiTiles(kpis, snapshot) {
  return KPI_DEFS.map(def => {
    const value = kpis[def.key];
    const prev = snapshot ? snapshot[def.key] : undefined;
    let deltaText = '';
    let tone = 'flat';
    if (typeof value === 'number' && typeof prev === 'number' && Math.abs(value - prev) > 0.049) {
      const diff = Math.round((value - prev) * 10) / 10;
      const rising = diff > 0;
      const good = def.better === 'high' ? rising : !rising;
      tone = good ? 'up' : 'down';
      deltaText = `${rising ? '▲' : '▼'}${Math.abs(diff)}`;
    }
    return { key: def.key, label: def.label, value: formatValue(def, value), deltaText, tone };
  });
}

function moduleSummary(key, shop, kpis) {
  if (key === 'listing') return `标题 ${shop.listing.titleScore} · 主图 ${shop.listing.imageScore} · 五点 ${shop.listing.bulletScore}`;
  if (key === 'ads') {
    if (!shop.ads.enabled) return '广告未投放：本周没有付费流量';
    return `日预算 $${shop.ads.dailyBudget} · 竞价 $${shop.ads.bid} · 结构 ${shop.ads.structureScore}`;
  }
  if (key === 'inventory') return `可售 ${shop.inventory.available} 件 · 在途 ${shop.inventory.inTransit} 件 · 覆盖 ${kpis.stockDays} 天`;
  if (key === 'orders') return `解决率 ${shop.service.resolutionRate}% · 评分 ${shop.service.rating} · 待处理 ${shop.orders.pending} 单`;
  if (key === 'health') return `及时响应 ${shop.service.responseRate}% · 退款率 ${shop.orders.refundRate}%`;
  return `综合决策分 ${kpis.quality ? Math.round(kpis.quality * 100) : 0} 商品力 · 毛利率 ${kpis.margin}%`;
}

Page({
  data: {
    loaded: false,
    mode: 'save',
    kpiTiles: [],
    actionPoints: { total: 12, used: 0, remaining: 12 },
    pointPercent: 0,
    decisionHints: [],
    modules: [],
    unlocked: false,
    tasks: [],
    taskSummary: { completed: 0, total: 6 },
    weekActive: false,
    weekDay: 0,
    history: [],
    hasHistory: false,
    lastRating: '',
    lastDecisionScore: null,
    practiceHint: '',
  },

  onLoad() { this.refresh(); },
  onShow() { this.refresh(); },

  refresh() {
    const s = state.get();
    const shop = state.getShopState();
    const kpis = shopEngine.deriveKpis(shop);
    const modules = MODULES.map(module => ({
      ...module,
      unlocked: this.chapterCleared(module.chapter, s),
      summary: moduleSummary(module.key, shop, kpis),
    }));
    const tasks = tasksEngine
      .evaluateWeeklyTasks(shop.weeklyTasks, { shop }, 'realtime')
      .map(task => ({
        ...task,
        currentText: task.current === null ? '等待经营数据' : `${task.current}${task.unit}`,
        gapText: task.gap === null ? '—' : `${task.gap}${task.unit}`,
        expanded: (this.data.tasks || []).some(item => item.id === task.id && item.expanded),
      }));
    const taskSummary = tasksEngine.summarize(tasks);
    const last = shop.lastSettlement;
    const history = (shop.settlementHistory || []).slice(-6).map(row => ({
      ...row,
      barWidth: Math.max(4, Math.min(100, row.decisionScore || 0)),
      level: row.decisionLevel || '',
    }));

    this.setData({
      loaded: true,
      mode: shop.mode,
      kpiTiles: buildKpiTiles(kpis, shop.metrics),
      actionPoints: state.getShopActionPoints(),
      pointPercent: Math.round((state.getShopActionPoints().remaining / (state.getShopActionPoints().total || 1)) * 100),
      decisionHints: kpis.notes,
      modules,
      unlocked: modules.some(module => module.unlocked),
      tasks,
      taskSummary,
      weekActive: !!(shop.week && shop.week.active),
      weekDay: (shop.week && shop.week.day) || 0,
      history,
      hasHistory: history.length > 0,
      lastRating: last ? last.rating : '',
      lastDecisionScore: last && last.decision ? last.decision.score : null,
      practiceHint: shop.mode === 'practice' ? '练习模式：所有操作只在本机内存里试算，杀进程即还原，不写正式存档。' : '',
    });
  },

  chapterCleared(chapterId, s) {
    const chapter = levels.chapters.find(item => item.id === chapterId);
    return !!chapter && chapter.levels.every(level => s.progress[level.id]);
  },

  onToggleTask(e) {
    const id = e.currentTarget.dataset.id;
    const tasks = this.data.tasks.map(task => (task.id === id ? { ...task, expanded: !task.expanded } : task));
    this.setData({ tasks });
  },

  onHandleTask(e) {
    wx.navigateTo({ url: tasksEngine.getTaskTargetPage(e.currentTarget.dataset.id) });
  },

  onTapModule(e) {
    const key = e.currentTarget.dataset.key;
    const module = this.data.modules.find(item => item.key === key);
    if (!module) return;
    if (!module.unlocked) {
      wx.showToast({ title: `通关第 ${module.chapter} 章后解锁`, icon: 'none', duration: 2200 });
      return;
    }
    wx.navigateTo({ url: `/pages/shop-${key}/shop-${key}` });
  },

  onStartWeek() {
    if (this.data.weekActive) {
      wx.navigateTo({ url: '/pages/shop-simulation/shop-simulation' });
      return;
    }
    wx.showModal({
      title: '开始本周经营',
      content: `将按当前决策推演 7 天经营（行动点剩余 ${this.data.actionPoints.remaining} 点）。开始后仍可回到模块调整决策。`,
      confirmText: '开始',
      success: result => {
        if (!result.confirm) return;
        state.startShopWeek({});
        wx.navigateTo({ url: '/pages/shop-simulation/shop-simulation' });
      },
    });
  },

  onOpenSettlement() {
    wx.navigateTo({ url: '/pages/shop-settlement/shop-settlement' });
  },

  onModeChange(e) {
    const mode = e.detail.value === '1' ? 'practice' : 'save';
    if (mode === this.data.mode) return;
    state.setShopMode(mode);
    this.refresh();
    wx.showToast({ title: mode === 'save' ? '已开启正式存档' : '已开启练习模式', icon: 'none' });
  },

  onResetWeek() {
    wx.showModal({
      title: '重置本周经营',
      content: '将把商品、广告、库存、客服与行动点全部还原到初始状态，只保留已完成的经营周记录。章节进度与星级不受影响。',
      confirmText: '重置',
      confirmColor: '#A84A42',
      success: result => {
        if (result.confirm) { state.resetShopWeek(); this.refresh(); wx.showToast({ title: '已重置本周', icon: 'success' }); }
      },
    });
  },
});
