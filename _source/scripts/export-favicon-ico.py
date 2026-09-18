"""Rasterise favicon.svg into the multi-resolution favicon.ico.

The .svg is the single source of truth: its paths are parsed rather than the
tile data re-derived, so the two icons cannot drift apart.
"""
import io, re, struct
from PIL import Image, ImageDraw

svg = open('favicon.svg').read()
vx, vy, vw, vh = (float(n) for n in re.search(r'viewBox="([^"]+)"', svg).group(1).split())
background = re.search(r'<rect[^>]*fill="(#[0-9a-f]{6})"', svg).group(1)
stroke = re.search(r'<g stroke="(#[0-9a-f]{6})" stroke-width="([0-9.]+)"', svg)
stroke_color, stroke_width = stroke.group(1), float(stroke.group(2))

paths = []
for d, fill in re.findall(r'<path d="([^"]+)" fill="(#[0-9a-f]{6})"', svg):
    points = [tuple(float(v) for v in pair.split())
              for pair in re.findall(r'[ML]([-0-9.]+ [-0-9.]+)', d)]
    paths.append((points, fill))

SUPERSAMPLE = 8                       # polygon edges need it; ICO frames are tiny

# Optical sizing. A favicon is not one drawing scaled four ways: at 16px the
# full halo collapses into grey mush and the joints eat the frame, so the small
# frames crop in on the centre and draw thinner joints. Each entry is
# (pixels, window in mosaic units, joint width multiplier, halo darkening).
# Cropping in costs contrast, because the tiles left in frame are the brightest
# of the halo, so the small frames darken them to keep the centre dominant.
SIZES = [(64, 36.0, 1.0, 1.0), (48, 33.0, 0.9, 0.9), (32, 27.0, 0.7, 0.62), (16, 21.0, 0.45, 0.42)]

def shade(fill, factor):
    if fill == '#ffffff' or factor == 1.0:
        return fill
    value = round(int(fill[1:3], 16) * factor)
    return '#' + f'{value:02x}' * 3

def render(size, window, joint, dim):
    # Crop about the centre of the full viewBox rather than its origin.
    cx, cy = vx + vw / 2, vy + vh / 2
    ox, oy = cx - window / 2, cy - window / 2
    scale = size * SUPERSAMPLE / window
    image = Image.new('RGBA', (size * SUPERSAMPLE, size * SUPERSAMPLE), background)
    draw = ImageDraw.Draw(image)
    for points, fill in paths:
        flat = [((x - ox) * scale, (y - oy) * scale) for x, y in points]
        draw.polygon(flat, fill=shade(fill, dim), outline=stroke_color,
                     width=max(1, round(stroke_width * joint * scale)))
    return image.resize((size, size), Image.LANCZOS)

frames = []
for size, window, joint, dim in SIZES:
    buffer = io.BytesIO()
    render(size, window, joint, dim).save(buffer, format='PNG', optimize=True)
    frames.append((size, buffer.getvalue()))

# ICO container: 6-byte header, then one 16-byte directory entry per frame.
header = struct.pack('<HHH', 0, 1, len(frames))
offset = len(header) + 16 * len(frames)
directory, body = b'', b''
for size, data in frames:
    directory += struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(data), offset)
    body += data
    offset += len(data)

open('favicon.ico', 'wb').write(header + directory + body)
open('_source/public/favicon.ico', 'wb').write(header + directory + body)
print('frames:', ', '.join(f'{s}x{s} ({len(d)}B)' for s, d in frames))
print('total:', len(header + directory + body), 'bytes (was 32038)')
