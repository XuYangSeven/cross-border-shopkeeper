const state = require('../../engine/state');
Page({
  data: { ads: {}, estimate: null },
  onShow() { this.setData({ ads: state.getShopState().ads }); },
  onBudget(e) { this.setData({ 'ads.dailyBudget': Number(e.detail.value) || 0 }); },
  onBid(e) { this.setData({ 'ads.bid': Number(e.detail.value) || 0 }); },
  onEstimate() {
    const ads = require('../../engine/ads');
    const result = ads.simulateCampaign({ budget: this.data.ads.dailyBudget * 7, priceUSD: state.getShopState().product.price, days: Array.from({ length: 7 }, () => ({ budget: this.data.ads.dailyBudget, bid: this.data.ads.bid, ctr: 0.03, cvr: 0.05 })) });
    this.setData({ estimate: result });
  },
  onStartWeek() {
    const shop = state.getShopState();
    state.startShopWeek({ ads: { ...this.data.ads, enabled: true }, finance: { ...shop.finance }, weekConfig: { ctr: 0.03, cvr: 0.05, quality: 1 } });
    wx.navigateTo({ url: '/pages/shop-simulation/shop-simulation' });
  },
  onBack() { wx.navigateBack(); },
});
