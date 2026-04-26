# Blog Quality Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 블로그 코드 리뷰 결과를 반영하여 보안, 버그, 디자인, 성능 이슈를 단계별로 수정한다.

**Architecture:** Supabase DB 제약 추가 → JS 버그/보안 수정 → CSS 정리 → 디자인 개선 → 접근성 순서로 진행. 각 단계는 독립적이며 커밋 단위로 분리.

**Tech Stack:** Jekyll, SCSS, Vanilla JS, Supabase (PostgreSQL), GitHub Pages

---

## Phase 1: 보안 (Priority: HIGH)

### Task 1: Supabase DB 제약 조건 추가

**Files:**
- 없음 (Supabase SQL Editor에서 실행)

- [ ] **Step 1: CHECK 제약 추가 SQL 실행**

Supabase 대시보드 → SQL Editor에서 실행:

```sql
ALTER TABLE comments
  ADD CONSTRAINT chk_nickname_length CHECK (char_length(nickname) <= 20),
  ADD CONSTRAINT chk_content_length CHECK (char_length(content) <= 1000),
  ADD CONSTRAINT chk_content_not_empty CHECK (char_length(trim(content)) > 0),
  ADD CONSTRAINT chk_slug_not_empty CHECK (char_length(post_slug) > 0);
```

- [ ] **Step 2: 검증 - 긴 content INSERT 시도**

Supabase SQL Editor에서 실행:

```sql
INSERT INTO comments (post_slug, nickname, content)
VALUES ('test', 'test', repeat('x', 1001));
-- Expected: ERROR constraint violation
```

- [ ] **Step 3: 테스트 데이터 정리**

```sql
DELETE FROM comments WHERE post_slug = 'test';
```

---

### Task 2: comments.js 에러 핸들링 및 보안 강화

**Files:**
- Modify: `assets/js/comments.js`

- [ ] **Step 1: dataset 유효성 검사 추가 (line 5-8)**

```javascript
// Before (line 5-8):
var SUPABASE_URL = section.dataset.supabaseUrl;
var SUPABASE_KEY = section.dataset.supabaseKey;
var POST_SLUG = section.dataset.postSlug;
var API = SUPABASE_URL + '/rest/v1/comments';

// After:
var SUPABASE_URL = section.dataset.supabaseUrl;
var SUPABASE_KEY = section.dataset.supabaseKey;
var POST_SLUG = section.dataset.postSlug;
if (!SUPABASE_URL || !SUPABASE_KEY || !POST_SLUG) return;
var API = SUPABASE_URL + '/rest/v1/comments';
```

- [ ] **Step 2: loadComments에 에러 핸들링 추가 (line 35-52)**

```javascript
// Before (line 35-52):
fetch(url, { headers: HEADERS })
  .then(function(res) { return res.json(); })
  .then(function(comments) { ... });

// After:
fetch(url, { headers: HEADERS })
  .then(function(res) {
    if (!res.ok) throw new Error(res.status);
    return res.json();
  })
  .then(function(comments) { ... })
  .catch(function() {
    var list = document.getElementById('comments-list');
    list.innerHTML = '<p class="comments-empty">댓글을 불러올 수 없습니다.</p>';
  });
```

- [ ] **Step 3: form null 가드 추가 (line 55)**

```javascript
// Before (line 55):
var form = document.getElementById('comment-form');
form.addEventListener('submit', function(e) {

// After:
var form = document.getElementById('comment-form');
if (!form) return;
form.addEventListener('submit', function(e) {
```

- [ ] **Step 4: POST 응답 검증 추가 (line 74-79)**

```javascript
// Before (line 74-79):
.then(function(res) { return res.json(); })
.then(function() {
  document.getElementById('comment-content').value = '';
  loadComments();
})

// After:
.then(function(res) {
  if (!res.ok) throw new Error(res.status);
  return res.json();
})
.then(function() {
  document.getElementById('comment-content').value = '';
  loadComments();
})
.catch(function() {
  alert('댓글 등록에 실패했습니다.');
})
```

- [ ] **Step 5: 커밋**

```bash
git add assets/js/comments.js
git commit -m "[FIX] 댓글 시스템 에러 핸들링 및 입력 검증 강화"
```

---

## Phase 2: JS 버그/품질 (Priority: MEDIUM)

### Task 3: search.js 정리

