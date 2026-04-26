# Blog V2: 3컬럼 레이아웃 + 신규 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL:** 커밋 메시지에 Co-Authored-By 트레일러를 절대 포함하지 마라.

**Goal:** 현재 1컬럼 블로그를 Chirpy 스타일의 3컬럼 레이아웃으로 전환하고, 3D 프로필, 검색, 운세 버튼, 방문자 카운터 등 인터랙티브 기능을 추가한다.

**Architecture:** CSS Grid 기반 3컬럼 레이아웃. 왼쪽 사이드바(고정) + 중앙 콘텐츠 + 오른쪽 사이드바. Three.js로 3D 모델 렌더링, 외부 API로 카운터 기능 구현. 모바일에서는 1컬럼으로 전환.

**Tech Stack:** Jekyll, CSS Grid, Three.js (3D), lunr.js (검색), Umami API (방문자), CountAPI/Firebase (운세 카운터)

**Blog Repo:** `E:\Project\dev-blog`

---

## File Structure

### New Files
```
_includes/sidebar-left.html      # Task 1: 왼쪽 사이드바 (프로필+네비+소셜)
_includes/sidebar-right.html     # Task 2: 오른쪽 사이드바 (TOC+태그+최근+운세)
_includes/search.html            # Task 3: 검색 UI + 결과
_includes/fortune.html           # Task 5: 운세 버튼 컴포넌트
_includes/model-viewer.html      # Task 4: Three.js 3D 모델 뷰어
assets/js/toc.js                 # Task 2: TOC 자동 생성 + 스크롤 추적
assets/js/search.js              # Task 3: lunr.js 검색 로직
assets/js/fortune.js             # Task 5: 운세 로직 + 카운터
assets/js/model-viewer.js        # Task 4: Three.js 3D 렌더링
assets/models/monkey.glb         # Task 4: 3D 모델 파일 (사용자 제공)
search.json                      # Task 3: 검색 인덱스 (Liquid 생성)
```

### Modified Files
```
_layouts/default.html            # Task 1: 3컬럼 Grid 레이아웃
_layouts/home.html               # Task 1: 3컬럼 적용
_layouts/post.html               # Task 1: 3컬럼 + TOC
_layouts/page.html               # Task 1: 3컬럼 적용
_layouts/tag.html                # Task 1: 3컬럼 적용
_includes/header.html            # Task 1: 검색바로 변경 (사이드바로 네비 이동)
_includes/footer.html            # Task 1: Privacy Policy 제거
assets/main.scss                 # Task 1-5: 전체 스타일 추가
```

---

## Task 1: 3컬럼 레이아웃 + 왼쪽 사이드바

현재 1컬럼(헤더-콘텐츠-푸터)을 3컬럼(사이드바-콘텐츠-사이드바)으로 전환.

**Files:**
- Create: `_includes/sidebar-left.html`
- Modify: `_layouts/default.html`
- Modify: `_includes/header.html` (검색바만 남김)
- Modify: `_includes/footer.html` (Privacy Policy 제거)
- Modify: `assets/main.scss` (Grid + 사이드바 스타일)

- [ ] **Step 1: sidebar-left.html 생성**

`_includes/sidebar-left.html`:

