# Blog Redesign Specification

## Goal

현재 minima 테마 기반의 촌스러운 레이아웃을 미니멀하고 세련된 다크 테마 블로그로 전면 리디자인한다. minima 테마는 유지하되 모든 레이아웃을 오버라이드하여 완전한 커스텀 디자인을 구현한다.

## Reference

- **레이아웃 참고**: think-note.com (가로 카드형, 미니멀, 넓은 여백)
- **색상 톤**: 크롬 다크 모드 웜 그레이 계열
- **방향**: 다크 테마 유지 + 레이아웃/색상/글꼴 전면 변경

## Design System

### Color Palette (Stone + Amber)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#292524` (stone-900) | 페이지 배경 |
| `--surface` | `#1c1917` (stone-950) | 카드, 코드 블록 배경 |
| `--text` | `#e7e5e4` (stone-200) | 본문 텍스트 |
| `--text-muted` | `#a8a29e` (stone-400) | 날짜, 서브텍스트 |
| `--accent` | `#fbbf24` (amber-400) | 링크, 강조, 호버 |
| `--accent-hover` | `#f59e0b` (amber-500) | 링크 호버 |
| `--border` | `#44403c` (stone-700) | 구분선, 보더 |
| `--surface-hover` | `#292524` (stone-900) | 카드 호버 |

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| 본문 텍스트 | IBM Plex Sans KR | Light (300) | 16px (1rem) |
| 포스트 제목 (홈) | IBM Plex Sans KR | SemiBold (600) | 1.25rem |
| 포스트 제목 (상세) | IBM Plex Sans KR | SemiBold (600) | 2rem |
| 헤더 블로그명 | IBM Plex Sans KR | SemiBold (600) | 1.25rem |
| 헤더 소제목 | IBM Plex Sans KR | Light (300) | 0.85rem |
| 네비게이션 | IBM Plex Sans KR | Medium (500) | 0.9rem |
| 태그 뱃지 | IBM Plex Sans KR | Medium (500) | 0.75rem |
| 날짜/메타 | IBM Plex Sans KR | Light (300) | 0.85rem |
| 코드 블록 | JetBrains Mono | Regular (400) | 0.9rem |
| 인라인 코드 | JetBrains Mono | Regular (400) | 0.85rem |
| 푸터 텍스트 | IBM Plex Sans KR | Medium (500) / Light (300) | 0.85rem |

Font loading (Google Fonts):
```
IBM Plex Sans KR: weights 300, 500, 600
JetBrains Mono: weight 400
```

## Layout Components

### Header

```
┌─────────────────────────────────────────────────────────────┐
│ ┌────┐  Keemminxu's Dev Blog [SemiBold]          Tags       │
│ │프로필│  언리얼 엔진 & 게임 개발 기술 블로그 [Light, muted]   │
│ └────┘                                                      │
├─────────────────────────────────────────────────────────────┤
```

- 프로필 이미지: 48px 원형 (border-radius: 50%), 블로그명 왼쪽
- 이미지 파일: `assets/profile/250x250.png`
- 로고(블로그명) + 소제목 프로필 옆, 네비게이션 우측
- 소제목은 블로그명 아래 muted 색상으로
- 하단 1px 보더 (`--border`)
- 모바일: 햄버거 메뉴 (Tags 링크만이라 간단)
- `header_pages`에서 privacy-policy.md 제거

### Homepage (home.html)

