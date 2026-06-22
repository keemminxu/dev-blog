# daily 일기 피드 + Discord 코멘트 연동 설계

날짜: 2026-06-22
상태: 승인됨
레포: dev-blog (블로그) + assist (비서 봇) — 둘 다 수정

## 1. 목표

Discord의 #코멘트 채널에 한 줄(또는 여러 줄) 일기를 남기면, 블로그 keemminxu.com의 새 **daily** 탭에
터미널 로그 형식으로 쌓여 보인다. git 커밋/배포 없이 Supabase 읽기/쓰기로 동작한다.

부수 작업: 블로그 탭 재구성 — 기존 `daily` 카테고리 글을 `etc`로 옮기고, 최상위 daily 탭을 일기 피드로 전환.

## 2. 아키텍처

```
[Discord #코멘트] --(메시지 작성)--> 비서 봇(GCP) --(service key write)--> Blog Supabase.daily_logs
                  --(메시지 삭제)--> 비서 봇          --(service key delete)--> (해당 row 삭제)

[블로그 /daily/] --(anon key read, 페이징)--> Blog Supabase.daily_logs --> 터미널 로그 카드 렌더
```

- Blog Supabase = `mnatdbpscbvhhsxstvaq` (블로그 전용, 비서의 `desk` 프로젝트와 별개)
- 일기 저장은 LLM 호출 없이 봇이 메시지 내용을 **그대로** 기록 (즉시·무료·안정적)

## 3. 데이터 모델 — Blog Supabase에 `daily_logs` 신규 테이블

```sql
create table if not exists daily_logs (
  id bigint generated always as identity primary key,
  content text not null,
  discord_message_id text unique,        -- Discord 메시지 삭제 → 일기 삭제 매칭용
  created_at timestamptz not null default now()
);
alter table daily_logs enable row level security;
-- anon은 읽기만. 쓰기·삭제는 봇의 service role 키로만(RLS 우회).
create policy "daily_logs anon read" on daily_logs for select to anon using (true);
```

- 기존 `comments`(글별 방문자 댓글)와 완전 별개 테이블.
- `created_at`은 봇이 Discord 메시지 작성 시각으로 명시 저장(now() 대신).

## 4. 비서 봇 (assist) 변경

### 4.1 `bot/diary.py` (신규) — Blog Supabase 기록 클라이언트
- `BLOG_SUPABASE_URL`, `BLOG_SUPABASE_SERVICE_KEY`로 PostgREST 직접 호출 (httpx, supa.py와 동일 패턴).
- `add(content, discord_message_id, created_at) -> None`: `POST /rest/v1/daily_logs`.
- `delete_by_message(discord_message_id) -> None`: `DELETE /rest/v1/daily_logs?discord_message_id=eq.<id>`.

### 4.2 `bot/discord_bot.py` — #코멘트 채널 핸들러
- `on_message`: 채널이 `diary_channel_id`면 → 허용 사용자 확인 후 `diary.add(content, message.id, message.created_at)` → ✅ 리액션. (Claude 대화로 라우팅하지 않음.) 실패 시 ❌ 리액션 + 짧은 에러.
- `on_raw_message_delete`: 삭제된 메시지가 `diary_channel_id`면 → `diary.delete_by_message(payload.message_id)`. (raw 이벤트라 캐시에 없어도 동작.)
- 기존 #비서 대화 핸들러는 그대로.

### 4.3 `bot/config.py` + `.env`
- 추가: `DIARY_CHANNEL_ID`, `BLOG_SUPABASE_URL`, `BLOG_SUPABASE_SERVICE_KEY`.
- `bot/main.py`에서 `Diary(...)` 조립해 `create_client`에 주입.

### 4.4 테스트 (`tests/test_diary.py`)
- diary.add가 올바른 URL/헤더/바디로 POST하는지 (httpx MockTransport).
- delete_by_message가 `discord_message_id=eq.` 필터로 DELETE하는지.
- 채널 라우팅: diary 채널 메시지는 diary.add 호출, #비서 메시지는 대화로 — 핸들러 분기 단위 검증.

