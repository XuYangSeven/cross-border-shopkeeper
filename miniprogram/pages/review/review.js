// 错题与复盘页：按关卡 / 题型查看错题，关联知识卡，可再练一次
const state = require('../../engine/state');
const levels = require('../../config/levels/index');

const TYPE_LABEL = {
  quiz: '选择题',
  transfer: '迁移题',
  reflection: '结构化复述',
  calc: '计算题',
  profitCalc: '利润核算',
  profitDemo: '利润演示',
  diagnose: '店铺诊断',
  skuFilter: '情报卡初筛',
  radarScore: '五维打分',
  moduleTour: '后台模块',
  formulaPuzzle: '公式拼装',
  titlePuzzle: '标题拼装',
  keywordLayout: '关键词布局',
  imageTest: '主图测试',
  listingBoss: 'Listing 实操',
  adMetric: '广告指标',
  adBoss: '广告实操',
  freightCalc: '运费核算',
  inventoryBoss: '库存实操',
  customerCase: '客服案例',
  customerBoss: '客服实操',
  analyticsClassify: '数据归类',
  funnelCalc: '漏斗计算',
  reviewReport: '运营复盘',
  cashFlowCalc: '资金盘点',
  financeCalc: '利润计算',
  financeBoss: '经营方案',
  negotiate: '供应商谈判',
  transportChoice: '运输方式选择',
  purchaseChoice: '采购决策',
  pricingChoice: '定价决策',
  riskChoice: '风险处理',
};

// 1-10 应排在 1-2 之后：先比章节号，再比关号（避免字符串排序把 1-10 排到 1-2 前）
function compareLevelId(a, b) {
  const [ca, na] = String(a).split('-').map(Number);
  const [cb, nb] = String(b).split('-').map(Number);
  const safeCa = Number.isFinite(ca) ? ca : 9999;
  const safeCb = Number.isFinite(cb) ? cb : 9999;
  if (safeCa !== safeCb) return safeCa - safeCb;
  const safeNa = Number.isFinite(na) ? na : 9999;
  const safeNb = Number.isFinite(nb) ? nb : 9999;
  return safeNa - safeNb;
}

function findLevel(id) {
  for (const ch of levels.chapters) {
    const lv = ch.levels.find(l => l.id === id);
    if (lv) return lv;
  }
  return null;
}

Page({
  data: {
    groups: [],
    total: 0,
    filterLevel: '',
    filterText: '全部关卡',
    empty: true,
  },
  onLoad(query) {
    const raw = typeof query.level === 'string' ? query.level.trim() : '';
    const valid = raw && !!findLevel(raw);
    this.setData({ filterLevel: valid ? raw : '' });
    this.refresh();
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const levelId = this.data.filterLevel;
    const all = state.getMistakes();
    const rows = levelId ? all.filter(item => item.levelId === levelId) : all;

    const byLevel = {};
    rows.forEach((item, i) => {
      const key = item.levelId || '未知关卡';
      const group = byLevel[key] = byLevel[key] || [];
      group.push({
        ...item,
        typeLabel: TYPE_LABEL[item.stepType] || '其他题型',
        key: `${item.levelId}-${item.stepIndex}-${item.stepType}-${item.at}-${i}`,
        expanded: false,
      });
    });

    const groups = Object.keys(byLevel).sort(compareLevelId).map(id => {
      const lv = findLevel(id);
      return {
        levelId: id,
        levelName: lv ? lv.name : id,
        items: byLevel[id].slice().reverse(),
      };
    });

    const filterLevel = this.data.filterLevel;
    const current = filterLevel ? findLevel(filterLevel) : null;
    this.setData({
      groups,
      total: rows.length,
      empty: rows.length === 0,
      filterText: current ? `${filterLevel} ${current.name}` : '全部关卡',
    });
  },
  // 默认折叠，点开才看解析，避免长页面
  onToggleItem(e) {
    const key = e.currentTarget.dataset.key;
    const groups = this.data.groups.map(g => ({
      ...g,
      items: g.items.map(item => item.key === key ? { ...item, expanded: !item.expanded } : item),
    }));
    this.setData({ groups });
  },
  onShowAll() {
    this.setData({ filterLevel: '' }, () => this.refresh());
  },
  onPractice(e) {
    const levelId = e.currentTarget.dataset.level;
    if (!levelId || !findLevel(levelId)) return;
    wx.navigateTo({ url: `/pages/level/level?id=${levelId}` });
  },
  onClear() {
    if (this.data.empty) return;
    const levelId = this.data.filterLevel;
    wx.showModal({
      title: '清除错题',
      content: levelId ? `清除 ${levelId} 的错题记录？此操作不可撤销。` : '清除全部错题记录？此操作不可撤销。',
      confirmText: '清除',
      confirmColor: '#C62828',
      success: r => {
        if (!r.confirm) return;
        state.clearMistakes(levelId || undefined);
        this.refresh();
        wx.showToast({ title: '已清除', icon: 'success' });
      },
    });
  },
  onBack() {
    wx.navigateBack();
  },
});