```
┌─────────────────────────────────────────────────────────────┐
│ [All]  [Unreal Engine]  [DevOps]  [Mobile]  ← 카테고리 탭   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌──────────┐  제목제목제목 [SemiBold]                        │
│ │ OG 썸네일 │  2026-03-24 · mobile [Light, muted]           │
│ │ (240x126) │  발췌문 텍스트가 여기에 표시됩니다...            │
│ └──────────┘  [Light]                                       │
│                                                             │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                             │
│ ┌──────────┐  제목제목제목 [SemiBold]                        │
│ │ OG 썸네일 │  2026-03-18 · unreal-engine [Light, muted]    │
│ │ (240x126) │  발췌문 텍스트...                               │
│ └──────────┘  [Light]                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- **카테고리 탭**: "All" = 홈(`/`), 나머지 = `/category/NAME/` 링크 (SEO 하이브리드)
- **카드 레이아웃**: OG 이미지(240x126) 좌측 + 제목/메타/발췌문 우측
- OG 이미지 경로: `/assets/og/{slug}.png`
- 카드 호버: 약간의 배경색 변화 또는 제목 액센트 색상
- 포스트는 최신순 (site.posts 기본 순서)
- **모바일**: 카드 세로 배치 (썸네일 위 → 텍스트 아래)

### Post Page (post.html)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│ UE5 iOS에서 AdMob SDK가 크래시를 일으키는 이유와 해결 과정     │
│ [SemiBold, 2rem]                                            │
│                                                             │
│ 2026-03-18 · unreal-engine  [Light, muted]                  │
│ [ue5] [ios] [admob] [memory-allocator] [crash]  ← 태그 뱃지 │
│                                                             │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                             │
│ 본문 내용 [Light, 1rem, line-height 1.8]                     │
│ 코드 블록 [JetBrains Mono, surface 배경, 둥근 모서리]         │
│ 이미지 [중앙 정렬, border-radius 8px]                        │
│                                                             │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                             │
│ 관련 포스트 [Medium]                                         │
│  · 포스트 제목 1                                              │
│  · 포스트 제목 2                                              │
│  · 포스트 제목 3                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- 본문 max-width: 720px, 중앙 정렬
- line-height: 1.8 (가독성)
- 코드 블록: `--surface` 배경, border-radius 8px, padding 20px
- 구문 강조: stone 계열에 맞는 색상 (기존 Gruvbox 하이라이트 색상 조정)
- 이미지: max-width 100%, border-radius 8px
- 태그 뱃지: `--surface` 배경, 클릭 시 `/tag/NAME/` 이동
- 관련 포스트: 기존 related-posts.html 유지, 스타일만 변경

### Tag Index Page (tags.html)

- 태그 클라우드: 뱃지 스타일 (`--surface` 배경, 호버 시 `--accent`)
- 태그별 포스트 목록: 심플 리스트 (날짜 + 제목)
- 전체적으로 홈페이지와 동일한 톤

### Individual Tag/Category Pages

- 홈페이지와 동일한 카드형 레이아웃 적용
- 카테고리 페이지: 상단에 카테고리 탭 유지 (현재 카테고리 활성화 표시)

### Footer

```
┌─────────────────────────────────────────────────────────────┐
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                             │
│              Keemminxu's Dev Blog [Medium]                   │
│      언리얼 엔진 & 게임 개발 기술 블로그 [Light, muted]       │
│                                                             │
│              [GitHub icon]  [LinkedIn icon]                   │
│                                                             │
│       © 2026 Keemminxu · Privacy Policy [Light, muted]      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- 중앙 정렬
- GitHub: https://github.com/keemminxu
- LinkedIn: https://www.linkedin.com/in/keemminxu/
- Privacy Policy: `/privacy-policy/` 링크 (작고 muted)
- 소셜 아이콘: SVG inline (외부 의존성 없음)

## Responsive Design

### Breakpoints
- **Desktop**: > 768px — 가로 카드, 헤더 네비 표시
- **Mobile**: ≤ 768px — 세로 카드, 햄버거 메뉴

### Mobile-specific
- 카드: 썸네일 상단 (100% 너비) → 텍스트 하단
- 헤더: 블로그명 + 햄버거 아이콘
- 푸터: 동일 (이미 중앙 정렬)
- 본문: padding 축소 (20px)

## Files to Create/Modify

### Override Layouts (minima 오버라이드)
- `_layouts/default.html` — 새로 생성 (전체 HTML 구조, 헤더/푸터 포함)
- `_layouts/home.html` — 새로 생성 (카드형 포스트 리스트 + 카테고리 탭)
- `_layouts/post.html` — 수정 (새 디자인 적용)
- `_layouts/page.html` — 새로 생성 (일반 페이지용)
- `_layouts/tag.html` — 수정 (카드형 레이아웃 적용)

### Includes
- `_includes/head.html` — 수정 (폰트 변경: IBM Plex Sans KR + JetBrains Mono)
- `_includes/header.html` — 새로 생성 (커스텀 헤더)
- `_includes/footer.html` — 새로 생성 (커스텀 푸터 + 소셜 링크)
- `_includes/post-card.html` — 새로 생성 (재사용 가능한 카드 컴포넌트)
- `_includes/category-tabs.html` — 새로 생성 (카테고리 탭 컴포넌트)
- `_includes/related-posts.html` — 유지 (스타일만 변경)

### Styles
- `assets/main.scss` — 전면 재작성 (기존 Gruvbox 제거, stone+amber 적용)

### Config
- `_config.yml` — `header_pages` 수정 (privacy-policy 제거)

### Category Pages
- `category/unreal-engine.html` — 카드형 레이아웃 적용
- `category/devops.html` — 카드형 레이아웃 적용
- `category/mobile.html` — 카드형 레이아웃 적용

## Constraints

- GitHub Pages 호환 (커스텀 플러그인 불가)
- `theme: minima` 유지 (gem 기반, 레이아웃 오버라이드로 커스터마이징)
- 외부 JS 라이브러리 미사용 (바닐라 JS만, 햄버거 메뉴용)
- 소셜 아이콘은 SVG inline (Font Awesome 등 외부 의존성 없음)
- 기존 SEO 구조 유지 (OG 태그, sitemap, robots.txt)
- 기존 포스트 front matter 변경 없음
