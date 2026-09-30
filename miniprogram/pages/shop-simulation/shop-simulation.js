// 7 日经营模拟：把本周决策跑成真实结果
// 语义：从「开始本周经营」那一刻起，决策被冻结；中途回模块改决策不影响已开跑的这一周。
const state = require('../../engine/state');
const shopEngine = require('../../engine/shop');
const view = require('../../engine/shop-view');

Page({
  data: {
    day: 0, totalDays: 7, done: false, simulation: null,
    snapshot: null, timeline: [], events: [], kpiTiles: [], running: false,
    frozenAt: '', hasShipment: false,
  },
  onLoad() { this.bootstrap(); },
  onShow() { this.refresh(); },

  bootstrap() {
    const shop = state.getShopState();
    if (!shop.weekSimulation) {
      // 首次进入：用当前决策生成模拟，并把它固定下来（决策冻结）
      const simulation = shopEngine.createSimulationState(shop, { days: 7 });
      state.updateShopState({ weekSimulation: simulation, week: { day: 0, active: true } }, 'simulate_start');
    }
    this.refresh();
  },

  refresh() {
    const shop = state.getShopState();
    const simulation = shop.weekSimulation || shopEngine.createSimulationState(shop, { days: 7 });
    const kpis = shopEngine.deriveKpis(shop);
    const shipments = ((shop.inventory || {}).shipments || []);
    const timeline = (simulation.snapshots || []).slice().reverse().map(item => ({
      ...item,
      stockTone: item.stockout ? 'warn' : '',
      label: `第 ${item.day} 天`,
    }));
    this.setData({
      day: simulation.day,
      totalDays: simulation.config.days,
      done: simulation.day >= simulation.config.days,
      simulation,
      snapshot: (simulation.snapshots || [])[simulation.snapshots.length - 1] || null,
      timeline,
      events: (simulation.events || []).slice().reverse(),
      kpiTiles: view.buildKpiTiles(kpis, shop.metrics),
      running: true,
      hasShipment: shipments.length > 0,
      frozenAt: shipments.length
        ? `已在途 ${shipments.map(item => `${item.freightName} ${item.units} 件（第 ${item.arrivalDay} 天到仓）`).join('、')}`
        : '',
    });
  },

  onNextDay() {
    const shop = state.getShopState();
    const simulation = shop.weekSimulation || shopEngine.createSimulationState(shop, { days: 7 });
    if (simulation.day >= simulation.config.days) return;
    const result = shopEngine.simulateDay(simulation);
    state.updateShopState({
      weekSimulation: result.simulation,
      week: { day: result.simulation.day, active: !result.done },
    }, 'simulate_day');
    this.refresh();
    if (result.done) {
      wx.showToast({ title: '7 天跑完，去看结算', icon: 'none' });
    }
  },

  onRunAll() {
    const shop = state.getShopState();
    let simulation = shop.weekSimulation || shopEngine.createSimulationState(shop, { days: 7 });
    while (simulation.day < simulation.config.days) simulation = shopEngine.simulateDay(simulation).simulation;
    state.updateShopState({ weekSimulation: simulation, week: { day: simulation.day, active: false } }, 'simulate_all');
    this.refresh();
  },

  onSettle() {
    wx.navigateTo({ url: '/pages/shop-settlement/shop-settlement' });
  },

  onBack() { wx.navigateBack(); },
});
