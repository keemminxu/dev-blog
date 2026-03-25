# Blog SEO Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SEO 기반 구축, 소셜 공유 최적화, 태그 시스템 추가로 블로그 유입 증대

**Architecture:** Jekyll GitHub Pages 블로그(minima 테마, 다크 Gruvbox 스타일)에 robots.txt, 자동 sitemap, 태그/카테고리 페이지, OG 이미지 자동 생성, 내부 링크 시스템을 추가한다. GitHub Pages 플러그인 제약 내에서 구현하며, 커스텀 기능은 빌드 전 Python 스크립트로 처리한다.

**Tech Stack:** Jekyll 3.x (GitHub Pages), Liquid templates, Python 3 + Pillow (OG images), SCSS (minima dark theme)

**Blog Repo:** `E:\Project\dev-blog`
**Blog URL:** `https://keemminxu.github.io/dev-blog`
**Branch:** `main`

---

## File Structure

### New Files
```
E:\Project\dev-blog\
├── robots.txt                          # Task 1: 크롤러 지시 파일
├── _layouts/
│   └── tag.html                        # Task 3: 태그별 포스트 목록 레이아웃
├── tags.html                           # Task 3: 태그 인덱스 페이지
├── categories.html                     # Task 4: 카테고리 인덱스 페이지
├── category/
│   ├── unreal-engine.html              # Task 4: 개별 카테고리 페이지
│   ├── devops.html                     # Task 4
│   └── mobile.html                     # Task 4
├── tag/                                # Task 3: 개별 태그 페이지 (스크립트 생성)
│   ├── ue5.html
│   ├── umg.html
│   ├── ... (모든 태그)
│   └── googlegamesdk.html
├── scripts/
│   ├── generate_tags.py                # Task 3: 태그 페이지 자동 생성 스크립트
│   └── generate_og.py                  # Task 5: OG 이미지 자동 생성 스크립트
└── assets/
    └── og/                             # Task 5: 생성된 OG 이미지 저장 디렉토리
        ├── default.png
        ├── ue5-multipart-file-upload-http.png
        └── ... (포스트별 이미지)
```

### Modified Files
```
_config.yml                             # Task 2: jekyll-sitemap 플러그인 추가
_includes/head.html                     # Task 6: OG 이미지 meta 태그 추가
assets/main.scss                        # Task 3,4: 태그/카테고리 페이지 스타일
C:\Users\keemm\.claude\commands\publish.md  # Task 7: OG+태그 생성 단계 추가
```

### Deleted Files
```
sitemap.xml                             # Task 2: 정적 파일 삭제 (자동 생성으로 대체)
```

---

## Phase 1: SEO Foundation

---

### Task 1: robots.txt 생성

**Files:**
- Create: `robots.txt`

- [ ] **Step 1: robots.txt 파일 생성**

```
---
---
User-agent: *
Allow: /

Sitemap: {{ site.url }}{{ site.baseurl }}/sitemap.xml
```

> Note: 빈 front matter(`---`)를 추가해야 Jekyll이 Liquid 변수를 처리한다. URL 변경 시 자동 반영.

- [ ] **Step 2: 커밋**

```bash
cd E:/Project/dev-blog
git add robots.txt
git commit -m "[SEO] robots.txt 추가"
```

---

### Task 2: 자동 sitemap 전환

현재 `sitemap.xml`이 정적 파일로 11개 포스트 중 5개만 포함. `jekyll-sitemap` 플러그인(github-pages gem에 포함)으로 자동 생성 전환.

**Files:**
- Modify: `_config.yml`
- Delete: `sitemap.xml`

- [ ] **Step 1: _config.yml에 플러그인 추가**

`_config.yml` 파일 끝에 추가:

```yaml
plugins:
  - jekyll-sitemap
  - jekyll-seo-tag
  - jekyll-feed
```

- [ ] **Step 2: 정적 sitemap.xml 삭제**

```bash
cd E:/Project/dev-blog
rm sitemap.xml
```

- [ ] **Step 3: 로컬에서 확인**

```bash
cd E:/Project/dev-blog
bundle exec jekyll build
# _site/sitemap.xml에 모든 11개 포스트가 포함되었는지 확인
cat _site/sitemap.xml
```

