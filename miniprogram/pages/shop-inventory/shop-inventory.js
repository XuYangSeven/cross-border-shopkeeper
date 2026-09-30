// 库存实操：按「日需求 × 交期」决定补货时点与运输方式
const state = require('../../engine/state');
const shopEngine = require('../../engine/shop');
const view = require('../../engine/shop-view');
const { definePage } = require('../../utils/pageGuard');

function shipmentRows(shipments) {
  return (shipments || []).map(item => ({
    label: `${item.freightName} ${item.units} 件`,
    detail: `第 ${item.arrivalDay} 天到仓 · 运费 ¥${item.costCNY}`,
    onTime: Number(item.arrivalDay) <= 7,
  }));
}

definePage('shop-inventory', {
  data: {
    shop: {}, kpis: {}, kpiTiles: [], actions: [],
    points: { total: 12, used: 0, remaining: 12 }, pointPercent: 0,
    shipments: [], hasShipment: false, projection: null, riskText: '', riskTone: 'ok',
  },
  onShow() { this.refresh(); },
  refresh() {
    const shop = state.getShopState();
    const kpis = shopEngine.deriveKpis(shop);
    const points = state.getShopActionPoints();
    const projection = shopEngine.simulateWeek(shop, { days: 7 }).settlement;
    const shipments = shipmentRows((shop.inventory || {}).shipments);

    let riskText = '按当前需求与在途到仓节奏，本周不会断货。';
    let riskTone = 'ok';
    if (projection.stockoutDays > 0) {
      riskTone = 'warn';
      riskText = `按当前决策推演，本周会断货 ${projection.stockoutDays} 天，预计丢单 ${projection.lostOrders} 笔。`;
    } else if (kpis.stockoutRisk > 0.4) {
      riskTone = 'mid';
      riskText = `本周能撑住，但库存只够 ${kpis.stockDays} 天，下周有断货风险。`;
    }

    this.setData({
      shop,
      kpis,
      kpiTiles: view.buildKpiTiles(kpis, shop.metrics),
      actions: view.buildActionRows(shop, 'inventory'),
      points,
      pointPercent: Math.round(points.remaining / (points.total || 1) * 100),
      shipments,
      hasShipment: shipments.length > 0,
      projection,
      riskText,
      riskTone,
    });
  },
  onAct(e) {
    const result = state.applyShopAction(e.currentTarget.dataset.id);
    if (!result.ok) {
      wx.showToast({ title: result.reason, icon: 'none', duration: 2400 });
      this.refresh();
      return;
    }
    wx.showToast({ title: result.shipmentNote || '补货已下单', icon: 'none', duration: 2600 });
    this.refresh();
  },
  onBack() { wx.navigateBack(); },
});
