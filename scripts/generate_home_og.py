#!/usr/bin/env python3
"""홈 페이지용 OG 이미지 생성 (keem's blog. / GO HAVE SOME FUN!)"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BLOG_ROOT = Path(__file__).parent.parent
FONT_PATH = BLOG_ROOT / "assets" / "fonts" / "HBIOS-SYS" / "HBIOS-SYS.ttf"
OUTPUT = BLOG_ROOT / "assets" / "og" / "home-og.png"

WIDTH, HEIGHT = 1200, 630

BG = (22, 19, 17)          # #161311
SURFACE = (34, 31, 29)      # #221f1d
PRIMARY = (255, 225, 167)   # #ffe1a7
ACCENT = (251, 191, 36)     # #fbbf24
MUTED = (138, 129, 119)

img = Image.new("RGB", (WIDTH, HEIGHT), BG)
draw = ImageDraw.Draw(img)

font_title = ImageFont.truetype(str(FONT_PATH), 140)
font_sub = ImageFont.truetype(str(FONT_PATH), 56)
font_tag = ImageFont.truetype(str(FONT_PATH), 28)

# Retro CRT frame border
border_pad = 40
draw.rectangle(
    [border_pad, border_pad, WIDTH - border_pad, HEIGHT - border_pad],
    outline=PRIMARY, width=4
)
# Inner screen
inner_pad = 70
draw.rectangle(
    [inner_pad, inner_pad, WIDTH - inner_pad, HEIGHT - inner_pad],
    fill=SURFACE
)

# Scanlines
for y in range(inner_pad, HEIGHT - inner_pad, 4):
    draw.line([(inner_pad, y), (WIDTH - inner_pad, y)], fill=(28, 25, 23), width=1)

# Title: keem's blog.
title = "keem's blog."
tb = draw.textbbox((0, 0), title, font=font_title)
tw, th = tb[2] - tb[0], tb[3] - tb[1]
tx = (WIDTH - tw) // 2
ty = (HEIGHT - th) // 2 - 70
draw.text((tx + 5, ty + 5), title, font=font_title, fill=(10, 8, 6))  # shadow
draw.text((tx, ty), title, font=font_title, fill=PRIMARY)

# Subtitle: GO HAVE SOME FUN!
sub = "GO HAVE SOME FUN!"
sb = draw.textbbox((0, 0), sub, font=font_sub)
sw, sh = sb[2] - sb[0], sb[3] - sb[1]
sx = (WIDTH - sw) // 2
sy = ty + th + 30
draw.text((sx, sy), sub, font=font_sub, fill=ACCENT)

# Bottom tag line
tag = "> UNREAL  GODOT  DAILY  _"
gb = draw.textbbox((0, 0), tag, font=font_tag)
gw = gb[2] - gb[0]
gx = (WIDTH - gw) // 2
gy = HEIGHT - inner_pad - 60
draw.text((gx, gy), tag, font=font_tag, fill=MUTED)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
img.save(str(OUTPUT), "PNG", optimize=True)
print(f"[OK] {OUTPUT}")
