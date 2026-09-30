// Listing 实操：用有限行动点优化标题 / 主图 / 五点，直接影响自然流量与转化
const state = require('../../engine/state');
const shopEngine = require('../../engine/shop');
const view = require('../../engine/shop-view');
const { definePage } = require('../../utils/pageGuard');

definePage('shop-listing', {
  data: {
    shop: {}, kpis: {}, kpiTiles: [], actions: [],
    points: { total: 12, used: 0, remaining: 12 }, pointPercent: 0, quality: 0,
  },
  onShow() { this.refresh(); },
  refresh() {
    const shop = state.getShopState();
    const kpis = shopEngine.deriveKpis(shop);
    const points = state.getShopActionPoints();
    this.setData({
      shop,
      kpis,
      kpiTiles: view.buildKpiTiles(kpis, shop.metrics),
      actions: view.buildActionRows(shop, 'listing'),
      points,
      pointPercent: Math.round(points.remaining / (points.total || 1) * 100),
      quality: Math.round((kpis.quality || 0) * 100),
    });
  },
  onAct(e) {
    const result = state.applyShopAction(e.currentTarget.dataset.id);
    if (!result.ok) {
      wx.showToast({ title: result.reason, icon: 'none', duration: 2400 });
      this.refresh();
      return;
    }
    wx.showToast({ title: '已完成 1 项优化', icon: 'none' });
    this.refresh();
  },
  onBack() { wx.navigateBack(); },
});
