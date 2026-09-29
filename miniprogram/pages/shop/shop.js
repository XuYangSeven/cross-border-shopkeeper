const levels = require('../../config/levels/index');
const state = require('../../engine/state');
const tasksEngine = require('../../engine/tasks');

Page({
  data: {
    unlocked: false,
    metrics: {},
    actionCount: 0,
    mode: 'save',
    tasks: [],
    taskSummary: { completed: 0, total: 6 },
    modules: [
      { key: 'dashboard', name: '数据看板', chapter: 1 },
      { key: 'listing', name: 'Listing', chapter: 3 },
      { key: 'ads', name: '广告', chapter: 4 },
      { key: 'inventory', name: '库存', chapter: 5 },
      { key: 'orders', name: '订单', chapter: 6 },
      { key: 'health', name: '绩效', chapter: 6 },
    ],
  },
  onLoad() { this.refresh(); },
  onShow() { this.refresh(); },
  refresh() {
    const s = state.get();
    const shop = state.getShopState();
    const modules = this.data.modules.map(module => ({ ...module, unlocked: this.chapterCleared(module.chapter, s) }));
    const settlement = shop.lastSettlement;
    const tasks = tasksEngine.evaluateTasks(shop.weeklyTasks, settlement, shop);
    const taskSummary = tasksEngine.summarize(tasks, settlement);
    this.setData({ modules, unlocked: modules.some(module => module.unlocked), metrics: shop.metrics, actionCount: state.getShopActionLog().length, mode: shop.mode, tasks, taskSummary });
  },
  chapterCleared(chapterId, s) {
    const chapter = levels.chapters.find(item => item.id === chapterId);
    return !!chapter && chapter.levels.every(level => s.progress[level.id]);
  },
  onTapModule(e) {
    const key = e.currentTarget.dataset.key;
    const module = this.data.modules.find(item => item.key === key);
    if (!module || !module.unlocked) { wx.showToast({ title: `完成第${module.chapter}章后解锁`, icon: 'none' }); return; }
    wx.navigateTo({ url: `/pages/shop-${key}/shop-${key}` });
  },
  onModeChange(e) {
    const mode = e.detail.value === '1' ? 'practice' : 'save';
    state.setShopMode(mode);
    this.setData({ mode });
    wx.showToast({ title: mode === 'save' ? '已开启自动保存' : '已开启练习模式', icon: 'none' });
  },
  onResetWeek() {
    wx.showModal({ title: '重置本周经营', content: '只重置店铺实操数据，不影响章节进度和星级。', success: result => { if (result.confirm) { state.resetShopWeek(); this.refresh(); } } });
  },
});