**Files:**
- Modify: `assets/js/search.js`

- [ ] **Step 1: baseUrl 제거 + innerHTML을 textContent로 변경 + debounce 추가**

```javascript
// line 7: 제거
// var baseUrl = '';

// line 9: baseUrl 제거
// Before: fetch(baseUrl + '/search.json')
// After:  fetch('/search.json')

// line 14: debounce 추가
// Before:
// input.addEventListener('input', function() {
// After:
var debounceTimer;
input.addEventListener('input', function() {
  clearTimeout(debounceTimer);
  var self = this;
  debounceTimer = setTimeout(function() {
    // ... 기존 로직 (self.value 사용)
  }, 150);
});

// line 39-40: innerHTML → textContent
// Before:
// a.innerHTML = '<div class="search-item-title">' + post.title + '</div>'
//             + '<div class="search-item-date">' + post.date + '</div>';
// After:
var titleDiv = document.createElement('div');
titleDiv.className = 'search-item-title';
titleDiv.textContent = post.title;
var dateDiv = document.createElement('div');
dateDiv.className = 'search-item-date';
dateDiv.textContent = post.date;
a.appendChild(titleDiv);
a.appendChild(dateDiv);
```

- [ ] **Step 2: 커밋**

```bash
git add assets/js/search.js
git commit -m "[FIX] search.js debounce 추가, XSS 방지, 불필요 변수 제거"
```

---

### Task 4: toc.js 스크롤 성능 개선

**Files:**
- Modify: `assets/js/toc.js`

- [ ] **Step 1: requestAnimationFrame throttle + getBoundingClientRect 적용 (line 31-45)**

```javascript
// Before (line 31-45):
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

// After:
var ticking = false;
window.addEventListener('scroll', function() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(function() {
      var current = '';
      headings.forEach(function(heading) {
        if (heading.getBoundingClientRect().top <= 100) {
          current = heading.id;
        }
      });
      tocLinks.forEach(function(link) {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
          link.classList.add('active');
        }
      });
      ticking = false;
    });
  }
});
```

- [ ] **Step 2: 커밋**

```bash
git add assets/js/toc.js
git commit -m "[PERF] toc.js 스크롤 핸들러 throttle 및 reflow 최적화"
```

---

## Phase 3: CSS 정리 (Priority: MEDIUM)

### Task 5: 죽은 CSS 제거

**Files:**
- Modify: `assets/main.scss`

- [ ] **Step 1: 사용하지 않는 셀렉터 제거**

아래 셀렉터/블록 전체를 삭제:

| 라인 | 셀렉터 | 이유 |
|-----|--------|-----|
| 229-234 | `.profile-image` | model-viewer로 교체됨 |
| 423 | `.popular-tags` | HTML에 없음 |
| 495-509 | `.visitor-counter` 블록 전체 | `.visitor-stats`로 교체됨 |
| 521-526 | `.footer-brand` | footer에 없음 |
| 528-533 | `.footer-description` | footer에 없음 |
| 535-550 | `.footer-social` | footer에 없음 |

- [ ] **Step 2: 커밋**

```bash
git add assets/main.scss
git commit -m "[CLEANUP] 사용하지 않는 CSS 셀렉터 제거 (~50줄)"
```

---

### Task 6: 디자인 개선

**Files:**
- Modify: `assets/main.scss`
- Modify: `_includes/comments.html`

- [ ] **Step 1: Post card hover 개선 (line 599)**

```scss
// Before:
&:hover { opacity: 0.9; }

// After:
&:hover { background: rgba($text, 0.03); }
```

- [ ] **Step 2: 댓글 폼 레이아웃 변경 - 등록 버튼을 textarea 아래로**

`_includes/comments.html` 변경:

```html
<!-- Before: -->
<form class="comment-form" id="comment-form">
  <div class="comment-form-row">
    <input type="text" id="comment-nickname" placeholder="닉네임 (선택)" maxlength="20">
    <button type="submit" class="comment-submit">등록</button>
  </div>
  <textarea id="comment-content" placeholder="댓글을 남겨주세요" rows="3" maxlength="1000" required></textarea>
</form>

<!-- After: -->
<form class="comment-form" id="comment-form">
  <input type="text" id="comment-nickname" placeholder="닉네임 (선택)" maxlength="20">
  <textarea id="comment-content" placeholder="댓글을 남겨주세요" rows="3" maxlength="1000" required></textarea>
  <div class="comment-form-actions">
    <button type="submit" class="comment-submit">등록</button>
  </div>
</form>
```

