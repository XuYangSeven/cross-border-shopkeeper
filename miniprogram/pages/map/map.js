const levels = require('../../config/levels/index');
const state = require('../../engine/state');
const audio = require('../../engine/audio');
const { definePage } = require('../../utils/pageGuard');

// 会话内记住上一次看到的「已解锁关卡」集合，用于检测刚刚新解锁的关卡并播放 unlock 音。
// 首帧只建立基线、不发声；离开关卡回到本页时命中差异才发声。
let knownUnlockedIds = null;

// data-* 属性在部分场景会以字符串回传，'false' 是真值，必须显式判定
function toBool(value) {
  return value === true || value === 'true';
}

// 计算解锁条件文案：前置关名 / 上一章名
function unlockHint(levelId) {
  const [chNo, levelNo] = String(levelId).split('-').map(Number);
  const chapter = levels.chapters.find(c => c.id === chNo);
  if (!chapter) return '完成前置关卡后解锁';
  if (levelNo > 1) {
    const prev = chapter.levels[levelNo - 2];
    return prev ? `完成「${prev.id} ${prev.name}」后解锁` : '完成前置关卡后解锁';
  }
  const prevChapter = levels.chapters.find(c => c.id === chNo - 1);
  return prevChapter ? `通关第 ${prevChapter.id} 章「${prevChapter.name}」全部关卡后解锁` : '完成前置关卡后解锁';
}

definePage('map', {
  data: {
    chapters: [],
    totalStars: 0,
    resume: null,
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
    const unlockedIds = [];
    const chapters = levels.chapters.map(ch => {
      let cleared = 0;
      const items = ch.levels.map(lv => {
        const p = progress[lv.id];
        totalStars += p ? p.stars : 0;
        if (p) cleared += 1;
        const unlocked = state.isLevelUnlocked(lv.id, levels);
        if (unlocked) unlockedIds.push(lv.id);
        return {
          id: lv.id, name: lv.name, type: lv.type, goal: lv.goal,
          stars: p ? p.stars : 0, bestScore: p ? p.bestScore : 0,
          starsText: p ? '★★★'.slice(0, p.stars) + '☆☆☆'.slice(p.stars) : '☆☆☆',
          locked: !unlocked,
          lockedText: unlocked ? '' : unlockHint(lv.id),
        };
      });
      return {
        id: ch.id,
        name: ch.name,
        levels: items,
        cleared,
        levelCount: ch.levels.length,
        progressText: `${cleared}/${ch.levels.length} 关`,
      };
    });
    // 退出续学入口：仅当存在未完成的关卡进度
    const saved = state.getLearningProgress();
    const savedLevel = saved ? state.isLevelCleared(saved.levelId) : false;
    const resume = saved && !savedLevel && saved.stepIndex > 0
      ? { levelId: saved.levelId, levelName: saved.levelName || saved.levelId, stepNo: saved.stepIndex + 1, stepTotal: saved.stepTotal || 0 }
      : null;
    this.setData({ chapters, totalStars, resume });
    // 新解锁检测：本页刷新时若出现「上次没有的已解锁关卡」，说明刚通关解锁了新内容。
    if (knownUnlockedIds && unlockedIds.some(id => knownUnlockedIds.indexOf(id) < 0)) {
      try { audio.sfx('unlock'); } catch (e) { /* 静默 */ }
    }
    knownUnlockedIds = unlockedIds;
  },
  onResume() {
    if (!this.data.resume) return;
    try { audio.sfx('tap'); } catch (e) { /* 静默 */ }
    wx.navigateTo({ url: `/pages/level/level?id=${this.data.resume.levelId}` });
  },
  onTapLevel(e) {
    const { id, locked, lockedText } = e.currentTarget.dataset;
    if (toBool(locked)) {
      wx.showToast({ title: lockedText || '先通关前面的关卡', icon: 'none', duration: 2500 });
      return;
    }
    try { audio.sfx('tap'); } catch (e) { /* 静默 */ }
    wx.navigateTo({ url: `/pages/level/level?id=${id}` });
  },
});
