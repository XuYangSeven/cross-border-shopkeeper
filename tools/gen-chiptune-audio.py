#!/usr/bin/env python3
"""生成《跨境掌柜》的 chiptune（8-bit）音频资产。

设计原则
--------
- 音色只用 8-bit 芯片语汇：方波（可变占空比）、三角波、白噪声打击。
  与像素风视觉同源；**不使用**现代 synth pad / 混响铺底 / 环境音。
- 纯 Python 手写 PCM（本机 numpy 不可用），SR=44100 / 单声道 / 16-bit，
  再经 ffmpeg(libmp3lame) 编码为 mp3。
- 确定性：噪声用固定种子，输出与运行时间无关，一条命令可重跑复现。
- 音频定位是「情绪与节奏」，不是「信息载体」——它不承载必须听懂才能过关的信息。

用法：
    python3 tools/gen-chiptune-audio.py

输出（miniprogram/audio/）：
    bgm.mp3      约 50s 可循环、低频密度低的学习底噪
    tap.mp3 correct.mp3 wrong.mp3 settle.mp3 coin.mp3 unlock.mp3   6 个音效

体积硬约束（脚本末尾自动校核，超限即非零退出）：
    BGM ≤ 400 KB，6 个音效合计 ≤ 200 KB，音频总量 ≤ 600 KB。
"""

import array
import math
import os
import random
import shutil
import struct
import subprocess
import sys
import tempfile
import wave

# ============================================================
# 基础参数
# ============================================================
SR = 44100                      # 采样率（单声道以省体积）
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, '..', 'miniprogram', 'audio')

BGM_KBPS = 56                   # BGM 码率：50s × 56kbps ≈ 350 KB
SFX_KBPS = 96                   # 音效码率：总时长 <2s，96k 也仅约 22 KB

FFMPEG = shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'


def midi(m):
    """MIDI 音高 → 频率（A4=69=440Hz）。"""
    return 440.0 * (2.0 ** ((m - 69) / 12.0))


# 常用音高（MIDI 号），便于谱面可读
N = {
    'A2': 45, 'C3': 48, 'D3': 50, 'E3': 52, 'F3': 53, 'G3': 55, 'A3': 57, 'B3': 59,
    'C4': 60, 'D4': 62, 'E4': 64, 'F4': 65, 'G4': 67, 'A4': 69, 'B4': 71,
    'C5': 72, 'D5': 74, 'E5': 76, 'F5': 77, 'G5': 79, 'A5': 81, 'B5': 83,
    'C6': 84, 'E6': 88, 'F2': 41, 'G2': 43,
}


# ============================================================
# 波形（8-bit 语汇）
# ============================================================
def w_square(phase, duty=0.5):
    """方波。duty=0.5 标准方波；0.125/0.25 为「脉冲波」，更细更冷。"""
    return 1.0 if (phase % 1.0) < duty else -1.0


def w_triangle(phase):
    """三角波：比方波柔和，常作低音声部。"""
    p = phase % 1.0
    return 4.0 * abs(p - 0.5) - 1.0


# ============================================================
# 单音渲染：相位累加，支持滑音（glide），逐样本包络
# ============================================================
def adsr(t, dur, a, d, s, r):
    if t < a:
        return t / a if a > 0 else 1.0
    if t < a + d:
        return 1.0 - (1.0 - s) * ((t - a) / d) if d > 0 else s
    if t < dur - r:
        return s
    if r > 0:
        return s * max(0.0, (dur - t) / r)
    return 0.0


