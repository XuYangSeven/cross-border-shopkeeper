// 我的：等级/金币/成就/能力反馈/错题入口/设置
const state = require('../../engine/state');
const CONSTANTS = require('../../config/constants');
const learning = require('../../engine/learning');
const audio = require('../../engine/audio');
const sync = require('../../engine/sync');
const { definePage } = require('../../utils/pageGuard');

// 金币流水的时间只到分钟——精确到秒对账本没有意义，还会把行撑长
function shortTime(ts) {
  const d = new Date(Number(ts) || 0);
  const pad = n => (n < 10 ? '0' + n : String(n));
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 同步结果的文案映射。放在一处，避免「登录页说一套、按钮说另一套」。
const SYNC_SUCCESS_TEXT = {
  'signed-in': '已登录',
  'signed-out': '已退出登录',
  uploaded: '已把本机进度备份到云端',
  downloaded: '已用云端进度覆盖本机',
  'in-sync': '本机与云端已一致',
};

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
    // 云端同步面板（见 engine/sync.js）
    sync: {
      configured: true,
      signedIn: false,
      busy: false,
      conflict: false,
      stateText: '',
      stateClass: 'sync-state-idle',
      lastSyncText: '还没有同步过',
      detailText: '',
      buttonText: '立即同步',
      message: '',
    },
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

  // ===== 云端同步面板 =====
  // 展示模型集中一处：状态文字、按钮文案、提示三者必须自洽，
  // 分散在各 handler 里改很容易出现「状态说已同步、按钮说去同步」。
  buildSyncView() {
    const status = sync.getStatus();
    const last = status.last || {};
    const view = {
      configured: !!status.configured,
      signedIn: !!status.signedIn,
      busy: !!this.data.sync.busy,
      conflict: !!this.data.sync.conflict,
      stateText: '未登录',
      stateClass: 'sync-state-idle',
      lastSyncText: '还没有同步过',
      detailText: '',
      buttonText: '立即同步',
      message: this.data.sync.message || '',
    };
    // 未配置云服务时只剩「本机保存」这一件事可说，其余按钮文案一律不成立
    if (!view.configured) {
      view.signedIn = false;
      view.conflict = false;
      return view;
    }
    if (!view.signedIn) return view;

    view.lastSyncText = status.lastSyncAt ? shortTime(status.lastSyncAt) : '还没有同步过';
    view.detailText = '同步的是学习进度（关卡、金币、能力评估、店铺经营），不含背景音乐等本机偏好。';
    if (status.pending) {
      view.stateText = '有改动待同步';
      view.buttonText = '立即同步';
    } else if (last.status === 'error') {
      view.stateText = '同步失败';
      view.stateClass = 'sync-state-bad';
      view.buttonText = '重试同步';
    } else if (status.lastSyncAt) {
      view.stateText = '已同步';
      view.stateClass = 'sync-state-ok';
    } else {
      view.stateText = '已登录，还没同步过';
      view.buttonText = '把进度备份到云端';
    }
    return view;
  },

  refreshSyncView() {
    this.setData({ sync: this.buildSyncView() });
  },

  // 所有云端动作走同一条管线：置忙 → 执行 → 落结果。
  // 执行体永远不抛（engine/sync 内部已兜住），这里的 try/catch 是最后一道保险。
  async runCloudOperation(run, pendingText) {
    if (this.data.sync.busy) return;
    this.setData({ 'sync.busy': true, 'sync.conflict': false, 'sync.message': pendingText || '' });
    let result;
    try {
      result = await run();
    } catch (e) {
      console.error('[me] 云端操作异常', e && e.message);
      result = { ok: false, status: 'error', message: '云端操作失败，请稍后再试' };
    }
    this.applySyncResult(result);
  },

  applySyncResult(result) {
    const r = result || {};
    const conflict = r.status === 'conflict';
    let message = r.message || '';
    if (r.ok && SYNC_SUCCESS_TEXT[r.status]) message = SYNC_SUCCESS_TEXT[r.status];
    this.setData({
      'sync.busy': false,
      'sync.conflict': conflict,
      'sync.message': message,
    });
    // 云端覆盖本机后，本页的金币/星数/能力都要重新读一遍
    if (r.status === 'downloaded') this.onShow();
    else this.refreshSyncView();
  },

  onCloudSignIn() {
    this.runCloudOperation(() => sync.signIn(), '正在登录…');
  },

  onCloudSyncNow() {
    this.runCloudOperation(() => sync.syncNow(), '正在同步…');
  },

  onCloudUpload() {
    this.runCloudOperation(() => sync.syncNow({ force: 'upload' }), '正在上传本机进度…');
  },

  // 覆盖是单向且不可撤销的：本机存档有快照兜底，但两份进度内容不同时无法自动合并，
  // 所以必须先让用户确认，不能点一下就盖。
  onCloudDownload() {
    wx.showModal({
      title: '用云端进度覆盖本机',
      content: '本机现在的进度会被云端那一份替换。两份内容不同时无法自动合并，确定继续？',
      confirmText: '覆盖本机',
      success: (r) => {
        if (r.confirm) this.runCloudOperation(() => sync.syncNow({ force: 'download' }), '正在从云端恢复…');
      },
    });
  },

  onCloudSignOut() {
    wx.showModal({
      title: '退出登录',
      content: '退出后进度仍留在本机，只是不再自动同步到云端。确定退出？',
      confirmText: '退出',
      success: (r) => {
        if (r.confirm) this.runCloudOperation(() => sync.signOut(), '正在退出…');
      },
    });
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
    // 同步面板要读实时登录态（可能在小程序启动时静默恢复），不能沿用上次渲染的旧值
    this.refreshSyncView();
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
