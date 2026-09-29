Page({
  data: { level: '', stars: 0, total: 0, coin: 0, cards: [] },
  onLoad(q) {
    const cards = require('../../config/cards');
    const stars = Number(q.stars);
    this.setData({
      level: q.level,
      stars,
      total: q.total,
      coin: q.coin,
      starsText: stars >= 1 ? '★★★'.slice(0, stars) + '☆☆☆'.slice(stars) : '☆☆☆',
      cards: (q.cards || '').split(',').filter(Boolean).map(id => cards[id]),
    });
  },
  onBackMap() {
    wx.switchTab({ url: '/pages/map/map' });
  },
  onRetry() {
    wx.redirectTo({ url: `/pages/level/level?id=${this.data.level}` });
  },
});
