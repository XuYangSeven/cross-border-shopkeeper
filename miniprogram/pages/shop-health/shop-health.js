const state = require('../../engine/state');
Page({ data: { service: {}, metrics: {} }, onShow() { const shop = state.getShopState(); this.setData({ service: shop.service, metrics: shop.metrics }); }, onBack() { wx.navigateBack(); } });