Expected: 모든 포스트 URL + tags.html + categories.html이 포함된 sitemap

- [ ] **Step 4: 커밋**

```bash
git add _config.yml
git rm sitemap.xml
git commit -m "[SEO] jekyll-sitemap 플러그인으로 자동 sitemap 전환"
```

---

### Task 3: 태그 페이지 시스템

**Files:**
- Create: `_layouts/tag.html`
- Create: `tags.html`
- Create: `tag/*.html` (스크립트로 자동 생성)
- Create: `scripts/generate_tags.py`
- Modify: `assets/main.scss`

- [ ] **Step 1: 태그 레이아웃 생성**

`_layouts/tag.html`:

```html
---
layout: default
---

<div class="tag-page">
  <h1 class="page-heading">🏷️ {{ page.tag }}</h1>
  <p class="tag-description">태그 <strong>{{ page.tag }}</strong>에 해당하는 포스트 목록</p>

  <ul class="post-list">
    {% assign sorted_posts = site.posts | sort: 'date' | reverse %}
    {% for post in sorted_posts %}
      {% if post.tags contains page.tag %}
      <li>
        <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
        <h3>
          <a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
        </h3>
        {% if post.excerpt %}
          <p class="post-excerpt">{{ post.excerpt | strip_html | truncate: 120 }}</p>
        {% endif %}
      </li>
      {% endif %}
    {% endfor %}
  </ul>

  <p class="back-link"><a href="{{ '/tags' | relative_url }}">← 모든 태그 보기</a></p>
</div>
```

- [ ] **Step 2: 태그 인덱스 페이지 생성**

`tags.html`:

```html
---
layout: default
title: Tags
permalink: /tags/
---

<div class="tags-index">
  <h1 class="page-heading">Tags</h1>

  <div class="tag-cloud">
    {% assign tags = site.tags | sort %}
    {% for tag in tags %}
      <a href="{{ '/tag/' | append: tag[0] | relative_url }}" class="tag-badge">
        {{ tag[0] }} <span class="tag-count">({{ tag[1].size }})</span>
      </a>
    {% endfor %}
  </div>

  {% assign tags = site.tags | sort %}
  {% for tag in tags %}
  <div class="tag-section" id="{{ tag[0] }}">
    <h2>{{ tag[0] }} <span class="tag-count">({{ tag[1].size }})</span></h2>
    <ul class="post-list">
      {% assign sorted = tag[1] | sort: 'date' | reverse %}
      {% for post in sorted %}
      <li>
        <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
        <a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
      </li>
      {% endfor %}
    </ul>
  </div>
  {% endfor %}
</div>
```

- [ ] **Step 3: 태그 페이지 자동 생성 스크립트**

`scripts/generate_tags.py`:

```python
#!/usr/bin/env python3
"""Jekyll 포스트에서 태그를 추출하여 개별 태그 페이지를 자동 생성한다."""

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
```

- [ ] **Step 4: 스크립트 실행하여 태그 페이지 생성**

```bash
cd E:/Project/dev-blog
pip install pyyaml  # 의존성 설치 (없을 경우)
python scripts/generate_tags.py
```

Expected: `tag/` 디렉토리에 모든 태그별 .html 파일 생성

- [ ] **Step 5: 태그 관련 SCSS 스타일 추가**

`assets/main.scss` 파일 끝에 추가:

