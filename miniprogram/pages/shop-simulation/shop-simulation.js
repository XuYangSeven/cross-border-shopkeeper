const state = require('../../engine/state');
const shopEngine = require('../../engine/shop');

Page({
  data: { day: 0, snapshot: null, simulation: null, done: false },
  onShow() { this.refresh(); },
  refresh() {
    const shop = state.getShopState();
    const config = shop.weekConfig || { ctr: 0.03, cvr: 0.05, quality: 1 };
    const simulation = this.data.simulation || shop.weekSimulation || shopEngine.createSimulationState(shop, config);
    this.setData({ day: simulation.day, simulation, done: simulation.day >= 7 });
  },
  onNextDay() {
    const shop = state.getShopState();
    const simulation = this.data.simulation || shopEngine.createSimulationState(shop, shop.weekConfig || { ctr: 0.03, cvr: 0.05, quality: 1 });
    const result = shopEngine.simulateDay(simulation);
    this.setData({ simulation: result.simulation, day: result.simulation.day, snapshot: result.snapshot || null, done: result.done });
    state.updateShopState({ week: { day: result.simulation.day, active: !result.done }, weekSimulation: result.simulation, inventory: { ...shop.inventory, available: result.simulation.inventory.available, inTransit: result.simulation.inventory.inTransit }, finance: { ...shop.finance, cash: result.simulation.finance.cash } }, 'simulate_day');
    if (result.done) wx.navigateTo({ url: '/pages/shop-settlement/shop-settlement' });
  },
  onBack() { wx.navigateBack(); },
});