def add_note(buf, t0, dur, pitch, wave='square', duty=0.5, vol=0.5,
             a=0.004, d=0.06, s=0.7, r=0.06, glide=None, seed=1):
    """把一个音叠加进 buf（浮点，范围约 [-1,1]）。

    glide：目标频率（Hz）。音高在前 60% 时长内指数滑向目标，用于 tap 的下滑、wrong 的叹气。
    """
    i0 = int(round(t0 * SR))
    n = int(round(dur * SR))
    phase = 0.0
    rng = random.Random(seed)
    f0 = midi(pitch) if isinstance(pitch, int) else float(pitch)
    for i in range(n):
        idx = i0 + i
        if idx < 0:
            continue
        if idx >= len(buf):
            break
        t = i / SR
        f = f0
        if glide is not None:
            g = min(1.0, t / (0.6 * dur)) if dur > 0 else 1.0
            f = f0 * ((glide / f0) ** g)
        phase += f / SR
        env = adsr(t, dur, a, d, s, r)
        if env <= 0.0:
            continue
        if wave == 'square':
            val = w_square(phase, duty)
        elif wave == 'triangle':
            val = w_triangle(phase)
        elif wave == 'noise':
            val = rng.uniform(-1.0, 1.0)
        else:
            val = math.sin(2.0 * math.pi * phase)
        buf[idx] += val * env * vol


def normalize(buf, peak_target):
    peak = max((abs(v) for v in buf), default=0.0)
    if peak <= 0.0:
        return
    k = peak_target / peak
    for i in range(len(buf)):
        buf[i] *= k


def fade_edges(buf, ms=3.0):
    """首尾各做极短淡入淡出，消除 mp3 边界 click（内容本身在边界近静音，故不可闻）。"""
    n = int(SR * ms / 1000.0)
    for i in range(min(n, len(buf))):
        g = i / n
        buf[i] *= g
        buf[len(buf) - 1 - i] *= g


def blank(seconds):
    return [0.0] * int(round(seconds * SR))


# ============================================================
# 6 个音效
# ============================================================
def gen_tap():
    """点击：≤60ms 极短 blip，略下滑，不占注意力、绝不留尾。"""
    b = blank(0.055)
    add_note(b, 0.0, 0.055, 1480, wave='square', duty=0.5, vol=0.5,
             a=0.001, d=0.03, s=0.0, r=0.02, glide=1180)
    normalize(b, 0.72)
    return b


def gen_correct():
    """答对：上行纯五度（E5→B5），明亮、干净，只传达「对了」的情绪。"""
    b = blank(0.34)
    add_note(b, 0.0, 0.14, N['E5'], wave='square', duty=0.5, vol=0.55,
             a=0.004, d=0.05, s=0.6, r=0.05)
    add_note(b, 0.11, 0.22, N['B5'], wave='square', duty=0.5, vol=0.55,
             a=0.004, d=0.06, s=0.55, r=0.09)
    # 低声部三角波给一点厚度，避免纯方波过尖
    add_note(b, 0.11, 0.22, N['E4'], wave='triangle', duty=0.5, vol=0.18,
             a=0.004, d=0.06, s=0.5, r=0.09)
    normalize(b, 0.86)
    return b


def gen_wrong():
    """答错：下行小二度（F4→E4），三角波、低音量、慢起音。

    刻意克制：学习场景里刺耳的「错误蜂鸣」会让学生想直接关掉声音。
    只提示「这次不对」，不制造惩罚感。
    """
    b = blank(0.42)
    add_note(b, 0.0, 0.40, N['F4'], wave='triangle', duty=0.5, vol=0.5,
             a=0.012, d=0.10, s=0.55, r=0.14, glide=midi(N['E4']))
    add_note(b, 0.0, 0.40, N['F3'], wave='triangle', duty=0.5, vol=0.16,
             a=0.02, d=0.12, s=0.5, r=0.16, glide=midi(N['E3']))
    normalize(b, 0.62)       # 整体偏轻：答错音不抢戏
    return b


def gen_settle():
    """结算：C-E-G-C 短琶音，暖而克制，呼应结算面板弹出。"""
    b = blank(0.60)
    notes = [N['C5'], N['E5'], N['G5'], N['C6']]
    for i, p in enumerate(notes):
        t0 = i * 0.11
        add_note(b, t0, 0.24, p, wave='square', duty=0.25, vol=0.42,
                 a=0.004, d=0.07, s=0.55, r=0.12)
        add_note(b, t0, 0.24, p - 12, wave='triangle', duty=0.5, vol=0.14,
                 a=0.004, d=0.08, s=0.5, r=0.12)
    normalize(b, 0.80)
    return b