```scss
// ── Tag & Category pages ──

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 32px;
}

.tag-badge {
  display: inline-block;
  padding: 4px 12px;
  background-color: lighten($background-color, 8%);
  color: $text-color;
  border-radius: 16px;
  font-size: 0.85em;
  text-decoration: none;
  transition: background-color 0.2s;

  &:hover {
    background-color: lighten($background-color, 15%);
    color: #83A598;
    text-decoration: none;
  }

  .tag-count {
    color: darken($text-color, 25%);
    font-size: 0.85em;
  }
}

.tag-section {
  margin-bottom: 32px;

  h2 {
    border-bottom: 1px solid lighten($background-color, 10%);
    padding-bottom: 8px;

    .tag-count {
      color: darken($text-color, 25%);
      font-size: 0.7em;
      font-weight: normal;
    }
  }
}

.tag-description {
  color: darken($text-color, 15%);
  margin-bottom: 24px;
}

.back-link {
  margin-top: 32px;
}

.post-excerpt {
  color: darken($text-color, 15%);
  font-size: 0.9em;
  margin-top: 4px;
}

// Post tags inline (for post pages)
.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 16px;

  .tag-link {
    display: inline-block;
    padding: 2px 8px;
    background-color: lighten($background-color, 6%);
    color: darken($text-color, 10%);
    border-radius: 12px;
    font-size: 0.75em;
    text-decoration: none;

    &:hover {
      background-color: lighten($background-color, 12%);
      color: #83A598;
    }
  }
}

// Category page styles
.category-section {
  margin-bottom: 40px;

  h2 {
    border-bottom: 1px solid lighten($background-color, 10%);
    padding-bottom: 8px;

    .cat-count {
      color: darken($text-color, 25%);
      font-size: 0.7em;
      font-weight: normal;
    }
  }
}

.category-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 32px;

  .category-card {
    padding: 12px 20px;
    background-color: lighten($background-color, 5%);
    border: 1px solid lighten($background-color, 10%);
    border-radius: 8px;
    text-decoration: none;
    color: $text-color;
    transition: all 0.2s;

    &:hover {
      background-color: lighten($background-color, 10%);
      border-color: #83A598;
      color: #83A598;
    }

    .cat-name {
      font-weight: 500;
    }

    .cat-count {
      color: darken($text-color, 25%);
      font-size: 0.85em;
    }
  }
}
```

- [ ] **Step 6: 커밋**

```bash
cd E:/Project/dev-blog
git add _layouts/tag.html tags.html tag/ scripts/generate_tags.py assets/main.scss
git commit -m "[SEO] 태그 페이지 시스템 추가"
```

---

### Task 4: 카테고리 페이지 시스템

현재 카테고리: `unreal-engine` (8), `devops` (1), `mobile` (2) — 3개뿐이므로 수동 생성.

**Files:**
- Create: `categories.html`
- Create: `category/unreal-engine.html`
- Create: `category/devops.html`
- Create: `category/mobile.html`

- [ ] **Step 1: 카테고리 인덱스 페이지 생성**

`categories.html`:

```html
---
layout: default
title: Categories
permalink: /categories/
---

<div class="categories-index">
  <h1 class="page-heading">Categories</h1>

  <div class="category-list">
    {% assign categories = site.categories | sort %}
    {% for cat in categories %}
      <a href="{{ '/category/' | append: cat[0] | relative_url }}" class="category-card">
        <span class="cat-name">{{ cat[0] }}</span>
        <span class="cat-count">({{ cat[1].size }})</span>
      </a>
    {% endfor %}
  </div>

  {% assign categories = site.categories | sort %}
  {% for cat in categories %}
  <div class="category-section" id="{{ cat[0] }}">
    <h2>{{ cat[0] }} <span class="cat-count">({{ cat[1].size }})</span></h2>
    <ul class="post-list">
      {% assign sorted = cat[1] | sort: 'date' | reverse %}
      {% for post in sorted %}
      <li>
        <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
        <a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
      </li>
      {% endfor %}
    </ul>
  </div>
  {% endfor %}
</div>
```

- [ ] **Step 2: 개별 카테고리 페이지 생성**

`category/unreal-engine.html`:

```html
---
layout: default
title: "Category: Unreal Engine"
permalink: /category/unreal-engine/
---

<div class="category-page">
  <h1 class="page-heading">🎮 Unreal Engine</h1>

  <ul class="post-list">
    {% assign posts = site.categories['unreal-engine'] | sort: 'date' | reverse %}
    {% for post in posts %}
    <li>
      <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
      <h3><a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></h3>
      {% if post.excerpt %}
        <p class="post-excerpt">{{ post.excerpt | strip_html | truncate: 120 }}</p>
      {% endif %}
      <div class="post-tags">
        {% for tag in post.tags %}
          <a href="{{ '/tag/' | append: tag | relative_url }}" class="tag-link">{{ tag }}</a>
        {% endfor %}
      </div>
    </li>
    {% endfor %}
  </ul>

  <p class="back-link"><a href="{{ '/categories' | relative_url }}">← 모든 카테고리 보기</a></p>
</div>
```

`category/devops.html`:

