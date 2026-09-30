// 店铺绩效：只读体检页 —— 红线检测 + 五维明细 + 分流到对应模块
const state = require('../../engine/state');
const shopEngine = require('../../engine/shop');
const view = require('../../engine/shop-view');
const { definePage } = require('../../utils/pageGuard');

// 每个决策维度对应哪个模块能改它
const DIM_MODULE = {
  product: { key: 'listing', name: 'Listing' },
  traffic: { key: 'ads', name: '广告' },
  stock: { key: 'inventory', name: '库存' },
  service: { key: 'orders', name: '订单与客服' },
  cash: { key: 'dashboard', name: '数据看板' },
};

definePage('shop-health', {
  data: {
    shop: {}, kpis: {}, kpiTiles: [],
    decision: null, rows: [], redlines: [], hasRedline: false,
    serviceRows: [], points: { total: 12, used: 0, remaining: 12 },
  },
  onShow() { this.refresh(); },
  refresh() {
    const shop = state.getShopState();
    const kpis = shopEngine.deriveKpis(shop);
    const projection = shopEngine.simulateWeek(shop, { days: 7 }).settlement;
    const decision = projection.decision || shopEngine.scoreDecisions(shop, projection);
    const redlines = shopEngine.findRedlines(projection);

    this.setData({
      shop,
      kpis,
      kpiTiles: view.buildKpiTiles(kpis, shop.metrics),
      decision,
      rows: view.buildDecisionRows(decision).map(row => ({ ...row, module: DIM_MODULE[row.key] || null })),
      redlines,
      hasRedline: redlines.length > 0,
      serviceRows: [
        { k: '订单解决率（任务线 90%）', v: `${shop.service.resolutionRate}%`, tone: shop.service.resolutionRate >= 90 ? 'ok' : 'warn' },
        { k: '及时响应率', v: `${shop.service.responseRate}%`, tone: shop.service.responseRate >= 90 ? 'ok' : 'warn' },
        { k: '店铺评分（任务线 4.3）', v: `${shop.service.rating}`, tone: shop.service.rating >= 4.3 ? 'ok' : 'warn' },
        { k: '退款率', v: `${shop.orders.refundRate}%`, tone: shop.orders.refundRate > 3 ? 'warn' : 'ok' },
        { k: '推演断货天数', v: `${projection.stockoutDays} 天`, tone: projection.stockoutDays > 0 ? 'warn' : 'ok' },
        { k: '推演期末现金', v: `¥${projection.endingCash}`, tone: projection.endingCash >= 3000 ? 'ok' : 'warn' },
      ],
      points: state.getShopActionPoints(),
    });
  },
  onGoto(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    wx.navigateTo({ url: `/pages/shop-${key}/shop-${key}` });
  },
  onBack() { wx.navigateBack(); },
});
