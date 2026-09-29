const levels = require('../../config/levels/index');
const state = require('../../engine/state');

Page({
  data: {
    chapters: [],
    totalStars: 0,
  },
  onLoad() {
    this.refresh();
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const s = state.get();
    const progress = s.progress || {};
    let totalStars = 0;
    const chapters = levels.chapters.map(ch => ({
      id: ch.id,
      name: ch.name,
      levels: ch.levels.map(lv => {
        const p = progress[lv.id];
        totalStars += p ? p.stars : 0;
        return {
          id: lv.id, name: lv.name, type: lv.type, goal: lv.goal,
          stars: p ? p.stars : 0, bestScore: p ? p.bestScore : 0,
          starsText: p ? '★★★'.slice(0, p.stars) + '☆☆☆'.slice(p.stars) : '☆☆☆',
          locked: !state.isLevelUnlocked(lv.id, levels),
        };
      }),
    }));
    this.setData({ chapters, totalStars });
  },
  onTapLevel(e) {
    const { id, locked } = e.currentTarget.dataset;
    if (locked) {
      wx.showToast({ title: '先通关前面的关卡', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/level/level?id=${id}` });
  },
});