```html
---
layout: default
title: "Category: DevOps"
permalink: /category/devops/
---

<div class="category-page">
  <h1 class="page-heading">⚙️ DevOps</h1>

  <ul class="post-list">
    {% assign posts = site.categories['devops'] | sort: 'date' | reverse %}
    {% for post in posts %}
    <li>
      <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
      <h3><a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></h3>
      {% if post.excerpt %}
        <p class="post-excerpt">{{ post.excerpt | strip_html | truncate: 120 }}</p>
      {% endif %}
      <div class="post-tags">
        {% for tag in post.tags %}
          <a href="{{ '/tag/' | append: tag | relative_url }}" class="tag-link">{{ tag }}</a>
        {% endfor %}
      </div>
    </li>
    {% endfor %}
  </ul>

  <p class="back-link"><a href="{{ '/categories' | relative_url }}">← 모든 카테고리 보기</a></p>
</div>
```

`category/mobile.html`:

```html
---
layout: default
title: "Category: Mobile"
permalink: /category/mobile/
---

<div class="category-page">
  <h1 class="page-heading">📱 Mobile</h1>

  <ul class="post-list">
    {% assign posts = site.categories['mobile'] | sort: 'date' | reverse %}
    {% for post in posts %}
    <li>
      <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
      <h3><a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></h3>
      {% if post.excerpt %}
        <p class="post-excerpt">{{ post.excerpt | strip_html | truncate: 120 }}</p>
      {% endif %}
      <div class="post-tags">
        {% for tag in post.tags %}
          <a href="{{ '/tag/' | append: tag | relative_url }}" class="tag-link">{{ tag }}</a>
        {% endfor %}
      </div>
    </li>
    {% endfor %}
  </ul>

  <p class="back-link"><a href="{{ '/categories' | relative_url }}">← 모든 카테고리 보기</a></p>
</div>
```

- [ ] **Step 3: 네비게이션에 태그/카테고리 링크 추가**

`_config.yml`에 헤더 네비게이션 추가:

```yaml
header_pages:
  - tags.html
  - categories.html
  - privacy-policy.md
```

> Note: `header_pages`는 allowlist로 동작한다. 여기에 없는 페이지는 헤더 네비게이션에서 사라지므로 기존 privacy-policy도 포함해야 한다.

- [ ] **Step 4: 커밋**

```bash
cd E:/Project/dev-blog
git add categories.html category/ _config.yml
git commit -m "[SEO] 카테고리 페이지 시스템 추가"
```

---

## Phase 2: Share Optimization

---

### Task 5: OG 이미지 자동 생성 스크립트

**Files:**
- Create: `scripts/generate_og.py`
- Create: `scripts/requirements.txt`
- Create: `assets/og/` (디렉토리)

- [ ] **Step 1: 의존성 파일 생성**

`scripts/requirements.txt`:

```
Pillow>=10.0.0
PyYAML>=6.0
```

- [ ] **Step 2: OG 이미지 생성 스크립트 작성**

`scripts/generate_og.py`:

```python
#!/usr/bin/env python3
"""포스트별 OG(Open Graph) 이미지를 자동 생성한다.

사용법:
    python scripts/generate_og.py              # 모든 포스트
    python scripts/generate_og.py --slug NAME  # 특정 포스트만
"""

import os
import re
import sys
import textwrap
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
    blog_name = "Keemminxu's Dev Blog"
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
    args = parser.parse_args()

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

            print(f"  🎨 {slug}.png")
            generate_og_image(meta, output)
            generated += 1

    print(f"\n✅ {generated}개 생성, {skipped}개 스킵 (이미 존재)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: 의존성 설치 및 실행**

```bash
cd E:/Project/dev-blog
pip install -r scripts/requirements.txt
python scripts/generate_og.py
```

Expected: `assets/og/` 에 11개 PNG 파일 생성

- [ ] **Step 4: 생성된 이미지 확인**

```bash
ls -la E:/Project/dev-blog/assets/og/
```

Expected: 각 파일이 ~50-100KB, 1200x630 크기

- [ ] **Step 5: 커밋**

```bash
cd E:/Project/dev-blog
git add scripts/ assets/og/
git commit -m "[SEO] OG 이미지 자동 생성 시스템 추가"
```

---

### Task 6: OG 이미지 meta 태그 연동

**Files:**
- Modify: `_includes/head.html`

- [ ] **Step 1: head.html에 OG 이미지 태그 추가**

`_includes/head.html`의 `{%- seo -%}` 태그 아래에 추가:

```html
  {%- seo -%}

  <!-- OG Image (jekyll-seo-tag가 page.image 미설정 시 og:image를 생성하지 않으므로 직접 추가) -->
  {% if page.id %}
    <meta property="og:image" content="{{ site.url }}{{ site.baseurl }}/assets/og/{{ page.slug }}.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
  {% elsif page.image == nil and site.image == nil %}
    <meta property="og:image" content="{{ site.url }}{{ site.baseurl }}/assets/og/default.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
  {% endif %}
