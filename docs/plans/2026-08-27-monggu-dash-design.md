# 「몽구랑 산책가자」 — 홈 콘솔 게임 개편 설계

**작성:** 2026-08-27 · 리서치 결과: [몽구 콘솔 개편안](https://claude.ai/code/artifact/bc7ec5ea-baa9-4b8e-81ee-e897d688055a)

**Goal:** 홈 CRT 콘솔의 우디(저작권 리스크) + Backrooms(목표 없음)를 제거하고, 우리집 셸티 **몽구**의 Chrome Dino형 측면 러너 **「몽구랑 산책가자」**(내부 코드명 `dash`)로 교체한다. 룩은 하이브리드 레트로(저해상도 픽셀 + 툰 램프 클레이 + 12fps 스텝).

**확정 사항 (2026-08-27 승인):**

| 항목 | 결정 |
|---|---|
| 게임 | 몽구 대시 (측면 러너) — 실측 렌더에서 측면 뷰만 셸티가 판독됨 |
| 룩 | 하이브리드: 내부 182×131 렌더타깃 + nearest 업스케일, 정점 스냅, MeshToon 3단 램프, Bayer 디더(약), 12fps 스텝, NoToneMapping |
| 엔진 | Three.js **0.185.1** WebGLRenderer, `/assets/vendor/three-0.185.1/`에 벤더링 + 로컬 importmap (CDN 의존 제거) |
| 타이틀 | 사용자 제작 로고 `assets/images/crt/Logo.png` (482×517, 현재 미사용 → 게임 타이틀로 사용) |
| 에셋 | `AnimMonggu.glb` → meshopt + WebP 512² = **202KB** (빌드 검증 완료, 백업: `E:/Downloads/backupglb/monggu_512_webp_meshopt.glb`) |

**기본값으로 진행하는 항목 (스펙 리뷰에서 뒤집을 수 있음):** 리더보드는 v1에서 localStorage만 · 효과음은 WebAudio 합성(에셋 0)·기본 음소거 + Y 토글 · 호두는 v1 제외(2차에 캐릭터 선택) · 대기 화면(놀아주기-lite) 포함.

---

## 1. 화면 흐름 (상태 머신)

```
OFF ──전원──▶ ATTRACT ──A/탭──▶ PLAY ──충돌──▶ GAMEOVER ──A/탭/3초──▶ PLAY
 ▲                                                        │
 └────────────────────전원──────────────────────────────────┘
```

- **OFF**: 기존 전원 토글 유지(스크린 오프 오버레이·LED).
- **ATTRACT** (대기 화면 = 놀아주기-lite): 로고 스프라이트 + "PRESS Ⓐ / TAP" 깜빡임 + `HI 00000`. 몽구는 마당을 느리게 배회하고 **head 본이 커서/터치 지점을 바라봄**, 꼬리 wag. 화면 드래그 카메라 오빗은 여기서만 허용. GLB 로딩 중에는 로고 + 실루엣 박스가 먼저 반응.
- **PLAY**: 카메라 측면 고정(약간 낮은 3/4, 리서치 이미지 B~E 사이 각), 오빗·오른스틱 비활성.
- **GAMEOVER**: 납작 squash + 'ㅠㅠ' 말풍선, 점수·HI 표시, 3초 내 재시작 가능. 실패는 웃기게.

## 2. 게임 규칙

- **점수** = 달린 거리(초당 ~10점, 5자리 `HI 01234` 표기). localStorage `monggu.best.dash` (try/catch).
- **속도 램프** (Chrome Dino 상수 이식): 시작 속도 6 → 최대 13, 점진 가속. **시작 3초 무장애.** 최고속의 2/3부터 비행 장애물 등장. **700점마다 앰버 야간 반전**(CRT 감성 팔레트 스왑).
- **장애물** (전부 procedural 박스/실린더/콘, 몽구 GLB 외 외부 에셋 없음):
  | 장애물 | 회피 동사 | 비고 |
  |---|---|---|
  | 울타리(1단/2단) | 점프 | 기본 |
  | 소화전 | 점프 | 낮고 좁음 |
  | 빨랫줄 | 숙이기 | 상단 장애 |
  | 비둘기(저공) | 점프 또는 **짖기**로 쫓기 | 짖기 쿨다운 1.5s |
  | 배달 오토바이 | 점프 | 후반, 접근 빠름(경고 클랙슨 선행) |
- **충돌**: AABB, 히트박스는 시각 크기의 ~70%(관대하게).

## 3. 입력 매핑 (기존 이벤트 재사용)

| intent | 키보드 | 게임패드 UI | 터치(CRT 화면) |
|---|---|---|---|
| 점프 (hold=높이) | Space / W / ↑ | Ⓐ, D-pad↑ | 화면 상단 ⅔ 탭·hold |
| 숙이기 (hold) | Shift / S / ↓ | Ⓑ, D-pad↓ | 화면 하단 ⅓ hold |
| 짖기 | E | Ⓧ | — (v1 터치 생략) |
| 음소거 토글 | F | Ⓨ | — |
| 일시정지 | — | TOUCH 패드 | — |
| 시작/재시작 | Space | Ⓐ | 아무 곳 탭 |

- `assets/js/dash/input.js`가 기존 `game-dpad`/`game-button`/스틱 콜백/키보드/터치를 **intent 이벤트로 변환**하는 어댑터. editable 포커스 시 무시(기존 로직 유지).
- **home.html 수정 1건**: ABXY 버튼에 release 디스패치(`mouseup`/`touchend` → `game-button-release`) 추가 — hold 점프 높이에 필요. D-pad는 이미 release('none')가 있음.
- **터치 판별**: 이동 10px 미만 = 탭. `touch-action: pan-y` 유지(세로 스크롤 보존). PLAY 중 화면 드래그 오빗 비활성이므로 충돌 없음.
- 왼스틱: flick ↑=점프, hold ↓=숙이기(보조). 오른스틱: PLAY 중 무시.

## 4. 렌더링 (하이브리드 레트로)

- 내부 `WebGLRenderTarget(182, 131, Nearest)` → 풀스크린 quad blit. 캔버스는 CSS 크기 그대로(`setPixelRatio(1)`), `image-rendering: pixelated`.
- blit 셰이더: `#include <tonemapping_fragment>` → `<colorspace_fragment>` → **Bayer 4×4 디더(강도 0.5) + 5bit 양자화**. 렌더러는 `NoToneMapping`, `antialias: false`.
- 머티리얼: 몽구·소품 모두 **MeshToonMaterial(3단 Nearest 램프)** + `onBeforeCompile`로 `#include <project_vertex>` 뒤 **정점 스냅**(격자 = 내부 해상도, w>0 가드). 몽구 텍스처 512² WebP, NearestFilter, mipmap 끔. Meshy 머티리얼 함정(emissive=baseColor 2배 밝기, specular [2,2,2], doubleSided)은 교체로 소거.
- 지면·배경: 캔버스 생성 텍스처(마당 잔디 + 골목), 낮은 담장·집 실루엣 2겹 패럴랙스, `Fog`. 몽구 아래 blob shadow(착지점 가독성).
- 애니: `mixer.update`를 1/12s 누적 스텝으로만 호출(스톱모션 감). CSS 스캔라인·롤링 밴드는 그대로 두고 셰이더 스캔라인은 넣지 않는다.

## 5. 몽구 컨트롤러 (걷기 1클립 + 프로시저럴)

클립 사실: `Armature|Unreal Take|baselayer` 1.0s, in-place(전진 성분 0), 루트 Armature scale 0.01 + 극소 메시 → **`Box3.setFromObject(model, true)`(precise)로 높이 정규화 필수**(아니면 바인드 포즈 기준으로 공중에 뜸). Hips에 상수 scale 0.9248 키 존재 → 오버라이드는 곱으로.

| 동작 | 구현 |
|---|---|
| 달리기 | 클립 `timeScale 2.2→3.0`(속도 연동) = 셸티 트롯 |
| 점프 | 클립 프리즈(앞다리 든 ~0.25s 프레임) + 루트 포물선 `y=h·4t(1−t)` + 상승 pitch −15°/하강 +10°, hold 시간→h |
| 착지 | 80ms squash `(1.12, 0.85, 1.12)` + 귀 flop |
| 숙이기 | `scale.y 0.6` + head 본 down |
| 짖기 | head pitch 펄스 + 'WOOF' 스프라이트 |
| 대기(attract) | 클립 pause + 호흡 scale ±2% + head look-at(커서) + 꼬리 4본 sin wag |

본 오버라이드는 반드시 `mixer.update()` **직후** 가산. 앉기/눕기는 클립 없인 불가 → v1 범위 밖(필요 시 Blender 수작업 + merge-clips).

## 6. 파일 구조

```
추가:
assets/vendor/three-0.185.1/        # three.module.min.js, three.core.min.js,
                                    # GLTFLoader.js, BufferGeometryUtils.js,
                                    # meshopt_decoder.module.js, SkeletonUtils.js
assets/glb/monggu.glb               # 202KB (빌드 완료본)
assets/js/dash/
  main.js       # 엔트리·상태 머신·루프(12fps 스텝·lazy init)
  pixelpass.js  # 저해상도 RT + blit(디더·양자화)·리사이즈
  materials.js  # 툰 램프·정점 스냅 패치·텍스처 필터
  dog.js        # GLB 로드·정규화·프로시저럴 애니 레이어
  track.js      # 지면·패럴랙스·스포너·충돌·점수 (순수 로직은 render 비의존)
  input.js      # 이벤트 → intent 어댑터
  hud.js        # 점수·로고·게임오버 오버레이(DOM)
  audio.js      # WebAudio 합성 SFX(점프·짖기·충돌·100점), 기본 음소거
  attract.js    # 대기 화면(놀아주기-lite)

수정:
_layouts/home.html                  # importmap 로컬 벤더 경로, dash/main.js 로드,
                                    # ABXY release 디스패치, 로고 오버레이 엘리먼트
assets/main.scss                    # #game-canvas image-rendering: pixelated, HUD 스타일

삭제:
assets/js/game.js                   # (dash/로 대체)
assets/js/backrooms-game.js
assets/js/dodge-game.js             # 레거시 미사용
assets/glb/woody_final.glb          # Disney IP — 홈 전송량 −1.44MB
```

전송량 변화(gz): 현재 three r162 비압축 259KB + woody 1.44MB ≈ **1.7MB** → three min 187KB + addons ~35KB + 게임 코드 ~15KB + monggu.glb 202KB ≈ **440KB**.

## 7. 성능·UX 위생

- 게임 모듈은 **LCP 이후 lazy init**(idle 또는 콘솔이 뷰포트 진입 시 dynamic import). 로딩 중 attract 자리에 로고+실루엣.
- `IntersectionObserver` + `visibilitychange`로 화면 밖/탭 백그라운드 시 루프 정지. `webglcontextlost/restored` 처리.
- `prefers-reduced-motion`: attract 자동 배회·회전 정지(정적 포즈), 게임은 사용자 시작 시에만 구동.
- WebGL2/GLB 실패 시: 로고 PNG 정적 포스터 + 스크린 오프 연출(콘솔이 죽은 척).
- 오디오는 첫 사용자 제스처에서 `AudioContext.resume()`(iOS 자동재생 정책), 기본 음소거.

## 8. 검증 계획

1. `track.js` 순수 로직(스폰 시퀀스·충돌·램프·점수)은 render 비의존으로 분리해 node 스모크 테스트(`scripts/dash-test.mjs`, Jekyll exclude 영역).
2. 기존 headless Chrome 하네스(playwright-core)로 데스크톱 1080p·390px 폰·iPhone SE 3해상도 스크린샷 + N프레임 시뮬 → 프레임 시간·콘솔 에러 0 확인.
3. 실기 확인(사용자): 모바일 터치 점프/숙이기, 세로 스크롤 보존, 전원/일시정지.
4. 수용 기준: 추가 전송 ≤ 450KB gz · 키보드만/터치만으로 전 기능 · 홈 Lighthouse 회귀 없음(게임 lazy) · editable 포커스 시 입력 무시 유지.

## 9. 범위 밖 (v2 후보)

Supabase 리더보드(치팅 방어 설계 필요) · 호두 캐릭터 선택(같은 리그, 파이프라인 검증됨 172KB) · 「산책길」 저각 카메라 모드 · 양몰이 "셸티 모드" · 추가 클립(Blender 수작업 idle/sit + merge-clips.mjs).

## 10. 미해결(구현 중 눈으로 결정)

- 점프 프리즈 프레임 위치(0.2~0.3s 중 실루엣이 가장 좋은 지점).
- 디더 강도·야간 반전 팔레트 수치.
- 로고 표시 방식: 482×517 PNG(336KB)를 ~360px WebP(~40KB)로 변환해 DOM 오버레이(권장) vs 캔버스 내 스프라이트.
