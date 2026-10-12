"""Turn Gemini/ChatGPT art (solid #FF00FF background) into game-ready PNGs.

Usage: python3 tools/process_art.py <folder with source images> public/assets

Source file names expected in the folder: sky.png, mountains.png, sea-town.png,
foliage.png, tiles.png, objects.png, icons.png. Crop boxes below match the
first Gemini batch; a new batch with a different layout needs new boxes.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
T = 32  # tile size in the game


def load(name):
    return Image.open(SRC / name).convert('RGB')


def key_magenta(img):
    """Magenta becomes transparent."""
    a = np.asarray(img.convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (r > 150) & (b > 150) & (g < 110) & (np.abs(r - b) < 90)
    rgba = np.dstack([a, np.where(bg, 0, 255)]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


def patch(img, box, dx, dy=0):
    """Cover a spot (the Gemini sparkle watermark) with pixels from (dx, dy) away."""
    x0, y0, x1, y1 = box
    img.paste(img.crop((x0 + dx, y0 + dy, x1 + dx, y1 + dy)), (x0, y0))


def shrink(img, size, hard_alpha=True):
    """Downscale with premultiplied alpha so magenta never bleeds into edges."""
    out = img.convert('RGBa').resize(size, Image.BOX).convert('RGBA')
    if hard_alpha:
        a = np.asarray(out).copy()
        a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
        out = Image.fromarray(a, 'RGBA')
    return out


def fit(img, w=None, h=None):
    iw, ih = img.size
    if w and h:
        return shrink(img, (w, h))
    if w:
        return shrink(img, (w, max(1, round(ih * w / iw))))
    return shrink(img, (max(1, round(iw * h / ih)), h))


def mirror_tile(img):
    """Image + its mirror: seamless when repeated horizontally."""
    w, h = img.size
    out = Image.new('RGBA', (w * 2, h))
    out.paste(img, (0, 0))
    out.paste(ImageOps.mirror(img), (w, 0))
    return out


def save(img, name):
    img.save(OUT / f'{name}.png', optimize=True)
    print(f'{name}.png {img.size}')


# ---------- backgrounds ----------
sky = load('sky.png')
patch(sky, (610, 1215, 690, 1295), -120)
sky = sky.resize((360, round(1376 * 360 / 768)), Image.BOX).crop((0, 0, 360, 640))
save(sky.convert('RGBA'), 'bg_sky')

for name, key, box, dx, scale in [
    ('mountains.png', 'bg_mountains', (1215, 610, 1295, 690), -90, 0.5),
    ('sea-town.png', 'bg_sea', (1215, 675, 1290, 750), -70, 0.5),
]:
    src = load(name)
    patch(src, box, dx)
    img = key_magenta(src)
    w, h = img.size
    save(mirror_tile(shrink(img, (round(w * scale), round(h * scale)))), key)

# Trees strip: separate trees and bushes placed along one line, none crossing
# the strip edges, so it repeats seamlessly.
trees = key_magenta(load('trees.png'))
bushes = key_magenta(load('bushes.png'))
S = 0.3
parts = {
    'oak': trees.crop((28, 0, 680, 628)),
    'pine': trees.crop((780, 92, 1144, 576)),
    'cypress': trees.crop((1176, 44, 1364, 630)),
    'bush': trees.crop((544, 536, 872, 768)),
    'sapling': bushes.crop((536, 28, 696, 264)),
    'dry': bushes.crop((728, 200, 1132, 476)),
    'fern': bushes.crop((20, 456, 420, 768)),
    'round': bushes.crop((456, 508, 924, 768)),
}
parts = {k: shrink(v, (round(v.width * S), round(v.height * S))) for k, v in parts.items()}
order = [('oak', 10), ('fern', -30), ('cypress', 60), ('bush', 40), ('pine', 120), ('round', -20),
         ('sapling', 50), ('cypress', 30), ('dry', 140), ('fern', 20), ('cypress', -10), ('round', 80)]
H = max(p.height for p in parts.values())
x = 20
placed = []
for name, gap in order:
    p = parts[name]
    placed.append((p, x))
    x += p.width + gap if gap > 0 else p.width + gap
strip_w = x + 40
trees_strip = Image.new('RGBA', (strip_w, H), (0, 0, 0, 0))
for p, px in placed:
    trees_strip.alpha_composite(p, (px, H - p.height))
save(trees_strip, 'bg_trees')

sea = np.asarray(load('sea-town.png'))
print('sea bottom color', '#%02x%02x%02x' % tuple(sea[760, 100]))

# ---------- tiles: 0 grass, 1 dirt, 2 plank, 3 water top, 4 water, 5 rock, 6 grass L, 7 grass R, 8 dirt 2 ----------
tiles_src = key_magenta(load('tiles.png'))
strip = Image.new('RGBA', (T * 9, T), (0, 0, 0, 0))


def tile(box, size=(T, T), at=(0, 0)):
    return shrink(tiles_src.crop(box), size)


strip.paste(tile((260, 4, 508, 252)), (0, 0))
strip.paste(tile((8, 264, 252, 508)), (T, 0))
plank = tile((8, 560, 252, 728), (T, 22))
strip.paste(plank, (2 * T, 2))
water_top = tile((8, 804, 252, 1020), (T, 28))
wt = Image.new('RGBA', (T, T), (0, 0, 0, 0))
wt.paste(water_top, (0, 4))
strip.paste(wt, (3 * T, 0))
deep = tuple(int(c) for c in np.asarray(water_top)[-2, T // 2][:3])
strip.paste(Image.new('RGBA', (T, T), deep + (255,)), (4 * T, 0))
strip.paste(tile((264, 520, 508, 764)), (5 * T, 0))
strip.paste(tile((4, 4, 252, 252)), (6 * T, 0))
strip.paste(tile((516, 4, 764, 252)), (7 * T, 0))
strip.paste(tile((264, 264, 508, 508)), (8 * T, 0))
# Water lets the background show through a little.
a = np.asarray(strip).copy()
a[:, 3 * T:5 * T, 3] = (a[:, 3 * T:5 * T, 3] * 0.85).astype(np.uint8)
save(Image.fromarray(a, 'RGBA'), 'tiles')

# ---------- objects ----------
obj = key_magenta(load('objects.png'))
save(fit(obj.crop((44, 36, 264, 288)), 32, 32), 'crate')
save(fit(obj.crop((300, 68, 500, 288)), h=32), 'lever_off')
save(fit(obj.crop((528, 68, 728, 288)), h=32), 'lever_on')
save(fit(obj.crop((76, 324, 232, 520)), h=34), 'cp_off')
save(fit(obj.crop((296, 324, 456, 520)), h=34), 'cp_on')
save(fit(obj.crop((764, 32, 984, 612)), h=96), 'goal')
save(fit(obj.crop((392, 652, 912, 820)), w=96), 'mplat')
crab = fit(obj.crop((404, 848, 640, 996)), w=34)
save(crab, 'crab_a')
save(ImageOps.mirror(crab), 'crab_b')

# Crusher: spiked bottom from the art, stone body repeated upward to 600px.
cr = fit(obj.crop((44, 556, 300, 996)), w=64)
cw, ch = cr.size
body = cr.crop((0, ch // 3, cw, ch // 3 + 24))
tall = Image.new('RGBA', (64, 600), (0, 0, 0, 0))
y = 600 - ch
tall.paste(cr, (0, y))
yy = y + ch // 3
while yy > 0:
    yy -= 24
    tall.paste(body, (0, yy))
tall.paste(cr.crop((0, ch // 3, cw, ch)), (0, y + ch // 3))
save(tall, 'crusher')

# ---------- icons ----------
ic = load('icons.png')
# Empty heart: mirror its clean left half over the watermark on the right.
left = ic.crop((704, 732, 844, 984))
ic.paste(ImageOps.mirror(left), (844, 732))
ic = key_magenta(ic)
# Spin frames: front, half-turned, edge, half-turned. Gemini drew the half-turned
# coins lying flat (wide ellipse), so they are rotated to stand upright.
coin_boxes = [(44, 56, 280, 288, False), (320, 84, 548, 256, True), (620, 56, 676, 288, False), (752, 84, 984, 256, True)]
for i, (x0, y0, x1, y1, rot) in enumerate(coin_boxes):
    c = ic.crop((x0, y0, x1, y1))
    if rot:
        c = c.rotate(90, expand=True)
    k = 16 / 236
    w, h = max(1, round(c.width * k)), min(16, round(c.height * k))
    frame = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    frame.paste(shrink(c, (w, h)), ((16 - w) // 2, (16 - h) // 2))
    save(frame, 'coin' if i == 0 else f'coin_{i}')
save(fit(ic.crop((324, 320, 704, 688)), h=18), 'star')
save(fit(ic.crop((44, 732, 324, 984)), 16, 14), 'heart')
save(fit(ic.crop((704, 732, 984, 984)), 16, 14), 'heart_empty')

# ---------- flat side-view objects (second batch, replaces the 3D-looking ones) ----------
if (SRC / 'objects-flat.png').exists():
    src = load('objects-flat.png')
    patch(src, (1255, 615, 1325, 690), -90)
    flat = key_magenta(src)
    save(fit(flat.crop((48, 48, 360, 360)), 32, 32), 'crate')
    save(fit(flat.crop((424, 84, 652, 360)), h=32), 'lever_off')
    save(fit(flat.crop((760, 84, 988, 360)), h=32), 'lever_on')
    save(shrink(flat.crop((48, 548, 1000, 624)), (96, 12)), 'mplat')
    # Pillar: spiked bottom (cap + spikes) with stone blocks repeated up to 600px.
    k = 64 / 300
    bottom = shrink(flat.crop((1064, 430, 1364, 724)), (64, round(294 * k)))
    unit = shrink(flat.crop((1064, 250, 1364, 430)), (64, round(180 * k)))
    tall = Image.new('RGBA', (64, 600), (0, 0, 0, 0))
    y = 600 - bottom.height
    tall.paste(bottom, (0, y))
    while y > 0:
        y -= unit.height
        tall.paste(unit, (0, y))
    save(tall, 'crusher')


# ---------- characters ----------
from collections import deque


def components(alpha, min_area=2000):
    """Bounding boxes of opaque blobs, left-to-right then top-to-bottom (by row band)."""
    small = alpha[::4, ::4] > 0
    h, w = small.shape
    seen = np.zeros_like(small, bool)
    boxes = []
    for y in range(h):
        for x in range(w):
            if small[y, x] and not seen[y, x]:
                q = deque([(y, x)]); seen[y, x] = True; ys = []; xs = []
                while q:
                    cy, cx = q.popleft(); ys.append(cy); xs.append(cx)
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx))
                if len(ys) * 16 >= min_area:
                    boxes.append((min(xs) * 4, min(ys) * 4, (max(xs) + 1) * 4, (max(ys) + 1) * 4))
    boxes.sort(key=lambda b: (b[1] // 250, b[0]))
    return boxes


def largest_only(img):
    """Drop stray specks (watermark, crumbs) around a single sprite."""
    a = np.asarray(img).copy()
    m = a[..., 3] > 0
    h, w = m.shape
    lab = np.zeros((h, w), np.int32); best = (0, 0); n = 0
    for y in range(h):
        for x in range(w):
            if m[y, x] and not lab[y, x]:
                n += 1; q = deque([(y, x)]); lab[y, x] = n; size = 0
                while q:
                    cy, cx = q.popleft(); size += 1
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; q.append((ny, nx))
                if size > best[1]: best = (n, size)
    a[..., 3] = np.where(lab == best[0], a[..., 3], 0)
    return Image.fromarray(a, 'RGBA')


def strip_box_right(img):
    """Cut away a crate on the right: columns sharing the crate's top and bottom rows."""
    m = np.asarray(img)[..., 3] > 0
    cols = [np.flatnonzero(m[:, x]) for x in range(m.shape[1])]
    x = m.shape[1] - 1
    while x > 0 and len(cols[x]) == 0: x -= 1
    ref = [cols[i] for i in range(x - 12, x - 2) if len(cols[i])]
    top, bot = int(np.median([c[0] for c in ref])), int(np.median([c[-1] for c in ref]))
    x -= 2
    while x > 0 and len(cols[x]) and abs(cols[x][0] - top) <= 6 and abs(cols[x][-1] - bot) <= 6:
        x -= 1
    return img.crop((0, 0, x - 2, img.height))