def gen_coin():
    """金币：B5→E6 两声清脆高音（经典芯片金币音），干净利落。"""
    b = blank(0.20)
    add_note(b, 0.0, 0.06, N['B5'], wave='square', duty=0.5, vol=0.55,
             a=0.002, d=0.03, s=0.0, r=0.02)
    add_note(b, 0.055, 0.14, N['E6'], wave='square', duty=0.5, vol=0.55,
             a=0.002, d=0.05, s=0.35, r=0.08)
    normalize(b, 0.84)
    return b


def gen_unlock():
    """解锁：C5→G5→C6 上行三音，末音延音，明亮有「打开」感。"""
    b = blank(0.62)
    add_note(b, 0.0, 0.14, N['C5'], wave='square', duty=0.5, vol=0.5,
             a=0.004, d=0.05, s=0.6, r=0.05)
    add_note(b, 0.12, 0.14, N['G5'], wave='square', duty=0.5, vol=0.5,
             a=0.004, d=0.05, s=0.6, r=0.05)
    add_note(b, 0.24, 0.38, N['C6'], wave='square', duty=0.25, vol=0.5,
             a=0.005, d=0.08, s=0.55, r=0.18)
    add_note(b, 0.24, 0.38, N['C5'], wave='triangle', duty=0.5, vol=0.16,
             a=0.005, d=0.09, s=0.5, r=0.18)
    normalize(b, 0.84)
    return b


# ============================================================
# BGM：16 小节、76 BPM（≈50s）可循环，慢速、声部少、留白多
# ============================================================
BPM = 76
BEAT = 60.0 / BPM               # ≈0.7895s
BAR = 4 * BEAT                  # ≈3.158s
BARS = 16

# Am – F – C – G，每和弦两小节（i–VI–III–VII，平和、可无限循环）
PROG = ['Am', 'F', 'C', 'G']
CHORD = {
    # bass 用八度 2-3，arp 用八度 3-4，都不进低频密集区
    'Am': {'bass': N['A2'], 'arp': [N['A3'], N['C4'], N['E4']]},
    'F':  {'bass': N['F2'], 'arp': [N['A3'], N['C4'], N['F4']]},
    'C':  {'bass': N['C3'], 'arp': [N['C4'], N['E4'], N['G4']]},
    'G':  {'bass': N['G2'], 'arp': [N['B3'], N['D4'], N['G4']]},
}

# 主旋律：极稀疏——16 小节里只 8 个音，其余留白。旋律性越弱越耐听。
MELODY = {
    0: (N['E5'], 2.0), 2: (N['C5'], 2.0), 4: (N['G4'], 2.0), 6: (N['D5'], 2.0),
    8: (N['E5'], 2.0), 10: (N['F5'], 2.0), 12: (N['E5'], 2.0), 14: (N['D5'], 2.0),
}


