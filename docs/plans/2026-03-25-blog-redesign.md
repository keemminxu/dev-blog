# Blog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL:** 커밋 메시지에 Co-Authored-By 트레일러를 절대 포함하지 마라.

**Goal:** minima 테마 기반 Jekyll 블로그를 미니멀 웜 다크 디자인(stone+amber)으로 전면 리디자인한다.

**Architecture:** minima 테마를 유지하되 모든 레이아웃과 스타일을 오버라이드한다. 재사용 가능한 include 컴포넌트(post-card, category-tabs, header, footer)를 만들고 각 레이아웃에서 조합하여 사용한다.

**Tech Stack:** Jekyll 3.x (GitHub Pages), Liquid, SCSS, IBM Plex Sans KR + JetBrains Mono (Google Fonts), Vanilla JS (햄버거 메뉴)

**Blog Repo:** `E:\Project\dev-blog`
**Spec:** `E:\Project\dev-blog\docs\specs\2026-03-25-blog-redesign.md`

---

## File Structure

### New Files
```
_layouts/default.html       # Task 2: 전체 HTML 셸 (헤더/푸터 포함)
_layouts/home.html          # Task 4: 카드형 포스트 리스트 + 카테고리 탭
_layouts/page.html          # Task 5: 일반 페이지 레이아웃
_includes/header.html       # Task 2: 프로필 + 블로그명 + 네비게이션
_includes/footer.html       # Task 2: 소셜 링크 + 저작권
_includes/post-card.html    # Task 3: 재사용 카드 컴포넌트
_includes/category-tabs.html # Task 3: 카테고리 탭 컴포넌트
```

### Modified Files
```
assets/main.scss            # Task 1: 전면 재작성
_includes/head.html         # Task 1: 폰트 변경
_layouts/post.html          # Task 5: 새 디자인 적용
_layouts/tag.html           # Task 6: 카드형 레이아웃
category/unreal-engine.html # Task 6: 카드형 + 카테고리 탭
category/devops.html        # Task 6: 카드형 + 카테고리 탭
category/mobile.html        # Task 6: 카드형 + 카테고리 탭
categories.html             # Task 6: 카드형
_config.yml                 # Task 6: header_pages 수정
```

---

## Task 1: SCSS 전면 재작성 + 폰트 변경

**Files:**
- Rewrite: `assets/main.scss`
- Modify: `_includes/head.html`

- [ ] **Step 1: head.html 폰트 변경**

`_includes/head.html`에서 Noto Sans KR을 IBM Plex Sans KR + JetBrains Mono로 교체.

기존 (line 25-28):
```html
  <!-- Custom Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet">
```

변경:
```html
  <!-- Custom Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@300;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
```

나머지 head.html 내용은 그대로 유지.

- [ ] **Step 2: main.scss 전면 재작성**

`assets/main.scss`를 아래 내용으로 **완전히 교체** (기존 내용 전부 삭제 후 새로 작성):

