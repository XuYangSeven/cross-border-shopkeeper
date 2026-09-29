const state = require('../../engine/state');
const shopEngine = require('../../engine/shop');
const tasksEngine = require('../../engine/tasks');
Page({ data: { settlement: {}, tasks: [], taskSummary: {} }, onShow() { const shop = state.getShopState(); const simulation = shop.weekSimulation; if (!simulation) { wx.navigateBack(); return; } const settlement = shopEngine.calculateWeekSettlement(simulation); const tasks = tasksEngine.evaluateTasks(shop.weeklyTasks, settlement, shop); const taskSummary = tasksEngine.summarize(tasks, settlement); this.setData({ settlement, tasks, taskSummary }); this.settlement = settlement; }, onSave() { state.saveShopSettlement(this.settlement); wx.showToast({ title: '结算已保存', icon: 'success' }); }, onBack() { wx.switchTab({ url: '/pages/shop/shop' }); } });
