#!/usr/bin/env python3
"""Jekyll 포스트에서 태그를 추출하여 개별 태그 페이지를 자동 생성한다."""

import sys

# Windows 콘솔(cp949)에서 이모지·한글 출력이 UnicodeEncodeError로 죽지 않도록 stdout을 UTF-8로 강제
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import os
import re
import yaml
from pathlib import Path

BLOG_ROOT = Path(__file__).parent.parent
POSTS_DIR = BLOG_ROOT / "_posts"
TAG_DIR = BLOG_ROOT / "tag"

TEMPLATE = """---
layout: tag
tag: {tag}
title: "Tag: {tag}"
permalink: /tag/{tag}/
---
"""


def extract_tags_from_posts():
    """모든 포스트에서 태그를 추출한다."""
    tags = set()
    for post_file in POSTS_DIR.glob("*.md"):
        content = post_file.read_text(encoding="utf-8")
        match = re.search(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
        if match:
            try:
                front_matter = yaml.safe_load(match.group(1))
                if front_matter and "tags" in front_matter:
                    post_tags = front_matter["tags"]
                    if isinstance(post_tags, list):
                        tags.update(post_tags)
                    elif isinstance(post_tags, str):
                        tags.add(post_tags)
            except yaml.YAMLError:
                print(f"  YAML 파싱 오류: {post_file.name}")
    return sorted(tags)


def generate_tag_pages(tags):
    """각 태그별 페이지 파일을 생성한다."""
    TAG_DIR.mkdir(exist_ok=True)

    # 기존 태그 페이지 삭제 (미사용 태그 정리)
    for existing in TAG_DIR.glob("*.html"):
        existing.unlink()

    for tag in tags:
        # URL-safe slug 생성 (소문자, 특수문자 제거)
        slug = re.sub(r'[^a-z0-9\-]', '', tag.lower().replace(' ', '-'))
        if not slug:
            print(f"  ⚠️ 스킵 (유효하지 않은 태그): {tag}")
            continue
        tag_file = TAG_DIR / f"{slug}.html"
        tag_file.write_text(TEMPLATE.format(tag=tag), encoding="utf-8")
        print(f"  ✅ tag/{slug}.html → {tag}")

    print(f"\n총 {len(tags)}개 태그 페이지 생성 완료")


if __name__ == "__main__":
    print("📌 포스트에서 태그 추출 중...")
    tags = extract_tags_from_posts()
    print(f"   {len(tags)}개 태그 발견: {', '.join(tags)}\n")

    print("📄 태그 페이지 생성 중...")
    generate_tag_pages(tags)
