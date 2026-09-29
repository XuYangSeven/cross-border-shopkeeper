const state = require('../../engine/state');
Page({ data: { shop: {} }, onShow() { this.setData({ shop: state.getShopState() }); }, onBack() { wx.navigateBack(); } });