def gen_bgm():
    total = BARS * BAR
    b = blank(total)
    for bar in range(BARS):
        t_bar = bar * BAR
        ch = CHORD[PROG[(bar // 2) % 4]]
        # ① 低音：整小节长音，三角波，音量低（低频密度低）
        add_note(b, t_bar, BAR * 0.95, ch['bass'], wave='triangle', duty=0.5, vol=0.22,
                 a=0.05, d=0.3, s=0.75, r=0.35)
        # ② 分解和弦：第 1/2/3 拍各一个音，第 4 拍留白（避免连打、给呼吸）
        for k, p in enumerate(ch['arp']):
            add_note(b, t_bar + k * BEAT, BEAT * 0.72, p,
                     wave='square', duty=0.125, vol=0.075,
                     a=0.012, d=0.12, s=0.55, r=0.16)
        # ③ 白噪声轻击：只落 2/4 拍，音量极低，仅提供轻微脉搏
        for beat in (1, 3):
            add_note(b, t_bar + beat * BEAT, 0.05, 0, wave='noise', duty=0.5, vol=0.030,
                     a=0.001, d=0.02, s=0.0, r=0.02, seed=100 + bar * 7 + beat)
        # ④ 主旋律：仅在配置的小节出现
        if bar in MELODY:
            p, beats = MELODY[bar]
            add_note(b, t_bar, beats * BEAT * 0.9, p, wave='square', duty=0.5, vol=0.115,
                     a=0.03, d=0.25, s=0.6, r=0.4)
    normalize(b, 0.50)       # 底噪：整体压得低，不抢注意力
    fade_edges(b, 4.0)
    return b


# ============================================================
# 编码与落盘
# ============================================================
def write_wav(path, buf):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        samples = array.array('h', (int(max(-1.0, min(1.0, v)) * 32767) for v in buf))
        w.writeframes(samples.tobytes())


def encode(wav_path, mp3_path, kbps):
    subprocess.run(
        [FFMPEG, '-y', '-loglevel', 'error', '-i', wav_path,
         '-ac', '1', '-ar', str(SR), '-b:a', f'{kbps}k',
         '-codec:a', 'libmp3lame', '-map_metadata', '-1', mp3_path],
        check=True,
    )


def main():
    if not os.path.exists(FFMPEG):
        print(f'✗ 找不到 ffmpeg：{FFMPEG}', file=sys.stderr)
        return 1
    os.makedirs(OUT_DIR, exist_ok=True)

    jobs = [
        ('bgm', gen_bgm, BGM_KBPS),
        ('tap', gen_tap, SFX_KBPS),
        ('correct', gen_correct, SFX_KBPS),
        ('wrong', gen_wrong, SFX_KBPS),
        ('settle', gen_settle, SFX_KBPS),
        ('coin', gen_coin, SFX_KBPS),
        ('unlock', gen_unlock, SFX_KBPS),
    ]

    tmp = tempfile.mkdtemp(prefix='chiptune-')
    total = 0
    sfx_total = 0
    rows = []
    try:
        for name, fn, kbps in jobs:
            buf = fn()
            wav = os.path.join(tmp, name + '.wav')
            mp3 = os.path.join(OUT_DIR, name + '.mp3')
            write_wav(wav, buf)
            encode(wav, mp3, kbps)
            size = os.path.getsize(mp3)
            dur = len(buf) / SR
            total += size
            if name != 'bgm':
                sfx_total += size
            rows.append((name, dur, kbps, size))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print(f'输出目录 {os.path.normpath(OUT_DIR)}')
    print(f'{"文件":<12}{"时长":>8}{"码率":>8}{"字节":>12}')
    for name, dur, kbps, size in rows:
        print(f'  {name + ".mp3":<10}{dur:>7.2f}s{kbps:>7}k{size:>12,}')
    print(f'  {"BGM":<10}{"":>7} {"":>7}{rows[0][3]:>12,}')
    print(f'音频总量 {total:,} 字节（{(total / 1024):.1f} KB）'
          f'｜BGM {rows[0][3]:,} B｜6 音效合计 {sfx_total:,} B')

    failed = 0
    if rows[0][3] > 400 * 1024:
        print(f'✗ BGM 超 400KB：{rows[0][3]:,}', file=sys.stderr)
        failed += 1
    if sfx_total > 200 * 1024:
        print(f'✗ 音效合计超 200KB：{sfx_total:,}', file=sys.stderr)
        failed += 1
    if total > 600 * 1024:
        print(f'✗ 音频总量超 600KB：{total:,}', file=sys.stderr)
        failed += 1
    if failed:
        return 1
    print('✓ 体积达标（BGM ≤400KB / 音效 ≤200KB / 总量 ≤600KB）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