```scss
---
---

// ═══════════════════════════════════════
// Design Tokens
// ═══════════════════════════════════════

$bg: #292524;
$surface: #1c1917;
$text: #e7e5e4;
$text-muted: #a8a29e;
$accent: #fbbf24;
$accent-hover: #f59e0b;
$border: #44403c;
$surface-hover: #292524;

$font-base: 'IBM Plex Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
$font-code: 'JetBrains Mono', 'Consolas', monospace;

$max-width: 720px;
$max-width-wide: 960px;
$breakpoint-mobile: 768px;

// ═══════════════════════════════════════
// Minima override variables
// ═══════════════════════════════════════

$background-color: $bg;
$text-color: $text;
$brand-color: $accent;
$brand-color-light: $accent-hover;
$brand-color-dark: darken($accent, 15%);
$base-font-family: $font-base;
$site-title-color: $text;

@import "minima";

// ═══════════════════════════════════════
// Base Reset & Typography
// ═══════════════════════════════════════

body {
  background-color: $bg;
  color: $text;
  font-family: $font-base;
  font-weight: 300;
  font-size: 16px;
  line-height: 1.8;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  color: $text;
  font-weight: 600;
}

a {
  color: $accent;
  text-decoration: none;
  transition: color 0.2s;

  &:visited { color: $accent; }
  &:hover { color: $accent-hover; }
}

::selection {
  background-color: rgba($accent, 0.3);
  color: $text;
}

hr {
  border: none;
  border-top: 1px solid $border;
  margin: 2rem 0;
}

img {
  max-width: 100%;
  border-radius: 8px;
}

// ═══════════════════════════════════════
// Layout
// ═══════════════════════════════════════

.wrapper {
  max-width: $max-width-wide;
  margin: 0 auto;
  padding: 0 24px;
}

.content-wrapper {
  max-width: $max-width;
  margin: 0 auto;
}

// ═══════════════════════════════════════
// Header
// ═══════════════════════════════════════

.site-header {
  background-color: $bg;
  border-top: none;
  border-bottom: 1px solid $border;
  padding: 20px 0;

  .wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}

.site-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;

  &:hover { text-decoration: none; }
}

.site-profile {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.site-brand-text {
  display: flex;
  flex-direction: column;
}

.site-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: $text;
  line-height: 1.3;
  letter-spacing: -0.01em;

  &, &:visited { color: $text; }
  &:hover { color: $accent; text-decoration: none; }
}

.site-subtitle {
  font-size: 0.85rem;
  font-weight: 300;
  color: $text-muted;
  line-height: 1.3;
}

.site-nav {
  display: flex;
  align-items: center;
  gap: 24px;
  background: none;
  border: none;
  padding: 0;
  min-height: 0;
  line-height: normal;

  .page-link {
    color: $text;
    font-weight: 500;
    font-size: 0.9rem;
    transition: color 0.2s;

    &:hover { color: $accent; }
    &:not(:last-child) { margin-right: 0; }
  }
}

// Hamburger menu (mobile)
.menu-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;

  svg {
    width: 24px;
    height: 24px;
    stroke: $text;
  }
}

.mobile-nav {
  display: none;
  padding: 16px 0;
  border-bottom: 1px solid $border;

  &.is-open { display: block; }

  a {
    display: block;
    padding: 8px 0;
    color: $text;
    font-weight: 500;
    font-size: 0.9rem;

    &:hover { color: $accent; }
  }
}

// ═══════════════════════════════════════
// Footer
// ═══════════════════════════════════════

.site-footer {
  background-color: $bg;
  border-top: 1px solid $border;
  padding: 48px 0 32px;
  text-align: center;
}

.footer-brand {
  font-size: 1rem;
  font-weight: 500;
  color: $text;
  margin-bottom: 4px;
}

.footer-description {
  font-size: 0.85rem;
  font-weight: 300;
  color: $text-muted;
  margin-bottom: 20px;
}

.footer-social {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 20px;

  a {
    color: $text-muted;
    transition: color 0.2s;

    &:hover { color: $accent; }

    svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
  }
}

.footer-legal {
  font-size: 0.8rem;
  font-weight: 300;
  color: $text-muted;

  a {
    color: $text-muted;
    &:hover { color: $accent; }
  }
}

// ═══════════════════════════════════════
// Category Tabs
// ═══════════════════════════════════════

.category-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 32px;
  flex-wrap: wrap;

  .tab {
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 500;
    color: $text-muted;
    background: transparent;
    border: 1px solid $border;
    text-decoration: none;
    transition: all 0.2s;

    &:hover {
      color: $accent;
      border-color: $accent;
    }

    &.active {
      color: $bg;
      background-color: $accent;
      border-color: $accent;
    }
  }
}

// ═══════════════════════════════════════
// Post Card
// ═══════════════════════════════════════

.post-card {
  display: flex;
  gap: 24px;
  padding: 24px 0;
  border-bottom: 1px solid $border;
  transition: opacity 0.2s;

  &:last-child { border-bottom: none; }
  &:hover { opacity: 0.9; }
}

.post-card-thumbnail {
  flex-shrink: 0;
  width: 240px;
  height: 126px;
  border-radius: 8px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
    transition: transform 0.3s;
  }

  &:hover img {
    transform: scale(1.03);
  }
}

.post-card-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.post-card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: $text;
  margin: 0 0 8px;
  line-height: 1.4;

  a {
    color: $text;
    &:hover { color: $accent; }
  }
}

.post-card-meta {
  font-size: 0.85rem;
  font-weight: 300;
  color: $text-muted;
  margin-bottom: 8px;

  a {
    color: $text-muted;
    &:hover { color: $accent; }
  }
}

.post-card-excerpt {
  font-size: 0.9rem;
  font-weight: 300;
  color: $text-muted;
  line-height: 1.6;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

// ═══════════════════════════════════════
// Post Page
// ═══════════════════════════════════════

.post-header {
  margin-bottom: 32px;
}

.post-title {
  font-size: 2rem;
  font-weight: 600;
  color: $text;
  line-height: 1.3;
  margin-bottom: 12px;
}

.post-meta {
  font-size: 0.85rem;
  font-weight: 300;
  color: $text-muted;

  a {
    color: $text-muted;
    &:hover { color: $accent; }
  }
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;

  .tag-link {
    display: inline-block;
    padding: 3px 10px;
    background-color: $surface;
    color: $text-muted;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.2s;

    &:hover {
      color: $accent;
      background-color: lighten($surface, 5%);
    }
  }
}

.post-content {
  font-weight: 300;
  line-height: 1.8;

  h1, h2, h3, h4 {
    margin-top: 2em;
    margin-bottom: 0.5em;
  }

  h2 { font-size: 1.5rem; }
  h3 { font-size: 1.25rem; }
  h4 { font-size: 1.1rem; }

  p { margin-bottom: 1.2em; }

  ul, ol {
    margin-bottom: 1.2em;
    padding-left: 1.5em;
  }

  li { margin-bottom: 0.3em; }

  blockquote {
    border-left: 3px solid $accent;
    padding: 0.5em 1em;
    margin: 1.5em 0;
    color: $text-muted;
    background-color: $surface;
    border-radius: 0 8px 8px 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5em 0;

    th, td {
      padding: 10px 14px;
      border: 1px solid $border;
      font-size: 0.9rem;
    }

    th {
      background-color: $surface;
      font-weight: 500;
    }

    tr:nth-child(even) {
      background-color: rgba($surface, 0.5);
    }
  }

  img {
    display: block;
    margin: 1.5em auto;
    max-width: 100%;
    border-radius: 8px;
  }

  strong { font-weight: 600; }
}

// ═══════════════════════════════════════
// Related Posts
// ═══════════════════════════════════════

.related-posts {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid $border;

  h3 {
    font-size: 1.1rem;
    font-weight: 500;
    margin-bottom: 12px;
    color: $text;
  }

  ul {
    list-style: none;
    padding: 0;

    li {
      margin-bottom: 10px;

      .post-meta {
        font-size: 0.85rem;
        margin-right: 8px;
      }

      a {
        color: $text;
        &:hover { color: $accent; }
      }
    }
  }
}

// ═══════════════════════════════════════
// Code Blocks
// ═══════════════════════════════════════

pre, code {
  font-family: $font-code;
  background-color: $surface;
  border: 1px solid $border;
  border-radius: 6px;
}

code {
  padding: 2px 6px;
  font-size: 0.85em;
  color: $accent;
}

pre {
  padding: 20px;
  overflow-x: auto;
  font-size: 0.9rem;
  line-height: 1.6;

  > code {
    border: 0;
    padding: 0;
    color: $text;
    background: none;
  }
}

// Inline code in text
p code, li code, td code,
h1 code, h2 code, h3 code, h4 code {
  background-color: $surface;
  color: $accent;
  padding: 2px 6px;
  border: 1px solid $border;
  border-radius: 4px;
  font-size: 0.85em;
}

// Syntax highlighting
div.highlight,
figure.highlight,
.highlight {
  background-color: $surface !important;
  border: 1px solid $border;
  border-radius: 8px;
  margin: 1.5em 0;

  pre, pre.highlight, code, pre code {
    background-color: $surface !important;
    color: $text !important;
  }

  .c, .cm, .c1, .cs { color: #6b7280 !important; }  // comments
  .k, .kd, .kn, .kp, .kr, .kc, .kt { color: #c084fc !important; }  // keywords
  .s, .s1, .s2, .sb, .sc, .sd, .sh, .sx, .sr { color: #86efac !important; }  // strings
  .na { color: $accent !important; }  // attributes
  .nb, .nc, .no, .nd { color: #93c5fd !important; }  // builtins
  .nf, .nx { color: #93c5fd !important; }  // functions
  .nn { color: $accent !important; }  // namespace
  .ni, .ne { color: #fca5a5 !important; }  // exceptions
  .mi, .mf, .mh, .mo, .il { color: #fdba74 !important; }  // numbers
  .o, .p { color: $text !important; }  // operators
  .nt { color: #fca5a5 !important; }  // tags
  .nv, .vi, .vg, .vc { color: #fca5a5 !important; }  // variables
  .err { color: #fca5a5 !important; background-color: transparent !important; }
  .gd { color: #fca5a5 !important; }  // diff deleted
  .gi { color: #86efac !important; }  // diff inserted
  .w { color: $text !important; }
}

.highlighter-rouge {
  background-color: $surface !important;
}

// ═══════════════════════════════════════
// Tags & Categories Index Pages
// ═══════════════════════════════════════

.page-heading {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.page-description {
  color: $text-muted;
  font-weight: 300;
  margin-bottom: 24px;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 32px;
}

.tag-badge {
  display: inline-block;
  padding: 4px 12px;
  background-color: $surface;
  color: $text-muted;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;

  &:hover {
    color: $accent;
    background-color: lighten($surface, 5%);
  }

  .tag-count {
    font-size: 0.8em;
    color: darken($text-muted, 10%);
  }
}

.tag-section {
  margin-bottom: 32px;

  h2 {
    font-size: 1.1rem;
    border-bottom: 1px solid $border;
    padding-bottom: 8px;
    margin-bottom: 12px;

    .tag-count {
      color: $text-muted;
      font-size: 0.8em;
      font-weight: 300;
    }
  }
}

.back-link {
  margin-top: 32px;
  a {
    color: $text-muted;
    &:hover { color: $accent; }
  }
}

// Simple post list (for tag sections)
.post-list-simple {
  list-style: none;
  padding: 0;

  li {
    padding: 6px 0;

    .post-meta {
      margin-right: 8px;
    }

    a {
      color: $text;
      &:hover { color: $accent; }
    }
  }
}

// ═══════════════════════════════════════
// Responsive
// ═══════════════════════════════════════

@media (max-width: $breakpoint-mobile) {
  .site-nav { display: none; }
  .menu-toggle { display: block; }

  .site-profile {
    width: 40px;
    height: 40px;
  }

  .site-title { font-size: 1.1rem; }

  .wrapper { padding: 0 16px; }

  .post-card {
    flex-direction: column;
    gap: 12px;
  }

  .post-card-thumbnail {
    width: 100%;
    height: auto;
    aspect-ratio: 1200 / 630;
  }

  .post-title { font-size: 1.5rem; }

  .category-tabs {
    gap: 6px;

    .tab {
      padding: 4px 12px;
      font-size: 0.8rem;
    }
  }
}
```