```

- [ ] **Step 2: 기본 OG 이미지 생성**

`generate_og.py`에 `--default` 플래그를 추가한다 (main 함수의 argparse에):

```python
parser.add_argument("--default", action="store_true", help="기본 OG 이미지만 생성")
```

main() 함수 시작 부분에 분기 추가:

```python
if args.default:
    meta = {"title": "Keemminxu's Dev Blog", "tags": ["ue5", "mobile", "game-dev"], "date": "2026", "slug": "default"}
    generate_og_image(meta, OG_DIR / "default.png")
    print("✅ default.png 생성")
    return
```

실행:

```bash
cd E:/Project/dev-blog
python scripts/generate_og.py --default
```

- [ ] **Step 3: 커밋**

```bash
cd E:/Project/dev-blog
git add _includes/head.html assets/og/default.png
git commit -m "[SEO] OG 이미지 meta 태그 연동"
```

---

### Task 7: /publish 스킬에 OG + 태그 생성 통합

**Files:**
- Modify: `C:\Users\keemm\.claude\commands\publish.md`

- [ ] **Step 1: /publish 스킬에 빌드 전 단계 추가**

`publish.md`의 Step 3 (발행 실행) 부분에 OG 이미지 + 태그 페이지 생성 단계를 추가:

기존:
```bash
cd E:/Project/dev-blog
git pull origin main
# 드래프트를 _posts/로 이동
```

변경 후:
```bash
cd E:/Project/dev-blog
git pull origin main

# 1. 드래프트를 _posts/로 이동
# _drafts/YYYY-MM-DD-slug.md → _posts/YYYY-MM-DD-slug.md

# 2. OG 이미지 생성 (새 포스트만)
python scripts/generate_og.py --slug SLUG_NAME

# 3. 태그 페이지 갱신 (새 태그가 추가됐을 수 있음)
python scripts/generate_tags.py

git add _posts/YYYY-MM-DD-slug.md assets/og/ tag/
# 이미지가 있는 경우 assets/images/도 추가
git commit -m "[POST] 포스트 제목"
git push origin main
```

- [ ] **Step 2: 커밋 (claude commands repo)**

이 파일은 `.claude` 디렉토리에 있으므로 별도 커밋 불필요 (로컬 설정)

---

### Task 8: 포스트 간 내부 링크 (관련 포스트)

**Files:**
- Create: `_includes/related-posts.html`
- Modify: `_layouts/post.html` (새로 생성 — minima 오버라이드)

- [ ] **Step 1: post 레이아웃 오버라이드 생성**

minima 테마의 post 레이아웃을 오버라이드하여 태그 표시 + 관련 포스트 섹션을 추가한다.

`_layouts/post.html`:

```html
---
layout: default
---
<article class="post h-entry" itemscope itemtype="http://schema.org/BlogPosting">

  <header class="post-header">
    <h1 class="post-title p-name" itemprop="name headline">{{ page.title | escape }}</h1>
    <p class="post-meta">
      <time class="dt-published" datetime="{{ page.date | date_to_xmlschema }}" itemprop="datePublished">
        {{ page.date | date: "%Y-%m-%d" }}
      </time>
      {% if page.categories.size > 0 %}
        · <a href="{{ '/category/' | append: page.categories[0] | relative_url }}">{{ page.categories[0] }}</a>
      {% endif %}
    </p>
    {% if page.tags.size > 0 %}
    <div class="post-tags">
      {% for tag in page.tags %}
        <a href="{{ '/tag/' | append: tag | relative_url }}" class="tag-link">{{ tag }}</a>
      {% endfor %}
    </div>
    {% endif %}
  </header>

  <div class="post-content e-content" itemprop="articleBody">
    {{ content }}
  </div>

  {% include related-posts.html %}

  <a class="u-url" href="{{ page.url | relative_url }}" hidden></a>
