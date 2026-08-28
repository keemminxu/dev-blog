#!/usr/bin/env python3
"""검색엔진에 새 포스트 인덱싱을 요청한다.

사용법:
    python scripts/ping_search_engines.py                    # sitemap ping만
    python scripts/ping_search_engines.py --url URL          # 특정 URL 인덱싱
    python scripts/ping_search_engines.py --all              # 모든 포스트 인덱싱
"""

import sys

# Windows 콘솔(cp949)에서 이모지·한글 출력이 UnicodeEncodeError로 죽지 않도록 stdout을 UTF-8로 강제
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import argparse
import json
import re
import urllib.request
import urllib.error
import yaml
from pathlib import Path

BLOG_ROOT = Path(__file__).parent.parent
POSTS_DIR = BLOG_ROOT / "_posts"

SITE_URL = "https://keemminxu.com"
BASE_URL = ""
SITEMAP_URL = f"{SITE_URL}{BASE_URL}/sitemap.xml"
INDEXNOW_KEY = "8ffe854fb9974c4ca5c63e1fd1e78bf1"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"


def ping_google_sitemap():
    """Google sitemap ping은 2023년에 폐지됨. 참고용으로만 남김.
    Google 인덱싱은 Search Console에서 수동 제출 또는 자동 크롤링에 의존."""
    print("  Google sitemap ping: deprecated (2023). Use Search Console instead.")


def submit_indexnow(urls):
    """IndexNow API로 Bing/Yandex에 URL을 제출한다."""
    if not urls:
        return

    payload = {
        "host": "keemminxu.com",
        "key": INDEXNOW_KEY,
        "keyLocation": f"{SITE_URL}{BASE_URL}/{INDEXNOW_KEY}.txt",
        "urlList": urls,
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        INDEXNOW_ENDPOINT,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"  IndexNow ({len(urls)} URLs): {resp.status}")
    except urllib.error.HTTPError as e:
        print(f"  IndexNow error: {e.code} {e.reason}")
    except Exception as e:
        print(f"  IndexNow failed: {e}")


def get_all_post_urls():
    """모든 포스트의 URL을 생성한다."""
    urls = []
    for post_file in sorted(POSTS_DIR.glob("*.md")):
        content = post_file.read_text(encoding="utf-8")
        match = re.search(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
        if not match:
            continue

        # 파일명에서 날짜와 slug 추출: 2026-02-04-slug.md
        name = post_file.stem
        parts = name.split("-", 3)
        if len(parts) < 4:
            continue
        year, month, day, slug = parts[0], parts[1], parts[2], parts[3]
        url = f"{SITE_URL}{BASE_URL}/{year}/{month}/{day}/{slug}/"
        urls.append(url)

    return urls


def main():
    parser = argparse.ArgumentParser(description="Search engine indexing")
    parser.add_argument("--url", help="Submit a specific URL")
    parser.add_argument("--all", action="store_true", help="Submit all posts")
    args = parser.parse_args()

    print("=== Search Engine Ping ===\n")

    # 1. Google sitemap ping (always)
    print("[Google]")
    ping_google_sitemap()

    # 2. IndexNow
    urls = []
    if args.url:
        urls = [args.url]
    elif args.all:
        urls = get_all_post_urls()
        # 홈페이지 + 태그 + 카테고리 페이지도 포함
        urls.append(f"{SITE_URL}{BASE_URL}/")
        urls.append(f"{SITE_URL}{BASE_URL}/tags/")
        urls.append(f"{SITE_URL}{BASE_URL}/categories/")

    if urls:
        print(f"\n[IndexNow] - {len(urls)} URLs")
        for u in urls:
            print(f"  -> {u}")
        submit_indexnow(urls)
    else:
        print("\n[IndexNow] skipped (no URLs specified, use --url or --all)")

    print("\nDone.")


if __name__ == "__main__":
    main()
