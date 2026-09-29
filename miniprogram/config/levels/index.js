// 关卡注册表（汇总各章）
module.exports = {
  chapters: [
    { id: 1, name: '入职培训', levels: require('./chapter1') },
    { id: 2, name: '选品实战', levels: require('./chapter2') },
    { id: 3, name: '上架优化', levels: require('./chapter3') },
    { id: 4, name: '广告投放', levels: require('./chapter4') },
    { id: 5, name: '物流与库存', levels: require('./chapter5') },
    { id: 6, name: '客服与售后', levels: require('./chapter6') },
    { id: 7, name: '数据分析与运营复盘', levels: require('./chapter7') },
    { id: 8, name: '资金与经营决策', levels: require('./chapter8') },
  ],
};