- [ ] **Step 3: 커밋**

```bash
cd E:/Project/dev-blog
git add assets/main.scss _includes/head.html
git commit -m "[DESIGN] SCSS 전면 재작성 + 폰트 변경 (stone+amber, IBM Plex Sans KR)"
```

---

## Task 2: 사이트 셸 — default.html + header + footer

**Files:**
- Create: `_layouts/default.html`
- Create: `_includes/header.html`
- Create: `_includes/footer.html`

- [ ] **Step 1: header.html 생성**

`_includes/header.html`:

```html
<header class="site-header">
  <div class="wrapper">
    <a class="site-brand" href="{{ '/' | relative_url }}">
      <img src="{{ '/assets/profile/250x250.png' | relative_url }}" alt="Profile" class="site-profile">
      <div class="site-brand-text">
        <span class="site-title">{{ site.title | escape }}</span>
        <span class="site-subtitle">{{ site.description | escape }}</span>
      </div>
    </a>

    <nav class="site-nav">
      <a class="page-link" href="{{ '/tags/' | relative_url }}">Tags</a>
    </nav>

    <button class="menu-toggle" aria-label="Menu" onclick="document.querySelector('.mobile-nav').classList.toggle('is-open')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
  </div>

  <div class="mobile-nav wrapper">
    <a href="{{ '/tags/' | relative_url }}">Tags</a>
    <a href="{{ '/categories/' | relative_url }}">Categories</a>
  </div>
</header>
```

