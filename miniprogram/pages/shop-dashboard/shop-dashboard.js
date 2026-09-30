// 数据看板：把「指标 → 成本结构 → 决策评分」串成一条解释链
const state = require('../../engine/state');
const shopEngine = require('../../engine/shop');
const view = require('../../engine/shop-view');
const { definePage } = require('../../utils/pageGuard');

definePage('shop-dashboard', {
  data: {
    shop: {}, kpis: {}, kpiTiles: [], actions: [],
    points: { total: 12, used: 0, remaining: 12 }, pointPercent: 0,
    decision: null, decisionRows: [], history: [], hasHistory: false,
  },
  onShow() { this.refresh(); },
  refresh() {
    const shop = state.getShopState();
    const kpis = shopEngine.deriveKpis(shop);
    const points = state.getShopActionPoints();
    const projection = shopEngine.simulateWeek(shop, { days: 7 }).settlement;
    const decision = projection.decision || shopEngine.scoreDecisions(shop, projection);
    const history = (shop.settlementHistory || []).slice(-6).map(row => ({
      ...row,
      barWidth: Math.max(4, Math.min(100, row.decisionScore || 0)),
    }));
    this.setData({
      shop,
      kpis,
      kpiTiles: view.buildKpiTiles(kpis, shop.metrics),
      actions: view.buildActionRows(shop, 'dashboard'),
      points,
      pointPercent: Math.round(points.remaining / (points.total || 1) * 100),
      decision,
      decisionRows: view.buildDecisionRows(decision),
      history,
      hasHistory: history.length > 0,
    });
  },
  onAct(e) {
    const result = state.applyShopAction(e.currentTarget.dataset.id);
    if (!result.ok) {
      wx.showToast({ title: result.reason, icon: 'none', duration: 2400 });
      this.refresh();
      return;
    }
    wx.showToast({ title: result.action.label, icon: 'none' });
    this.refresh();
  },
  onBack() { wx.navigateBack(); },
});