```html
<aside class="sidebar-left">
  <div class="sidebar-left-inner">
    <!-- 프로필 영역 (3D 모델 또는 이미지 fallback) -->
    <div class="profile-section">
      <div id="model-container" class="profile-model">
        <!-- Three.js가 로드되면 여기에 3D 렌더링 -->
        <!-- fallback: 이미지 -->
        <img src="{{ '/assets/profile/250x250.png' | relative_url }}"
             alt="Profile" class="profile-image" id="profile-fallback">
      </div>
      <h2 class="profile-name">{{ site.title | escape }}</h2>
      <p class="profile-desc">{{ site.description | escape }}</p>
    </div>

    <!-- 네비게이션 -->
    <nav class="sidebar-nav">
      <a href="{{ '/' | relative_url }}" class="nav-item {% if page.url == '/' %}active{% endif %}">
        <span class="nav-icon">🏠</span> 홈
      </a>

      <!-- 카테고리 (계층형) -->
      <div class="nav-section">
        <span class="nav-item nav-section-title">
          <span class="nav-icon">📂</span> 카테고리
        </span>
        <div class="nav-children">
          {% assign categories = site.categories | sort %}
          {% for cat in categories %}
            <a href="{{ '/category/' | append: cat[0] | relative_url }}"
               class="nav-child {% if page.url contains cat[0] %}active{% endif %}">
              {{ cat[0] }} <span class="nav-count">({{ cat[1].size }})</span>
            </a>
          {% endfor %}
        </div>
      </div>

      <a href="{{ '/tags/' | relative_url }}" class="nav-item {% if page.url == '/tags/' %}active{% endif %}">
        <span class="nav-icon">🏷️</span> 태그
      </a>
    </nav>

    <!-- 소셜 링크 -->
    <div class="sidebar-social">
      <a href="https://github.com/keemminxu" target="_blank" rel="noopener" aria-label="GitHub">
        <svg viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
      </a>
      <a href="https://www.linkedin.com/in/keemminxu/" target="_blank" rel="noopener" aria-label="LinkedIn">
        <svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      </a>
      <a href="mailto:cuzziman@gmail.com" aria-label="Email">
        <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
      </a>
      <a href="https://blog.naver.com/mintaly" target="_blank" rel="noopener" aria-label="Naver Blog">
        <svg viewBox="0 0 24 24"><path d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z"/></svg>
      </a>
      <a href="https://instagram.com/keemminxu" target="_blank" rel="noopener" aria-label="Instagram">
        <svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
      </a>
    </div>
  </div>
</aside>
```

- [ ] **Step 2: header.html을 검색바 전용으로 변경**

`_includes/header.html` 전체 교체:

```html
<header class="top-bar">
  <div class="top-bar-inner">
    <!-- 모바일 메뉴 토글 -->
    <button class="menu-toggle" aria-label="Menu"
            onclick="document.querySelector('.sidebar-left').classList.toggle('is-open')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>

    <!-- 검색 -->
    <div class="search-bar">
      <input type="text" id="search-input" placeholder="검색..." autocomplete="off">
      <div id="search-results" class="search-results"></div>
    </div>
  </div>
</header>
```

- [ ] **Step 3: footer.html에서 Privacy Policy 제거**

`_includes/footer.html`에서 `footer-legal` div 변경:

기존:
```html
    <div class="footer-legal">
      &copy; {{ site.time | date: '%Y' }} Keemminxu · <a href="{{ '/privacy-policy/' | relative_url }}">Privacy Policy</a>
    </div>
```

변경:
```html
    <div class="footer-legal">
      &copy; {{ site.time | date: '%Y' }} Keemminxu
    </div>
```

- [ ] **Step 4: default.html을 3컬럼 Grid로 변경**

`_layouts/default.html` 전체 교체:

```html
<!DOCTYPE html>
<html lang="{{ page.lang | default: site.lang | default: 'ko' }}">
  {%- include head.html -%}
  <body>
    {%- include header.html -%}

    <div class="site-container">
      {%- include sidebar-left.html -%}

      <main class="main-content">
        {{ content }}
      </main>

      {% if page.layout == 'post' or page.layout == 'home' or page.url == '/' %}
        {%- include sidebar-right.html -%}
      {% endif %}
    </div>

    {%- include footer.html -%}
  </body>
</html>
```

- [ ] **Step 5: main.scss에 3컬럼 Grid + 사이드바 스타일 추가**

`assets/main.scss`에 기존 레이아웃/헤더/푸터 섹션을 교체. 주요 변경:

