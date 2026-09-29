// 技能手册（知识卡片收藏 + 面试问法）
const cards = require('../../config/cards');
const state = require('../../engine/state');

Page({
  data: { groups: [], total: 0, collected: 0 },
  onShow() {
    const s = state.get();
    const all = Object.values(cards);
    const byChapter = {};
    all.forEach(c => {
      (byChapter[c.chapter] = byChapter[c.chapter] || []).push({ ...c, owned: s.cards.includes(c.id) });
    });
    const groups = Object.keys(byChapter).sort().map(ch => ({
      chapter: ch,
      name: ch === '1' ? '入职培训' : ch === '2' ? '选品实战' : `第 ${ch} 章`,
      cards: byChapter[ch],
    }));
    this.setData({ groups, total: all.length, collected: s.cards.length });
  },
  onFlip(e) {
    const { ch, idx } = e.currentTarget.dataset;
    const key = `groups[${ch}].cards[${idx}].flip`;
    this.setData({ [key]: !this.data.groups[ch].cards[idx].flip });
  },
});