## 5. 블로그 (dev-blog) 변경

### 5.1 `/daily/` 일기 페이지 (신규)
- `daily.html` (permalink `/daily/`, layout default) — 일기 피드 컨테이너 + 페이지네이션 컨트롤. anon키·Supabase URL을 data-속성으로 노출(기존 comments.html 패턴 그대로).
- `assets/js/daily.js` (신규):
  - `GET /rest/v1/daily_logs?order=created_at.desc&limit=10&offset=<page*10>` + `Prefer: count=exact`로 전체 개수 취득 → 페이지 수 계산.
  - 터미널 로그 카드 렌더:
    ```
    > 2026.06.19 (목) 16:48 ─────────
      {content 줄들, 들여쓰기}
    ```
  - 줄바꿈은 `<br>`, HTML 이스케이프(기존 comments.js의 escapeHtml 재사용).
  - 이전/다음 버튼 + 현재/전체 페이지 표시. 0건이면 "아직 일기가 없습니다."
- `assets/css/...` — 터미널 로그 카드 스타일(블로그 네온/모노스페이스 톤에 맞춤).

### 5.2 탭 재구성 (구체)
- `_posts/2026-04-22-cutething.md`: `categories: ["daily"]` → `categories: ["etc"]` (유일한 daily 글).
  → 이후 `daily` 카테고리는 비고, etc는 글 5개(기존 4 + 1).
- `_includes/sidebar-left.html`: 최상위 `daily` 항목 링크 `/category/daily` → `/daily/`. tech>etc 자식은 유지.
- `category/daily.html`: 제거(일기 페이지 `/daily/`가 대체). `category/etc.html`은 유지.
- `_includes/category-tabs.html`: site.categories 자동 생성이라 daily 글이 없으면 자동으로 빠짐 — 별도 수정 불필요(확인만).

## 6. 페이지네이션
- 서버측: `limit=10&offset=N`, 최신순(`created_at.desc`).
- 전체 개수: 응답 `Content-Range` 헤더(`Prefer: count=exact`)에서 파싱 → 총 페이지.
- 컨트롤: ◀ 이전 / `p/total` / 다음 ▶. 첫·마지막 페이지에서 버튼 비활성.

## 7. 에러 처리
- 봇 기록 실패: ✅ 대신 ❌ 리액션 + "일기 저장 실패: 사유" 짧은 답(일기 유실 침묵 금지).
- 봇 삭제 실패: 로그만(이미 디스코드에선 지워진 상태라 사용자 흐름엔 영향 적음).
- 블로그 조회 실패: "일기를 불러오지 못했습니다." 표시.

## 8. 사용자가 할 것
- Discord에 **#코멘트(코멘트 남기기) 채널** 생성 → 채널 ID 제공.
- Blog Supabase(`mnatdbpscbvhhsxstvaq`)의 **service_role 키** 제공(봇 쓰기용, 서버 .env에만 보관).
- (봇은 #코멘트 채널에도 보기/기록읽기 권한 필요 — 기존 봇 권한으로 충분, 채널만 접근 가능하면 됨.)

## 9. 비범위 (YAGNI)
- 일기 수정(edit) — 작성+삭제만. 오타는 디스코드 메시지 지우고 다시 쓰기.
- 블로그에서 직접 일기 작성(관리자 에디터) — Discord가 유일 입력.
- 방문자에게 일기 댓글 — 기존 글별 `comments`와 별개로 두고 추가 안 함.

## 10. 손대는 파일 요약
**dev-blog:** `daily.html`(신규) · `assets/js/daily.js`(신규) · `assets/css`(카드 스타일) · `_includes/sidebar-left.html` · `category/daily.html`(삭제) · `_posts/2026-04-22-cutething.md`(카테고리)
**assist:** `bot/diary.py`(신규) · `bot/discord_bot.py` · `bot/config.py` · `bot/main.py` · `.env`/`.env.example` · `tests/test_diary.py`
**Supabase(Blog):** `daily_logs` 테이블 + RLS