```scss
// ═══════════════════════════════════════
// 3-Column Layout
// ═══════════════════════════════════════

.top-bar {
  position: fixed;
  top: 0;
  right: 0;
  left: 240px;  // 왼쪽 사이드바 너비만큼 오프셋
  height: 56px;
  background-color: $bg;
  border-bottom: 1px solid $border;
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 0 24px;
}

.top-bar-inner {
  width: 100%;
  display: flex;
  align-items: center;
}

.menu-toggle {
  display: none;  // 데스크톱에서 숨김
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  margin-right: 12px;
  svg { width: 24px; height: 24px; stroke: $text; }
}

.search-bar {
  flex: 1;
  max-width: 400px;
  margin-left: auto;
  position: relative;

  input {
    width: 100%;
    padding: 8px 16px;
    background-color: $surface;
    border: 1px solid $border;
    border-radius: 20px;
    color: $text;
    font-family: $font-base;
    font-size: 0.85rem;
    font-weight: 300;
    outline: none;
    transition: border-color 0.2s;

    &::placeholder { color: $text-muted; }
    &:focus { border-color: $accent; }
  }
}

.search-results {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: $surface;
  border: 1px solid $border;
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 200;

  &.is-open { display: block; }

  .search-item {
    display: block;
    padding: 10px 16px;
    color: $text;
    text-decoration: none;
    border-bottom: 1px solid $border;
    font-size: 0.85rem;

    &:last-child { border-bottom: none; }
    &:hover { background: rgba($accent, 0.1); }

    .search-item-title { font-weight: 500; }
    .search-item-date { color: $text-muted; font-size: 0.8rem; }
  }
}

.site-container {
  display: grid;
  grid-template-columns: 240px 1fr 240px;
  min-height: 100vh;
  padding-top: 56px;  // top-bar 높이
}

// ── Left Sidebar ──

.sidebar-left {
  position: fixed;
  top: 0;
  left: 0;
  width: 240px;
  height: 100vh;
  background-color: $surface;
  border-right: 1px solid $border;
  overflow-y: auto;
  z-index: 200;
  padding: 24px 20px;
}

.sidebar-left-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.profile-section {
  text-align: center;
  margin-bottom: 24px;
}

.profile-model {
  width: 120px;
  height: 120px;
  margin: 0 auto 12px;
  border-radius: 50%;
  overflow: hidden;
}

.profile-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.profile-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: $text;
  margin: 0 0 4px;
}

.profile-desc {
  font-size: 0.75rem;
  font-weight: 300;
  color: $text-muted;
  margin: 0;
}

.sidebar-nav {
  flex: 1;
  margin-bottom: 16px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: $text-muted;
  font-size: 0.85rem;
  font-weight: 500;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.2s;

  &:hover { color: $text; background: rgba($text, 0.05); }
  &.active { color: $accent; }
}

.nav-icon { font-size: 1.0rem; }

.nav-section-title {
  cursor: default;
}

.nav-children {
  padding-left: 20px;
}

.nav-child {
  display: block;
  padding: 4px 12px;
  color: $text-muted;
  font-size: 0.8rem;
  font-weight: 300;
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.2s;

  &:hover { color: $text; }
  &.active { color: $accent; }

  .nav-count {
    font-size: 0.75rem;
    color: darken($text-muted, 10%);
  }
}

.sidebar-social {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid $border;

  a {
    color: $text-muted;
    transition: color 0.2s;
    &:hover { color: $accent; }
    svg { width: 18px; height: 18px; fill: currentColor; }
  }
}

// ── Main Content ──

.main-content {
  padding: 32px 40px;
  min-width: 0;
}

// ── Right Sidebar ──

.sidebar-right {
  position: sticky;
  top: 56px;
  height: calc(100vh - 56px);
  overflow-y: auto;
  padding: 24px 20px;
  border-left: 1px solid $border;
}

.sidebar-section {
  margin-bottom: 28px;

  h4 {
    font-size: 0.85rem;
    font-weight: 600;
    color: $text;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid $border;
  }
}

.toc-list {
  list-style: none;
  padding: 0;

  li {
    margin-bottom: 4px;

    a {
      display: block;
      padding: 3px 0;
      color: $text-muted;
      font-size: 0.8rem;
      font-weight: 300;
      text-decoration: none;
      transition: color 0.2s;
      border-left: 2px solid transparent;
      padding-left: 8px;

      &:hover { color: $text; }
      &.active {
        color: $accent;
        border-left-color: $accent;
      }
    }

    // 중첩 레벨
    &.toc-h3 a { padding-left: 20px; font-size: 0.75rem; }
    &.toc-h4 a { padding-left: 32px; font-size: 0.75rem; }
  }
}

.popular-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.recent-posts-list {
  list-style: none;
  padding: 0;

  li {
    margin-bottom: 8px;

    a {
      color: $text-muted;
      font-size: 0.8rem;
      font-weight: 300;
      text-decoration: none;
      line-height: 1.4;
      display: block;
      &:hover { color: $accent; }
    }
  }
}

// ── Fortune Button ──

.fortune-section {
  text-align: center;
  margin-bottom: 28px;
}

.fortune-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: $text;
  margin-bottom: 8px;
}

.fortune-btn {
  display: inline-block;
  padding: 10px 24px;
  background: linear-gradient(135deg, $accent, $accent-hover);
  color: $bg;
  font-family: $font-base;
  font-size: 0.9rem;
  font-weight: 600;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s;
  animation: fortune-glow 2s ease-in-out infinite;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 0 20px rgba($accent, 0.4);
  }
}

@keyframes fortune-glow {
  0%, 100% { box-shadow: 0 0 5px rgba($accent, 0.2); }
  50% { box-shadow: 0 0 15px rgba($accent, 0.4); }
}

.fortune-result {
  margin-top: 12px;
  font-size: 0.8rem;
  font-weight: 300;
  color: $text;
  min-height: 20px;
}

.fortune-counter {
  margin-top: 6px;
  font-size: 0.7rem;
  color: $text-muted;
}

// ── Visitor Counter ──

.visitor-counter {
  display: flex;
  justify-content: center;
  gap: 16px;
  font-size: 0.75rem;
  color: $text-muted;
  padding: 8px 0;

  .counter-item {
    text-align: center;
    .counter-label { display: block; font-size: 0.65rem; }
    .counter-value { font-weight: 500; color: $text; }
  }
}

// ═══════════════════════════════════════
// Responsive - 3 Column
// ═══════════════════════════════════════

@media (max-width: 1100px) {
  // 태블릿: 오른쪽 사이드바 숨김
  .site-container {
    grid-template-columns: 240px 1fr;
  }
  .sidebar-right { display: none; }
}

@media (max-width: 768px) {
  // 모바일: 왼쪽 사이드바도 숨김
  .top-bar { left: 0; }
  .menu-toggle { display: block; }

  .site-container {
    grid-template-columns: 1fr;
  }

  .sidebar-left {
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    &.is-open { transform: translateX(0); }
  }

  .main-content { padding: 24px 16px; }
}
```