- [ ] **Step 2: footer.html 생성**

`_includes/footer.html`:

```html
<footer class="site-footer">
  <div class="wrapper">
    <div class="footer-brand">{{ site.title | escape }}</div>
    <div class="footer-description">{{ site.description | escape }}</div>

    <div class="footer-social">
      <a href="https://github.com/keemminxu" target="_blank" rel="noopener" aria-label="GitHub">
        <svg viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
      </a>
      <a href="https://www.linkedin.com/in/keemminxu/" target="_blank" rel="noopener" aria-label="LinkedIn">
        <svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      </a>
    </div>

    <div class="footer-legal">
      &copy; {{ site.time | date: '%Y' }} Keemminxu · <a href="{{ '/privacy-policy/' | relative_url }}">Privacy Policy</a>
    </div>
  </div>
</footer>
```

- [ ] **Step 3: default.html 생성**

`_layouts/default.html`:

```html
<!DOCTYPE html>
<html lang="{{ page.lang | default: site.lang | default: 'ko' }}">
  {%- include head.html -%}
  <body>
    {%- include header.html -%}

    <main class="page-content" aria-label="Content">
      <div class="wrapper">
        {{ content }}
      </div>
    </main>

    {%- include footer.html -%}
  </body>
</html>
```

- [ ] **Step 4: 커밋**

