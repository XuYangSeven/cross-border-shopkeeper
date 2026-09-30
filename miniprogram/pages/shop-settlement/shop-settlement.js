// 7 日经营结算：结果 + 决策评分 + 任务锁定 + 能力证据写入
const state = require('../../engine/state');
const shopEngine = require('../../engine/shop');
const tasksEngine = require('../../engine/tasks');
const view = require('../../engine/shop-view');

Page({
  data: {
    settlement: null, tasks: [], taskSummary: {},
    mode: 'save', practiceOnly: false, saved: false,
    decisionRows: [], evidenceRows: [], redlines: [], hasRedline: false,
    reward: { coins: 0, exp: 0 }, empty: false,
  },
  onShow() { this.refresh(); },
  refresh() {
    const shop = state.getShopState();
    const simulation = shop.weekSimulation;
    let settlement = null;
    if (simulation) {
      settlement = shopEngine.calculateWeekSettlement(simulation, shop);
    } else if (shop.lastSettlement) {
      settlement = shop.lastSettlement;
    }
    if (!settlement) {
      this.setData({ empty: true });
      return;
    }
    const tasks = tasksEngine.evaluateTasks(shop.weeklyTasks, settlement, shop);
    const taskSummary = tasksEngine.summarize(tasks, settlement);
    const decisionRows = view.buildDecisionRows(settlement.decision);
    const evidence = shopEngine.buildSettlementEvidence(shop, settlement);
    const redlines = shopEngine.findRedlines(settlement);

    this.setData({
      settlement,
      tasks,
      taskSummary,
      mode: shop.mode,
      practiceOnly: shop.mode === 'practice',
      decisionRows,
      redlines,
      hasRedline: redlines.length > 0,
      reward: taskSummary.reward,
      empty: false,
      evidenceRows: [
        { k: '写入能力维度', v: (evidence.dimensions || []).length ? evidence.dimensions.join('、') : '无（各维度均未达 55 分）' },
        { k: '知识广度（≥60 分的维度占比）', v: `${Math.round(evidence.knowledge * 100)}%` },
        { k: '决策迁移（综合决策分）', v: `${Math.round(evidence.transfer * 100)} 分` },
        { k: '复盘质量（≥75 分的维度占比）', v: `${Math.round(evidence.reflection * 100)}%` },
        { k: '资金安全度', v: `${Math.round(evidence.efficiency * 100)}%` },
        { k: '合规问题', v: evidence.complianceErrors ? `${evidence.complianceErrors} 项（评分封顶 60）` : '无' },
      ],
    });
    this.settlement = settlement;
  },
  onSave() {
    if (this.data.saved || !this.settlement) return;
    if (this.data.practiceOnly) {
      state.saveShopSettlement(this.settlement);
      this.setData({ saved: true });
      wx.showToast({ title: '已生成练习预览', icon: 'success' });
      return;
    }
    state.saveShopSettlement(this.settlement);
    this.setData({ saved: true });
    wx.showModal({
      title: '本周已锁定',
      content: `奖励 ${this.data.reward.coins} 金币 / ${this.data.reward.exp} 经验已到账，决策已计入能力证据。要开新的一周请回店铺重置本周。`,
      showCancel: false,
      confirmText: '知道了',
      success: () => wx.switchTab({ url: '/pages/shop/shop' }),
    });
  },
  onBack() { wx.switchTab({ url: '/pages/shop/shop' }); },
});