NOTE: 기존 main.scss의 `.site-header`, `.site-brand`, `.site-nav`, `.site-footer` 관련 스타일은 새 스타일로 교체해야 한다.

- [ ] **Step 6: 커밋**

```bash
cd E:/Project/dev-blog
git add _includes/sidebar-left.html _includes/header.html _includes/footer.html _layouts/default.html assets/main.scss
git commit -m "[DESIGN] 3컬럼 레이아웃 + 왼쪽 사이드바"
```

---

## Task 2: 오른쪽 사이드바 (TOC + 인기태그 + 최근포스트)

**Files:**
- Create: `_includes/sidebar-right.html`
- Create: `assets/js/toc.js`

- [ ] **Step 1: sidebar-right.html 생성**

`_includes/sidebar-right.html`:

```html
<aside class="sidebar-right">
  <!-- 운세 버튼 (Task 5에서 구현) -->
  <div id="fortune-container"></div>

  <!-- TOC (포스트 페이지만) -->
  {% if page.layout == 'post' %}
  <div class="sidebar-section">
    <h4>바로가기</h4>
    <ul class="toc-list" id="toc-list">
      <!-- JS로 자동 생성 -->
    </ul>
  </div>
  {% endif %}

  <!-- 인기 태그 -->
  <div class="sidebar-section">
    <h4>인기 태그</h4>
    <div class="popular-tags">
      {% assign sorted_tags = site.tags | sort: 'last' %}
      {% assign tag_count = 0 %}
      {% for tag in sorted_tags reversed %}
        {% if tag_count < 10 %}
          <a href="{{ '/tag/' | append: tag[0] | relative_url }}" class="tag-badge">{{ tag[0] }}</a>
          {% assign tag_count = tag_count | plus: 1 %}
        {% endif %}
      {% endfor %}
    </div>
  </div>

  <!-- 최근 포스트 -->
  <div class="sidebar-section">
    <h4>최근 포스트</h4>
    <ul class="recent-posts-list">
      {% for post in site.posts limit: 5 %}
        <li><a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></li>
      {% endfor %}
    </ul>
  </div>

  <!-- 방문자 카운터 -->
  <div class="visitor-counter">
    <div class="counter-item">
      <span class="counter-label">TODAY</span>
      <span class="counter-value" id="today-count">-</span>
    </div>
    <div class="counter-item">
      <span class="counter-label">TOTAL</span>
      <span class="counter-value" id="total-count">-</span>
    </div>
  </div>
</aside>
```