```bash
cd E:/Project/dev-blog
git add _layouts/default.html _includes/header.html _includes/footer.html
git commit -m "[DESIGN] 사이트 셸 - default.html + 커스텀 헤더/푸터"
```

---

## Task 3: 재사용 컴포넌트 — post-card + category-tabs

**Files:**
- Create: `_includes/post-card.html`
- Create: `_includes/category-tabs.html`

- [ ] **Step 1: post-card.html 생성**

`_includes/post-card.html`:

```html
{% comment %}
  포스트 카드 컴포넌트. 사용 시 include에 post 변수를 전달한다.
  예: {% include post-card.html post=post %}
{% endcomment %}

<article class="post-card">
  <a href="{{ include.post.url | relative_url }}" class="post-card-thumbnail">
    {% assign post_slug = include.post.url | split: '/' | last %}
    <img src="{{ '/assets/og/' | append: post_slug | append: '.png' | relative_url }}"
         alt="{{ include.post.title | escape }}"
         loading="lazy">
  </a>
  <div class="post-card-content">
    <h3 class="post-card-title">
      <a href="{{ include.post.url | relative_url }}">{{ include.post.title | escape }}</a>
    </h3>
    <p class="post-card-meta">
      {{ include.post.date | date: "%Y-%m-%d" }}
      {% if include.post.categories.size > 0 %}
        · <a href="{{ '/category/' | append: include.post.categories[0] | relative_url }}">{{ include.post.categories[0] }}</a>
      {% endif %}
    </p>
    {% if include.post.excerpt %}
      <p class="post-card-excerpt">{{ include.post.excerpt | strip_html | truncate: 120 }}</p>
    {% endif %}
  </div>
</article>
```

