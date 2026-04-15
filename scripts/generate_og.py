#!/usr/bin/env python3
"""포스트별 OG(Open Graph) 이미지를 자동 생성한다.

사용법:
    python scripts/generate_og.py              # 모든 포스트
    python scripts/generate_og.py --slug NAME  # 특정 포스트만
    python scripts/generate_og.py --default    # 기본 OG 이미지만 생성
    python scripts/generate_og.py --drafts     # _drafts도 포함
"""

import os
import re
import sys
import argparse
import yaml
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ── Config ──
BLOG_ROOT = Path(__file__).parent.parent
POSTS_DIR = BLOG_ROOT / "_posts"
DRAFTS_DIR = BLOG_ROOT / "_drafts"
OG_DIR = BLOG_ROOT / "assets" / "og"

WIDTH = 1200
HEIGHT = 630

# Gruvbox dark theme (블로그 스타일과 일치)
BG_COLOR = (57, 54, 51)          # #393633
TEXT_COLOR = (235, 219, 178)     # #EBDBB2
ACCENT_COLOR = (131, 165, 152)   # #83A598
TAG_BG_COLOR = (69, 66, 62)     # lighten(#393633, 5%)
MUTED_COLOR = (168, 153, 132)   # darken(#EBDBB2, 20%)

# Font paths (Windows)
FONT_CANDIDATES = [
    "C:/Windows/Fonts/NotoSansKR-Bold.ttf",
    "C:/Windows/Fonts/NotoSansKR-Regular.ttf",
    "C:/Windows/Fonts/malgunbd.ttf",   # 맑은 고딕 Bold
    "C:/Windows/Fonts/malgun.ttf",     # 맑은 고딕
]

FONT_REGULAR_CANDIDATES = [
    "C:/Windows/Fonts/NotoSansKR-Regular.ttf",
    "C:/Windows/Fonts/malgun.ttf",
]


def find_font(candidates, size):
    """사용 가능한 폰트를 찾아 반환한다."""
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def extract_post_meta(file_path):
    """포스트 파일에서 메타데이터를 추출한다."""
    content = file_path.read_text(encoding="utf-8")
    match = re.search(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return None
    try:
        meta = yaml.safe_load(match.group(1))
        slug = file_path.stem
        # 날짜 프리픽스 제거: 2026-02-04-slug → slug
        slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", slug)
        meta["slug"] = slug
        return meta
    except yaml.YAMLError:
        return None


def wrap_text(text, font, max_width, draw):
    """텍스트를 max_width에 맞게 줄바꿈한다."""
    lines = []
    words = text.split()
    current_line = ""

    for word in words:
        test_line = f"{current_line} {word}".strip()
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)
    return lines


def generate_og_image(meta, output_path):
    """단일 포스트의 OG 이미지를 생성한다."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Fonts
    font_title = find_font(FONT_CANDIDATES, 42)
    font_blog = find_font(FONT_REGULAR_CANDIDATES, 20)
    font_tag = find_font(FONT_REGULAR_CANDIDATES, 18)
    font_date = find_font(FONT_REGULAR_CANDIDATES, 16)

    padding = 60

    # ── Top: 블로그 이름 ──
    blog_name = "keem's blog."
    draw.text((padding, padding), blog_name, font=font_blog, fill=ACCENT_COLOR)

    # ── Accent line ──
    draw.line(
        [(padding, padding + 36), (WIDTH - padding, padding + 36)],
        fill=ACCENT_COLOR, width=2
    )

    # ── Center: 포스트 제목 ──
    title = meta.get("title", "Untitled")
    title_lines = wrap_text(title, font_title, WIDTH - padding * 2, draw)

    # 최대 3줄까지만 표시
    if len(title_lines) > 3:
        title_lines = title_lines[:3]
        title_lines[-1] = title_lines[-1][:len(title_lines[-1]) - 3] + "..."

    line_height = 56
    total_title_height = len(title_lines) * line_height
    title_start_y = (HEIGHT - total_title_height) // 2 - 20

    for i, line in enumerate(title_lines):
        y = title_start_y + i * line_height
        draw.text((padding, y), line, font=font_title, fill=TEXT_COLOR)

    # ── Bottom: 태그 + 날짜 ──
    tags = meta.get("tags", [])
    if isinstance(tags, str):
        tags = [tags]
    tags = tags[:5]  # 최대 5개

    tag_y = HEIGHT - padding - 50
    tag_x = padding

    for tag in tags:
        tag_text = f"#{tag}"
        bbox = draw.textbbox((0, 0), tag_text, font=font_tag)
        tag_width = bbox[2] - bbox[0] + 16
        tag_height = bbox[3] - bbox[1] + 8

        # 태그 배경
        draw.rounded_rectangle(
            [tag_x, tag_y, tag_x + tag_width, tag_y + tag_height + 4],
            radius=10,
            fill=TAG_BG_COLOR
        )
        draw.text((tag_x + 8, tag_y + 4), tag_text, font=font_tag, fill=MUTED_COLOR)
        tag_x += tag_width + 8

    # 날짜
    date = meta.get("date", "")
    if hasattr(date, "strftime"):
        date_str = date.strftime("%Y-%m-%d")
    else:
        date_str = str(date)[:10]

    date_bbox = draw.textbbox((0, 0), date_str, font=font_date)
    date_width = date_bbox[2] - date_bbox[0]
    draw.text(
        (WIDTH - padding - date_width, HEIGHT - padding - 20),
        date_str, font=font_date, fill=MUTED_COLOR
    )

    # 저장
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(output_path), "PNG", optimize=True)


def main():
    parser = argparse.ArgumentParser(description="OG 이미지 생성")
    parser.add_argument("--slug", help="특정 포스트 slug만 생성")
    parser.add_argument("--drafts", action="store_true", help="_drafts도 포함")
    parser.add_argument("--default", action="store_true", help="기본 OG 이미지만 생성")
    args = parser.parse_args()

    # --default: 기본 이미지만 생성
    if args.default:
        meta = {
            "title": "keem's blog.",
            "tags": ["ue5", "mobile", "game-dev"],
            "date": "2026",
            "slug": "default",
        }
        output = OG_DIR / "default.png"
        generate_og_image(meta, output)
        print("[OK] default.png 생성")
        return

    dirs = [POSTS_DIR]
    if args.drafts:
        dirs.append(DRAFTS_DIR)

    generated = 0
    skipped = 0

    for posts_dir in dirs:
        if not posts_dir.exists():
            continue
        for post_file in sorted(posts_dir.glob("*.md")):
            meta = extract_post_meta(post_file)
            if not meta:
                continue

            slug = meta["slug"]

            if args.slug and slug != args.slug:
                continue

            output = OG_DIR / f"{slug}.png"

            # 이미 존재하면 스킵 (--slug로 지정한 경우는 항상 재생성)
            if output.exists() and not args.slug:
                skipped += 1
                continue

            print(f"  [gen] {slug}.png")
            generate_og_image(meta, output)
            generated += 1

    print(f"\n[OK] {generated}개 생성, {skipped}개 스킵 (이미 존재)")


if __name__ == "__main__":
    main()
