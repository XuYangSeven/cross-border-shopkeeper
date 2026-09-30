// 新手引导页：小程序启动后的第一屏，介绍玩法，点「开始」进入关卡地图。
// 约束：只读存档（用于展示进度与切换按钮文案），不写任何状态；跳转用 switchTab（map 是 tabBar 页）。
const state = require('../../engine/state');
const levels = require('../../config/levels/index');
const cards = require('../../config/cards');
const learning = require('../../engine/learning');
const { definePage } = require('../../utils/pageGuard');

const LEVEL_TOTAL = levels.chapters.reduce((sum, ch) => sum + (ch.levels || []).length, 0);
const CARD_TOTAL = Object.keys(cards || {}).length;
const DIM_TOTAL = (learning.DIMENSIONS || []).length;

const FEATURES = [
  {
    no: '01',
    title: '关卡闯关',
    stat: `${LEVEL_TOTAL} 关`,
    desc: '8 大章节，从选品、上架、广告到物流、客服、资金，每关一个真实运营决策，做完立刻知道对错和原因。',
  },
  {
    no: '02',
    title: '店铺经营沙盘',
    stat: '12 行动点',
    desc: '用有限的行动点和现金做取舍，跑完 7 天经营再结算，亲眼看每个决策怎么变成利润、库存和口碑。',
  },
  {
    no: '03',
    title: '知识手册',
    stat: `${CARD_TOTAL} 张卡`,
    desc: '把运营概念、公式和面试问法整理成卡片，随闯关解锁，随时可以翻回来复习。',
  },
  {
    no: '04',
    title: '能力评估',
    stat: `${DIM_TOTAL} 个维度`,
    desc: '每一次决策和结算都会写进你的能力档案，清楚知道自己在哪一项强、哪一项还要补。',
  },
];

const FLOW = ['知道概念', '动手决策', '即时反馈', '复盘表达', '能力评估'];

definePage('intro', {
  data: {
    features: FEATURES,
    flow: FLOW,
    ctaText: '开始体验',
    hasProgress: false,
    cleared: 0,
    totalLevels: LEVEL_TOTAL,
    stars: 0,
  },
  onLoad() {
    this.refresh();
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    let cleared = 0;
    let stars = 0;
    try {
      const progress = (state.get() || {}).progress || {};
      levels.chapters.forEach(ch => {
        (ch.levels || []).forEach(lv => {
          const record = progress[lv.id];
          if (record) {
            cleared += 1;
            stars += Number(record.stars) || 0;
          }
        });
      });
    } catch (e) {
      cleared = 0;
      stars = 0;
    }
    this.setData({
      cleared,
      stars,
      hasProgress: cleared > 0,
      ctaText: cleared > 0 ? '继续学习' : '开始体验',
    });
  },
  onStart() {
    wx.switchTab({ url: '/pages/map/map' });
  },
});