- [ ] **Step 2: category-tabs.html 생성**

`_includes/category-tabs.html`:

```html
{% comment %}
  카테고리 탭 컴포넌트. page.url 기반으로 활성 탭을 자동 표시한다.
  홈페이지(/)에서는 "All"이 활성화된다.
{% endcomment %}

<nav class="category-tabs">
  <a href="{{ '/' | relative_url }}"
     class="tab {% if page.url == '/' or page.url == '/index.html' %}active{% endif %}">All</a>
  {% assign categories = site.categories | sort %}
  {% for cat in categories %}
    <a href="{{ '/category/' | append: cat[0] | relative_url }}"
       class="tab {% if page.url contains cat[0] %}active{% endif %}">
      {{ cat[0] | capitalize }}
    </a>
  {% endfor %}
</nav>
```

- [ ] **Step 3: 커밋**

```bash
cd E:/Project/dev-blog
git add _includes/post-card.html _includes/category-tabs.html
git commit -m "[DESIGN] 재사용 컴포넌트 - 포스트 카드 + 카테고리 탭"
```

---

## Task 4: 홈페이지 — home.html

**Files:**
- Create: `_layouts/home.html`

- [ ] **Step 1: home.html 생성**

`_layouts/home.html`:

```html
---
layout: default
---

<div class="home">
  {% include category-tabs.html %}

  <div class="post-list">
    {% for post in site.posts %}
      {% include post-card.html post=post %}
    {% endfor %}
  </div>
</div>
```

- [ ] **Step 2: 커밋**

```bash
cd E:/Project/dev-blog
git add _layouts/home.html
git commit -m "[DESIGN] 홈페이지 - 카드형 포스트 리스트 + 카테고리 탭"
```

---

## Task 5: 포스트 + 일반 페이지 레이아웃

**Files:**
- Modify: `_layouts/post.html`
- Create: `_layouts/page.html`

- [ ] **Step 1: post.html 재작성**

`_layouts/post.html`을 아래로 **완전히 교체**:

```html
---
layout: default
---
<article class="post h-entry" itemscope itemtype="http://schema.org/BlogPosting">
  <div class="content-wrapper">
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
  </div>

  <a class="u-url" href="{{ page.url | relative_url }}" hidden></a>
</article>
```

- [ ] **Step 2: page.html 생성**

`_layouts/page.html`:

```html
---
layout: default
---
<div class="content-wrapper">
  <header class="page-header">
    <h1 class="page-heading">{{ page.title | escape }}</h1>
  </header>

  <div class="post-content">
    {{ content }}
  </div>
</div>
```

- [ ] **Step 3: 커밋**

```bash
cd E:/Project/dev-blog
git add _layouts/post.html _layouts/page.html
git commit -m "[DESIGN] 포스트 + 페이지 레이아웃 리디자인"
```

---

## Task 6: 태그/카테고리 페이지 + 설정 정리

**Files:**
- Modify: `_layouts/tag.html`
- Modify: `category/unreal-engine.html`
- Modify: `category/devops.html`
- Modify: `category/mobile.html`
- Modify: `categories.html`
- Modify: `tags.html`
- Modify: `_config.yml`

- [ ] **Step 1: tag.html 카드형으로 변경**

`_layouts/tag.html`을 아래로 **완전히 교체**:

```html
---
layout: default
---

<div class="tag-page">
  <h1 class="page-heading">{{ page.tag }}</h1>
  <p class="page-description">태그 <strong>{{ page.tag }}</strong>에 해당하는 포스트 목록</p>

  <div class="post-list">
    {% assign sorted_posts = site.posts | sort: 'date' | reverse %}
    {% for post in sorted_posts %}
      {% if post.tags contains page.tag %}
        {% include post-card.html post=post %}
      {% endif %}
    {% endfor %}
  </div>

  <p class="back-link"><a href="{{ '/tags/' | relative_url }}">← 모든 태그 보기</a></p>
</div>
```