- [ ] **Step 2: toc.js 생성**

`assets/js/toc.js`:

```javascript
// 포스트 페이지에서 자동으로 TOC를 생성하고 스크롤 위치를 추적한다.
document.addEventListener('DOMContentLoaded', function() {
  var tocList = document.getElementById('toc-list');
  if (!tocList) return;

  var content = document.querySelector('.post-content');
  if (!content) return;

  var headings = content.querySelectorAll('h2, h3, h4');
  if (headings.length === 0) return;

  // TOC 항목 생성
  headings.forEach(function(heading, index) {
    var id = heading.id || 'heading-' + index;
    heading.id = id;

    var li = document.createElement('li');
    li.className = 'toc-' + heading.tagName.toLowerCase();

    var a = document.createElement('a');
    a.href = '#' + id;
    a.textContent = heading.textContent;
    a.addEventListener('click', function(e) {
      e.preventDefault();
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    li.appendChild(a);
    tocList.appendChild(li);
  });

  // 스크롤 추적
  var tocLinks = tocList.querySelectorAll('a');
  window.addEventListener('scroll', function() {
    var current = '';
    headings.forEach(function(heading) {
      if (window.scrollY >= heading.offsetTop - 100) {
        current = heading.id;
      }
    });

    tocLinks.forEach(function(link) {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  });
});
```

- [ ] **Step 3: head.html에 JS 로드 추가**

`_includes/head.html` 끝부분(`</head>` 전)에 추가:

```html
  <!-- Page Scripts -->
  {% if page.layout == 'post' %}
    <script defer src="{{ '/assets/js/toc.js' | relative_url }}"></script>
  {% endif %}
```

- [ ] **Step 4: 커밋**

```bash
cd E:/Project/dev-blog
git add _includes/sidebar-right.html assets/js/toc.js _includes/head.html
git commit -m "[DESIGN] 오른쪽 사이드바 - TOC + 인기태그 + 최근포스트"
```

---

## Task 3: 검색 기능

**Files:**
- Create: `search.json`
- Create: `assets/js/search.js`
- Modify: `_includes/head.html` (검색 JS 로드)

- [ ] **Step 1: search.json 생성 (Liquid로 검색 인덱스 빌드)**

루트에 `search.json`:

```
---
layout: null
---
[
  {% for post in site.posts %}
    {
      "title": {{ post.title | jsonify }},
      "title_en": {{ post.title_en | default: "" | jsonify }},
      "url": "{{ post.url | relative_url }}",
      "date": "{{ post.date | date: '%Y-%m-%d' }}",
      "categories": {{ post.categories | jsonify }},
      "tags": {{ post.tags | jsonify }},
      "excerpt": {{ post.excerpt | strip_html | truncate: 200 | jsonify }}
    }{% unless forloop.last %},{% endunless %}
  {% endfor %}
]
```

- [ ] **Step 2: search.js 생성**

`assets/js/search.js`:

```javascript
document.addEventListener('DOMContentLoaded', function() {
  var input = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  if (!input || !results) return;

  var posts = [];

  // 검색 인덱스 로드
  fetch(document.querySelector('meta[name="baseurl"]')
    ? '/dev-blog/search.json'
    : '/search.json')
    .catch(function() { return fetch('/dev-blog/search.json'); })
    .then(function(r) { return r.json(); })
    .then(function(data) { posts = data; });

  input.addEventListener('input', function() {
    var query = this.value.toLowerCase().trim();
    results.innerHTML = '';

    if (query.length < 2) {
      results.classList.remove('is-open');
      return;
    }

    var matches = posts.filter(function(post) {
      return post.title.toLowerCase().includes(query)
        || (post.title_en && post.title_en.toLowerCase().includes(query))
        || post.tags.some(function(t) { return t.toLowerCase().includes(query); })
        || post.excerpt.toLowerCase().includes(query);
    }).slice(0, 5);

    if (matches.length === 0) {
      results.classList.remove('is-open');
      return;
    }

    matches.forEach(function(post) {
      var a = document.createElement('a');
      a.className = 'search-item';
      a.href = post.url;
      a.innerHTML = '<div class="search-item-title">' + post.title + '</div>'
                  + '<div class="search-item-date">' + post.date + '</div>';
      results.appendChild(a);
    });

    results.classList.add('is-open');
  });

  // 외부 클릭 시 닫기
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('is-open');
    }
  });
});
```

