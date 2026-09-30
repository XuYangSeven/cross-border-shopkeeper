// 订单与客服：解决率与店铺评分是两个独立指标，要分别用不同动作去抬
const state = require('../../engine/state');
const shopEngine = require('../../engine/shop');
const view = require('../../engine/shop-view');

Page({
  data: {
    shop: {}, kpis: {}, kpiTiles: [], actions: [],
    points: { total: 12, used: 0, remaining: 12 }, pointPercent: 0,
    gaps: [], scoreTone: 'warn',
  },
  onShow() { this.refresh(); },
  refresh() {
    const shop = state.getShopState();
    const kpis = shopEngine.deriveKpis(shop);
    const points = state.getShopActionPoints();
    const service = shop.service || {};
    const gaps = [];
    if (Number(service.resolutionRate) < 90) gaps.push(`解决率距 90% 任务线还差 ${Math.round((90 - service.resolutionRate) * 10) / 10} 个百分点，用「加急处理工单」每次 +4。`);
    if (Number(service.rating) < 4.3) gaps.push(`店铺评分距 4.3 任务线还差 ${Math.round((4.3 - service.rating) * 100) / 100}，售后回访 +0.06 / 次，话术培训 +0.04 / 次。`);
    if (Number((shop.orders || {}).refundRate) > 3) gaps.push(`退款率 ${shop.orders.refundRate}% 偏高，售后补偿能同时压退款率与抬评分。`);
    if (!gaps.length) gaps.push('服务两项指标都已越过任务线，剩下的行动点建议投到流量或库存。');

    this.setData({
      shop,
      kpis,
      kpiTiles: view.buildKpiTiles(kpis, shop.metrics),
      actions: view.buildActionRows(shop, 'orders'),
      points,
      pointPercent: Math.round(points.remaining / (points.total || 1) * 100),
      gaps,
      scoreTone: Number(service.rating) >= 4.3 && Number(service.resolutionRate) >= 90 ? 'ok' : 'warn',
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