- [ ] **Step 2: 카테고리 페이지 3개를 카드형 + 탭으로 변경**

`category/unreal-engine.html`:

```html
---
layout: default
title: "Category: Unreal Engine"
permalink: /category/unreal-engine/
---

<div class="category-page">
  {% include category-tabs.html %}

  <div class="post-list">
    {% assign posts = site.categories['unreal-engine'] | sort: 'date' | reverse %}
    {% for post in posts %}
      {% include post-card.html post=post %}
    {% endfor %}
  </div>
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
  {% include category-tabs.html %}

  <div class="post-list">
    {% assign posts = site.categories['devops'] | sort: 'date' | reverse %}
    {% for post in posts %}
      {% include post-card.html post=post %}
    {% endfor %}
  </div>
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
  {% include category-tabs.html %}

  <div class="post-list">
    {% assign posts = site.categories['mobile'] | sort: 'date' | reverse %}
    {% for post in posts %}
      {% include post-card.html post=post %}
    {% endfor %}
  </div>
</div>
```

- [ ] **Step 3: categories.html 업데이트**

`categories.html`을 아래로 **완전히 교체**:

```html
---
layout: default
title: Categories
permalink: /categories/
---

<div class="categories-index">
  {% include category-tabs.html %}

  <div class="post-list">
    {% for post in site.posts %}
      {% include post-card.html post=post %}
    {% endfor %}
  </div>
</div>
```

- [ ] **Step 4: tags.html 스타일 업데이트**

`tags.html`을 아래로 **완전히 교체**:

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
    <ul class="post-list-simple">
      {% assign sorted = tag[1] | sort: 'date' | reverse %}
      {% for post in sorted %}
      <li>
        <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
        <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
      </li>
      {% endfor %}
    </ul>
  </div>
  {% endfor %}
</div>
```

- [ ] **Step 5: _config.yml 수정 — header_pages에서 privacy-policy 제거**

`_config.yml`의 `header_pages` 변경:

기존:
```yaml
header_pages:
  - tags.html
  - categories.html
  - privacy-policy.md
```

변경:
```yaml
header_pages:
  - tags.html
```

> Note: 커스텀 header.html에서 네비게이션을 직접 관리하므로 header_pages는 minima fallback용으로만 tags.html 유지. categories는 홈페이지 탭으로 접근. privacy-policy는 푸터에서만 링크.

- [ ] **Step 6: 커밋**

```bash
cd E:/Project/dev-blog
git add _layouts/tag.html category/ categories.html tags.html _config.yml
git commit -m "[DESIGN] 태그/카테고리 페이지 카드형 + 설정 정리"
```

---

## Verification Checklist

모든 태스크 완료 후 확인:

- [ ] 홈페이지: 카테고리 탭 + 카드형 포스트 리스트 표시
- [ ] 헤더: 프로필 이미지 + 블로그명/소제목 + Tags 네비게이션
- [ ] 푸터: GitHub/LinkedIn 아이콘 + Privacy Policy 링크
- [ ] 포스트 페이지: 제목/날짜/태그 + 본문 + 관련 포스트
- [ ] 코드 블록: JetBrains Mono + stone 배경 + 구문 강조
- [ ] 태그 페이지: 카드형 레이아웃
- [ ] 카테고리 페이지: 카드형 + 상단 카테고리 탭 (활성 표시)
- [ ] 모바일: 세로 카드 + 햄버거 메뉴
- [ ] 색상: stone 웜 다크 + 앰버 액센트
- [ ] 글꼴: IBM Plex Sans KR (Light/Medium/SemiBold) + JetBrains Mono
- [ ] OG 이미지: 기존 SEO 구조 유지 (head.html의 og:image 태그)
