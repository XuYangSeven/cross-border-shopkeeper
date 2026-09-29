// 我的：等级/金币/成就/设置
const state = require('../../engine/state');
const CONSTANTS = require('../../config/constants');

Page({
  data: { coins: 0, exp: 0, stars: 0, title: '', nextTitle: '' },
  onShow() {
    const s = state.get();
    const stars = Object.values(s.progress).reduce((a, p) => a + p.stars, 0);
    const lv = Math.max(1, Math.floor(s.exp / 50) + 1);
    const t = [...CONSTANTS.LEVEL_TITLES].reverse().find(x => lv >= x.lv);
    const next = CONSTANTS.LEVEL_TITLES.find(x => x.lv > lv);
    this.setData({ coins: s.coins, exp: s.exp, stars, title: t.title, nextTitle: next ? next.title : '已满级' });
  },
  onReset() {
    wx.showModal({
      title: '重置存档',
      content: '将清空全部进度、卡片与金币，确定？',
      success: (r) => {
        if (r.confirm) { state.reset(); this.onShow(); wx.showToast({ title: '已重置', icon: 'success' }); }
      },
    });
  },
});