`assets/main.scss` 댓글 CSS 수정:

```scss
// .comment-form-row 제거, 새 스타일 추가:
#comment-nickname {
  // max-width: 180px; 유지하되 display: block
  margin-bottom: 8px;
}
.comment-form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
```

- [ ] **Step 3: border/color 통일 - 댓글 섹션에서 rgba() → $border 토큰 사용**

```scss
// Before:
.comments-section { border-top: 1px solid rgba($text, 0.1); }
#comment-nickname { border: 1px solid rgba($text, 0.1); background: rgba($text, 0.05); }
#comment-content { border: 1px solid rgba($text, 0.1); background: rgba($text, 0.05); }

// After:
.comments-section { border-top: 1px solid $border; }
#comment-nickname { border: 1px solid $border; background: $surface; }
#comment-content { border: 1px solid $border; background: $surface; }
```

- [ ] **Step 4: 모바일 사이드바 백드롭 추가**

`assets/main.scss` 768px 미디어 쿼리 안에:

```scss
.sidebar-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;
  &.is-open { display: block; }
}
```

`_layouts/default.html`에 backdrop div 추가 (sidebar-left 바로 앞):

```html
<div class="sidebar-backdrop" id="sidebar-backdrop"></div>
```

`_includes/header.html` 햄버거 버튼 onclick 수정:

```javascript
// sidebar + backdrop 동시 토글
document.querySelector('.sidebar-left').classList.toggle('is-open');
document.getElementById('sidebar-backdrop').classList.toggle('is-open');
```

`_includes/sidebar-left.html` 닫기 버튼도 backdrop 닫기 추가.

backdrop 클릭 시 사이드바 닫기:

```javascript
// sidebar-backdrop onclick
document.querySelector('.sidebar-left').classList.remove('is-open');
this.classList.remove('is-open');
```

- [ ] **Step 5: 커밋**

```bash
git add assets/main.scss _includes/comments.html _layouts/default.html _includes/header.html _includes/sidebar-left.html
git commit -m "[DESIGN] 카드 hover, 댓글 폼 레이아웃, 색상 통일, 모바일 백드롭"
```

---

## Phase 4: 접근성 (Priority: LOW)

### Task 7: focus 스타일 및 aria-label 추가

**Files:**
- Modify: `assets/main.scss`
- Modify: `_includes/comments.html`
- Modify: `_includes/header.html`

- [ ] **Step 1: 전역 focus-visible 스타일 추가**

`assets/main.scss` 상단 (body 스타일 근처):

```scss
*:focus-visible {
  outline: 2px solid $accent;
  outline-offset: 2px;
}
```

- [ ] **Step 2: aria-label 추가**

`_includes/header.html` - 검색 input:

```html
<!-- Before: -->
<input type="text" id="search-input" placeholder="검색...">
<!-- After: -->
<input type="text" id="search-input" placeholder="검색..." aria-label="블로그 검색">
```

`_includes/comments.html` - 댓글 inputs:

```html
<input type="text" id="comment-nickname" placeholder="닉네임 (선택)" maxlength="20" aria-label="댓글 닉네임">
<textarea id="comment-content" placeholder="댓글을 남겨주세요" rows="3" maxlength="1000" required aria-label="댓글 내용"></textarea>
```

- [ ] **Step 3: 커밋**

```bash
git add assets/main.scss _includes/comments.html _includes/header.html
git commit -m "[A11Y] focus-visible 스타일 및 aria-label 추가"
```

---

## 체크리스트

| Phase | Task | 내용 | 상태 |
|-------|------|------|------|
| 1 | Task 1 | Supabase DB 제약 조건 | ⬜ |
| 1 | Task 2 | comments.js 에러 핸들링 | ⬜ |
| 2 | Task 3 | search.js 정리 | ⬜ |
| 2 | Task 4 | toc.js 성능 개선 | ⬜ |
| 3 | Task 5 | 죽은 CSS 제거 | ⬜ |
| 3 | Task 6 | 디자인 개선 | ⬜ |
| 4 | Task 7 | 접근성 개선 | ⬜ |
