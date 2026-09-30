#!/usr/bin/env python3
"""生成 tabBar 像素风图标。

设计约束（与 app.wxss 的「像素风基线」一致）：
- 逻辑画布 27x27，每个逻辑像素放大 3 倍 -> 81x81，用 NEAREST 保证硬边像素，不产生抗锯齿灰边。
- 未选中态 #9E9E9E（= app.json tabBar.color），选中态 #D4A934（= tabBar.selectedColor）。
- 输出透明底 PNG。

用法：python3 tools/gen-tabbar-icons.py
"""

import os
from PIL import Image

GRID = 27
SCALE = 3
SIZE = GRID * SCALE  # 81

NORMAL = (158, 158, 158)
SELECTED = (212, 169, 52)

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'miniprogram', 'images')


class Canvas:
    """27x27 单色掩膜画布，坐标全部为逻辑像素，越界自动裁剪。"""

    def __init__(self):
        self.px = [[0] * GRID for _ in range(GRID)]

    def rect(self, x1, y1, x2, y2, on=True):
        for y in range(max(0, y1), min(GRID - 1, y2) + 1):
            for x in range(max(0, x1), min(GRID - 1, x2) + 1):
                self.px[y][x] = 1 if on else 0
        return self

    def clear(self, x1, y1, x2, y2):
        return self.rect(x1, y1, x2, y2, on=False)

    def to_image(self, color):
        small = Image.new('RGBA', (GRID, GRID), (0, 0, 0, 0))
        cells = small.load()
        for y in range(GRID):
            for x in range(GRID):
                if self.px[y][x]:
                    cells[x, y] = (color[0], color[1], color[2], 255)
        return small.resize((SIZE, SIZE), Image.NEAREST)


def icon_levels():
    """关卡：地图旗标（旗面 + 旗杆 + 底座）。"""
    c = Canvas()
    c.rect(7, 4, 9, 21)          # 旗杆
    c.rect(9, 4, 20, 12)         # 旗面
    c.clear(17, 9, 20, 12)       # 旗面缺口 -> 三角燕尾，避免读成纯方块
    c.rect(4, 22, 13, 24)        # 底座
    return c


def icon_shop():
    """店铺：宽出挑的遮阳棚 + 店身 + 门洞。

    刻意不加「左右橱窗」——两个实心方块夹一个门洞会读成汉字「口口」结构，
    在 81px 下辨识度反而下降；单门洞 + 棚身分明最干净。
    """
    c = Canvas()
    c.rect(2, 5, 24, 9)          # 遮阳棚（比店身宽，出挑）
    c.rect(5, 11, 21, 23)        # 店身（与棚留 1px 空档，形成分界）
    c.clear(11, 15, 15, 23)      # 门洞
    return c


def icon_manual():
    """手册：摊开的书（书体 + 书脊 + 左右页文字行）。"""
    c = Canvas()
    c.rect(4, 5, 22, 22)         # 书体
    c.clear(4, 5, 4, 5)          # 四角切圆
    c.clear(22, 5, 22, 5)
    c.clear(4, 22, 4, 22)
    c.clear(22, 22, 22, 22)
    c.clear(13, 5, 13, 22)       # 书脊（挖空，不是填充）
    # 文字行：必须在已填充的书体上「挖空」才可见
    c.clear(6, 9, 10, 9)
    c.clear(6, 13, 10, 13)
    c.clear(6, 17, 10, 17)
    c.clear(16, 9, 20, 9)
    c.clear(16, 13, 20, 13)
    c.clear(16, 17, 20, 17)
    return c


def icon_me():
    """我的：头 + 肩。"""
    c = Canvas()
    c.rect(10, 4, 16, 11)        # 头
    c.clear(10, 4, 10, 5)        # 四角切掉，读成圆头
    c.clear(16, 4, 16, 5)
    c.clear(10, 10, 10, 11)
    c.clear(16, 10, 16, 11)
    c.rect(7, 14, 19, 15)        # 肩线
    c.rect(5, 16, 21, 23)        # 身体
    c.clear(5, 16, 5, 16)        # 削肩
    c.clear(21, 16, 21, 16)
    return c


ICONS = {
    'tab-levels': icon_levels,
    'tab-shop': icon_shop,
    'tab-manual': icon_manual,
    'tab-me': icon_me,
}


def render_preview(out_dir):
    """把 8 个图标拼成一张对照图（上排未选中 / 下排选中），底色取 tabBar 的深蓝。

    用途：图标是像素画，只能靠眼睛判断辨识度，不能只靠断言。
    这张图在 tools/ 下，不在 miniprogramRoot 内，不会被小程序打包。
    """
    names = ['tab-levels', 'tab-shop', 'tab-manual', 'tab-me']
    pad = 16
    width = pad + 4 * (SIZE + pad)
    height = pad + 2 * (SIZE + pad)
    canvas = Image.new('RGB', (width, height), (26, 43, 74))
    for col, name in enumerate(names):
        for row, suffix in enumerate(['', '-on']):
            with Image.open(os.path.join(out_dir, f'{name}{suffix}.png')) as im:
                canvas.paste(im.convert('RGBA'), (pad + col * (SIZE + pad), pad + row * (SIZE + pad)), im.convert('RGBA'))
    preview_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tabbar-preview.png')
    canvas.resize((width * 2, height * 2), Image.NEAREST).save(preview_path)
    return preview_path


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    written = []
    for name, builder in ICONS.items():
        canvas = builder()
        normal_path = os.path.join(OUT_DIR, f'{name}.png')
        selected_path = os.path.join(OUT_DIR, f'{name}-on.png')
        canvas.to_image(NORMAL).save(normal_path)
        canvas.to_image(SELECTED).save(selected_path)
        written.extend([normal_path, selected_path])
    for path in written:
        with Image.open(path) as im:
            assert im.size == (SIZE, SIZE), f'{path} 尺寸错误 {im.size}'
            assert im.mode == 'RGBA', f'{path} 非 RGBA'
        print(f'  miniprogram/images/{os.path.basename(path)}  {SIZE}x{SIZE} RGBA')
    print(f'共 {len(written)} 个图标')
    print(f'  对照图 {render_preview(OUT_DIR)}（上排未选中 / 下排选中）')


if __name__ == '__main__':
    main()
