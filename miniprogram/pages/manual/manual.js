// 技能手册（知识卡片收藏 + 面试问法）
const cards = require('../../config/cards');
const state = require('../../engine/state');
const levels = require('../../config/levels/index');
const { definePage } = require('../../utils/pageGuard');

// 章节名以关卡注册表为单一来源：以前这里硬编码一份副本，
// 新增章节时手册页会显示成「第 N 章」而地图页显示真名，两边对不上。
const CHAPTER_NAME = levels.chapters.reduce((acc, ch) => {
  acc[ch.id] = ch.name;
  return acc;
}, {});

definePage('manual', {
  data: { groups: [], total: 0, collected: 0 },
  onShow() {
    const s = state.get();
    const owned = Array.isArray(s.cards) ? s.cards : [];
    const all = Object.values(cards);
    const byChapter = {};
    all.forEach(c => {
      (byChapter[c.chapter] = byChapter[c.chapter] || []).push({ ...c, owned: owned.includes(c.id) });
    });
    const groups = Object.keys(byChapter).sort((a, b) => Number(a) - Number(b)).map(ch => ({
      chapter: ch,
      name: CHAPTER_NAME[ch] || `第 ${ch} 章`,
      cards: byChapter[ch],
      ownedCount: byChapter[ch].filter(c => c.owned).length,
    }));
    this.setData({ groups, total: all.length, collected: owned.length });
  },
  onFlip(e) {
    const { ch, idx } = e.currentTarget.dataset;
    const key = `groups[${ch}].cards[${idx}].flip`;
    this.setData({ [key]: !this.data.groups[ch].cards[idx].flip });
  },
});