def sheet_frames(name, cut_below=None):
    src = load(name)
    if cut_below:  # a drawn ground line glues frames together
        a = np.asarray(src).copy(); a[cut_below:] = (255, 0, 255); src = Image.fromarray(a)
    keyed = key_magenta(src)
    alpha = np.asarray(keyed)[..., 3]
    return [largest_only(keyed.crop(b)) for b in components(alpha)]


def place(frames, k, canvas):
    """Scale by k, stand on the canvas bottom, center on head+shoulders."""
    out = []
    cw, ch = canvas
    for f in frames:
        f = f.crop(f.getbbox())
        s = shrink(f, (max(1, round(f.width * k)), max(1, round(f.height * k))))
        m = np.asarray(s)[..., 3] > 0
        top = m[: max(1, int(s.height * 0.4))]
        cx = np.flatnonzero(top.any(axis=0)).mean() if top.any() else s.width / 2
        c = Image.new('RGBA', canvas, (0, 0, 0, 0))
        c.alpha_composite(s, (int(round(cw / 2 - cx)), ch - s.height)) if s.height <= ch else None
        out.append(c)
    return out


def character(hero, canvas, stand_px, sheets):
    """sheets: {anim: (file, scale_vs_idle, options)}; scale from the idle sheet's standing height."""
    idle = sheet_frames(sheets['idle'][0])
    k = stand_px / max(f.getbbox()[3] - f.getbbox()[1] for f in idle)
    for anim, (file, rel, opts) in sheets.items():
        frames = idle if anim == 'idle' else sheet_frames(file, opts.get('cut_below'))
        frames = frames[: opts.get('take', len(frames))]
        if opts.get('crate'):
            frames = [strip_box_right(f) for f in frames]
        for i, f in enumerate(place(frames, k * rel, canvas)):
            save(f, f'{hero}_{anim}_{i}')
            if anim == 'idle' and i == 0:
                save(f, f'{hero}_idle')


if (SRC / 'dad-idle.png').exists():
    character('dad', (48, 56), 50, {
        'idle': ('dad-idle.png', 1, {'take': 3}),
        'run': ('dad-run.png', 1, {'cut_below': 735}),
        'jump': ('dad-jump.png', 1, {}),
        'push': ('dad-push.png', 2.0, {'crate': True}),
    })

# Manifest of every image, read by the game at startup.
import json
(OUT / 'manifest.json').write_text(json.dumps(sorted(p.stem for p in OUT.glob('*.png'))))
