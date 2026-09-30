// 我的：等级/金币/成就/能力反馈/错题入口/设置
const state = require('../../engine/state');
const CONSTANTS = require('../../config/constants');
const learning = require('../../engine/learning');
const audio = require('../../engine/audio');
const { definePage } = require('../../utils/pageGuard');

// 金币流水的时间只到分钟——精确到秒对账本没有意义，还会把行撑长
function shortTime(ts) {
  const d = new Date(Number(ts) || 0);
  const pad = n => (n < 10 ? '0' + n : String(n));
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

definePage('me', {
  data: {
    coins: 0, exp: 0, stars: 0, title: '', nextTitle: '',
    abilityOverall: 0,
    abilityLevel: '',
    abilityDims: [],
    mistakeCount: 0,
    hasResume: false,
    resumeText: '',
    resumeLevelId: '',
    ruleOpen: false,
    saveAlert: null,
    // 金币经济
    studyStreak: 0,
    coinLedger: [],
    // 音频开关（独立于存档，见 engine/audio.js）
    bgmOn: true,
    sfxOn: true,
  },
  onToggleRule() {
    this.setData({ ruleOpen: !this.data.ruleOpen });
  },
  // 存档异常必须让用户看见：以前 save() 静默返回 false，用户丢进度后才察觉
  buildSaveAlert() {
    if (typeof state.getSaveStatus !== 'function') return null;
    const s = state.getSaveStatus();
    if (s.loadFailed) {
      return {
        title: '存档读取异常',
        body: '本次启动没能读到本机存档。为避免覆盖可能仍可恢复的数据，已暂停自动保存。请先不要继续闯关，退出重进一次试试。',
      };
    }
    if (!s.ok) {
      return {
        title: '进度未能保存',
        body: `已连续 ${s.failCount} 次写入失败，最近的闯关与经营进度不会被记住。${s.lastError ? `（${s.lastError}）` : ''}`,
      };
    }
    if (s.recoveredFromBackup) {
      return {
        title: '已从备份恢复',
        body: '本机存档此前损坏，已用上一个完好快照恢复。最近一次操作之前的进度都在。',
      };
    }
    return null;
  },
  onShow() {
    const s = state.get();
    const progress = s.progress || {};
    const stars = Object.values(progress).reduce((a, p) => a + ((p && p.stars) || 0), 0);
    const lv = Math.max(1, Math.floor((s.exp || 0) / 50) + 1);
    const t = [...CONSTANTS.LEVEL_TITLES].reverse().find(x => lv >= x.lv);
    const next = CONSTANTS.LEVEL_TITLES.find(x => x.lv > lv);

    const ability = learning.summarizeAbility(state.getAbility());
    const learningProgress = state.getLearningProgress();
    const mistakes = state.getMistakes();
    // 已通关的续学点无意义，入口只在存在进行中关卡时出现
    const resumeUsable = !!(learningProgress && learningProgress.levelId
      && !state.isLevelCleared(learningProgress.levelId));
    // 金币账本：新的在前，最多 6 条（存的是结论行，不做完整快照）
    const coinLedger = state.getCoinLedger(6).map((entry, i) => ({
      key: `${entry.at}-${i}`,
      label: entry.label,
      timeText: shortTime(entry.at),
      amount: entry.amount,
      sign: entry.amount > 0 ? `+${entry.amount}` : String(entry.amount),
    }));

    const audioPref = audio.getPref();

    this.setData({
      coins: s.coins || 0, exp: s.exp || 0, stars,
      title: t ? t.title : '', nextTitle: next ? next.title : '已满级',
      abilityOverall: ability.overall,
      abilityLevel: ability.level,
      abilityDims: ability.list.map(d => ({ ...d, barWidth: d.score })),
      mistakeCount: mistakes.length,
      hasResume: resumeUsable,
      resumeText: resumeUsable ? `${learningProgress.levelId} 第 ${learningProgress.stepIndex + 1} 步` : '',
      resumeLevelId: resumeUsable ? learningProgress.levelId : '',
      saveAlert: this.buildSaveAlert(),
      studyStreak: state.getStudyStreak(),
      coinLedger,
      bgmOn: audioPref.bgm,
      sfxOn: audioPref.sfx,
    });
  },
  onResume() {
    if (!this.data.resumeLevelId) return;
    wx.navigateTo({ url: `/pages/level/level?id=${this.data.resumeLevelId}` });
  },
  onOpenReview() {
    wx.navigateTo({ url: '/pages/review/review' });
  },
  onOpenManual() {
    wx.switchTab({ url: '/pages/manual/manual' });
  },
  // 兜底首次交互：页内任一点击都是真实手势，可幂等启动 BGM（已在播放则无操作）。
  // 小程序禁止无手势播放，所以启动动作必须挂在像这样的点击里，不能放 onShow。
  onPageTap() {
    audio.startBgm();
  },
  onToggleBgm(e) {
    const on = !!(e && e.detail && e.detail.value);
    const p = audio.setPref({ bgm: on });
    this.setData({ bgmOn: p.bgm });
    wx.showToast({ title: on ? '背景音乐已开启' : '背景音乐已关闭', icon: 'none' });
  },
  onToggleSfx(e) {
    const on = !!(e && e.detail && e.detail.value);
    const p = audio.setPref({ sfx: on });
    this.setData({ sfxOn: p.sfx });
    // 开启时立刻放一声点击音：既做反馈，也让用户当场确认声音是否真的能响
    if (on) audio.sfx('tap');
    wx.showToast({ title: on ? '音效已开启' : '音效已关闭', icon: 'none' });
  },
  onReset() {
    wx.showModal({
      title: '重置存档',
      content: '将清空全部进度、卡片、金币、能力记录与错题，确定？此操作不可撤销。',
      confirmText: '重置',
      confirmColor: '#C62828',
      success: (r) => {
        if (r.confirm) { state.reset(); this.onShow(); wx.showToast({ title: '已重置', icon: 'success' }); }
      },
    });
  },
});