</article>
```

- [ ] **Step 2: 관련 포스트 컴포넌트 생성**

`_includes/related-posts.html`:

```html
{% comment %}
  태그 기반 관련 포스트를 최대 3개 표시한다.
  공통 태그가 1개 이상인 포스트를 최신순으로 표시.
{% endcomment %}

{% assign max_related = 3 %}
{% assign related = "" | split: "" %}

{% for post in site.posts %}
  {% if post.url == page.url %}
    {% continue %}
  {% endif %}

  {% assign common_tags = 0 %}
  {% for tag in page.tags %}
    {% if post.tags contains tag %}
      {% assign common_tags = common_tags | plus: 1 %}
    {% endif %}
  {% endfor %}

  {% if common_tags > 0 %}
    {% assign related = related | push: post %}
  {% endif %}
{% endfor %}

{% if related.size > 0 %}
<div class="related-posts">
  <h3>관련 포스트</h3>
  <ul>
    {% for post in related limit: max_related %}
    <li>
      <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
      <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
    </li>
    {% endfor %}
  </ul>
</div>
{% endif %}
```

- [ ] **Step 3: 관련 포스트 스타일 추가**

`assets/main.scss` 끝에 추가:

```scss
// ── Related posts ──

.related-posts {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid lighten($background-color, 10%);

  h3 {
    font-size: 1.1em;
    margin-bottom: 12px;
    color: darken($text-color, 10%);
  }

  ul {
    list-style: none;
    padding: 0;

    li {
      margin-bottom: 8px;

      .post-meta {
        font-size: 0.85em;
        margin-right: 8px;
      }
    }
  }
}
```

- [ ] **Step 4: 커밋**

```bash
cd E:/Project/dev-blog
git add _layouts/post.html _includes/related-posts.html assets/main.scss
git commit -m "[SEO] 포스트 태그 표시 및 관련 포스트 추가"
```

---

## Phase 3: Expansion (별도 계획 필요)

### Task 9: 디자인 변경 (UI/UX)

> 별도 brainstorming 세션에서 스코프 정의 필요.
> - 현재 minima 테마 유지 vs 커스텀 테마 제작
> - 모바일 반응형 개선 영역
> - 다크 모드 토글 필요 여부
> - 홈페이지 레이아웃 변경 (현재 단순 포스트 목록)

### Task 10: 영어 버전 시스템

> 별도 brainstorming 세션에서 설계 필요.
> - /archive 스킬에 `--en` 플래그 추가
> - 포스트 파일명 규칙 (slug-en.md vs en/slug.md)
> - 언어 전환 UI
> - 기존 11개 포스트 영어 번역 우선순위

---

## Verification Checklist

Phase 완료 후 확인:

### Phase 1 완료 시
- [ ] `robots.txt`가 `https://keemminxu.github.io/dev-blog/robots.txt`에서 접근 가능
- [ ] `sitemap.xml`이 모든 포스트 + 태그/카테고리 페이지를 포함
- [ ] `/tags/` 페이지에 모든 태그와 포스트 목록 표시
- [ ] `/categories/` 페이지에 3개 카테고리 표시
- [ ] 개별 태그 페이지 (예: `/tag/ue5/`) 정상 작동
- [ ] 개별 카테고리 페이지 (예: `/category/unreal-engine/`) 정상 작동
- [ ] 헤더 네비게이션에 Tags, Categories 링크 표시

### Phase 2 완료 시
- [ ] 모든 포스트에 OG 이미지 생성됨 (`assets/og/*.png`)
- [ ] SNS 공유 시 OG 이미지 카드 미리보기 표시 (https://www.opengraph.xyz/ 로 확인)
- [ ] 각 포스트 페이지에 태그 링크 표시
- [ ] 각 포스트 하단에 관련 포스트 목록 (최대 3개) 표시
- [ ] `/publish` 스킬이 OG 이미지 + 태그 페이지 자동 생성
