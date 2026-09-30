// 广告实操：预算 / 竞价 / 广告结构三个抓手，直接影响付费流量与 ACOS
const state = require('../../engine/state');
const shopEngine = require('../../engine/shop');
const view = require('../../engine/shop-view');
const { definePage } = require('../../utils/pageGuard');

definePage('shop-ads', {
  data: {
    shop: {}, kpis: {}, kpiTiles: [], actions: [],
    points: { total: 12, used: 0, remaining: 12 }, pointPercent: 0,
    acosTone: '', acosHint: '',
  },
  onShow() { this.refresh(); },
  refresh() {
    const shop = state.getShopState();
    const kpis = shopEngine.deriveKpis(shop);
    const points = state.getShopActionPoints();
    let acosTone = 'ok';
    let acosHint = 'ACOS 在健康区间（≤30%），可以考虑逐步放量。';
    if (!shop.ads.enabled) { acosTone = 'warn'; acosHint = '广告未投放：本周不会产生付费流量，也不算完成「广告效率」任务。'; }
    else if (kpis.acos > 45) { acosTone = 'warn'; acosHint = 'ACOS 严重超标，先下调预算或竞价止血，再谈放量。'; }
    else if (kpis.acos > 35) { acosTone = 'warn'; acosHint = 'ACOS 高于 35% 的任务线，降预算或降竞价都能改善。'; }
    else if (kpis.acos > 30) { acosTone = 'mid'; acosHint = 'ACOS 已过任务线，继续压到 30% 以内会更稳。'; }

    this.setData({
      shop,
      kpis,
      kpiTiles: view.buildKpiTiles(kpis, shop.metrics),
      actions: view.buildActionRows(shop, 'ads'),
      points,
      pointPercent: Math.round(points.remaining / (points.total || 1) * 100),
      acosTone,
      acosHint,
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