- [ ] **Step 3: head.html에 검색 JS 로드**

```html
  <script defer src="{{ '/assets/js/search.js' | relative_url }}"></script>
```

- [ ] **Step 4: 커밋**

```bash
cd E:/Project/dev-blog
git add search.json assets/js/search.js _includes/head.html
git commit -m "[FEAT] 검색 기능 추가"
```

---

## Task 4: 3D 모델 뷰어 (Three.js)

**Files:**
- Create: `_includes/model-viewer.html`
- Create: `assets/js/model-viewer.js`
- Add: `assets/models/monkey.glb` (사용자 제공)
- Modify: `_includes/head.html` (Three.js CDN)
- Modify: `_includes/sidebar-left.html` (모델 뷰어 include)

- [ ] **Step 1: head.html에 Three.js CDN 추가**

```html
  <!-- Three.js (3D Model) -->
  <script type="importmap">
    { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js" } }
  </script>
```

- [ ] **Step 2: model-viewer.js 생성**

`assets/js/model-viewer.js`:

```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/loaders/GLTFLoader.js';

var container = document.getElementById('model-container');
if (container) {
  var fallback = document.getElementById('profile-fallback');

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 3);

  var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(120, 120);
  renderer.setPixelRatio(window.devicePixelRatio);

  // 조명
  var ambient = new THREE.AmbientLight(0xfbbf24, 0.6);
  scene.add(ambient);
  var directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(2, 2, 2);
  scene.add(directional);

  var baseUrl = document.querySelector('meta[name="baseurl"]')
    ? '/dev-blog' : '';

  var loader = new GLTFLoader();
  loader.load(baseUrl + '/assets/models/monkey.glb', function(gltf) {
    var model = gltf.scene;

    // 모델 크기 정규화
    var box = new THREE.Box3().setFromObject(model);
    var size = box.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z);
    model.scale.multiplyScalar(1.8 / maxDim);

    // 중앙 정렬
    box.setFromObject(model);
    var center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    scene.add(model);

    // fallback 이미지 숨기고 캔버스 표시
    if (fallback) fallback.style.display = 'none';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.borderRadius = '50%';

    // 회전 애니메이션
    function animate() {
      requestAnimationFrame(animate);
      model.rotation.y += 0.01;
      renderer.render(scene, camera);
    }
    animate();
  }, undefined, function(err) {
    // 로드 실패 시 fallback 이미지 유지
    console.log('3D model load failed, using fallback image');
  });
}
```

- [ ] **Step 3: head.html에 model-viewer.js 로드**

```html
  <script type="module" src="{{ '/assets/js/model-viewer.js' | relative_url }}"></script>
```

- [ ] **Step 4: monkey.glb 파일 확인**

사용자가 `assets/models/monkey.glb`를 제공해야 함. 없으면 fallback 이미지가 표시됨.

- [ ] **Step 5: 커밋**

```bash
cd E:/Project/dev-blog
git add assets/js/model-viewer.js _includes/head.html
# monkey.glb가 있으면: git add assets/models/monkey.glb
git commit -m "[FEAT] 3D 모델 프로필 뷰어 (Three.js)"
```

---

## Task 5: 운세 버튼 + 방문자 카운터

**Files:**
- Create: `assets/js/fortune.js`
- Modify: `_includes/sidebar-right.html` (운세 컴포넌트 삽입)

- [ ] **Step 1: fortune.js 생성**

`assets/js/fortune.js`:

```javascript
document.addEventListener('DOMContentLoaded', function() {
  var container = document.getElementById('fortune-container');
  if (!container) return;

  // 운세 데이터
  var fortunes = [
    { score: 100, msg: "대박! 오늘 커밋하면 버그 제로!" },
    { score: 95, msg: "PR이 한 번에 머지되는 날!" },
    { score: 90, msg: "Stack Overflow 없이 코딩 성공!" },
    { score: 85, msg: "오늘 작성한 코드가 미래의 나를 감동시킨다." },
    { score: 80, msg: "컴파일 한 번에 성공하는 상서로운 기운!" },
    { score: 75, msg: "좋은 기운. 리팩토링하기 좋은 날." },
    { score: 70, msg: "무난한 하루. 테스트 코드 쓰기 딱 좋은 날." },
    { score: 65, msg: "나쁘지 않아. 문서 정리하면 보람찬 하루." },
    { score: 60, msg: "조금 주의. 프로덕션 배포는 내일로." },
    { score: 55, msg: "git stash 해두는 게 좋겠어." },
    { score: 50, msg: "보통. 새 기능보다는 버그 수정에 집중." },
    { score: 45, msg: "rm -rf는 오늘 쓰지 마." },
    { score: 40, msg: "force push 금지의 날." },
    { score: 35, msg: "세그폴트 조심. 저장 자주 하세요." },
    { score: 30, msg: "오늘은 코딩 대신 산책이 답." },
    { score: 20, msg: "undefined is not a function의 기운이..." },
    { score: 10, msg: "모니터 끄고 쉬세요. 진심으로." }
  ];

  // 오늘 날짜 시드 (같은 날은 같은 운세)
  var today = new Date().toISOString().slice(0, 10);
  var seed = 0;
  for (var i = 0; i < today.length; i++) {
    seed = ((seed << 5) - seed) + today.charCodeAt(i);
    seed = seed & seed;
  }

  container.innerHTML =
    '<div class="fortune-section">' +
    '  <div class="fortune-label">오늘의 운빨은?!</div>' +
    '  <button class="fortune-btn" id="fortune-btn">확인하기</button>' +
    '  <div class="fortune-result" id="fortune-result"></div>' +
    '  <div class="fortune-counter" id="fortune-counter"></div>' +
    '</div>';

  var btn = document.getElementById('fortune-btn');
  var result = document.getElementById('fortune-result');
  var counter = document.getElementById('fortune-counter');

  // 오늘 이미 확인했는지 체크
  var checked = localStorage.getItem('fortune-date') === today;
  if (checked) {
    var saved = JSON.parse(localStorage.getItem('fortune-data'));
    if (saved) {
      result.innerHTML = '<strong>' + saved.score + '점</strong> — ' + saved.msg;
      btn.textContent = '확인 완료';
      btn.disabled = true;
      btn.style.opacity = '0.6';
    }
  }

  btn.addEventListener('click', function() {
    // 날짜 기반 랜덤 (같은 날 같은 결과)
    var idx = Math.abs(seed + navigator.userAgent.length) % fortunes.length;
    var fortune = fortunes[idx];

    result.innerHTML = '<strong>' + fortune.score + '점</strong> — ' + fortune.msg;
    localStorage.setItem('fortune-date', today);
    localStorage.setItem('fortune-data', JSON.stringify(fortune));

    btn.textContent = '확인 완료';
    btn.disabled = true;
    btn.style.opacity = '0.6';

    // 카운터 업데이트 (CountAPI)
    fetch('https://api.countapi.xyz/hit/keemminxu-dev-blog/fortune-' + today)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        counter.textContent = '오늘 ' + data.value + '명이 운세를 확인했어요';
      })
      .catch(function() {});
  });

  // 운세 카운터 현재값 로드
  fetch('https://api.countapi.xyz/get/keemminxu-dev-blog/fortune-' + today)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.value > 0) {
        counter.textContent = '오늘 ' + data.value + '명이 운세를 확인했어요';
      }
    })
    .catch(function() {});
});
```

- [ ] **Step 2: 방문자 카운터 (Umami API 활용)**

Umami의 공개 API 또는 `hits.seeyoufarm.com` 같은 무료 카운터 서비스를 사용한다. 간단한 방법:

`assets/js/fortune.js` 끝에 방문자 카운터 추가:

```javascript
// 방문자 카운터 (hits.seeyoufarm.com)
(function() {
  var todayEl = document.getElementById('today-count');
  var totalEl = document.getElementById('total-count');
  if (!todayEl || !totalEl) return;

  // hits 서비스 사용
  fetch('https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fkeemminxu.github.io%2Fdev-blog&count_bg=%23fbbf24&title_bg=%23292524&icon=&icon_color=%23E7E0EC&title=visits&edge_flat=true')
    .catch(function() {});

  // Umami API로 실제 통계를 가져오려면 Umami 설정에서 Share URL을 활성화해야 함
  // 현재는 단순 카운터로 대체
  var total = parseInt(localStorage.getItem('visit-total') || '0') + 1;
  localStorage.setItem('visit-total', total);
  totalEl.textContent = total;

  var todayKey = 'visit-' + new Date().toISOString().slice(0, 10);
  var todayVal = parseInt(localStorage.getItem(todayKey) || '0') + 1;
  localStorage.setItem(todayKey, todayVal);
  todayEl.textContent = todayVal;
})();
```

NOTE: localStorage 기반 카운터는 개인별이라 정확하지 않음. Umami Share URL을 활성화하면 실제 통계 API 사용 가능. 우선 localStorage로 구현하고 이후 Umami API로 교체 권장.

- [ ] **Step 3: head.html에 fortune.js 로드**

```html
  <script defer src="{{ '/assets/js/fortune.js' | relative_url }}"></script>
```

- [ ] **Step 4: 커밋**

```bash
cd E:/Project/dev-blog
git add assets/js/fortune.js _includes/head.html
git commit -m "[FEAT] 운세 버튼 + 방문자 카운터"
```

---

## Task 6: 레이아웃 통합 (home, post, tag, category 페이지)

기존 레이아웃들을 3컬럼 구조에 맞게 업데이트. default.html이 Grid를 제공하므로 각 레이아웃은 main-content 안의 콘텐츠만 담당.

**Files:**
- Modify: `_layouts/home.html`
- Modify: `_layouts/post.html`
- Modify: `_layouts/tag.html`
- Modify: `_layouts/page.html`
- Modify: `category/*.html`
- Modify: `categories.html`
- Modify: `tags.html`

- [ ] **Step 1: home.html 업데이트**

default.html이 Grid + 사이드바를 제공하므로 home.html은 콘텐츠만:

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

(변경 없음 — 현재와 동일. default.html이 사이드바를 감싸므로 그대로 작동)

- [ ] **Step 2: post.html 업데이트**

wrapper 불필요 (default.html이 처리):

```html
---
layout: default
---
<article class="post h-entry" itemscope itemtype="http://schema.org/BlogPosting">
  <header class="post-header">
    <h1 class="post-title p-name" itemprop="name headline">{{ page.title | escape }}</h1>
    {% if page.title_en %}
      <p class="post-title-en">{{ page.title_en }}</p>
    {% endif %}
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

NOTE: `content-wrapper` div 제거 — 3컬럼에서는 main-content 자체가 너비를 제한.

- [ ] **Step 3: 커밋**

```bash
cd E:/Project/dev-blog
git add _layouts/ category/ categories.html tags.html
git commit -m "[DESIGN] 3컬럼 레이아웃 통합"
```

---

## Verification Checklist

- [ ] 3컬럼 레이아웃: 왼쪽 사이드바 + 콘텐츠 + 오른쪽 사이드바
- [ ] 왼쪽 사이드바: 프로필(3D or 이미지) + 계층형 카테고리 + 소셜 5개
- [ ] 오른쪽 사이드바: 운세버튼 + TOC + 인기태그 + 최근포스트 + 방문자카운터
- [ ] 검색: 상단 검색바에서 포스트 제목/태그/내용 검색
- [ ] 운세 버튼: 반짝이는 버튼, 클릭 시 점수+운세, 하루 1회
- [ ] 3D 모델: glb 파일 있으면 회전, 없으면 프로필 이미지 fallback
- [ ] 방문자 카운터: TODAY + TOTAL 표시
- [ ] 모바일: 사이드바 숨김, 햄버거 메뉴, 1컬럼
- [ ] 태블릿: 오른쪽 사이드바만 숨김, 2컬럼
- [ ] 기존 SEO 구조 유지 (OG 태그, sitemap, robots.txt)
- [ ] Privacy Policy: 푸터에서 제거됨
